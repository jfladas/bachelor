<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BlobVisuals from "./BlobVisuals.vue";
import RadialMenu from "./RadialMenu.vue";
import MicroJournal from "./MicroJournal.vue";
import PINWindow from "./window/PINWindow.vue";
import SleepWindow from "./window/SleepWindow.vue";
import SettingsWindow from "./window/SettingsWindow.vue";
import { useBlobPhysics } from "../composables/useBlobPhysics";
import { STATES } from "../composables/useBlobState";
import { useBlobFace } from "../composables/useBlobFace";
import { useBlobState } from "../composables/useBlobState";
import { useMicroJournal } from "../composables/useMicroJournal";
import { createHueVariables } from "../utils/themeColors";
import { clampHue, clampUnit, clampPercent } from "../utils/validation";
import * as storage from "../utils/storage";
import * as ipc from "../utils/ipc";

const props = defineProps({
    onboardingData: {
        type: Object,
        default: () => ({
            hue: 220,
            assignedHue: 220,
            symmetry: 0.5,
            variability: 0.5,
            activity: 0.5,
            reaction: "sparkles",
        }),
    },
});

const BALL_COUNT = 5;
const BASE_BALL_RADIUS = 20;
const MAX_RADIUS_VARIATION = 3;
const MIN_BALL_RADIUS = 15;
const EDGE_WIDTH = 20;
// storage helper handles keys
const SLEEP_TAG_MIN_RATIO = 0.02;
const SLEEP_TAG_MAX_RATIO = 0.98;

// use shared clampPercent from validation

const hue = computed(() => {
    return clampHue(props.onboardingData?.hue, 220);
});

const symmetry = computed(() => clampUnit(props.onboardingData?.symmetry, 0.5));
const variability = computed(() => clampUnit(props.onboardingData?.variability, 0.5));
const activity = computed(() => clampUnit(props.onboardingData?.activity, 0.5));

const ballRadii = computed(() => {
    const centerIndex = (BALL_COUNT - 1) / 2;
    const variation = (1 - symmetry.value) * MAX_RADIUS_VARIATION;

    return Array.from({ length: BALL_COUNT }, (_, index) => {
        const offsetFromCenter = index - centerIndex;
        const radius = BASE_BALL_RADIUS + offsetFromCenter * variation;
        return Math.max(MIN_BALL_RADIUS, Math.round(radius));
    });
});

const hueVariables = computed(() => createHueVariables(hue.value));

const sleepShift = computed(() => {
    if (blobState.state.value !== STATES.SLEEPING) {
        return "0px";
    }

    return sleepVisualSide.value === "left" ? "-100vw" : "100vw";
});

const shellStyle = computed(() => ({
    ...hueVariables.value,
    "--sleep-shift": sleepShift.value,
}));

const createDefaultAppSettings = () => ({
    blobSize: 100,
    sleepTagVisible: true,
    startOnSystemRestart: true,
});

const normalizeAppSettings = (settings = {}) => ({
    blobSize: clampPercent(settings?.blobSize ?? settings?.blobScale ?? 100),
    sleepTagVisible: settings?.sleepTagVisible !== false,
    startOnSystemRestart: settings?.startOnSystemRestart !== false,
});

const appSettings = ref(createDefaultAppSettings());
const settingsLoaded = ref(false);
const showSettingsModal = ref(false);
const blobScale = computed(() => appSettings.value.blobSize / 100);

const {
    positions,
    grabbing,
    state,
    outlinePoints,
    blobPath,
    faceStyle,
    setBlobAreaRef,
    setBlobEdgeRef,
    startDrag,
    didDragRecently,
    setInteractionLocked,
    jump,
    pinProgress,
    pinAnchor,
    isPinned,
} = useBlobPhysics({
    ballRadii,
    blobScale,
    activity,
});

const { faceParts, setFace, startEyeFollow, stopEyeFollow, eyesOffset } = useBlobFace();
const blobState = useBlobState();

const journal = useMicroJournal();
const {
    emotionTags,
    journalText,
    selectedEmotion,
    activePrompt,
    canSubmit,
    entries,
    isUnlocked,
    maxEntryLength,
    setJournalText,
    setEmotionTag,
    rotatePrompt,
    resetDraft,
    saveEntry,
    isPinProtected,
} = journal;

const DEFAULT_FACE_EMOTION = "default";
const latestSubmittedEmotion = ref(DEFAULT_FACE_EMOTION);
const visualEmotion = ref(DEFAULT_FACE_EMOTION);

const applyFaceEmotion = (emotionId) => {
    const nextEmotion = emotionId || DEFAULT_FACE_EMOTION;
    visualEmotion.value = nextEmotion;
    setFace(nextEmotion);
};

const resolveLatestSubmittedEmotion = () => {
    return entries.value[0]?.emotion || DEFAULT_FACE_EMOTION;
};

const menuOpen = ref(false);
const journalOpen = ref(false);
const journalPanelSide = ref(null);
const lockedPanelStyle = ref(null);
const journalPromptVisible = ref(false);
const journalEmotionVisible = ref(true);
const journalTextVisible = ref(true);
const secMenuOpen = ref(false);
const showPINModal = ref(false);
const showSleepModal = ref(false);
const sleepTimerId = ref(null);
const sleepEmotionRestoreTimerId = ref(null);
const sleepDockSide = ref("right");
const sleepVisualSide = ref("right");
const sleepDockRatio = ref(0.9);
const wakeButtonRef = ref(null);
const sleepDeleteZoneRef = ref(null);
const sleepTagPointerDown = ref(false);
const sleepTagDragging = ref(false);
const sleepTagDragStart = ref(null);
const sleepTagSuppressClick = ref(false);
const sleepDeleteZoneActive = ref(false);
const sleepTagHidden = ref(false);
const sleepTagMounted = ref(false);
const isIgnoringMouseEvents = ref(false);
const pendingEntryOptions = ref(null);
const sleepSetupDraft = ref({ amount: 1, unit: "hours", rememberAsDefault: false });
const _passwordSetupResolve = { ref: null };
const _passwordSetupReject = { ref: null };
let removeTrayWakeListener = null;
let sleepTagShowTimerId = null;

onMounted(async () => {
    await journal.loadEntries();
});

onMounted(() => {
    hydrateAppSettings();
});

const syncSleepDraft = (draft) => {
    const amount = Math.min(999, Math.max(1, Math.round(Number(draft?.amount) || 1)));
    const unit = draft?.unit === "minutes" || draft?.unit === "until-woken-up" ? draft.unit : "hours";
    const rememberAsDefault = draft?.rememberAsDefault === true;

    sleepSetupDraft.value = { amount, unit, rememberAsDefault };
    storage.writeSleepDraft(sleepSetupDraft.value);
    if (rememberAsDefault) {
        storage.writeSleepPreference(sleepSetupDraft.value);
        return;
    }

    try { storage.clearSleepPreference(); } catch { }
};

const syncSleepPreference = (draft) => {
    const amount = Math.min(999, Math.max(1, Math.round(Number(draft?.amount) || 1)));
    const unit = draft?.unit === "minutes" || draft?.unit === "until-woken-up" ? draft.unit : "hours";
    const rememberAsDefault = draft?.rememberAsDefault === true;

    sleepSetupDraft.value = { amount, unit, rememberAsDefault };
    storage.writeSleepDraft(sleepSetupDraft.value);
    if (rememberAsDefault) {
        storage.writeSleepPreference(sleepSetupDraft.value);
        return;
    }

    try { storage.clearSleepPreference(); } catch { }
};

const hydrateSleepDraft = () => {
    const storedDraft = storage.readSleepDraft();
    if (storedDraft) {
        sleepSetupDraft.value = storedDraft;
    }

    const storedPreference = storage.readSleepPreference();
    if (storedPreference) {
        sleepSetupDraft.value = {
            amount: storedPreference.amount,
            unit: storedPreference.unit,
            rememberAsDefault: true,
        };
    }
};

hydrateSleepDraft();

const hydrateAppSettings = async () => {
    const storedSettings = storage.readSettings();
    if (storedSettings) {
        appSettings.value = normalizeAppSettings(storedSettings);
    }

    try {
        const startOnSystemRestart = await ipc.invoke("app:get-start-on-restart");
        if (typeof startOnSystemRestart === "boolean") {
            appSettings.value.startOnSystemRestart = startOnSystemRestart;
            storage.writeSettings(appSettings.value);
        }
    } catch (error) {
        if (!String(error?.message || error).includes("No handler registered")) {
            console.error("Failed to read startup setting:", error);
        }
    } finally {
        settingsLoaded.value = true;
    }
};

const syncAppSettings = (nextSettings = {}) => {
    appSettings.value = normalizeAppSettings({
        ...appSettings.value,
        ...nextSettings,
    });
    storage.writeSettings(appSettings.value);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const mousePos = ref({ x: 0, y: 0 });

const getCursorOffset = () => {
    if (!blobCenter.value) return { x: 0, y: 0 };
    return {
        x: mousePos.value.x - blobCenter.value.x,
        y: mousePos.value.y - blobCenter.value.y + 50,
    };
};

const getViewportBounds = () => {
    if (typeof window === "undefined") {
        return { width: 1280, height: 720 };
    }

    return {
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight),
    };
};

const blobCenter = computed(() => {
    if (positions.value.length === 0) {
        return null;
    }

    const totals = positions.value.reduce(
        (acc, ball) => ({
            x: acc.x + ball.x + ball.radius,
            y: acc.y + ball.y + ball.radius,
        }),
        { x: 0, y: 0 }
    );

    return {
        x: totals.x / positions.value.length,
        y: totals.y / positions.value.length,
    };
});

const menuAnchorStyle = computed(() => {
    const { width, height } = getViewportBounds();
    const safeRadius = 110;
    const maxX = Math.max(safeRadius, width - safeRadius);
    const maxY = Math.max(safeRadius, height);

    if (!blobCenter.value) {
        return {
            left: "-9999px",
            top: "-9999px",
        };
    }

    return {
        left: `${clamp(blobCenter.value.x, safeRadius, maxX)}px`,
        top: `${clamp(blobCenter.value.y, 0, maxY)}px`,
    };
});

const getJournalPanelSide = () => {
    const { width } = getViewportBounds();

    if (journalPanelSide.value) {
        return journalPanelSide.value;
    }

    if (!blobCenter.value) {
        return "left";
    }

    return blobCenter.value.x < width / 2 ? "left" : "right";
};

const computedPanelStyle = computed(() => {
    const { width } = getViewportBounds();
    const panelWidth = 480;
    const minInset = 110;
    const bottomOffset = 48;
    const sideOffset = 110;
    const maxInset = Math.max(minInset, width - panelWidth - minInset);
    const side = getJournalPanelSide();

    if (!blobCenter.value) {
        return side === "left"
            ? {
                left: `${minInset}px`,
                right: "auto",
                bottom: `${bottomOffset}px`,
            }
            : {
                left: "auto",
                right: `${minInset}px`,
                bottom: `${bottomOffset}px`,
            };
    }

    const blobX = blobCenter.value.x;

    if (side === "left") {
        return {
            left: `${clamp(blobX + sideOffset, minInset, maxInset)}px`,
            right: "auto",
            bottom: `${bottomOffset}px`,
        };
    }

    return {
        left: "auto",
        right: `${clamp(width - blobX + sideOffset, minInset, maxInset)}px`,
        bottom: `${bottomOffset}px`,
    };
});

const panelStyle = computed(() => {
    if (journalOpen.value && lockedPanelStyle.value) {
        return lockedPanelStyle.value;
    }
    return computedPanelStyle.value;
});

const setMenuState = (isOpen) => {
    blobState.setState(isOpen ? STATES.ACTIVE : STATES.IDLE);
};

const syncMenuState = () => {
    setMenuState(menuOpen.value || journalOpen.value || secMenuOpen.value);
};

const closeMenu = ({ clearDraft = false } = {}) => {
    const wasJournalOpen = journalOpen.value;

    menuOpen.value = false;
    journalOpen.value = false;
    journalPanelSide.value = null;
    lockedPanelStyle.value = null;
    secMenuOpen.value = false;
    syncMenuState();

    if (wasJournalOpen) {
        applyFaceEmotion(latestSubmittedEmotion.value);
    }

    if (clearDraft) {
        resetDraft();
    }
};

const clearSleepTimer = () => {
    if (sleepTimerId.value) {
        window.clearTimeout(sleepTimerId.value);
        sleepTimerId.value = null;
    }
};

const clearSleepEmotionRestoreTimer = () => {
    if (sleepEmotionRestoreTimerId.value) {
        window.clearTimeout(sleepEmotionRestoreTimerId.value);
        sleepEmotionRestoreTimerId.value = null;
    }
};

const restoreFaceEmotionAfterSleep = () => {
    clearSleepEmotionRestoreTimer();
    sleepEmotionRestoreTimerId.value = window.setTimeout(() => {
        sleepEmotionRestoreTimerId.value = null;
        applyFaceEmotion(selectedEmotion.value || latestSubmittedEmotion.value || DEFAULT_FACE_EMOTION);
    }, 3000);
};

const readStoredSleepState = () => storage.readSleepState();
const writeStoredSleepState = (wakeAt, dockSide, dockRatio = 0.5, indefinite = false) => storage.writeSleepState(wakeAt, dockSide, dockRatio, indefinite, !sleepTagHidden.value);
const clearStoredSleepState = () => storage.clearSleepState();

const setIgnoreMouseEvents = (ignore) => {
    const nextIgnore = Boolean(ignore);
    if (isIgnoringMouseEvents.value === nextIgnore) {
        return;
    }

    isIgnoringMouseEvents.value = nextIgnore;
    try { ipc.send('set-ignore-mouse-events', nextIgnore); } catch { }
};

const sleepTagStyle = computed(() => ({
    top: `${Math.round(Math.min(SLEEP_TAG_MAX_RATIO, Math.max(SLEEP_TAG_MIN_RATIO, sleepDockRatio.value)) * 100)}%`,
}));

const clearSleepTagAnimationTimers = () => {
    if (sleepTagShowTimerId) {
        window.clearTimeout(sleepTagShowTimerId);
        sleepTagShowTimerId = null;
    }
};

const showWakeTagWithDelay = (delayMs) => {
    if (sleepTagHidden.value) {
        clearSleepTagAnimationTimers();
        sleepTagMounted.value = false;
        return;
    }

    clearSleepTagAnimationTimers();

    if (!Number.isFinite(delayMs) || delayMs <= 0) {
        sleepTagMounted.value = true;
        return;
    }

    sleepTagShowTimerId = window.setTimeout(() => {
        sleepTagShowTimerId = null;
        if (sleepTagHidden.value) {
            sleepTagMounted.value = false;
            return;
        }
        sleepTagMounted.value = true;
    }, Math.max(0, Number(delayMs) || 0));
};

const updateSleepDockPosition = (clientX, clientY) => {
    const { width, height } = getViewportBounds();
    sleepDockSide.value = clientX < width / 2 ? "left" : "right";
    sleepDockRatio.value = Math.min(SLEEP_TAG_MAX_RATIO, Math.max(SLEEP_TAG_MIN_RATIO, clientY / Math.max(1, height)));
};

const isPointInDeleteZone = (clientX, clientY) => {
    const rect = sleepDeleteZoneRef.value?.getBoundingClientRect?.();
    if (!rect) {
        return false;
    }

    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
};

const handleWakeButtonPointerDown = (event) => {
    if (event.button !== 0 || blobState.state.value !== STATES.SLEEPING) {
        return;
    }

    sleepTagPointerDown.value = true;
    sleepTagDragging.value = false;
    sleepTagDragStart.value = { x: event.clientX, y: event.clientY };
    sleepTagSuppressClick.value = false;
    sleepDeleteZoneActive.value = false;
    setIgnoreMouseEvents(false);
};

const handleWakeButtonClick = (event) => {
    if (sleepTagSuppressClick.value) {
        event.preventDefault();
        event.stopPropagation();
        sleepTagSuppressClick.value = false;
        return;
    }

    wakeFromSleep();
};

const finishSleepTagDrag = (clientX, clientY) => {
    if (!sleepTagPointerDown.value) {
        return;
    }

    const dragStart = sleepTagDragStart.value;
    const draggedDistance = dragStart ? Math.hypot(clientX - dragStart.x, clientY - dragStart.y) : 0;

    sleepTagPointerDown.value = false;
    sleepTagDragging.value = false;
    sleepTagDragStart.value = null;
    sleepTagSuppressClick.value = draggedDistance > 6;

    if (isPointInDeleteZone(clientX, clientY)) {
        sleepDeleteZoneActive.value = false;
        sleepTagHidden.value = true;
        sleepTagMounted.value = false;
        const storedSleepState = readStoredSleepState();
        if (storedSleepState) {
            writeStoredSleepState(storedSleepState.wakeAt, sleepDockSide.value, sleepDockRatio.value);
        }
        setIgnoreMouseEvents(true);
        return;
    }

    updateSleepDockPosition(clientX, clientY);
    sleepVisualSide.value = sleepDockSide.value;
    const storedSleepState = readStoredSleepState();
    if (storedSleepState) {
        writeStoredSleepState(storedSleepState.wakeAt, sleepDockSide.value, sleepDockRatio.value);
    }
    sleepDeleteZoneActive.value = false;
    syncSleepClickthrough(clientX, clientY);
};

const performWakeFromSleep = () => {
    clearSleepTimer();
    clearStoredSleepState();
    sleepVisualSide.value = "right";
    sleepTagPointerDown.value = false;
    sleepTagDragging.value = false;
    sleepTagDragStart.value = null;
    sleepTagSuppressClick.value = false;
    sleepDeleteZoneActive.value = false;
    sleepTagHidden.value = false;
    sleepTagMounted.value = false;
    blobState.wakeUp();
    setIgnoreMouseEvents(false);
    setInteractionLocked(menuOpen.value || journalOpen.value || secMenuOpen.value);
};

const onSleepTagAfterLeave = () => {
    if (blobState.state.value === STATES.SLEEPING && !sleepTagHidden.value) {
        performWakeFromSleep();
    }
};

const syncSleepClickthrough = (mouseX = null, mouseY = null) => {
    if (blobState.state.value !== STATES.SLEEPING || sleepTagDragging.value) {
        return;
    }

    const wakeButton = wakeButtonRef.value;
    if (!wakeButton) {
        setIgnoreMouseEvents(true);
        return;
    }

    if (!Number.isFinite(mouseX) || !Number.isFinite(mouseY)) {
        setIgnoreMouseEvents(true);
        return;
    }

    const rect = wakeButton.getBoundingClientRect();
    const isOverWakeButton = mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom;
    setIgnoreMouseEvents(!isOverWakeButton);
};

const resolveSleepSide = () => {
    const { width } = getViewportBounds();

    if (!blobCenter.value) {
        return "right";
    }

    return blobCenter.value.x < width / 2 ? "left" : "right";
};

const syncSleepState = () => {
    const storedSleepState = readStoredSleepState();

    if (!storedSleepState) {
        if (blobState.state.value === STATES.SLEEPING) {
            wakeFromSleep();
        }
        return;
    }

    const remainingMs = storedSleepState.indefinite ? null : storedSleepState.wakeAt - Date.now();
    if (storedSleepState.indefinite) {
        sleepDockSide.value = storedSleepState.dockSide;
        sleepVisualSide.value = storedSleepState.dockSide;
        sleepDockRatio.value = storedSleepState.dockRatio ?? 0.9;
        sleepTagHidden.value = storedSleepState.showWakeTag === false;
        if (sleepTagHidden.value) {
            sleepTagMounted.value = false;
        } else if (!sleepTagMounted.value) {
            showWakeTagWithDelay(0);
        }

        if (blobState.state.value !== STATES.SLEEPING) {
            blobState.sleepFor(0);
            clearSleepEmotionRestoreTimer();
            applyFaceEmotion("sleeping");
        }

        clearSleepTimer();
        setIgnoreMouseEvents(true);
        return;
    }

    if (remainingMs <= 0) {
        clearStoredSleepState();
        if (blobState.state.value === STATES.SLEEPING) {
            wakeFromSleep();
        } else {
            setIgnoreMouseEvents(false);
        }
        return;
    }

    sleepDockSide.value = storedSleepState.dockSide;
    sleepVisualSide.value = storedSleepState.dockSide;
    sleepDockRatio.value = storedSleepState.dockRatio ?? 0.9;
    sleepTagHidden.value = storedSleepState.showWakeTag === false;
    if (sleepTagHidden.value) {
        sleepTagMounted.value = false;
    } else if (!sleepTagMounted.value) {
        showWakeTagWithDelay(0);
    }
    if (blobState.state.value !== STATES.SLEEPING) {
        blobState.sleepFor(remainingMs);
        clearSleepEmotionRestoreTimer();
        applyFaceEmotion("sleeping");
    }

    clearSleepTimer();
    sleepTimerId.value = window.setTimeout(() => {
        wakeFromSleep();
    }, remainingMs);
    setIgnoreMouseEvents(true);
};

const wakeFromSleep = ({ animateTag = true } = {}) => {
    if (animateTag && !sleepTagHidden.value && sleepTagMounted.value) {
        sleepTagMounted.value = false;
        return;
    }

    performWakeFromSleep();
};

const handleSleepConfirm = (payload) => {
    const normalizedPayload = typeof payload === "number" ? { durationMs: payload } : payload || {};
    const durationMs = Number(normalizedPayload.durationMs);
    const untilWokenUp = normalizedPayload.unit === "until-woken-up";
    showSleepModal.value = false;
    closeMenu();

    syncSleepDraft(sleepSetupDraft.value);

    clearSleepTimer();
    sleepDockSide.value = resolveSleepSide();
    sleepVisualSide.value = sleepDockSide.value;
    sleepDockRatio.value = 0.9;
    sleepTagHidden.value = !appSettings.value.sleepTagVisible;
    sleepTagMounted.value = false;
    showWakeTagWithDelay(appSettings.value.sleepTagVisible ? 3000 : 0);
    if (untilWokenUp) {
        writeStoredSleepState(null, sleepDockSide.value, sleepDockRatio.value, true);
        blobState.sleepFor(0);
        setIgnoreMouseEvents(true);
        clearSleepEmotionRestoreTimer();
        applyFaceEmotion("sleeping");
        return;
    }

    const wakeAt = Date.now() + Math.max(0, Number(durationMs) || 0);
    writeStoredSleepState(wakeAt, sleepDockSide.value, sleepDockRatio.value);
    blobState.sleepFor(durationMs);
    setIgnoreMouseEvents(true);
    clearSleepEmotionRestoreTimer();
    applyFaceEmotion("sleeping");

    sleepTimerId.value = window.setTimeout(() => {
        wakeFromSleep();
    }, Math.max(0, wakeAt - Date.now()));
};

const handleSleepCancel = () => {
    showSleepModal.value = false;
};

const openMenu = () => {
    if (didDragRecently()) {
        return;
    }

    secMenuOpen.value = false;

    if (!menuOpen.value) {
        menuOpen.value = true;
        syncMenuState();
        return;
    }

    if (!journalOpen.value) {
        closeMenu();
    }
};

const openJournal = () => {
    const { width } = getViewportBounds();
    journalPanelSide.value = !blobCenter.value || blobCenter.value.x < width / 2 ? "left" : "right";

    menuOpen.value = true;
    journalOpen.value = true;
    secMenuOpen.value = false;
    syncMenuState();
};

const openSecMenu = () => {
    if (didDragRecently()) {
        return;
    }

    menuOpen.value = false;
    journalOpen.value = false;
    journalPanelSide.value = null;
    secMenuOpen.value = true;
    syncMenuState();
};

const sendToSleep = () => {
    const storedPreference = storage.readSleepPreference();
    if (storedPreference) {
        syncSleepDraft({
            amount: storedPreference.amount,
            unit: storedPreference.unit,
            rememberAsDefault: true,
        });
        handleSleepConfirm({
            durationMs: storedPreference.unit === "until-woken-up"
                ? null
                : Math.max(60 * 1000, storedPreference.amount * (storedPreference.unit === "minutes" ? 60 * 1000 : 60 * 60 * 1000)),
            unit: storedPreference.unit,
            amount: storedPreference.amount,
        });
        return;
    }

    closeMenu();
    showSleepModal.value = true;
};

const openSettings = () => {
    closeMenu();
    showSettingsModal.value = true;
};

const closeSettings = () => {
    showSettingsModal.value = false;
};

const updateBlobSizeSetting = (nextValue) => {
    syncAppSettings({ blobSize: clampPercent(nextValue) });
};

const updateSleepAmountSetting = (nextValue) => {
    syncSleepDraft({
        amount: nextValue,
        unit: sleepSetupDraft.value.unit,
        rememberAsDefault: sleepSetupDraft.value.rememberAsDefault,
    });
};

const updateSleepUnitSetting = (nextValue) => {
    syncSleepDraft({
        amount: sleepSetupDraft.value.amount,
        unit: nextValue,
        rememberAsDefault: sleepSetupDraft.value.rememberAsDefault,
    });
};

const updateAskEveryTimeSetting = (nextValue) => {
    syncSleepDraft({
        amount: sleepSetupDraft.value.amount,
        unit: sleepSetupDraft.value.unit,
        rememberAsDefault: !Boolean(nextValue),
    });
};

const updateSleepTagVisibleSetting = (nextValue) => {
    syncAppSettings({ sleepTagVisible: Boolean(nextValue) });
};

const updateStartOnSystemRestartSetting = async (nextValue) => {
    const desired = Boolean(nextValue);
    syncAppSettings({ startOnSystemRestart: desired });

    try {
        const savedValue = await ipc.invoke("app:set-start-on-restart", desired);
        if (typeof savedValue === "boolean") {
            syncAppSettings({ startOnSystemRestart: savedValue });
        }
    } catch (error) {
        console.error("Failed to update startup setting:", error);
    }
};

const redoOnboarding = async () => {
    closeSettings();

    try {
        await ipc.invoke("reset-onboarding-state");
    } catch (error) {
        console.error("Failed to redo onboarding:", error);
    }
};

const clearJournal = async () => {
    closeSettings();

    try {
        const didReset = await ipc.invoke("journal:reset");
        if (didReset) {
            await journal.loadEntries();
        }
    } catch (error) {
        console.error("Failed to clear journal:", error);
    }
};

const hardReset = async () => {
    closeSettings();

    try {
        await ipc.invoke("app:hard-reset");
    } catch (error) {
        console.error("Failed to perform hard reset:", error);
    }
};

const quitApplication = () => {
    closeMenu({ clearDraft: true });
    try { ipc.send('quit-app'); } catch { }
};

const submitJournal = async (entryOptions = {}) => {
    try {
        let protectedAlready = true;

        if (entryOptions?.isSecret) {
            protectedAlready = await isPinProtected();
            if (!protectedAlready) {
                pendingEntryOptions.value = entryOptions;
                showPINModal.value = true;

                await new Promise((resolve, reject) => {
                    _passwordSetupResolve.ref = resolve;
                    _passwordSetupReject.ref = reject;
                });
            }
        }

        const savedEntry = await saveEntry(entryOptions);
        if (!savedEntry) {
            return;
        }

        if (entryOptions?.isSecret && !protectedAlready) {
            await journal.loadEntries();
        }

        latestSubmittedEmotion.value = savedEntry.emotion || DEFAULT_FACE_EMOTION;
        applyFaceEmotion(latestSubmittedEmotion.value);

        jump();
        blobState.setState(STATES.IDLE);
    } catch (err) {
        // user cancelled PIN setup or something else failed; abort submission silently
        pendingEntryOptions.value = null;
        return;
    }
};

const handleUnlockEntry = async () => {
    showPINModal.value = true;
};

const handleDeleteEntry = async (entryId) => {
    try {
        await journal.deleteEntry(entryId);
    } catch (err) {
        console.error('Failed to delete entry', err);
    }
};

const handlePINSetupComplete = async () => {
    showPINModal.value = false;

    if (_passwordSetupResolve.ref) {
        _passwordSetupResolve.ref(true);
        _passwordSetupResolve.ref = null;
    }

    _passwordSetupReject.ref = null;
};

const handlePINUnlockComplete = async () => {
    showPINModal.value = false;
    await journal.loadEntries();
};

const handlePINCancel = async () => {
    showPINModal.value = false;
    if (_passwordSetupReject.ref) {
        _passwordSetupReject.ref(new Error('cancelled'));
        _passwordSetupReject.ref = null;
    }
    _passwordSetupResolve.ref = null;
};

watch(
    entries,
    () => {
        if (selectedEmotion.value) {
            return;
        }

        latestSubmittedEmotion.value = resolveLatestSubmittedEmotion();
        applyFaceEmotion(latestSubmittedEmotion.value);
    },
    { immediate: true }
);

watch(
    selectedEmotion,
    (emotionId) => {
        applyFaceEmotion(emotionId || DEFAULT_FACE_EMOTION);
    },
    { immediate: true }
);

watch(blobState.state, (next) => {
    if (next === STATES.ENGAGED) {
        startEyeFollow(getCursorOffset);
        return;
    }

    if (next === STATES.SLEEPING) {
        stopEyeFollow();
        clearSleepEmotionRestoreTimer();
        applyFaceEmotion("sleeping");
        return;
    }

    if (blobState.previous.value === STATES.SLEEPING && next === STATES.IDLE) {
        restoreFaceEmotionAfterSleep();
    }

    stopEyeFollow();
});

onMounted(() => {
    const onMove = (e) => {
        mousePos.value = { x: e.clientX, y: e.clientY };

        if (sleepTagPointerDown.value && sleepTagDragStart.value) {
            const movedDistance = Math.hypot(e.clientX - sleepTagDragStart.value.x, e.clientY - sleepTagDragStart.value.y);
            if (movedDistance > 6 && !sleepTagDragging.value) {
                sleepTagDragging.value = true;
                sleepTagSuppressClick.value = true;
                sleepVisualSide.value = sleepDockSide.value;
            }
        }

        if (sleepTagDragging.value) {
            updateSleepDockPosition(e.clientX, e.clientY);
            sleepDeleteZoneActive.value = isPointInDeleteZone(e.clientX, e.clientY);
            setIgnoreMouseEvents(false);
            return;
        }

        if (blobState.state.value === STATES.SLEEPING) {
            syncSleepClickthrough(e.clientX, e.clientY);
        }
    };
    const onUp = (e) => {
        if (sleepTagPointerDown.value) {
            finishSleepTagDrag(e.clientX, e.clientY);
        }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    onBeforeUnmount(() => window.removeEventListener("mousemove", onMove));
    onBeforeUnmount(() => window.removeEventListener("mouseup", onUp));
});

onMounted(() => {
    const onResume = () => syncSleepState();

    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);
    document.addEventListener("visibilitychange", onResume);
    syncSleepState();

    onBeforeUnmount(() => {
        window.removeEventListener("focus", onResume);
        window.removeEventListener("pageshow", onResume);
        document.removeEventListener("visibilitychange", onResume);
    });
});

onMounted(() => {
    const onTrayWake = () => {
        if (blobState.state.value === STATES.SLEEPING) {
            wakeFromSleep();
        }
    };

    (async () => {
        const _ipc = await ipc.ipc();
        _ipc?.on?.("tray:wake-blob", onTrayWake);
        removeTrayWakeListener = () => _ipc?.removeListener?.("tray:wake-blob", onTrayWake);
    })();
});

watch(grabbing, (isGrabbing) => {
    if (!isGrabbing || !(menuOpen.value || journalOpen.value || secMenuOpen.value)) {
        return;
    }

    closeMenu();
});

watch(journalOpen, (isOpen) => {
    if (isOpen) {
        lockedPanelStyle.value = computedPanelStyle.value;
    } else {
        lockedPanelStyle.value = null;
    }
});

watch(
    () => menuOpen.value || journalOpen.value || secMenuOpen.value || showPINModal.value || showSleepModal.value || showSettingsModal.value,
    (isInteractive) => {
        setInteractionLocked(isInteractive);
    },
    { immediate: true }
);

watch(
    () => blobState.state.value,
    (next) => {
        if (next === STATES.SLEEPING) {
            syncSleepClickthrough(mousePos.value.x, mousePos.value.y);
            return;
        }

        sleepTagPointerDown.value = false;
        sleepTagDragging.value = false;
        sleepTagDragStart.value = null;
        sleepTagSuppressClick.value = false;
        sleepDeleteZoneActive.value = false;
        sleepTagMounted.value = false;
        setIgnoreMouseEvents(false);
    }
);

onBeforeUnmount(() => {
    removeTrayWakeListener?.();
    removeTrayWakeListener = null;
    clearSleepTagAnimationTimers();
    clearSleepTimer();
    clearSleepEmotionRestoreTimer();
    clearStoredSleepState();
    setIgnoreMouseEvents(false);
    setInteractionLocked(false);
    blobState.setState(false);
});
</script>

<template>
    <div class="shell" :style="shellStyle">
        <BlobVisuals :hue-variables="hueVariables" :blob-path="blobPath" :edge-width="EDGE_WIDTH" :grabbing="grabbing"
            :face-style="faceStyle" :face-parts="faceParts"
            :face-eyes-style="{ transform: `translateY(-175%) translate(${eyesOffset.x}px, ${eyesOffset.y}px)`, transition: 'transform 0.3s ease' }"
            :outline-points="outlinePoints" :positions="positions" :blob-area-ref="setBlobAreaRef"
            :blob-edge-ref="setBlobEdgeRef" :emotion="visualEmotion" :is-active="menuOpen || journalOpen || secMenuOpen"
            :blob-scale="blobScale" :pin-progress="pinProgress" :pin-anchor="pinAnchor" :is-pinned="isPinned"
            @start-drag="startDrag" @open-menu="openMenu" @open-sec-menu="openSecMenu" :state="blobState.state.value" />

        <Transition name="sleep-tag" @after-leave="onSleepTagAfterLeave">
            <button v-if="blobState.state.value === STATES.SLEEPING && !sleepTagHidden && sleepTagMounted"
                ref="wakeButtonRef" class="sleep-tag" :class="sleepDockSide" :style="sleepTagStyle"
                aria-label="Wake Blob" @mousedown.prevent="handleWakeButtonPointerDown" @click="handleWakeButtonClick">
            </button>
        </Transition>

        <div v-if="blobState.state.value === STATES.SLEEPING && sleepTagDragging" ref="sleepDeleteZoneRef"
            class="sleep-delete-zone" :class="[sleepDockSide, { active: sleepDeleteZoneActive }]">
            Remove
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                <path
                    d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
        </div>

        <button v-if="menuOpen || journalOpen || secMenuOpen" class="menu-backdrop" aria-label="Close menu"
            @click="closeMenu" tabindex="-1" />

        <RadialMenu :visible="menuOpen && Boolean(blobCenter)" :anchor-style="menuAnchorStyle"
            @open-journal="openJournal" @sleep="sendToSleep" @settings="openSettings" />

        <RadialMenu :visible="secMenuOpen && Boolean(blobCenter)" :anchor-style="menuAnchorStyle" mode="secondary"
            @quit="quitApplication" />

        <MicroJournal :visible="journalOpen" :panel-style="panelStyle" :prompt="activePrompt"
            :emotion-tags="emotionTags" :selected-emotion="selectedEmotion" :text-value="journalText"
            :can-submit="canSubmit" :max-length="maxEntryLength" :entries="entries" :is-unlocked="isUnlocked"
            :prompt-visible="journalPromptVisible" :emotion-visible="journalEmotionVisible"
            :text-visible="journalTextVisible" @update:prompt-visible="journalPromptVisible = $event"
            @update:emotion-visible="journalEmotionVisible = $event" @update:text-visible="journalTextVisible = $event"
            @close="closeMenu" @select-emotion="setEmotionTag" @rotate-prompt="rotatePrompt"
            @update:text="setJournalText" @submit="submitJournal" @unlock-entries="handleUnlockEntry"
            @delete-entry="handleDeleteEntry" />

        <Transition name="overlay-fade" appear>
            <PINWindow v-if="showPINModal" @password-set="handlePINSetupComplete"
                @password-unlocked="handlePINUnlockComplete"
                @cancel="handlePINCancel" />
        </Transition>

        <Transition name="overlay-fade" appear>
            <SleepWindow v-if="showSleepModal" :initial-amount="sleepSetupDraft.amount"
                :initial-unit="sleepSetupDraft.unit" @confirm="handleSleepConfirm" @cancel="handleSleepCancel"
                @draft-change="syncSleepDraft" />
        </Transition>

        <Transition name="overlay-fade" appear>
            <SettingsWindow v-if="showSettingsModal" :blob-size="appSettings.blobSize"
                :sleep-amount="sleepSetupDraft.amount" :sleep-unit="sleepSetupDraft.unit"
                :ask-every-time="!sleepSetupDraft.rememberAsDefault" :sleep-tag-visible="appSettings.sleepTagVisible"
                :start-on-system-restart="appSettings.startOnSystemRestart" @close="closeSettings"
                @update:blob-size="updateBlobSizeSetting" @update:sleep-amount="updateSleepAmountSetting"
                @update:sleep-unit="updateSleepUnitSetting" @update:ask-every-time="updateAskEveryTimeSetting"
                @update:sleep-tag-visible="updateSleepTagVisibleSetting"
                @update:start-on-system-restart="updateStartOnSystemRestartSetting" @redo-onboarding="redoOnboarding"
                @clear-journal="clearJournal" @hard-reset="hardReset" />
        </Transition>
    </div>
</template>

<style scoped>
.shell {
    overflow: visible;
    position: fixed;
    inset: 0;
}

.shell :deep(.root) {
    z-index: 13;
}

.menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 12;
    border: 0;
    padding: 0;
    margin: 0;
    background: transparent;
    pointer-events: all;
}

.sleep-tag {
    --sleep-tag-slide-x: 0%;
    position: fixed;
    z-index: 14;
    border: 0;
    padding: 1rem 0.75rem;
    background: var(--primary);
    color: var(--text-strong);
    box-shadow: 0 0 0.5rem var(--shadow);
    transform: translateY(-50%);
    cursor: pointer;
    pointer-events: auto;
    transition: padding 0.2s ease, background 0.2s ease;
    touch-action: none;
    user-select: none;
}

.sleep-tag:hover {
    background: var(--lighter);
    padding: 1rem;
}

.sleep-tag.left {
    --sleep-tag-slide-x: -105%;
    left: 0;
    border-radius: 0 1rem 1rem 0;
}

.sleep-tag.right {
    --sleep-tag-slide-x: 105%;
    right: 0;
    border-radius: 1rem 0 0 1rem;
}

.sleep-tag:focus-visible {
    outline: 3px solid var(--lighter);
    outline-offset: 2px;
}

.sleep-tag-enter-active,
.sleep-tag-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.sleep-tag-enter-from,
.sleep-tag-leave-to {
    opacity: 0;
    transform: translateY(-50%) translateX(var(--sleep-tag-slide-x));
}

.sleep-tag-enter-to,
.sleep-tag-leave-from {
    opacity: 1;
    transform: translateY(-50%);
}

.sleep-delete-zone {
    position: fixed;
    width: 6rem;
    top: 0;
    transform: none;
    z-index: 13;
    padding: 1rem;
    color: var(--text-strong);
    font-weight: 600;
    background: var(--lighter);
    pointer-events: none;
    display: flex;
    align-items: center;
}

.sleep-delete-zone svg {
    margin: 0 0.5rem;
    flex-shrink: 0;
    width: 1.2rem;
    height: 1.2rem;
}

.sleep-delete-zone.left {
    border-radius: 0 0 1.5rem 0;
    text-align: right;
    left: 0;
    flex-direction: row-reverse;
}

.sleep-delete-zone.right {
    border-radius: 0 0 0 1.5rem;
    text-align: left;
    right: 0;
    flex-direction: row;
}

.sleep-delete-zone.active {
    background: var(--white);
    box-shadow: 0 0 1rem var(--primary);
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
    opacity: 0;
}
</style>
