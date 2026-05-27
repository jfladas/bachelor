<script setup>
import Button from "../Button.vue";
import RangeSlider from "../RangeSlider.vue";

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

const updateAnswer = (key, value) => {
    emit("update-answer", {
        key,
        value: Number(value),
    });
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
                <RangeSlider :id="sliderOption.key" :model-value="props.questionAnswers[sliderOption.key]"
                    :left-label="sliderOption.leftLabel" :right-label="sliderOption.rightLabel"
                    :left-tooltip="sliderOption.leftTooltip" :right-tooltip="sliderOption.rightTooltip" :min="0"
                    :max="1" :step="0.1" :show-markers="true" :aria-label="sliderOption.key"
                    @update:modelValue="updateAnswer(sliderOption.key, $event)" />
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

.range-slider {
    margin: 0;
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
