#!/usr/bin/env node

const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const multer = require("multer");
const os = require("os");
const path = require("path");
const QRCode = require("qrcode");

const app = express();
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const UPLOAD_DIR = path.join(ROOT_DIR, "uploads");
const PORT = Number(process.env.PORT) || 3000;
const MAX_FILE_SIZE = Number(process.env.BYTEDROP_MAX_FILE_SIZE) || 250 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = Number(process.env.BYTEDROP_MAX_FILES_PER_REQUEST) || 20;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  );
  next();
});

app.use(express.static(PUBLIC_DIR, {
  dotfiles: "deny",
  etag: true,
  index: "index.html",
  maxAge: "1h",
}));

function sanitizeOriginalName(name) {
  const base = path.basename(name || "file");
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);

  return cleaned || "file";
}

function isManagedFileName(name) {
  return /^[a-f0-9]{16}-[\w.\- ]{1,120}$/.test(name);
}

function resolveUploadPath(name) {
  if (!isManagedFileName(name)) return null;

  const resolved = path.resolve(UPLOAD_DIR, name);
  return resolved.startsWith(UPLOAD_DIR + path.sep) ? resolved : null;
}

function getFileList() {
  return fs.readdirSync(UPLOAD_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile() && isManagedFileName(entry.name))
    .map(entry => {
      const filePath = path.join(UPLOAD_DIR, entry.name);
      const stats = fs.statSync(filePath);
      return {
        name: entry.name,
        displayName: entry.name.replace(/^[a-f0-9]{16}-/, ""),
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        downloadUrl: `/download/${encodeURIComponent(entry.name)}`,
      };
    })
    .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const token = crypto.randomBytes(8).toString("hex");
    cb(null, `${token}-${sanitizeOriginalName(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_PER_REQUEST,
  },
});

app.post("/upload", upload.array("files", MAX_FILES_PER_REQUEST), (req, res) => {
  res.status(201).json({ files: req.files.map(file => file.filename) });
});

app.get("/files", (_req, res) => {
  res.json(getFileList());
});

app.get("/download/:name", (req, res) => {
  const filePath = resolveUploadPath(req.params.name);
  if (!filePath || !fs.existsSync(filePath)) {
    res.sendStatus(404);
    return;
  }

  res.download(filePath, req.params.name.replace(/^[a-f0-9]{16}-/, ""));
});

app.get("/receive", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "receive.html"));
});

app.delete("/clear", (_req, res) => {
  for (const file of getFileList()) {
    const filePath = resolveUploadPath(file.name);
    if (filePath) fs.unlinkSync(filePath);
  }

  res.sendStatus(204);
});

app.delete("/delete/:name", (req, res) => {
  const filePath = resolveUploadPath(req.params.name);
  if (!filePath || !fs.existsSync(filePath)) {
    res.sendStatus(404);
    return;
  }

  fs.unlinkSync(filePath);
  res.sendStatus(204);
});

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

const IP = getLocalIP();
const BASE_URL = `http://${IP}:${PORT}`;
const QR_URL = `${BASE_URL}/receive`;

app.get("/qr", async (_req, res, next) => {
  try {
    const qr = await QRCode.toDataURL(QR_URL, {
      color: {
        dark: "#101010",
        light: "#ffffff",
      },
      margin: 1,
      width: 320,
    });
    res.json({ url: QR_URL, qr });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});

app.listen(PORT, () => {
  console.log(`
ByteDrop started

Laptop: ${BASE_URL}
Phone:  ${QR_URL}

Open the laptop URL to upload files, then scan the QR code from your phone.
Press Ctrl+C to stop.
`);
});
