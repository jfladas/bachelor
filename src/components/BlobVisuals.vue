<script setup>
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
    outlinePoints: {
        type: Array,
        required: true,
    },
    positions: {
        type: Array,
        required: true,
    },
    eyesSrc: {
        type: String,
        required: true,
    },
    mouthSrc: {
        type: String,
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
    companionState: {
        type: String,
        default: "idle",
    },
});

const dev = false; // dev mode shows physics bodies and outlines for debugging

defineEmits(["start-drag", "activate-companion"]);
</script>

<template>
    <div class="root" :style="props.hueVariables"
        :class="[{ active: props.isActive }, `state-${props.companionState}`]">
        <svg class="blob-overlay" aria-hidden="true">
            <path :ref="props.blobAreaRef" class="blob-area" :class="{ grabbing: props.grabbing, dev: dev }"
                :d="props.blobPath" @mousedown="$emit('start-drag', $event)"
                @click.stop="$emit('activate-companion')" />
            <path :ref="props.blobEdgeRef" class="blob-edge" :class="{ dev: dev }" :d="props.blobPath"
                :style="{ strokeWidth: `${props.edgeWidth}px` }" @mousedown="$emit('start-drag', $event)"
                @click.stop="$emit('activate-companion')" />
        </svg>

        <div v-if="!dev" class="face" :style="props.faceStyle">
            <img class="face-eyes" :src="props.eyesSrc" alt="" />
            <img class="face-mouth" :src="props.mouthSrc" alt="" />
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
    position: fixed;
    inset: 0;
}

.blob-overlay {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.blob-area {
    cursor: pointer;
    fill: var(--primary);
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
    position: fixed;
    transform: translate(-50%, -100%);
    pointer-events: none;
    z-index: 2;
    user-select: none;
}

.face-eyes,
.face-mouth {
    position: absolute;
    left: 50%;
    display: block;
    height: auto;
    transform: translateX(-50%);
}

.face-eyes {
    width: 3.5rem;
    bottom: 1.2rem;
}

.face-mouth {
    width: 2.8rem;
    bottom: -0.5rem;
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
</style>
