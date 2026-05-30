<script setup>
import { computed } from "vue";

const props = defineProps({
    modelValue: {
        type: [Number, String],
        default: 0,
    },
    id: {
        type: String,
        required: true,
    },
    min: {
        type: Number,
        default: 0,
    },
    max: {
        type: Number,
        default: 1,
    },
    step: {
        type: Number,
        default: 0.1,
    },
    leftLabel: {
        type: String,
        default: "",
    },
    rightLabel: {
        type: String,
        default: "",
    },
    centerLabel: {
        type: String,
        default: "",
    },
    leftTooltip: {
        type: String,
        default: "",
    },
    rightTooltip: {
        type: String,
        default: "",
    },
    centerTooltip: {
        type: String,
        default: "",
    },
    ariaLabel: {
        type: String,
        default: "Range slider",
    },
    showMarkers: {
        type: Boolean,
        default: true,
    },
});

const emit = defineEmits(["update:modelValue"]);

const normalizedValue = computed(() => Number(props.modelValue));

const stepMarkers = computed(() => {
    const markerCount = Math.max(0, Math.round((props.max - props.min) / props.step));
    return Array.from({ length: markerCount + 1 }, (_, index) => Number((props.min + index * props.step).toFixed(1)));
});

const handleInput = (event) => {
    emit("update:modelValue", Number(event.target.value));
};
</script>

<template>
    <div class="range-slider">
        <label v-if="leftLabel || rightLabel || centerLabel" :for="id" class="range-slider-label">
            <span class="range-slider-label-text" tabindex="0">
                {{ leftLabel }}
                <span v-if="leftTooltip" class="range-slider-tooltip" role="tooltip">{{ leftTooltip }}</span>
            </span>
            <span class="range-slider-label-text" tabindex="0" style="transform: translateX(0.5rem);">
                {{ centerLabel }}
                <span v-if="centerTooltip" class="range-slider-tooltip" role="tooltip">{{ centerTooltip }}</span>
            </span>
            <span class="range-slider-label-text" tabindex="0">
                {{ rightLabel }}
                <span v-if="rightTooltip" class="range-slider-tooltip right" role="tooltip">{{ rightTooltip }}</span>
            </span>
        </label>

        <div class="range-slider-wrapper">
            <input :id="id" :value="normalizedValue" class="range-slider-input" type="range" :min="min" :max="max"
                :step="step" :aria-label="ariaLabel" @input="handleInput" />
            <div v-if="showMarkers" class="range-slider-step-markers" aria-hidden="true">
                <span v-for="marker in stepMarkers" :key="`${id}-step-${marker}`" class="range-slider-step-dot" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.range-slider {
    width: 100%;
    margin: 1rem 0;
}

.range-slider-label {
    display: flex;
    justify-content: space-between;
    padding: 0 0.3rem 0 0.1rem;
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-strong);
}

.range-slider-label-text {
    position: relative;
    display: inline-flex;
    align-items: center;
    outline: none;
}

.range-slider-label-text:has(.range-slider-tooltip) {
    cursor: help;
}

.range-slider-label-text:focus-visible {
    border-radius: 0.3rem;
    box-shadow: 0 0 0 2px var(--lighter);
}

.range-slider-tooltip {
    position: absolute;
    left: -1rem;
    bottom: 1.5rem;
    width: 10rem;
    padding: 0.5rem 1rem;
    border-radius: 1rem;
    background: var(--secondary);
    color: var(--text);
    font-size: 0.8rem;
    font-weight: 500;
    z-index: 6;
    pointer-events: none;
    opacity: 0;
    transform: translateY(0.2rem);
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.range-slider-tooltip.right {
    left: auto;
    right: -1rem;
    text-align: right;
}

.range-slider-tooltip.center {
    left: 50%;
    transform: translate(-50%, 0.2rem);
}

.range-slider-label-text:hover .range-slider-tooltip,
.range-slider-label-text:focus-visible .range-slider-tooltip {
    opacity: 1;
    transform: translateY(0);
}

.range-slider-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    height: 1.2rem;
    margin-bottom: 1rem;
}

.range-slider-wrapper::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 0.5rem;
    border-radius: 0.5rem;
    background: var(--secondary);
    transform: translateY(-50%);
    z-index: 1;
}

.range-slider-input {
    appearance: none;
    width: 100%;
    height: 1.2rem;
    background: transparent;
    outline: none;
    cursor: pointer;
    position: relative;
    z-index: 3;
}

.range-slider-step-markers {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 0.6rem;
    transform: translateY(-50%);
    pointer-events: none;
    z-index: 2;
}

.range-slider-step-dot {
    width: 0.25rem;
    height: 0.25rem;
    border-radius: 50%;
    background: white;
}

.range-slider-input::-webkit-slider-runnable-track {
    height: 0.5rem;
    border-radius: 0.5rem;
    background: transparent;
}

.range-slider-input::-webkit-slider-thumb {
    appearance: none;
    width: 1.2rem;
    height: 1.2rem;
    margin-top: -0.35rem;
    border-radius: 50%;
    background: var(--darker);
    cursor: pointer;
}

.range-slider-input::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    background: var(--primary);
}

.range-slider-input:focus-visible::-webkit-slider-thumb {
    outline: 3px solid var(--lighter);
    outline-offset: 2px;
}

.range-slider-side-label {
    flex: none;
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-strong);
    white-space: nowrap;
}
</style>
