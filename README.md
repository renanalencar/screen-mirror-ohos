# ScreenMirror - Screen Mirroring from Mobile to PC

Real-time screen mirroring from a mobile phone to a PC browser, based on WebRTC and OpenHarmony.

*Note: This project is based on the [harmony-OS-screen-mirror](https://github.com/jm1121985/harmony-OS-screen-mirror) project.*

## Features

- Real-time mobile screen capture (via getDisplayMedia)
- H.264 hardware encoding, 720p/1080p adaptive
- PC browser reception, supporting fullscreen, fill, and rotation
- Low latency on local network (< 200ms)
- Robust signaling server with keep-alive heartbeats and automatic dead-session eviction

## Architecture

```
Mobile (HarmonyOS App) --WebRTC--> PC Browser
                    |
              Signaling Server (Node.js WebSocket)
```

## Dependencies

### Mobile

- DevEco Studio 5.0+
- HarmonyOS SDK API 12+
- [@ohos/webrtc](https://ohpm.openharmony.cn/#/en/detail/@ohos%2Fwebrtc) OHPM package

### Signaling Server

- Node.js 18+
- npm install ws

### PC Receiver

- Chrome / Edge browser (with WebRTC support)

## Quick Start

### 1. Install Dependencies

```bash
ohpm install
```

### 2. Start Signaling Server and Receiver

```bash
# Initialize submodules (if not already present)
git submodule sync
git submodule update --init --recursive

cd signaling-server
npm install
cd ..
# Start the signaling server:
node signaling-server/server.js
# Or use start.bat on Windows
```

### 3. Deploy Mobile App

1. Open this project in DevEco Studio
2. Sync the project with Hvigor to fetch OHPM dependencies
3. Sign → Run on physical device

### 4. Start Mirroring

1. Ensure mobile and PC are on the same WiFi
2. Open web-receiver/index.html in PC browser
3. Open the App on mobile → Click "Start Mirroring"
4. The mobile screen will appear on the PC

## Shortcuts

| Key | Function |
|------|------|
| F | Toggle Fullscreen |
| R | Rotate 90° |
| C | Toggle Fill/Adaptive |
| Double-click video | Fullscreen |

## File Description

| Directory | Description |
|------|------|
| entry/ | HarmonyOS App Source Code (ArkTS) |
| signaling-server/ | WebSocket Signaling Server |
| web-receiver/ | PC Browser Receiver Page |
| start.bat | One-click Start Script |

Note: `signaling-server/` and `web-receiver/` are now configured as git submodules. If this repository previously contained copies of those folders, they were backed up to `signaling-server.orig/` and `web-receiver.orig/`.

## Start Script

A convenience script is provided to initialize submodules, back up any existing non-submodule folders, install the signaling server dependencies, and run the server.

Run the script on macOS/Linux:

```bash
chmod +x scripts/start-submodules-and-server.sh
./scripts/start-submodules-and-server.sh
```

The script is located at [scripts/start-submodules-and-server.sh](scripts/start-submodules-and-server.sh).

## Screenshots

See [docs/screenshots/](docs/screenshots/)

## License

MIT License

## Acknowledgements

- [@ohos/webrtc](https://ohpm.openharmony.cn/#/en/detail/@ohos%2Fwebrtc) — OpenHarmony WebRTC SDK
- Google WebRTC — Underlying Audio/Video Engine
- OpenHarmony — Operating System Platform
