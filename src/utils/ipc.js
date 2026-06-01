let cached = null

export async function getElectronIPC(timeout = 5000) {
    const startTime = Date.now()

    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (window.electron?.ipcRenderer) {
                clearInterval(checkInterval)
                resolve(window.electron.ipcRenderer)
                return
            }

            if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval)
                resolve(null)
            }
        }, 50)
    })
}

export async function ipc() {
    if (cached) return cached
    cached = await getElectronIPC()
    return cached
}

export async function invoke(channel, ...args) {
    const i = await ipc()
    if (!i || !i.invoke) return null
    return i.invoke(channel, ...args)
}

export async function send(channel, ...args) {
    const i = await ipc()
    if (!i || !i.send) return
    return i.send(channel, ...args)
}

export async function on(channel, handler) {
    const i = await ipc()
    if (!i || !i.on) return
    return i.on(channel, handler)
}

export async function removeListener(channel, handler) {
    const i = await ipc()
    if (!i || !i.removeListener) return
    return i.removeListener(channel, handler)
}

export default { ipc, invoke, send, on, removeListener }
