<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import BlobVisuals from "./BlobVisuals.vue";
import RadialMenu from "./RadialMenu.vue";
import MicroJournal from "./MicroJournal.vue";
import eyesDefaultImage from "../assets/face/eyes_default.svg";
import mouthDefaultImage from "../assets/face/mouth_default.svg";
import { COMPANION_STATES, usePhysicsBlob } from "../composables/usePhysicsBlob";
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
    companionState,
    outlinePoints,
    blobPath,
    faceStyle,
    setBlobAreaRef,
    setBlobEdgeRef,
    startDrag,
    didDragRecently,
    setInteractionLocked,
    setManualState,
    playMiniCelebrate,
} = usePhysicsBlob({
    ballRadii,
    activity,
    ipcRenderer,
});

const {
    emotionTags,
    journalText,
    selectedEmotion,
    activePrompt,
    canSubmit,
    maxEntryLength,
    setJournalText,
    setEmotionTag,
    rotatePrompt,
    resetDraft,
    saveEntry,
} = useMicroJournal();

const menuOpen = ref(false);
const journalOpen = ref(false);
const journalPanelSide = ref(null);

let idleStateTimeoutId;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getViewportBounds = () => {
    if (typeof window === "undefined") {
        return { width: 1280, height: 720 };
    }

    return {
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight),
    };
};

const companionCenter = computed(() => {
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

    if (!companionCenter.value) {
        return {
            left: "-9999px",
            top: "-9999px",
        };
    }

    return {
        left: `${clamp(companionCenter.value.x, safeRadius, maxX)}px`,
        top: `${clamp(companionCenter.value.y, 0, maxY)}px`,
    };
});

const getJournalPanelSide = () => {
    const { width } = getViewportBounds();

    if (journalPanelSide.value) {
        return journalPanelSide.value;
    }

    if (!companionCenter.value) {
        return "left";
    }

    return companionCenter.value.x < width / 2 ? "left" : "right";
};

const panelStyle = computed(() => {
    const { width } = getViewportBounds();
    const panelWidth = 480;
    const minInset = 110;
    const bottomOffset = 48;
    const sideOffset = 110;
    const maxInset = Math.max(minInset, width - panelWidth - minInset);
    const side = getJournalPanelSide();

    if (!companionCenter.value) {
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

    const companionX = companionCenter.value.x;

    if (side === "left") {
        return {
            left: `${clamp(companionX + sideOffset, minInset, maxInset)}px`,
            right: "auto",
            bottom: `${bottomOffset}px`,
        };
    }

    return {
        left: "auto",
        right: `${clamp(width - companionX + sideOffset, minInset, maxInset)}px`,
        bottom: `${bottomOffset}px`,
    };
});

const setCompanionMenuState = (isOpen) => {
    setManualState(isOpen ? COMPANION_STATES.ACTIVE : null);
};

const closeMenu = ({ clearDraft = false } = {}) => {
    menuOpen.value = false;
    journalOpen.value = false;
    journalPanelSide.value = null;
    setCompanionMenuState(false);

    if (clearDraft) {
        resetDraft();
    }
};

const activateCompanion = () => {
    if (didDragRecently()) {
        return;
    }

    if (!menuOpen.value) {
        menuOpen.value = true;
        setCompanionMenuState(true);
        return;
    }

    if (!journalOpen.value) {
        closeMenu();
    }
};

const openJournal = () => {
    const { width } = getViewportBounds();
    journalPanelSide.value = !companionCenter.value || companionCenter.value.x < width / 2 ? "left" : "right";

    menuOpen.value = true;
    journalOpen.value = true;
    setCompanionMenuState(true);
};

const sendCompanionToSleep = () => {
    closeMenu();
    ipcRenderer?.send?.("hide-app");
};

const openSettings = () => {
    // Placeholder until settings UI is implemented.
};

const submitJournal = (entryOptions = {}) => {
    const savedEntry = saveEntry(entryOptions);
    if (!savedEntry) {
        return;
    }

    playMiniCelebrate();
    closeMenu();

    setManualState(COMPANION_STATES.IDLE);
    if (idleStateTimeoutId) {
        window.clearTimeout(idleStateTimeoutId);
    }

    idleStateTimeoutId = window.setTimeout(() => {
        setManualState(null);
        idleStateTimeoutId = undefined;
    }, 520);
};

watch(grabbing, (isGrabbing) => {
    if (!isGrabbing || !menuOpen.value) {
        return;
    }

    closeMenu();
});

watch(
    () => menuOpen.value || journalOpen.value,
    (isInteractive) => {
        setInteractionLocked(isInteractive);
    },
    { immediate: true }
);

onBeforeUnmount(() => {
    if (idleStateTimeoutId) {
        window.clearTimeout(idleStateTimeoutId);
        idleStateTimeoutId = undefined;
    }

    setInteractionLocked(false);
    setCompanionMenuState(false);
});
</script>

<template>
    <div class="companion-shell" :style="hueVariables">
        <BlobVisuals :hue-variables="hueVariables" :blob-path="blobPath" :edge-width="EDGE_WIDTH" :grabbing="grabbing"
            :face-style="faceStyle" :outline-points="outlinePoints" :positions="positions" :eyes-src="eyesDefaultImage"
            :mouth-src="mouthDefaultImage" :blob-area-ref="setBlobAreaRef" :blob-edge-ref="setBlobEdgeRef"
            :is-active="menuOpen || journalOpen" :companion-state="companionState" @start-drag="startDrag"
            @activate-companion="activateCompanion" />

        <button v-if="menuOpen || journalOpen" class="menu-backdrop" aria-label="Close companion menu"
            @click="closeMenu" tabindex="-1" />

        <RadialMenu :visible="menuOpen && Boolean(companionCenter)" :anchor-style="menuAnchorStyle"
            @open-journal="openJournal" @sleep="sendCompanionToSleep" @settings="openSettings" />

        <MicroJournal :visible="journalOpen" :panel-style="panelStyle" :prompt="activePrompt"
            :emotion-tags="emotionTags" :selected-emotion="selectedEmotion" :text-value="journalText"
            :can-submit="canSubmit" :max-length="maxEntryLength" @close="closeMenu" @select-emotion="setEmotionTag"
            @rotate-prompt="rotatePrompt" @update:text="setJournalText" @submit="submitJournal" />
    </div>
</template>

<style scoped>
.companion-shell {

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
