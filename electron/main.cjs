const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require("electron");
const fs = require('fs');
const path = require('path');
const http = require('http');

let mainWindow;
let tray;
let workAreaPollId;
let lastWorkAreaSignature = '';
let onDisplayMetricsChanged;
let onDisplayAdded;
let onDisplayRemoved;

// Use app.isPackaged to detect production vs development. When running locally
// via `npm run dev` the app will not be packaged so we should load the Vite dev
// server at localhost. This avoids relying on NODE_ENV which may not be set.
const isDev = !app.isPackaged;
const devServerUrl = "http://localhost:5173";
const onboardingStatePath = path.join(app.getPath('userData'), 'onboarding-state.json');
const onboardingDefaults = {
    completed: false,
    completedAt: null,
    data: {
        hue: 220,
        assignedHue: 220,
        symmetry: 0.5,
        variability: 0.5,
        activity: 0.5,
        reaction: 'sparkles',
        traits: [],
        questionAnswers: {
            reservedOpen: 0.5,
            calmAssertive: 0.5,
            rationalEmotional: 0.5,
            groundedCreative: 0.5,
        },
        hueOverride: false,
    },
};

function sanitizeOnboardingData(data) {
    const clampHue = (value, fallback = 220) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return fallback;
        }

        return ((Math.round(numeric) % 360) + 360) % 360;
    };

    const clampUnit = (value, fallback = 0.5) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return fallback;
        }

        return Math.min(1, Math.max(0, Number(numeric.toFixed(2))));
    };

    const normalizeReaction = (value, fallback = 'sparkles') => {
        const allowedReactions = ['sparkles', 'flowers', 'hearts'];
        if (typeof value === 'string' && allowedReactions.includes(value)) {
            return value;
        }

        return fallback;
    };

    const allowedTraits = ['active', 'optimistic', 'gentle', 'chill', 'mysterious', 'cute'];
    const traits = Array.isArray(data?.traits)
        ? data.traits.filter((trait) => typeof trait === 'string' && allowedTraits.includes(trait))
        : [];

    const hue = clampHue(data?.hue, 220);
    const assignedHue = clampHue(data?.assignedHue ?? data?.eyeHue ?? hue, hue);

    const questionAnswers = {
        reservedOpen: clampUnit(data?.questionAnswers?.reservedOpen, 0.5),
        calmAssertive: clampUnit(data?.questionAnswers?.calmAssertive, 0.5),
        rationalEmotional: clampUnit(data?.questionAnswers?.rationalEmotional, 0.5),
        groundedCreative: clampUnit(data?.questionAnswers?.groundedCreative, 0.5),
    };

    return {
        hue,
        assignedHue,
        symmetry: clampUnit(data?.symmetry, 0.5),
        variability: clampUnit(data?.variability ?? data?.randomness, 0.5),
        activity: clampUnit(data?.activity ?? data?.speed, 0.5),
        reaction: normalizeReaction(data?.reaction, 'sparkles'),
        traits: Array.from(new Set(traits)).slice(0, 6),
        questionAnswers,
        hueOverride: Boolean(data?.hueOverride ?? (hue !== assignedHue)),
    };
}

function readOnboardingState() {
    try {
        if (!fs.existsSync(onboardingStatePath)) {
            return { ...onboardingDefaults };
        }

        const raw = fs.readFileSync(onboardingStatePath, 'utf8');
        const state = JSON.parse(raw);
        return {
            completed: state.completed === true,
            completedAt: state.completedAt || null,
            data: sanitizeOnboardingData(state.data || {}),
        };
    } catch (error) {
        console.error('Failed to read onboarding state:', error);
        return { ...onboardingDefaults };
    }
}

function writeOnboardingState(nextState) {
    try {
        fs.mkdirSync(path.dirname(onboardingStatePath), { recursive: true });

        const tempPath = `${onboardingStatePath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(nextState, null, 2), 'utf8');
        fs.renameSync(tempPath, onboardingStatePath);

        return true;
    } catch (error) {
        console.error('Failed to write onboarding state:', error);
        return false;
    }
}

function resetOnboardingState() {
    try {
        if (fs.existsSync(onboardingStatePath)) {
            fs.unlinkSync(onboardingStatePath);
        }

        return true;
    } catch (error) {
        console.error('Failed to reset onboarding state:', error);
        return false;
    }
}

function showMainWindow() {
    if (!mainWindow) {
        return;
    }

    mainWindow.show();
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
}

function getWorkArea() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return null;
    }

    const display = screen.getDisplayMatching(mainWindow.getBounds());
    return display?.workArea || null;
}

function syncToWorkArea(force = false) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    const workArea = getWorkArea();
    if (!workArea) {
        return;
    }

    const signature = `${workArea.x},${workArea.y},${workArea.width},${workArea.height}`;
    if (!force && signature === lastWorkAreaSignature) {
        return;
    }

    lastWorkAreaSignature = signature;
    const current = mainWindow.getBounds();
    if (
        current.x === workArea.x &&
        current.y === workArea.y &&
        current.width === workArea.width &&
        current.height === workArea.height
    ) {
        return;
    }

    mainWindow.setBounds({
        x: workArea.x,
        y: workArea.y,
        width: workArea.width,
        height: workArea.height,
    });
}

let ipcRegistered = false;

function registerIpcHandlers() {
    if (ipcRegistered) {
        return;
    }

    // Register onboarding and mouse-event channels before the renderer loads.
    ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
        if (!mainWindow) {
            return;
        }

        mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
    });

    ipcMain.on('quit-app', () => {
        app.quit();
    });

    ipcMain.on('hide-app', () => {
        if (!mainWindow) {
            return;
        }

        mainWindow.hide();
    });

    ipcMain.handle('has-completed-onboarding', () => {
        const state = readOnboardingState();
        return state.completed;
    });

    ipcMain.handle('get-onboarding-state', () => {
        return readOnboardingState();
    });

    ipcMain.handle('save-onboarding-state', (event, data) => {
        const nextState = {
            completed: true,
            completedAt: new Date().toISOString(),
            data: sanitizeOnboardingData(data || {}),
        };

        const ok = writeOnboardingState(nextState);
        if (!ok) {
            throw new Error('Failed to persist onboarding state');
        }

        return nextState;
    });

    ipcMain.on('onboarding-complete', () => {
        const previous = readOnboardingState();
        const nextState = {
            completed: true,
            completedAt: previous.completedAt || new Date().toISOString(),
            data: sanitizeOnboardingData(previous.data || {}),
        };

        writeOnboardingState(nextState);
    });

    ipcRegistered = true;
}

function waitForDevServer(url, timeoutMs = 30000, intervalMs = 500) {
    const start = Date.now();

    return new Promise((resolve, reject) => {
        const attempt = () => {
            const req = http.get(url, (res) => {
                // Drain response data so the socket can be reused/closed cleanly.
                res.resume();
                resolve();
            });

            req.on('error', () => {
                if (Date.now() - start >= timeoutMs) {
                    reject(new Error(`Timed out waiting for dev server at ${url}`));
                    return;
                }

                setTimeout(attempt, intervalMs);
            });

            req.setTimeout(2000, () => {
                req.destroy();
            });
        };

        attempt();
    });
}

app.whenReady().then(async () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const initialOnboardingState = readOnboardingState();

    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        show: false,
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
    syncToWorkArea(true);

    onDisplayMetricsChanged = () => {
        syncToWorkArea();
    };
    screen.on('display-metrics-changed', onDisplayMetricsChanged);

    onDisplayAdded = () => {
        syncToWorkArea(true);
    };
    screen.on('display-added', onDisplayAdded);

    onDisplayRemoved = () => {
        syncToWorkArea(true);
    };
    screen.on('display-removed', onDisplayRemoved);

    workAreaPollId = setInterval(() => {
        syncToWorkArea();
    }, 1000);

    registerIpcHandlers();

    if (isDev) {
        try {
            await waitForDevServer(devServerUrl);
            await mainWindow.loadURL(devServerUrl);
        } catch (error) {
            console.error("Failed to connect to Vite dev server:", error);
            app.quit();
            return;
        }

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
        await mainWindow.loadFile(indexPath);
    }

    showMainWindow();

    // Keep onboarding clickable on first run; enable clickthrough only after onboarding.
    mainWindow.setIgnoreMouseEvents(initialOnboardingState.completed, { forward: true });

    try {
        const trayIconPath = path.join(__dirname, "assets", "tray-icon.png");
        let trayIcon = nativeImage.createFromPath(trayIconPath);

        if (trayIcon.isEmpty()) {
            trayIcon = await app.getFileIcon(process.execPath, { size: "small" });
        }

        tray = new Tray(trayIcon);
        tray.setToolTip("Desktop Companion");
        const trayMenuTemplate = [
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
        ];

        if (isDev) {
            trayMenuTemplate.push(
                {
                    label: "Reset Onboarding",
                    click: async () => {
                        const didReset = resetOnboardingState();
                        if (!didReset || !mainWindow) {
                            return;
                        }

                        mainWindow.setIgnoreMouseEvents(false, { forward: true });
                        await mainWindow.webContents.reloadIgnoringCache();
                    },
                },
                { type: "separator" }
            );
        } else {
            trayMenuTemplate.push({ type: "separator" });
        }

        trayMenuTemplate.push({
            label: "Quit",
            click: () => app.quit(),
        });

        tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate));
    } catch (error) {
        console.error("Tray initialization failed:", error);
    }
});

app.on("before-quit", () => {
    if (workAreaPollId) {
        clearInterval(workAreaPollId);
        workAreaPollId = undefined;
    }

    if (onDisplayMetricsChanged) {
        screen.removeListener('display-metrics-changed', onDisplayMetricsChanged);
        onDisplayMetricsChanged = undefined;
    }

    if (onDisplayAdded) {
        screen.removeListener('display-added', onDisplayAdded);
        onDisplayAdded = undefined;
    }

    if (onDisplayRemoved) {
        screen.removeListener('display-removed', onDisplayRemoved);
        onDisplayRemoved = undefined;
    }

    if (tray) {
        tray.destroy();
        tray = null;
    }
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});