const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require("electron");
const path = require('path');

let mainWindow;
let tray;

// Use app.isPackaged to detect production vs development. When running locally
// via `npm run dev` the app will not be packaged so we should load the Vite dev
// server at localhost. This avoids relying on NODE_ENV which may not be set.
const isDev = !app.isPackaged;

app.whenReady().then(async () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    // Keep the companion above other windows, including fullscreen apps.
    mainWindow.setAlwaysOnTop(true, "screen-saver");
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setSkipTaskbar(true);

    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");

        // open DevTools in development (detached)
        const devToolsWindow = new BrowserWindow({
            width: 800,
            height: 600,
        });
        mainWindow.webContents.setDevToolsWebContents(devToolsWindow.webContents);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        // In production, load the built index.html from the renderer `dist` folder
        const indexPath = path.join(__dirname, '../dist/index.html');
        mainWindow.loadFile(indexPath);
    }

    // Enable clickthrough on the background
    mainWindow.setIgnoreMouseEvents(true, { forward: true });

    // Register mouse-event toggling before any optional tray setup.
    ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
        mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
    });

    try {
        const trayIconPath = path.join(__dirname, "assets", "tray-icon.png");
        let trayIcon = nativeImage.createFromPath(trayIconPath);

        if (trayIcon.isEmpty()) {
            trayIcon = await app.getFileIcon(process.execPath, { size: "small" });
        }

        tray = new Tray(trayIcon);
        tray.setToolTip("Desktop Companion");
        tray.setContextMenu(Menu.buildFromTemplate([
            {
                label: "Show",
                click: () => {
                    if (!mainWindow) {
                        return;
                    }

                    mainWindow.show();
                    mainWindow.setAlwaysOnTop(true, "screen-saver");
                },
            },
            {
                label: "Hide",
                click: () => {
                    if (!mainWindow) {
                        return;
                    }

                    mainWindow.hide();
                },
            },
            { type: "separator" },
            {
                label: "Quit",
                click: () => app.quit(),
            },
        ]));
    } catch (error) {
        console.error("Tray initialization failed:", error);
    }
});

app.on("before-quit", () => {
    if (tray) {
        tray.destroy();
        tray = null;
    }
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});