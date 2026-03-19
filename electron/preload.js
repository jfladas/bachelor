const { contextBridge, ipcRenderer } = require("electron");

console.log("preload.js is loaded");

contextBridge.exposeInMainWorld("electron", {
    ipcRenderer: {
        send: (channel, data) => {
            console.log(`Sending IPC message: ${channel}`, data);
            ipcRenderer.send(channel, data);
        },
        on: (channel, callback) => {
            console.log(`Listening for IPC message: ${channel}`);
            ipcRenderer.on(channel, (event, ...args) => callback(...args));
        },
    },
});

console.log("electron object exposed to renderer process");
