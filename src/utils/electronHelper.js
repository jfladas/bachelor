export async function getElectronIPC(timeout = 5000) {
    const startTime = Date.now();

    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (window.electron?.ipcRenderer) {
                clearInterval(checkInterval);
                resolve(window.electron.ipcRenderer);
                return;
            }

            if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                console.warn('Electron IPC not available after timeout');
                resolve(null);
            }
        }, 50);
    });
}

export function isElectronApp() {
    return Boolean(window.electron);
}
