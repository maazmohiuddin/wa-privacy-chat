# WA Privacy Chat

A privacy-first WhatsApp desktop client for Windows. Chat with one contact — everything masked by default, nothing exposed at a glance.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Version](https://img.shields.io/github/v/release/maazmohiuddin/wa-privacy-chat)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Single-contact focus** — mapped to one WhatsApp number, no distractions
- **Message masking** — all messages shown as `••••••` by default, click to reveal
- **Hidden sender** — no names or numbers visible, just `>>` and `<<` arrows
- **PIN or pattern lock** — lock screen with 3×3 pattern grid or numeric PIN
- **Auto-lock** — locks after 8 seconds of idle or when the window loses focus
- **Screen capture protection** — blocked from screenshots and screen recording
- **Image support** — images hidden under `[hidden image]` tag, click to reveal
- **7 color themes** — green, cyan, blue, purple, red, amber, white
- **Notification sound** — subtle audio ping on incoming messages
- **Scheduled send** — send a message at a specific time or after a delay
- **Auto-update** — silently downloads updates in the background, installs on restart
- **No re-login after updates** — WhatsApp session persists across installs and updates
- **Frameless terminal UI** — minimal, monospace, dark — looks like a console

---

## Download

👉 **[Latest Release](https://github.com/maazmohiuddin/wa-privacy-chat/releases/latest)**

Download `WA Single Chat Setup x.x.x.exe`, run it, enter the phone number you want to chat with, and scan the QR code with WhatsApp on your phone. That's it.

No Node.js or npm required — Chromium is bundled.

---

## How it works

Built on [Electron](https://www.electronjs.org/) and [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js). The app runs a headless WhatsApp Web session locally on your machine — no servers, no cloud, no data leaves your device except to WhatsApp's own infrastructure.

Session data is stored at `%APPDATA%\wa-single-chat\` and survives updates and reinstalls.

---

## Privacy model

| What is hidden | How |
|---|---|
| Message content | Masked as dots until clicked |
| Sender identity | Replaced with `>>` / `<<` arrows |
| Images | Covered with `[hidden image]` overlay |
| Screen recording | `setContentProtection(true)` blocks capture |
| Idle exposure | Auto-locks after 8s of inactivity |
| Focus loss | Blurs and locks when window loses focus |

---

## Building from source

```bash
git clone https://github.com/maazmohiuddin/wa-privacy-chat.git
cd wa-privacy-chat
npm install
```

You also need to download Chromium into `chromium/chrome-win64/`:
```
npx @puppeteer/browsers install chrome@stable --path ./chromium
```

Then run in dev mode:
```bash
npm start
```

Or build the installer:
```bash
set CSC_IDENTITY_AUTO_DISCOVERY=false
npm run dist
```

---

## Auto-update

Releases are hosted on GitHub. Installed versions automatically check for updates on launch and show a banner when one is available. One click restarts and installs.

---

## License

MIT
