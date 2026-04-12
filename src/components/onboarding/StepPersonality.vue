<script setup>
import Button from "./Button.vue";

const props = defineProps({
    questionAnswers: {
        type: Object,
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

const updateAnswer = (key, event) => {
    emit("update-answer", {
        key,
        value: Number(event.target.value),
    });
};
</script>

<template>
    <section>
        <h1>Represent yourself</h1>
        <p class="description">
            Adjust the sliders and choose traits to reflect your personality. This will impact the appearance and
            behavior
            of your companion.
        </p>

        <div class="field sliders-field">
            <label for="reservedOpen" class="slider-label">
                <span>Reserved</span>
                <span>Open</span>
            </label>
            <input id="reservedOpen" class="slider" :value="props.questionAnswers.reservedOpen" type="range" min="0"
                max="1" step="0.1" @input="updateAnswer('reservedOpen', $event)" />

            <label for="calmAssertive" class="slider-label">
                <span>Calm</span>
                <span>Assertive</span>
            </label>
            <input id="calmAssertive" class="slider" :value="props.questionAnswers.calmAssertive" type="range" min="0"
                max="1" step="0.1" @input="updateAnswer('calmAssertive', $event)" />

            <label for="rationalEmotional" class="slider-label">
                <span>Rational</span>
                <span>Emotional</span>
            </label>
            <input id="rationalEmotional" class="slider" :value="props.questionAnswers.rationalEmotional" type="range"
                min="0" max="1" step="0.1" @input="updateAnswer('rationalEmotional', $event)" />

            <label for="groundedCreative" class="slider-label">
                <span>Grounded</span>
                <span>Creative</span>
            </label>
            <input id="groundedCreative" class="slider" :value="props.questionAnswers.groundedCreative" type="range"
                min="0" max="1" step="0.1" @input="updateAnswer('groundedCreative', $event)" />
        </div>

        <h1>I am...</h1>
        <div class="field traits-field">
            <Button v-for="trait in props.traitOptions" :key="trait" type="button" variant="secondary"
                class="trait-chip" :class="{ active: props.selectedTraits.includes(trait) }"
                @click="emit('toggle-trait', trait)">
                {{ trait }}
            </Button>
        </div>
    </section>
</template>

<style scoped>
h1 {
    margin: 1rem 0 0.5rem 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-strong);
}

.description {
    color: var(--text);
    line-height: 1.5;
    font-size: 1rem;
    font-weight: 500;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.sliders-field {
    margin-top: 2rem;
}

.slider {
    appearance: none;
    width: 100%;
    height: 0.5rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    background: var(--secondary);
    outline: none;
    cursor: pointer;
}

.slider::-webkit-slider-thumb {
    appearance: none;
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 50%;
    background: var(--darker);
    cursor: pointer;
    transition: transform 0.2s ease, background 0.2s ease;
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
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-strong);
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
    padding: 0.8rem 4rem;
    font-weight: 600;
    color: var(--white);
    background: var(--darker);
}

.trait-chip.active:hover {
    background: var(--primary);
}
</style>
