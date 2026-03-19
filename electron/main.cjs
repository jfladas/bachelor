const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require('path');

let mainWindow;

// Use app.isPackaged to detect production vs development. When running locally
// via `npm run dev` the app will not be packaged so we should load the Vite dev
// server at localhost. This avoids relying on NODE_ENV which may not be set.
const isDev = !app.isPackaged;

app.whenReady().then(() => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

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

    // Listen for mouse events from renderer process
    ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
        mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});