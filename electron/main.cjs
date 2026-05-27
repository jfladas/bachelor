const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, powerMonitor } = require("electron");
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const StorageService = require('./storageService.cjs');

let mainWindow;
let tray;
let workAreaPollId;
let lastWorkAreaSignature = '';
let onDisplayMetricsChanged;
let onDisplayAdded;
let onDisplayRemoved;

// Journal encryption state (only in memory)
let encryptionKey = null;
let isUnlocked = false;
let storageService = null;

function setJournalUnlocked(nextUnlocked) {
    isUnlocked = Boolean(nextUnlocked);

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('journal:lock-state-changed', isUnlocked);
    }
}

// Use app.isPackaged to detect production vs development. When running locally
// via `npm run dev` the app will not be packaged so we should load the Vite dev
// server at localhost. This avoids relying on NODE_ENV which may not be set.
const isDev = !app.isPackaged;
const devServerUrl = "http://localhost:5173";
const appIconPath = path.join(__dirname, "assets", process.platform === "win32" ? "icon.ico" : "icon.png");
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

    const allowedTraits = ['active', 'optimistic', 'gentle', 'chill', 'mysterious', 'cute', 'grounded', 'creative'];
    const traits = Array.isArray(data?.traits)
        ? data.traits.filter((trait) => typeof trait === 'string' && allowedTraits.includes(trait))
        : [];

    const hue = clampHue(data?.hue, 220);
    const assignedHue = clampHue(data?.assignedHue ?? data?.eyeHue ?? hue, hue);

    const questionAnswers = {
        reservedOpen: clampUnit(data?.questionAnswers?.reservedOpen, 0.5),
        calmAssertive: clampUnit(data?.questionAnswers?.calmAssertive, 0.5),
        rationalEmotional: clampUnit(data?.questionAnswers?.rationalEmotional, 0.5),
    };

    return {
        hue,
        assignedHue,
        symmetry: clampUnit(data?.symmetry, 0.5),
        variability: clampUnit(data?.variability ?? data?.randomness, 0.5),
        activity: clampUnit(data?.activity ?? data?.speed, 0.5),
        reaction: normalizeReaction(data?.reaction, 'sparkles'),
        traits: Array.from(new Set(traits)).slice(0, allowedTraits.length),
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

function resetJournalState() {
    try {
        encryptionKey = null;
        setJournalUnlocked(false);

        if (!storageService) {
            storageService = new StorageService(app.getPath('userData'));
        }

        storageService.resetJournal();
        storageService = new StorageService(app.getPath('userData'));

        return true;
    } catch (error) {
        console.error('Failed to reset journal state:', error);
        return false;
    }
}

function encryptCipherData(plaintext, key) {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);

    let ciphertext = cipher.update(JSON.stringify(plaintext), 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
        nonce: nonce.toString('hex'),
        ciphertext,
        authTag: authTag.toString('hex'),
    };
}

function decryptCipherData(encrypted, key) {
    const nonce = Buffer.from(encrypted.nonce, 'hex');
    const ciphertext = Buffer.from(encrypted.ciphertext, 'hex');
    const authTag = Buffer.from(encrypted.authTag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return JSON.parse(plaintext);
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

    // Journal encryption handlers
    ipcMain.handle('journal:is-password-protected', () => {
        if (!storageService) return false;
        return storageService.isPasswordProtected();
    });

    ipcMain.handle('journal:get-metadata', () => {
        if (!storageService) return [];
        return storageService.getMetadata();
    });

    ipcMain.handle('journal:is-unlocked', () => {
        return isUnlocked;
    });

    ipcMain.handle('journal:setup-password', (event, password) => {
        if (!storageService) {
            storageService = new StorageService(app.getPath('userData'));
        }

        const salt = storageService.getSalt();
        encryptionKey = crypto
            .pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');

        // Repair metadata for old entries (mark .enc files as secret)
        storageService.repairMetadata();

        setJournalUnlocked(true);

        return { success: true, passwordSet: true };
    });

    ipcMain.handle('journal:verify-password', (event, password) => {
        if (!storageService) {
            storageService = new StorageService(app.getPath('userData'));
        }

        const salt = storageService.getSalt();
        const derivedKey = crypto
            .pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');

        // Try to decrypt at least one secret entry to verify PIN is correct.
        // If no encrypted secret exists yet, the PIN still counts as valid because
        // the journal can already be password-protected from metadata alone.
        try {
            const metadata = storageService.getMetadata();
            const secretEntries = metadata.filter(m => m.isSecret);

            const encryptedSecret = secretEntries.find((m) => {
                const encryptedPath = path.join(storageService.journalDir, `${m.id}.enc`);
                return fs.existsSync(encryptedPath);
            });

            if (encryptedSecret) {
                const encryptedPath = path.join(storageService.journalDir, `${encryptedSecret.id}.enc`);
                const encrypted = JSON.parse(fs.readFileSync(encryptedPath, 'utf8'));
                decryptCipherData(encrypted, derivedKey);
            }
        } catch (error) {
            return { success: false, error: 'Incorrect PIN' };
        }

        encryptionKey = derivedKey;
        setJournalUnlocked(true);

        storageService.repairMetadata();

        const metadata = storageService.getMetadata();
        for (const metaEntry of metadata) {
            if (!metaEntry.isSecret) {
                continue;
            }

            const plainPath = path.join(storageService.journalDir, `${metaEntry.id}.json`);
            const encryptedPath = path.join(storageService.journalDir, `${metaEntry.id}.enc`);

            if (!fs.existsSync(plainPath) || fs.existsSync(encryptedPath)) {
                continue;
            }

            try {
                const plainContent = JSON.parse(fs.readFileSync(plainPath, 'utf8'));
                const encryptedContent = encryptCipherData(plainContent, encryptionKey);
                storageService.saveEntry(
                    {
                        id: metaEntry.id,
                        createdAt: metaEntry.createdAt || plainContent.createdAt || new Date().toISOString(),
                        metadata: {
                            ...metaEntry,
                            isSecret: true,
                        },
                    },
                    encryptedContent
                );
                fs.unlinkSync(plainPath);
            } catch (error) {
                console.error('Failed to re-encrypt locked secret entry:', metaEntry.id, error);
            }
        }

        return { success: true };
    });

    ipcMain.handle('journal:save-entry', (event, entry) => {
        if (!storageService) {
            throw new Error('Storage not initialized');
        }

        const entryData = {
            id: entry.id,
            createdAt: entry.createdAt,
            updatedAt: new Date().toISOString(),
            text: entry.text,
            emotion: entry.emotion,
            prompt: entry.prompt,
        };

        const entryWithMetadata = {
            id: entry.id,
            createdAt: entry.createdAt,
            metadata: {
                emotion: entry.emotion,
                hasText: Boolean(entry.text),
                isSecret: entry.isSecret,
            },
        };

        if (entry.isSecret) {
            if (!encryptionKey) {
                storageService.savePlainEntry(entryWithMetadata, entryData);
            } else {
                const encryptedContent = encryptCipherData(entryData, encryptionKey);
                storageService.saveEntry(entryWithMetadata, encryptedContent);
            }
        } else {
            storageService.savePlainEntry(entryWithMetadata, entryData);
        }

        return { success: true, id: entry.id };
    });

    ipcMain.handle('journal:load-entries', () => {
        if (!storageService) {
            throw new Error('Storage not initialized');
        }

        if (encryptionKey) {
            return storageService.loadAllEntries((encrypted) => {
                return decryptCipherData(encrypted, encryptionKey);
            });
        }

        return storageService.loadAllEntries();
    });

    ipcMain.handle('journal:delete-entry', (event, entryId) => {
        if (!storageService) {
            throw new Error('Journal encryption not initialized');
        }

        storageService.deleteEntry(entryId);
        return { success: true };
    });

    ipcMain.handle('journal:clear-password', () => {
        encryptionKey = null;
        setJournalUnlocked(false);
        return { success: true };
    });

    ipcMain.handle('journal:lock', () => {
        encryptionKey = null;
        setJournalUnlocked(false);
        return { success: true };
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

    // Initialize storage service for encrypted journal
    storageService = new StorageService(app.getPath('userData'));

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
        icon: appIconPath,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

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

    powerMonitor.on('lock-screen', () => {
        encryptionKey = null;
        setJournalUnlocked(false);
    });

    powerMonitor.on('resume', () => {
        showMainWindow();
    });

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

    mainWindow.setIgnoreMouseEvents(initialOnboardingState.completed, { forward: true });

    try {
        let trayIcon = nativeImage.createFromPath(appIconPath);

        if (trayIcon.isEmpty()) {
            trayIcon = await app.getFileIcon(process.execPath, { size: "small" });
        }

        tray = new Tray(trayIcon);
        tray.setToolTip("Amorphous Blob");
        const trayMenuTemplate = [
            {
                label: "Wake Blob",
                click: () => {
                    if (!mainWindow) {
                        return;
                    }

                    mainWindow.show();
                    mainWindow.setAlwaysOnTop(true, "screen-saver");
                    mainWindow.webContents.send("tray:wake-blob");
                },
            },
        ];

        trayMenuTemplate.push(
            {
                label: "Reset",
                click: async () => {
                    const didReset = resetOnboardingState();
                    const didResetJournal = resetJournalState();
                    if (!didReset || !didResetJournal || !mainWindow) {
                        return;
                    }

                    try {
                        await mainWindow.webContents.executeJavaScript("window.localStorage.clear();");
                    } catch (error) {
                        console.error("Failed to clear localStorage:", error);
                    }

                    mainWindow.setIgnoreMouseEvents(false, { forward: true });
                    await mainWindow.webContents.reloadIgnoringCache();
                },
            },
            { type: "separator" }
        );

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