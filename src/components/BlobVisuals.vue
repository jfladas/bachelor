<script setup>
import { computed, getCurrentInstance, ref } from 'vue';

const props = defineProps({
    hueVariables: {
        type: Object,
        required: true,
    },
    blobPath: {
        type: String,
        required: true,
    },
    edgeWidth: {
        type: Number,
        required: true,
    },
    grabbing: {
        type: Boolean,
        required: true,
    },
    faceStyle: {
        type: Object,
        required: true,
    },
    faceParts: {
        type: Object,
        required: true,
    },
    faceEyesStyle: {
        type: Object,
        default: () => ({}),
    },
    outlinePoints: {
        type: Array,
        required: true,
    },
    positions: {
        type: Array,
        required: true,
    },
    blobAreaRef: {
        type: Function,
        default: null,
    },
    blobEdgeRef: {
        type: Function,
        default: null,
    },
    isActive: {
        type: Boolean,
        default: false,
    },
    state: {
        type: String,
        default: "idle",
    },
    emotion: {
        type: String,
        default: "default",
    },
    blobScale: {
        type: Number,
        default: 1,
    },
});

const dev = false; // dev mode shows physics bodies and outlines for debugging

const emit = defineEmits(["start-drag", "open-menu", "open-sec-menu"]);

const downPos = ref(null);
const CLICK_MOVE_THRESHOLD = 6;
const EMOTION_KEYS = new Set(["excited", "content", "sad", "anxious", "angry"]);

const gradientBaseId = `blob-gradient-${getCurrentInstance()?.uid ?? "main"}`;
const primaryGradientId = `${gradientBaseId}-a`;
const accentGradientId = `${gradientBaseId}-b`;

const emotionKey = computed(() => (EMOTION_KEYS.has(props.emotion) ? props.emotion : null));

const rootStyle = computed(() => {
    const style = {
        ...props.hueVariables,
        "--blob-scale": `${Math.max(0.5, Number(props.blobScale) || 1)}`,
    };

    if (emotionKey.value) {
        style["--emotion-hue"] = `var(--${emotionKey.value})`;
    }

    return style;
});

const normalizeHue = (value, fallback = 220) => {
    const numeric = Number.parseFloat(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return ((numeric % 360) + 360) % 360;
};

const hueBlend = (fromHue, toHue, amount) => {
    const start = normalizeHue(fromHue);
    const end = normalizeHue(toHue, start);
    const t = Math.max(0, Math.min(1, amount));
    const delta = ((end - start + 540) % 360) - 180;
    return normalizeHue(start + delta * t, start);
};

const oklch = (l, c, h) => `oklch(${l}% ${c} ${normalizeHue(h).toFixed(2)})`;

const baseHue = computed(() => normalizeHue(props.hueVariables?.["--hue"], 220));
const emotionHue = computed(() => normalizeHue(props.hueVariables?.[`--${emotionKey.value}`], baseHue.value));
const primaryL = computed(() => Number.parseFloat(props.hueVariables?.["--primary-l"]) || 71);
const primaryC = computed(() => Number.parseFloat(props.hueVariables?.["--primary-c"]) || 0.16);

const gradientPalette = computed(() => {
    if (!emotionKey.value) {
        return { stops: [] };
    }

    const b = baseHue.value;
    const e = emotionHue.value;
    const l = primaryL.value;
    const c = primaryC.value;

    const colorAt = (mix) => oklch(l, c, hueBlend(b, e, mix));

    const makeStop = (offset, mixes) => ({
        offset,
        color: colorAt(mixes[0]),
        values: mixes.map(colorAt).join(";"),
    });

    return {
        stops: [
            makeStop("0", [0, 0.05, 0.1, 0.05, 0]),
            makeStop("0.5", [0, 0.05, 0.1, 0.05, 0]),
            makeStop("0.6", [0, 0.2, 0.25, 0.2, 0]),
            makeStop("0.7", [0.05, 0.35, 0.4, 0.35, 0.05]),
            makeStop("0.8", [0.1, 0.5, 0.6, 0.5, 0.1]),
            makeStop("0.9", [0.15, 0.65, 0.8, 0.65, 0.15]),
            makeStop("1", [0.2, 0.8, 1, 0.8, 0.2]),
        ],
    };
});

const blobFill = computed(() => (emotionKey.value ? `url(#${accentGradientId})` : "var(--primary)"));

function handlePointerDown(event) {
    downPos.value = { x: event.clientX, y: event.clientY };
    emit('start-drag', event);

    const onPointerUp = (upEvent) => {
        if (upEvent.button === 2) {
            downPos.value = null;
            return;
        }

        if (downPos.value) {
            const dx = (upEvent.clientX || 0) - downPos.value.x;
            const dy = (upEvent.clientY || 0) - downPos.value.y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= CLICK_MOVE_THRESHOLD * CLICK_MOVE_THRESHOLD) {
                emit('open-menu', upEvent);
            }
        }

        downPos.value = null;
    };

    window.addEventListener('pointerup', onPointerUp, { once: true });
}
</script>

<template>
    <div class="root" :style="rootStyle" :class="[{ active: props.isActive }, `state-${props.state}`]">
        <svg class="blob-overlay" aria-hidden="true">
            <defs v-if="emotionKey">
                <radialGradient :id="accentGradientId" gradientUnits="objectBoundingBox" cx="40%" cy="60%" r="70%"
                    fx="80%" fy="20%">
                    <stop v-for="stop in gradientPalette.stops" :key="`accent-${stop.offset}`" :offset="stop.offset"
                        :stop-color="stop.color">
                        <animate attributeName="stop-color" :values="stop.values" dur="18s" repeatCount="indefinite" />
                    </stop>
                    <animateTransform attributeName="gradientTransform" type="rotate" values="360 .5 .5;0 .5 .5"
                        dur="22s" repeatCount="indefinite" />
                </radialGradient>
            </defs>
            <path :ref="props.blobAreaRef" class="blob-area" :class="{ grabbing: props.grabbing, dev: dev }"
                :fill="blobFill" :d="props.blobPath" @pointerdown="handlePointerDown"
                @contextmenu.prevent.stop="$emit('open-sec-menu', $event)" />
            <path :ref="props.blobEdgeRef" class="blob-edge" :class="{ dev: dev }" :d="props.blobPath"
                :style="{ strokeWidth: `${props.edgeWidth}px` }" @mousedown="$emit('start-drag', $event)"
                @pointerdown="handlePointerDown" @contextmenu.prevent.stop="$emit('open-sec-menu', $event)" />
        </svg>

        <div v-if="!dev" class="face" :style="props.faceStyle">
            <svg class="face-eyes" viewBox="0 0 363 180" aria-hidden="true" :style="props.faceEyesStyle">
                <path v-for="(eyePath, index) in props.faceParts.eyes" :key="`eye-${index}`" :d="eyePath" />
            </svg>
            <svg class="face-mouth" viewBox="0 0 363 180" aria-hidden="true">
                <path v-for="(mouthPath, index) in props.faceParts.mouth" :key="`mouth-${index}`" :d="mouthPath" />
            </svg>
        </div>

        <svg v-if="dev" class="overlay" aria-hidden="true">
            <circle v-for="(point, index) in props.outlinePoints" :key="`outline-point-${index}`" class="outline-point"
                :cx="point.x" :cy="point.y" r="3.5" />

            <line v-for="(ballPosition, index) in props.positions" :key="`chain-${index}`"
                :x1="ballPosition.x + ballPosition.radius" :y1="ballPosition.y + ballPosition.radius"
                :x2="props.positions[(index + 1) % props.positions.length]?.x + props.positions[(index + 1) % props.positions.length]?.radius"
                :y2="props.positions[(index + 1) % props.positions.length]?.y + props.positions[(index + 1) % props.positions.length]?.radius" />
        </svg>

        <div v-if="dev" v-for="(ballPosition, index) in props.positions" :key="index" class="ball" :style="{
        left: `${ballPosition.x}px`,
        top: `${ballPosition.y}px`,
        width: `${ballPosition.radius * 2}px`,
        height: `${ballPosition.radius * 2}px`
      }" />
    </div>
</template>

<style scoped>
.root {
    overflow: visible;
    position: fixed;
    inset: 0;
    opacity: 1;
    pointer-events: none;
    transform: translateX(var(--sleep-shift, 0px));
    transform-origin: center;
    transition: transform 6s cubic-bezier(0.22, 0, 0.36, 1), opacity 0.2s linear;
}

.blob-overlay {
    overflow: visible;
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.blob-area {
    cursor: pointer;
    stroke: none;
    pointer-events: all;
    filter: drop-shadow(0 0 1.5rem color-mix(in oklch, var(--shadow) 70%, transparent));
    transition: filter 0.5s ease;
}

.blob-edge {
    cursor: pointer;
    fill: none;
    stroke: none;
    pointer-events: stroke;
}

.blob-area.grabbing {
    cursor: move;
}

.face {
    position: relative;
    display: flex;
    pointer-events: none;
    width: 4.5rem;
    transform: translateX(-50%) scale(var(--blob-scale, 1));
    transform-origin: center;
    z-index: 2;
    user-select: none;
}

.face-eyes {
    position: absolute;
    transform: translateY(-175%);
    pointer-events: none;
    display: block;
    overflow: visible;
    fill: var(--white);
    filter: drop-shadow(0 0 0.5rem color-mix(in oklch, var(--shadow) 50%, transparent));
    stroke: none;
}

.face-mouth {
    position: absolute;
    transform: translateY(-75%);
    pointer-events: none;
    display: block;
    overflow: visible;
    fill: var(--white);
    filter: drop-shadow(0 0 0.5rem color-mix(in oklch, var(--shadow) 50%, transparent));
    stroke: none;
}

.overlay {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.overlay line {
    stroke: var(--text);
    stroke-width: 1;
    stroke-linecap: round;
}

.outline-point {
    stroke: var(--text);
    stroke-width: 1;
    fill: var(--text-strong);
}

.ball {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, var(--white) 0%, var(--primary) 50%, var(--darker) 100%);
    pointer-events: none;
}

.blob-area.dev {
    fill: var(--white);
    stroke: none;
}

.blob-edge.dev {
    stroke: var(--shadow);
}

.root.active .blob-area {
    filter: drop-shadow(0 0 1.5rem color-mix(in oklch, var(--primary) 70%, transparent));
}

.root.state-sleeping .blob-area,
.root.state-sleeping .blob-edge {
    cursor: default;
    pointer-events: none;
}

.root.state-sleeping {
    opacity: 0;
    transition: transform 6s cubic-bezier(0.22, 0, 0.36, 1), opacity 0s linear 6s;
}
</style>
