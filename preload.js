const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proctorAPI', {
  getStatus: () => ipcRenderer.invoke('get-status'),
  getDetections: () => ipcRenderer.invoke('get-detections'),

  onSignal: (callback) => {
    const handler = (_event, signal) => callback(signal);
    ipcRenderer.on('signal', handler);
    return () => ipcRenderer.removeListener('signal', handler);
  },

  onScoreUpdate: (callback) => {
    const handler = (_event, score) => callback(score);
    ipcRenderer.on('score-update', handler);
    return () => ipcRenderer.removeListener('score-update', handler);
  },

  onBrowserConnected: (callback) => {
    const handler = (_event, connected) => callback(connected);
    ipcRenderer.on('browser-connected', handler);
    return () => ipcRenderer.removeListener('browser-connected', handler);
  },

  onStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('status', handler);
    return () => ipcRenderer.removeListener('status', handler);
  },

  onSessionStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('session-status', handler);
    return () => ipcRenderer.removeListener('session-status', handler);
  },

  onPreCheckBlockers: (callback) => {
    const handler = (_event, apps) => callback(apps);
    ipcRenderer.on('pre-check-blockers', handler);
    return () => ipcRenderer.removeListener('pre-check-blockers', handler);
  },
});
