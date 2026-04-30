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
    faceParts: {
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
});

const dev = false; // dev mode shows physics bodies and outlines for debugging

defineEmits(["start-drag", "open-menu", "open-sec-menu"]);
</script>

<template>
    <div class="root" :style="props.hueVariables" :class="[{ active: props.isActive }, `state-${props.state}`]">
        <svg class="blob-overlay" aria-hidden="true">
            <path :ref="props.blobAreaRef" class="blob-area" :class="{ grabbing: props.grabbing, dev: dev }"
                :d="props.blobPath" @mousedown="$emit('start-drag', $event)" @click.stop="$emit('open-menu')"
                @contextmenu.prevent.stop="$emit('open-sec-menu', $event)" />
            <path :ref="props.blobEdgeRef" class="blob-edge" :class="{ dev: dev }" :d="props.blobPath"
                :style="{ strokeWidth: `${props.edgeWidth}px` }" @mousedown="$emit('start-drag', $event)"
                @click.stop="$emit('open-menu')" @contextmenu.prevent.stop="$emit('open-sec-menu', $event)" />
        </svg>

        <div v-if="!dev" class="face" :style="props.faceStyle">
            <svg class="face-eyes" viewBox="0 0 363 180" aria-hidden="true">
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
    position: relative;
    display: flex;
    pointer-events: none;
    width: 4.5rem;
    transform: translateX(-50%);
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
    stroke: none;
}

.face-mouth {
    position: absolute;
    transform: translateY(-75%);
    pointer-events: none;
    display: block;
    overflow: visible;
    fill: var(--white);
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
</style>
