const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const { SignalAggregator } = require("./src/aggregator");
const { WebSocketServer } = require("./src/server/ws-server");
const { ProcessScanner } = require("./src/detection/process-scanner");
const { FilesystemChecker } = require("./src/detection/filesystem-checker");
const { ClipboardMonitor } = require("./src/detection/clipboard-monitor");
const { NetworkMonitor } = require("./src/detection/network-monitor");
const { DisplayMonitor } = require("./src/detection/display-monitor");
const { ExtensionScanner } = require("./src/detection/extension-scanner");
const { BackendReporter } = require("./src/reporting/backend-reporter");

const WS_PORT = 18329;
const ASSESSMENT_BASE_URL = "http://localhost:3000";

let mainWindow = null;
let aggregator = null;
let wsServer = null;
let reporter = null;
let sessionId = null;

// Detection modules
let processScanner = null;
let filesystemChecker = null;
let clipboardMonitor = null;
let networkMonitor = null;
let displayMonitor = null;
let extensionScanner = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 720,
    resizable: true,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0f1117",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function initAggregator() {
  aggregator = new SignalAggregator();

  aggregator.on("signal", (signal) => {
    sendToRenderer("signal", signal);
    if (reporter) {
      reporter.enqueueSignal(signal);
    }
  });

  aggregator.on("score-update", (score) => {
    sendToRenderer("score-update", score);
  });
}

function initDetectionModules() {
  const emitSignal = (signal) => aggregator.ingest(signal);

  // Process scanner - polls for AI tools, screen sharing, etc.
  processScanner = new ProcessScanner(emitSignal);
  processScanner.start();

  // Filesystem checker - checks for installed cheating apps
  filesystemChecker = new FilesystemChecker(emitSignal);
  filesystemChecker.runOnce();

  // Clipboard monitor - polls clipboard for suspicious content
  clipboardMonitor = new ClipboardMonitor(emitSignal);
  clipboardMonitor.start();

  // Network monitor - checks for connections to AI services
  networkMonitor = new NetworkMonitor(emitSignal);
  networkMonitor.start();

  // Display monitor - detects multiple displays
  displayMonitor = new DisplayMonitor(emitSignal, screen);
  displayMonitor.start();

  // Extension scanner - scans browser extension directories
  extensionScanner = new ExtensionScanner(emitSignal);
  extensionScanner.runOnce();
}

function initWebSocketServer() {
  wsServer = new WebSocketServer(WS_PORT, (signal) => {
    aggregator.ingest({ ...signal, source: "browser" });
  });

  wsServer.on("client-connected", () => {
    sendToRenderer("browser-connected", true);
  });

  wsServer.on("client-disconnected", () => {
    sendToRenderer("browser-connected", false);
  });

  wsServer.start();
}

function initReporter() {
  reporter = new BackendReporter({
    baseUrl: ASSESSMENT_BASE_URL,
  });
  reporter.start();
}

/**
 * Run pre-check: collect blocking apps from the initial signals
 * already gathered by detection modules, then drive the session
 * through pre_check → ready.
 */
async function runPreCheckAndReady() {
  // Tell assessment we're running pre-checks
  sendToRenderer("session-status", "pre_check");
  await reporter.updateStatus("pre_check");

  // Give detection modules a moment to finish initial scans
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Collect any critical signals that are "blockers"
  const allSignals = aggregator.getRecentSignals(200);
  const blockerSignals = allSignals.filter(
    (s) =>
      s.type === "process-detected" &&
      (s.severity === "critical" || s.severity === "high"),
  );
  const blockerApps = blockerSignals
    .map((s) => s.metadata?.processName)
    .filter(Boolean);

  if (blockerApps.length > 0) {
    // Report blockers — assessment app shows "please close these apps"
    await reporter.updateStatus("pre_check", {
      blocker: true,
      apps: [...new Set(blockerApps)],
    });
    sendToRenderer("session-status", "pre_check_blocking");
    sendToRenderer("pre-check-blockers", [...new Set(blockerApps)]);
  } else {
    // All clear — move to ready
    await reporter.updateStatus("ready");
    sendToRenderer("session-status", "ready");
  }
}

// ── IPC Handlers ──────────────────────────────────────

ipcMain.handle("pair", async (_event, pairingCode) => {
  if (!reporter) return { error: "Reporter not initialized" };

  const result = await reporter.pair(pairingCode);
  if (result.error) {
    return { error: result.error };
  }

  sessionId = result.sessionId;
  sendToRenderer("session-status", "paired");

  // Start the pre-check → ready flow
  runPreCheckAndReady();

  return { sessionId: result.sessionId, status: result.status };
});

ipcMain.handle("get-status", () => {
  return {
    wsPort: WS_PORT,
    sessionId,
    browserConnected: wsServer ? wsServer.hasClients() : false,
    signalCount: aggregator ? aggregator.getSignalCount() : 0,
    score: aggregator ? aggregator.getScore() : 100,
    signals: aggregator ? aggregator.getRecentSignals(50) : [],
  };
});

ipcMain.handle("get-detections", () => {
  return aggregator ? aggregator.getRecentSignals(100) : [];
});

// ── App Lifecycle ─────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  initAggregator();
  initDetectionModules();
  initWebSocketServer();
  initReporter();

  sendToRenderer("status", { ready: true, wsPort: WS_PORT });
});

app.on("window-all-closed", () => {
  if (processScanner) processScanner.stop();
  if (clipboardMonitor) clipboardMonitor.stop();
  if (networkMonitor) networkMonitor.stop();
  if (displayMonitor) displayMonitor.stop();
  if (wsServer) wsServer.stop();
  if (reporter) reporter.stop();
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
