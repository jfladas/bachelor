import { clampUnit, clampHue } from './validation'

const SETTINGS_KEY = 'amorphous-blob:settings'
const POSITION_KEY = 'amorphous-blob:blob-center'
const SLEEP_STATE_KEY = 'amorphous-blob:sleep-state'
const SLEEP_DRAFT_KEY = 'amorphous-blob:sleep-setup-draft'
const SLEEP_PREFERENCE_KEY = 'amorphous-blob:sleep-setup-preference'

const safeParse = (raw) => {
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}

export const readSettings = () => {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return null
    const parsed = safeParse(raw)
    if (!parsed) return null

    return {
        blobSize: typeof parsed.blobSize === 'number' ? Math.min(150, Math.max(50, Math.round(parsed.blobSize))) : undefined,
        sleepTagVisible: parsed.sleepTagVisible !== false,
        startOnSystemRestart: parsed.startOnSystemRestart !== false,
    }
}

export const writeSettings = (settings = {}) => {
    try {
        const payload = {
            blobSize: typeof settings.blobSize === 'number' ? Math.min(150, Math.max(50, Math.round(settings.blobSize))) : undefined,
            sleepTagVisible: settings.sleepTagVisible !== false,
            startOnSystemRestart: settings.startOnSystemRestart !== false,
            savedAt: Date.now(),
        }
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload))
    } catch {
        // ignore
    }
}

export const readPosition = () => {
    const raw = window.localStorage.getItem(POSITION_KEY)
    const parsed = safeParse(raw)
    if (!parsed) return null
    const { xRatio, yRatio } = parsed
    if (!Number.isFinite(xRatio) || !Number.isFinite(yRatio)) return null
    const { innerWidth: width = 1280, innerHeight: height = 720 } = window
    return {
        x: Math.min(width, Math.max(0, xRatio * width)),
        y: Math.min(height, Math.max(0, yRatio * height)),
    }
}

export const writePosition = (center) => {
    try {
        const { innerWidth: width = 1280, innerHeight: height = 720 } = window
        const payload = {
            xRatio: Math.min(1, Math.max(0, center.x / Math.max(1, width))),
            yRatio: Math.min(1, Math.max(0, center.y / Math.max(1, height))),
            savedAt: Date.now(),
        }
        window.localStorage.setItem(POSITION_KEY, JSON.stringify(payload))
    } catch {
        // ignore
    }
}

const clampSleepAmount = (amount) => {
    const n = Number(amount)
    if (!Number.isFinite(n) || n < 1) return null
    return Math.min(999, Math.round(n))
}

export const readSleepDraft = () => {
    const raw = window.localStorage.getItem(SLEEP_DRAFT_KEY)
    const parsed = safeParse(raw)
    if (!parsed) return null

    const amount = clampSleepAmount(parsed.amount)
    const unit = parsed?.unit === 'minutes' || parsed?.unit === 'until-woken-up' ? parsed.unit : 'hours'
    const rememberAsDefault = parsed?.rememberAsDefault === true
    if (amount === null) return null
    return { amount, unit, rememberAsDefault }
}

export const writeSleepDraft = (draft) => {
    try {
        const amount = clampSleepAmount(draft?.amount) ?? 1
        const unit = draft?.unit === 'minutes' || draft?.unit === 'until-woken-up' ? draft.unit : 'hours'
        const payload = { amount: Math.min(999, Math.max(1, amount)), unit, rememberAsDefault: draft?.rememberAsDefault === true, savedAt: Date.now() }
        window.localStorage.setItem(SLEEP_DRAFT_KEY, JSON.stringify(payload))
    } catch {
        // ignore
    }
}

export const readSleepPreference = () => {
    const raw = window.localStorage.getItem(SLEEP_PREFERENCE_KEY)
    const parsed = safeParse(raw)
    if (!parsed || parsed.enabled !== true) return null
    const amount = clampSleepAmount(parsed.amount)
    if (amount === null) return null
    const unit = parsed.unit === 'minutes' || parsed.unit === 'until-woken-up' ? parsed.unit : 'hours'
    return { enabled: true, amount, unit }
}

export const writeSleepPreference = (draft) => {
    try {
        const amount = clampSleepAmount(draft?.amount) ?? 1
        const unit = draft?.unit === 'minutes' || draft?.unit === 'until-woken-up' ? draft.unit : 'hours'
        const payload = { enabled: draft?.rememberAsDefault === true, amount: Math.min(999, Math.max(1, amount)), unit, savedAt: Date.now() }
        window.localStorage.setItem(SLEEP_PREFERENCE_KEY, JSON.stringify(payload))
    } catch {
        // ignore
    }
}

export const clearSleepPreference = () => {
    try {
        window.localStorage.removeItem(SLEEP_PREFERENCE_KEY)
    } catch { }
}

export const readSleepState = () => {
    const raw = window.localStorage.getItem(SLEEP_STATE_KEY)
    const parsed = safeParse(raw)
    if (!parsed) return null

    const indefinite = parsed?.indefinite === true
    const wakeAt = indefinite ? null : Number(parsed?.wakeAt)
    const dockSide = parsed?.dockSide === 'left' ? 'left' : 'right'
    const dockRatio = Number.isFinite(parsed?.dockRatio) ? Math.min(0.98, Math.max(0.02, parsed.dockRatio)) : 0.5
    const showWakeTag = parsed.showWakeTag !== false

    if (!indefinite && wakeAt !== null && !Number.isFinite(wakeAt)) return null

    return { wakeAt: indefinite ? null : Math.max(0, Math.round(wakeAt)), indefinite, dockSide, dockRatio, showWakeTag }
}

export const writeSleepState = (wakeAt, dockSide = 'right', dockRatio = 0.5, indefinite = false, showWakeTag = true) => {
    try {
        const payload = { wakeAt: indefinite ? null : Math.max(0, Math.round(wakeAt)), indefinite: Boolean(indefinite), dockSide: dockSide === 'left' ? 'left' : 'right', dockRatio: Math.min(0.98, Math.max(0.02, dockRatio)), showWakeTag: !!showWakeTag, savedAt: Date.now() }
        window.localStorage.setItem(SLEEP_STATE_KEY, JSON.stringify(payload))
    } catch {
        // ignore
    }
}

export const clearSleepState = () => {
    try {
        window.localStorage.removeItem(SLEEP_STATE_KEY)
    } catch { }
}

export default {
    readSettings,
    writeSettings,
    readPosition,
    writePosition,
    readSleepDraft,
    writeSleepDraft,
    readSleepPreference,
    writeSleepPreference,
    readSleepState,
    writeSleepState,
    clearSleepState,
}
