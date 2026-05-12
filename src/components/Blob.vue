<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BlobVisuals from "./BlobVisuals.vue";
import RadialMenu from "./RadialMenu.vue";
import MicroJournal from "./MicroJournal.vue";
import PasswordSetup from "./PasswordSetup.vue";
import { useBlobPhysics } from "../composables/useBlobPhysics";
import { STATES } from "../composables/useBlobState";
import { useBlobFace } from "../composables/useBlobFace";
import { useBlobState } from "../composables/useBlobState";
import { useMicroJournal } from "../composables/useMicroJournal";
import { createHueVariables } from "../utils/themeColors";
import { clampHue, clampUnit } from "../utils/validation";

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

const { ipcRenderer } = require("electron");

const BALL_COUNT = 5;
const BASE_BALL_RADIUS = 20;
const MAX_RADIUS_VARIATION = 3;
const MIN_BALL_RADIUS = 15;
const EDGE_WIDTH = 20;

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
} = useBlobPhysics({
    ballRadii,
    activity,
    ipcRenderer,
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
} = journal;

const menuOpen = ref(false);
const journalOpen = ref(false);
const journalPanelSide = ref(null);
const secMenuOpen = ref(false);
const showPasswordModal = ref(false);

onMounted(async () => {
    await journal.loadEntries();
});

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

const panelStyle = computed(() => {
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

const setMenuState = (isOpen) => {
    blobState.setState(isOpen ? STATES.ACTIVE : STATES.IDLE);
};

const syncMenuState = () => {
    setMenuState(menuOpen.value || journalOpen.value || secMenuOpen.value);
};

const closeMenu = ({ clearDraft = false } = {}) => {
    menuOpen.value = false;
    journalOpen.value = false;
    journalPanelSide.value = null;
    secMenuOpen.value = false;
    syncMenuState();

    if (clearDraft) {
        resetDraft();
    }
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
    closeMenu();
    ipcRenderer?.send?.("hide-app");
    window.alert("Work in progress");
};

const openSettings = () => {
    window.alert("Work in progress");
};

const quitApplication = () => {
    closeMenu({ clearDraft: true });
    ipcRenderer?.send?.("quit-app");
};

const submitJournal = async (entryOptions = {}) => {
    const savedEntry = await saveEntry(entryOptions);
    if (!savedEntry) {
        return;
    }

    jump();
    blobState.setState(STATES.IDLE);
};

const handleUnlockEntry = async () => {
    showPasswordModal.value = true;
};

const handlePasswordSetupComplete = async () => {
    showPasswordModal.value = false;
};

watch(
    selectedEmotion,
    (emotionId) => {
        if (emotionId) {
            setFace(emotionId);
        }
    },
    { immediate: true }
);

watch(blobState.state, (next) => {
    if (next === STATES.ENGAGED) {
        startEyeFollow(getCursorOffset);
        return;
    }
    stopEyeFollow();
});

onMounted(() => {
    const onMove = (e) => {
        mousePos.value = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove);
    onBeforeUnmount(() => window.removeEventListener("mousemove", onMove));
});

watch(grabbing, (isGrabbing) => {
    if (!isGrabbing || !menuOpen.value) {
        return;
    }

    closeMenu();
});

watch(
    () => menuOpen.value || journalOpen.value || secMenuOpen.value,
    (isInteractive) => {
        setInteractionLocked(isInteractive);
    },
    { immediate: true }
);

onBeforeUnmount(() => {
    setInteractionLocked(false);
    blobState.setState(false);
});
</script>

<template>
    <div class="shell" :style="hueVariables">
        <BlobVisuals :hue-variables="hueVariables" :blob-path="blobPath" :edge-width="EDGE_WIDTH" :grabbing="grabbing"
            :face-style="faceStyle" :face-parts="faceParts"
            :face-eyes-style="{ transform: `translateY(-175%) translate(${eyesOffset.x}px, ${eyesOffset.y}px)`, transition: 'transform 0.3s ease' }"
            :outline-points="outlinePoints" :positions="positions" :blob-area-ref="setBlobAreaRef"
            :blob-edge-ref="setBlobEdgeRef" :is-active="menuOpen || journalOpen || secMenuOpen" @start-drag="startDrag"
            @open-menu="openMenu" @open-sec-menu="openSecMenu" :state="blobState.state.value" />

        <button v-if="menuOpen || journalOpen || secMenuOpen" class="menu-backdrop" aria-label="Close menu"
            @click="closeMenu" tabindex="-1" />

        <RadialMenu :visible="menuOpen && Boolean(blobCenter)" :anchor-style="menuAnchorStyle"
            @open-journal="openJournal" @sleep="sendToSleep" @settings="openSettings" />

        <RadialMenu :visible="secMenuOpen && Boolean(blobCenter)" :anchor-style="menuAnchorStyle" mode="secondary"
            @quit="quitApplication" />

        <MicroJournal :visible="journalOpen" :panel-style="panelStyle" :prompt="activePrompt"
            :emotion-tags="emotionTags" :selected-emotion="selectedEmotion" :text-value="journalText"
            :can-submit="canSubmit" :max-length="maxEntryLength" :entries="entries" :is-unlocked="isUnlocked"
            @close="closeMenu" @select-emotion="setEmotionTag" @rotate-prompt="rotatePrompt"
            @update:text="setJournalText" @submit="submitJournal" @unlock-entries="handleUnlockEntry" />

        <PasswordSetup v-if="showPasswordModal" @password-set="handlePasswordSetupComplete"
            @password-unlocked="handlePasswordSetupComplete" @cancel="showPasswordModal = false" />
    </div>
</template>

<style scoped>
.shell {

    position: fixed;
    inset: 0;
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
</style>
