const page = document.body.dataset.page;
const filesEl = document.getElementById("files");
const statusEl = document.getElementById("status");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const clearBtn = document.getElementById("clearBtn");
const fileInput = document.getElementById("fileInput");
const drop = document.getElementById("drop");
let lastFilesSignature = null;

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function createButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `file-action ${className || ""}`.trim();
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

async function uploadFiles(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;

  const form = new FormData();
  files.forEach(file => form.append("files", file));
  setStatus(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}...`);

  const response = await fetch("/upload", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Upload failed");
  }

  setStatus("Upload complete.");
  await loadFiles();
}

function renderEmpty() {
  const empty = document.createElement("div");
  empty.className = "empty";
  empty.textContent = page === "receive"
    ? "Waiting for shared files. Keep this tab open and they will appear automatically."
    : "Nothing shared yet. Drop files above or choose them from your computer.";
  filesEl.replaceChildren(empty);
}

function getFilesSignature(files) {
  return files.map(file => `${file.name}:${file.size}:${file.modifiedAt}`).join("|");
}

function renderFiles(files) {
  const cards = files.map(file => {
    const card = document.createElement("article");
    card.className = "file-card";

    const details = document.createElement("div");
    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = file.displayName || file.name;

    const meta = document.createElement("span");
    meta.className = "file-meta";
    meta.textContent = `${formatBytes(file.size)} shared ${new Date(file.modifiedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    details.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "file-actions";
    actions.append(createButton("Download", "", () => {
      window.location.href = file.downloadUrl;
    }));

    if (page === "send") {
      actions.append(createButton("Delete", "danger", async () => {
        await fetch(`/delete/${encodeURIComponent(file.name)}`, { method: "DELETE" });
        await loadFiles();
      }));
    }

    card.append(details, actions);
    return card;
  });

  filesEl.replaceChildren(...cards);
}

async function loadFiles() {
  const response = await fetch("/files", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load files");

  const files = await response.json();
  const hasFiles = files.length > 0;
  const signature = getFilesSignature(files);

  if (clearBtn) clearBtn.hidden = !hasFiles;
  if (downloadAllBtn) {
    downloadAllBtn.hidden = !hasFiles;
    downloadAllBtn.textContent = `Download all (${files.length})`;
    downloadAllBtn.onclick = () => {
      files.forEach((file, index) => {
        setTimeout(() => window.open(file.downloadUrl, "_blank", "noopener"), index * 250);
      });
    };
  }

  setStatus(hasFiles
    ? `${files.length} file${files.length === 1 ? "" : "s"} ready.`
    : page === "receive" ? "Waiting for shared files..." : "Ready when you are.");

  if (signature === lastFilesSignature) return;
  lastFilesSignature = signature;

  if (hasFiles) renderFiles(files);
  else renderEmpty();
}

async function loadQr() {
  const qrBox = document.getElementById("qrBox");
  const link = document.getElementById("link");
  if (!qrBox || !link) return;

  const response = await fetch("/qr", { cache: "no-store" });
  const data = await response.json();

  const image = document.createElement("img");
  image.src = data.qr;
  image.alt = "QR code for the ByteDrop receive page";

  qrBox.replaceChildren(image);
  link.textContent = data.url;
  link.href = data.url;
}

if (fileInput) {
  fileInput.addEventListener("change", async () => {
    try {
      await uploadFiles(fileInput.files);
      fileInput.value = "";
    } catch (error) {
      setStatus(error.message);
    }
  });
}

if (drop) {
  ["dragenter", "dragover"].forEach(eventName => {
    drop.addEventListener(eventName, event => {
      event.preventDefault();
      drop.classList.add("is-active");
    });
  });

  ["dragleave", "drop"].forEach(eventName => {
    drop.addEventListener(eventName, event => {
      event.preventDefault();
      drop.classList.remove("is-active");
    });
  });

  drop.addEventListener("drop", async event => {
    try {
      await uploadFiles(event.dataTransfer.files);
    } catch (error) {
      setStatus(error.message);
    }
  });

  window.addEventListener("dragover", event => event.preventDefault());
  window.addEventListener("drop", event => event.preventDefault());
}

if (clearBtn) {
  clearBtn.addEventListener("click", async () => {
    await fetch("/clear", { method: "DELETE" });
    await loadFiles();
  });
}

loadQr().catch(() => setStatus("Could not load the QR code."));
loadFiles().catch(() => setStatus("Could not load shared files."));
setInterval(() => {
  loadFiles().catch(() => setStatus("Could not refresh shared files."));
}, 2500);
