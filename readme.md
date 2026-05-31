# ByteDrop

ByteDrop is a tiny local-network file drop for moving files from your computer to nearby devices on the same Wi-Fi. Start it, open the desktop page, scan the QR code from your phone, and download the shared files directly from your machine.

No accounts. No cloud storage. No public upload service.

## Highlights

- QR-powered receive page for phones and tablets
- Drag-and-drop or file picker uploads from the desktop page
- Live file list refresh on both sender and receiver screens
- One-click individual downloads or batch download opening
- Clear and delete controls for the sender
- Hardened local file handling with safe filenames, bounded upload size, and path validation
- Security headers for the static UI

## Requirements

- Node.js 18 or newer
- Devices connected to the same trusted local network

## Install

Run without installing globally:

```bash
npx byte-drop
```

Or install this checkout locally:

```bash
npm install
npm start
```

If installed globally:

```bash
npm install -g byte-drop
byte-drop
```

## Usage

1. Start ByteDrop:

```bash
npm start
```

2. Open the laptop URL printed in the terminal, usually:

```text
http://192.168.x.x:3000
```

3. Drop or choose files on the desktop page.

4. Scan the QR code from your phone, or open:

```text
http://192.168.x.x:3000/receive
```

5. Download files on the receiving device.

Uploaded files are stored in the local `uploads/` folder and are ignored by git.

## Configuration

ByteDrop uses conservative defaults, and you can tune them with environment variables:

| Variable | Default | Purpose |
| --- | ---: | --- |
| `PORT` | `3000` | HTTP port for the local server |
| `BYTEDROP_MAX_FILE_SIZE` | `262144000` | Maximum size per file in bytes, 250 MB by default |
| `BYTEDROP_MAX_FILES_PER_REQUEST` | `20` | Maximum files accepted in one upload request |

PowerShell example:

```powershell
$env:PORT="4000"
$env:BYTEDROP_MAX_FILE_SIZE="104857600"
npm start
```

## Security Notes

ByteDrop is designed for trusted local networks, not the public internet. Anyone on the same reachable network who can open the ByteDrop URL can view and download files while the server is running.

This version includes:

- Generated storage names to avoid trusting user-provided filenames
- Filename sanitization and strict route validation
- Resolved-path checks for download and delete operations
- Upload count and file-size limits
- Hidden Express implementation header
- Content Security Policy and basic browser hardening headers
- Static file serving that denies dotfiles

Recommended use:

- Run it only on private networks you trust.
- Stop the server when sharing is done.
- Delete files from the UI when they should no longer be available.
- Avoid exposing the port through router forwarding, tunnels, or public hosting.

Run an npm dependency audit with:

```bash
npm run audit
```

## Project Structure

```text
server.js             Express server, upload handling, QR endpoint
public/index.html     Sender interface
public/receive.html   Receiver interface
public/styles.css     Shared visual system
public/app.js         Shared client behavior
uploads/              Runtime file storage, ignored by git
```

## License

MIT
