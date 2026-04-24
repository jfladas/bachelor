<script setup>
import Button from "../Button.vue";

const props = defineProps({
    questionAnswers: {
        type: Object,
        required: true,
    },
    sliderOptions: {
        type: Array,
        required: true,
    },
    selectedTraits: {
        type: Array,
        required: true,
    },
    traitOptions: {
        type: Array,
        required: true,
    },
});

const emit = defineEmits(["toggle-trait", "update-answer"]);

const SLIDER_MIN = 0;
const SLIDER_MAX = 1;
const SLIDER_STEP = 0.1;

const sliderSteps = Array.from(
    { length: Math.round((SLIDER_MAX - SLIDER_MIN) / SLIDER_STEP) + 1 },
    (_, index) => Number((SLIDER_MIN + index * SLIDER_STEP).toFixed(1))
);

const updateAnswer = (key, event) => {
    emit("update-answer", {
        key,
        value: Number(event.target.value),
    });
};

const isCurrentStep = (currentValue, stepValue) => {
    return Math.round(Number(currentValue) / SLIDER_STEP) === Math.round(stepValue / SLIDER_STEP);
};
</script>

<template>
    <section>
        <h1 class="title">Represent yourself</h1>
        <p class="description">
            Adjust the sliders and choose traits to reflect your personality.
            This will impact the appearance and behavior of your blob.
            You can always change these later.
        </p>

        <div class="field sliders-field">
            <template v-for="sliderOption in props.sliderOptions" :key="sliderOption.key">
                <label :for="sliderOption.key" class="slider-label">
                    <span class="slider-label-text" tabindex="0">
                        {{ sliderOption.leftLabel }}
                        <span v-if="sliderOption.leftTooltip" class="slider-tooltip" role="tooltip">{{
                            sliderOption.leftTooltip }}</span>
                    </span>
                    <span class="slider-label-text" tabindex="0">
                        {{ sliderOption.rightLabel }}
                        <span v-if="sliderOption.rightTooltip" class="slider-tooltip right" role="tooltip">{{
                            sliderOption.rightTooltip }}</span>
                    </span>
                </label>
                <div class="slider-wrapper">
                    <input :id="sliderOption.key" class="slider" :value="props.questionAnswers[sliderOption.key]"
                        type="range" :min="SLIDER_MIN" :max="SLIDER_MAX" :step="SLIDER_STEP"
                        @input="updateAnswer(sliderOption.key, $event)" />
                    <div class="slider-step-markers" aria-hidden="true">
                        <span v-for="step in sliderSteps" :key="`${sliderOption.key}-step-${step}`"
                            class="slider-step-dot" />
                    </div>
                </div>
            </template>
        </div>

        <h1 class="title">I am...</h1>
        <div class="field traits-field">
            <Button v-for="trait in props.traitOptions" :key="trait" variant="secondary" class="trait-chip"
                :class="{ active: props.selectedTraits.includes(trait) }" @click="emit('toggle-trait', trait)">
                {{ trait }}
            </Button>
        </div>
    </section>
</template>

<style scoped>
.sliders-field {
    margin-top: 2rem;
}

.slider {
    appearance: none;
    width: 100%;
    height: 1.2rem;
    background: transparent;
    outline: none;
    cursor: pointer;
    position: relative;
    z-index: 3;
}

.slider-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    height: 1.2rem;
    margin-bottom: 1rem;
}

.slider-wrapper::before {
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

.slider-step-markers {
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

.slider-step-dot {
    width: 0.25rem;
    height: 0.25rem;
    border-radius: 50%;
    background: white;
}

.slider::-webkit-slider-runnable-track {
    height: 0.5rem;
    border-radius: 0.5rem;
    background: transparent;
}

.slider::-webkit-slider-thumb {
    appearance: none;
    width: 1.2rem;
    height: 1.2rem;
    margin-top: -0.35rem;
    border-radius: 50%;
    background: var(--darker);
    cursor: pointer;
}

.slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    background: var(--primary);
}

.slider:focus-visible::-webkit-slider-thumb {
    outline: 3px solid var(--lighter);
    outline-offset: 2px;
}

.slider-label {
    display: flex;
    justify-content: space-between;
    padding: 0 0.3rem 0 0.1rem;
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-strong);
}

.slider-label-text {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: help;
    outline: none;
}

.slider-label-text:focus-visible {
    border-radius: 0.3rem;
    box-shadow: 0 0 0 2px var(--lighter);
}

.slider-tooltip {
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

.slider-tooltip.right {
    left: auto;
    right: -1rem;
    text-align: right;
}

.slider-label-text:hover .slider-tooltip,
.slider-label-text:focus-visible .slider-tooltip {
    opacity: 1;
    transform: translateY(0);
}

.traits-field {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
}

.trait-chip {
    width: auto;
    padding: 0.8rem 2rem;
    transition: transform 0.2s ease, background 0.2s ease;
}

.trait-chip.active {
    padding: 0.8rem 2.5rem;
    font-weight: 600;
    color: var(--white);
    background: var(--darker);
}

.trait-chip.active:hover {
    background: var(--primary);
}
</style>
