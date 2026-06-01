const { contextBridge, ipcRenderer } = require("electron");

// With contextIsolation: true (recommended), use contextBridge
// With contextIsolation: false (current), we can access ipcRenderer directly
try {
    contextBridge.exposeInMainWorld("electron", {
        ipcRenderer: {
            send: (channel, data) => {
                ipcRenderer.send(channel, data);
            },
            on: (channel, callback) => {
                ipcRenderer.on(channel, (event, ...args) => callback(...args));
            },
            invoke: (channel, data) => {
                return ipcRenderer.invoke(channel, data);
            },
        },
    });
} catch (error) {
    // If contextBridge fails, directly expose on window (for contextIsolation: false)
    window.electron = {
        ipcRenderer: {
            send: (channel, data) => {
                ipcRenderer.send(channel, data);
            },
            on: (channel, callback) => {
                ipcRenderer.on(channel, (event, ...args) => callback(...args));
            },
            invoke: (channel, data) => {
                return ipcRenderer.invoke(channel, data);
            },
        },
    };
}
