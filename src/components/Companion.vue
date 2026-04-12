<script setup>
import { computed } from "vue";
import BlobVisuals from "./BlobVisuals.vue";
import eyesDefaultImage from "../assets/face/eyes_default.svg";
import mouthDefaultImage from "../assets/face/mouth_default.svg";
import { usePhysicsBlob } from "../composables/usePhysicsBlob";
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
const reaction = computed(() => props.onboardingData?.reaction || "sparkles");

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
    outlinePoints,
    blobPath,
    faceStyle,
    setBlobAreaRef,
    setBlobEdgeRef,
    startDrag,
} = usePhysicsBlob({
    ballRadii,
    activity,
    ipcRenderer,
});
</script>

<template>
    <BlobVisuals :hue-variables="hueVariables" :blob-path="blobPath" :edge-width="EDGE_WIDTH" :grabbing="grabbing"
        :face-style="faceStyle" :outline-points="outlinePoints" :positions="positions" :eyes-src="eyesDefaultImage"
        :mouth-src="mouthDefaultImage" :blob-area-ref="setBlobAreaRef" :blob-edge-ref="setBlobEdgeRef"
        @start-drag="startDrag" />
</template>
