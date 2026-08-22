// Bridge between Electron main process and the React app.
// Exposes a minimal, safe API on window.desktopAPI
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
    isDesktop: true,
    platform: process.platform,
    version: process.versions.electron,
    listPrinters: () => ipcRenderer.invoke("misk:list-printers"),
    getSettings: () => ipcRenderer.invoke("misk:get-settings"),
    setSettings: (patch) => ipcRenderer.invoke("misk:set-settings", patch),
    silentPrint: (payload) => ipcRenderer.invoke("misk:silent-print", payload),
    onUpdateAvailable: (cb) => ipcRenderer.on("misk:update-available", cb),
});
