// العرّاب (Al-Arraab) — Electron main process
// Handles: window creation, silent printing to configured printer, auto-update, IPC.
const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require("electron");
const path = require("path");
const Store = require("electron-store");
const { autoUpdater } = require("electron-updater");

// -------- Persistent store (per-machine settings) --------
const store = new Store({
    name: "al-arraab-settings",
    defaults: {
        appUrl: process.env.AL_ARRAAB_URL || "https://al3rab.shop",
        printerName: "",
        paperSize: "80mm",
        autoPrint: true,
        copies: 1,
        openDrawer: false,
        autoLaunch: true,
    },
});

// -------- Auto-launch on system boot --------
function applyAutoLaunch() {
    if (process.platform === "linux") return; // handled via .desktop file
    app.setLoginItemSettings({
        openAtLogin: !!store.get("autoLaunch"),
        openAsHidden: false,
    });
}

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: "العرّاب — Al-Arraab",
        backgroundColor: "#0f172a",
        icon: path.join(__dirname, "build", "icon.png"),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            spellcheck: false,
        },
    });

    // Remove default menu, keep only DevTools shortcut in dev.
    Menu.setApplicationMenu(null);

    const url = store.get("appUrl");
    mainWindow.loadURL(url);

    // Ctrl+Shift+I opens DevTools; Ctrl+R reloads; F11 fullscreen; Alt+F4 exits.
    mainWindow.webContents.on("before-input-event", (event, input) => {
        if (input.control && input.shift && input.key.toLowerCase() === "i") mainWindow.webContents.openDevTools();
        if (input.key === "F11") mainWindow.setFullScreen(!mainWindow.isFullScreen());
    });

    // Open external links in default browser (wa.me, chrome:// help pages, etc.)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });

    mainWindow.on("closed", () => { mainWindow = null; });
}

// -------- Silent print IPC --------
ipcMain.handle("misk:list-printers", async () => {
    if (!mainWindow) return [];
    try {
        // Electron 30+: getPrintersAsync; older: webContents.getPrinters()
        if (mainWindow.webContents.getPrintersAsync) {
            return await mainWindow.webContents.getPrintersAsync();
        }
        return mainWindow.webContents.getPrinters();
    } catch (e) { return []; }
});

ipcMain.handle("misk:get-settings", () => store.store);
ipcMain.handle("misk:set-settings", (_e, patch) => {
    Object.entries(patch || {}).forEach(([k, v]) => store.set(k, v));
    applyAutoLaunch();
    return store.store;
});

ipcMain.handle("misk:silent-print", async (_e, payload) => {
    const { html, deviceName, copies = 1, paperSize = "80mm" } = payload || {};
    if (!html) return { ok: false, error: "no html" };

    // Convert paper size to microns for Electron's mediaSize.
    const mm = paperSize === "58mm" ? { w: 58, h: 297 } : paperSize === "a4" ? { w: 210, h: 297 } : { w: 80, h: 297 };

    const printWin = new BrowserWindow({
        show: false,
        webPreferences: { offscreen: false },
    });
    const doc = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><style>
        @page { size: ${mm.w}mm ${mm.h}mm; margin: 0; }
        html, body { margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; }
    </style></head><body>${html}</body></html>`;
    await printWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(doc));

    const results = [];
    for (let i = 0; i < Math.max(1, copies); i++) {
        results.push(await new Promise((resolve) => {
            printWin.webContents.print({
                silent: true,
                printBackground: true,
                deviceName: deviceName || undefined,
                margins: { marginType: "none" },
                pageSize: { width: mm.w * 1000, height: mm.h * 1000 }, // microns
            }, (success, err) => resolve({ ok: success, err: err || null }));
        }));
    }
    printWin.destroy();
    return { ok: results.every(r => r.ok), results };
});

// -------- Auto-updater --------
autoUpdater.autoDownload = true;
autoUpdater.on("update-available", () => mainWindow?.webContents.send("misk:update-available"));
autoUpdater.on("update-downloaded", () => {
    dialog.showMessageBox(mainWindow, {
        type: "info",
        buttons: ["إعادة التشغيل الآن", "لاحقاً"],
        title: "تحديث جديد",
        message: "تمّ تنزيل تحديث جديد. سيتم تثبيته عند إعادة التشغيل.",
    }).then(({ response }) => { if (response === 0) autoUpdater.quitAndInstall(); });
});

app.whenReady().then(() => {
    createWindow();
    applyAutoLaunch();
    // Silent update check on start
    try { autoUpdater.checkForUpdatesAndNotify(); } catch {}

    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
