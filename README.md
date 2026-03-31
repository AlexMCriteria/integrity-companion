# Integrity Companion

An Electron-based proctoring companion app that monitors OS-level activity during online assessments. It detects suspicious processes, applications, browser extensions, clipboard activity, network connections, and display configurations — then reports signals to a paired assessment application in real time.

## Prerequisites

- **Node.js 18+** (for the Electron app)
- **npm** (included with Node.js)

## Installation

```bash
git clone https://github.com/AlexMCriteria/integrity-companion.git
cd integrity-companion
npm install
```

## Running the App

```bash
npm start
```

This launches the Electron app with two views:

- **Candidate tab** — Clean, minimal view the test-taker sees. Includes a pairing code input to connect with the assessment app.
- **Debug tab** — Detailed detection dashboard with integrity score, signal feed, and connection status (for internal use).

## How It Works

### Pairing with the Assessment App

1. The candidate opens the assessment in their browser (e.g. `http://localhost:3000`)
2. The assessment app displays a **6-digit pairing code**
3. The candidate enters the code in the Electron app's Candidate tab and clicks **Connect**
4. The Electron app pairs with the session, runs a system pre-check, and begins monitoring

### Detection Modules

The app runs six OS-level detection modules:

| Module | What it detects |
|---|---|
| **Process Scanner** | Running AI tools (Claude, ChatGPT, Cluely), screen sharing, VMs |
| **Filesystem Checker** | Installed cheating applications in known paths |
| **Clipboard Monitor** | Suspicious clipboard content, rapid changes, large pastes |
| **Network Monitor** | Active connections to AI services and remote access tools |
| **Display Monitor** | Multiple displays and display configuration changes |
| **Extension Scanner** | Suspicious browser extensions (AI assistants, cheating aids) |

### Signal Flow

1. Detection modules emit signals to the **Signal Aggregator**
2. The aggregator scores signals by severity and computes an integrity score (0–100)
3. Signals are forwarded to the assessment app via `POST /api/session/{id}/signal`
4. The assessment app's browser receives updates in real time via Server-Sent Events (SSE)

### WebSocket Server

A local WebSocket server runs on `ws://localhost:18329` for direct browser-to-Electron communication (e.g. confirming the companion app is running).

## Project Structure

```
integrity-companion/
├── main.js                          # Electron main process
├── preload.js                       # Context bridge (IPC → renderer)
├── package.json
├── renderer/
│   ├── index.html                   # App UI (Candidate + Debug tabs)
│   ├── renderer.js                  # UI logic and event handling
│   └── styles.css                   # Styling
├── src/
│   ├── aggregator.js                # Signal aggregation + scoring
│   ├── detection/
│   │   ├── process-scanner.js       # Running process detection
│   │   ├── filesystem-checker.js    # Installed app detection
│   │   ├── clipboard-monitor.js     # Clipboard monitoring
│   │   ├── network-monitor.js       # Network connection detection
│   │   ├── display-monitor.js       # Multi-display detection
│   │   └── extension-scanner.js     # Browser extension scanning
│   ├── reporting/
│   │   └── backend-reporter.js      # HTTP API client for assessment app
│   └── server/
│       └── ws-server.js             # Local WebSocket server
└── snippet/
    └── proctor-snippet.js           # Browser-side JS snippet (standalone use)
```

## Integration API

The Electron app communicates with the assessment backend at `http://localhost:3000` using these endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/session/pair` | POST | Pair with a session using a 6-digit code |
| `/api/session/{id}/status` | POST | Update session status (paired → pre_check → ready) |
| `/api/session/{id}/signal` | POST | Report a detection signal |

## Development

```bash
# Run with DevTools open
npx electron . --inspect
```
