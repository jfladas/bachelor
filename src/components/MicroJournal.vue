<script setup>
import { ref, watch } from "vue";
import Button from "./Button.vue";

const props = defineProps({
    visible: {
        type: Boolean,
        required: true,
    },
    panelStyle: {
        type: Object,
        default: () => ({}),
    },
    prompt: {
        type: String,
        default: "",
    },
    emotionTags: {
        type: Array,
        default: () => [],
    },
    selectedEmotion: {
        type: String,
        default: "",
    },
    textValue: {
        type: String,
        default: "",
    },
    canSubmit: {
        type: Boolean,
        default: false,
    },
    maxLength: {
        type: Number,
        default: 600,
    },
});

const emit = defineEmits(["close", "rotate-prompt", "select-emotion", "update:text", "submit"]);

const showPrompt = ref(false);
const showEmotion = ref(true);
const showText = ref(true);

const showPromptSection = () => {
    showPrompt.value = true;
};

const hidePromptSection = () => {
    showPrompt.value = false;
};

const showEmotionSection = () => {
    showEmotion.value = true;
};

const hideEmotionSection = () => {
    if (props.selectedEmotion) {
        emit("select-emotion", props.selectedEmotion);
    }

    showEmotion.value = false;
};

const showTextSection = () => {
    showText.value = true;
};

const hideTextSection = () => {
    emit("update:text", "");
    showText.value = false;
};

const handleSubmit = () => {
    emit("submit", {
        includePrompt: showPrompt.value,
        includeEmotion: showEmotion.value,
        includeText: showText.value,
    });
};

watch(
    () => props.visible,
    (isVisible) => {
        if (!isVisible) {
            return;
        }

        showPrompt.value = false;
        showEmotion.value = true;
        showText.value = true;
    }
);

</script>

<template>
    <section v-if="props.visible" class="window" :style="props.panelStyle" role="dialog" aria-label="Micro journal">
        <header class="header">
            <p class="eyebrow">Micro Journal</p>
            <Button variant="secondary close-button circle-small" aria-label="Close micro journal"
                @click="$emit('close')">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path
                        d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
            </Button>
        </header>

        <div v-if="!showPrompt || !showEmotion || !showText" class="optional-actions">
            <Button v-if="!showPrompt" variant="secondary" @click="showPromptSection">
                Show prompt
            </Button>

            <Button v-if="!showEmotion" variant="secondary" @click="showEmotionSection">
                Show emotion
            </Button>

            <Button v-if="!showText" variant="secondary" @click="showTextSection">
                Show text field
            </Button>
        </div>

        <div v-if="showPrompt" class="subpanel optional">
            <button type="button" class="remove-option" aria-label="Remove prompt" @click="hidePromptSection">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path
                        d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
            </button>
            <p class="label">Prompt</p>
            <div class="prompt-field field">

                <p class="prompt">{{ props.prompt || "Just write anything." }}</p>
                <Button variant="secondary circle-small" @click="$emit('rotate-prompt')">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                        <path fill-rule="evenodd"
                            d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.932.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-1.242l.842.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44 1.241l-.84-.84v1.371a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75H5.35a.75.75 0 0 1 0 1.5H3.98l.841.841a4.5 4.5 0 0 0 7.08-.932.75.75 0 0 1 1.025-.273Z"
                            clip-rule="evenodd" />
                    </svg>
                </Button>
            </div>

        </div>

        <div v-if="showEmotion" class="subpanel optional">
            <button class="remove-option" aria-label="Remove emotion" @click="hideEmotionSection">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path
                        d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
            </button>
            <p class="label">Emotion</p>
            <div class="emotion-field field">

                <Button v-for="tag in props.emotionTags" :key="tag.id" variant="secondary" class="emotion-chip"
                    :class="{ active: props.selectedEmotion === tag.id }" @click="$emit('select-emotion', tag.id)">
                    <div class="icon" v-html="tag.svg"></div>
                    <div v-if="props.selectedEmotion === tag.id">{{ tag.label }}</div>
                </Button>
            </div>
        </div>

        <div v-if="showText" class="subpanel optional">
            <button type="button" class="remove-option" aria-label="Remove entry field" @click="hideTextSection">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path
                        d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
            </button>
            <label class="label" for="micro-journal-entry">Entry</label>
            <textarea id="micro-journal-entry" class="textarea" :value="props.textValue" :maxlength="props.maxLength"
                placeholder="Tell me something..." @input="$emit('update:text', $event.target.value)"
                spellcheck="false" />
            <span class="char-count">{{ props.textValue.length }}/{{ props.maxLength }}</span>
        </div>

        <div class="actions">
            <Button variant="primary" class="save-button" :disabled="!props.canSubmit" @click="handleSubmit">
                Submit
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path
                        d="M2.87 2.298a.75.75 0 0 0-.812 1.021L3.39 6.624a1 1 0 0 0 .928.626H8.25a.75.75 0 0 1 0 1.5H4.318a1 1 0 0 0-.927.626l-1.333 3.305a.75.75 0 0 0 .811 1.022 24.89 24.89 0 0 0 11.668-5.115.75.75 0 0 0 0-1.175A24.89 24.89 0 0 0 2.869 2.298Z" />
                </svg>
            </Button>
        </div>
    </section>
</template>

<style scoped>
.window {
    position: fixed;
    z-index: 25;
    width: 30rem;
    height: auto;
    padding-bottom: 6rem;
}

.subpanel {
    display: flex;
    flex-direction: column;
}

.optional {
    position: relative;
}

.close-button {
    z-index: 3;
}

.optional-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
}

.remove-option {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 1.2rem;
    height: 1.2rem;
    padding: 0;
    border: none;
    border-radius: 1rem;
    background: transparent;
    color: var(--text);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    z-index: 1;
    transition: opacity 0.2s ease, background 0.2s ease;
}

.optional:hover .remove-option,
.optional:focus-within .remove-option {
    opacity: 1;
}

.remove-option:hover,
.remove-option:focus-visible {
    background: var(--secondary);
}

.label {
    margin: 0.5rem 0 0.5rem 0;
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-strong);
}

.prompt-field {
    flex-direction: row;
    align-items: baseline;
    justify-content: start;
    gap: 1rem;
}

.prompt {
    font-size: 1.2rem;
    font-weight: 500;
    font-family: 'GeneralSans-VariableItalic', 'GeneralSans-Italic', sans-serif;
    color: var(--darker);
    margin: 0 0 1rem 0;
}

.emotion-field {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    padding: 0 1rem;
    gap: 1rem;
}

.emotion-chip {
    display: inline-flex;
    align-items: center;
    width: auto;
    padding: 0.8rem 1rem;
    color: var(--text);
    cursor: pointer;
}

.emotion-chip .icon {
    fill: var(--text);
}

.emotion-chip.active {
    padding: 0.8rem 1rem;
    font-weight: 600;
    color: var(--white);
    background: var(--darker);
}

.emotion-chip.active .icon {
    fill: var(--white);
}

.emotion-chip.active:hover {
    background: var(--primary);
}

.textarea {
    height: 6rem;
    resize: none;
    border-radius: 1rem;
    border: none;
    background: var(--white);
    color: var(--text-strong);
    font-size: 1rem;
    padding: 0.8rem;
    line-height: 1.4;
    cursor: unset;
    scrollbar-gutter: stable;
}

.textarea:focus-visible {
    outline: 3px solid var(--lighter);
    outline-offset: 2px;
}

.char-count {
    position: absolute;
    right: 1rem;
    bottom: 0.5rem;
    color: var(--text);
    font-size: 0.8rem;
}
</style>
