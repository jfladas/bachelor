<script setup>
import { ref, watch, computed, nextTick } from "vue";
import Button from "./Button.vue";
import JournalList from "./JournalList.vue";

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
    entries: {
        type: Array,
        default: () => [],
    },
    isUnlocked: {
        type: Boolean,
        default: false,
    },
    promptVisible: {
        type: Boolean,
        default: false,
    },
    emotionVisible: {
        type: Boolean,
        default: true,
    },
    textVisible: {
        type: Boolean,
        default: true,
    },
});

const emit = defineEmits([
    "close",
    "rotate-prompt",
    "select-emotion",
    "update:text",
    "update:prompt-visible",
    "update:emotion-visible",
    "update:text-visible",
    "submit",
    "unlock-entries",
    "delete-entry",
]);

const isSecretEntry = ref(false);
const showJournalList = ref(true);
const windowEl = ref(null);
const windowHeight = ref(0);

const showPromptSection = () => {
    emit("update:prompt-visible", true);
};

const hidePromptSection = () => {
    emit("update:prompt-visible", false);
};

const showEmotionSection = () => {
    emit("update:emotion-visible", true);
};

const hideEmotionSection = () => {
    if (props.selectedEmotion) {
        emit("select-emotion", props.selectedEmotion);
    }

    emit("update:emotion-visible", false);
};

const showTextSection = () => {
    emit("update:text-visible", true);
};

const hideTextSection = () => {
    emit("update:text", "");
    emit("update:text-visible", false);
};

const toggleSecretEntry = () => {
    isSecretEntry.value = !isSecretEntry.value;
};

const toggleJournalList = () => {
    showJournalList.value = !showJournalList.value;
};

const handleSubmit = () => {
    emit("submit", {
        includePrompt: props.promptVisible,
        includeEmotion: props.emotionVisible,
        includeText: props.textVisible,
        isSecret: isSecretEntry.value,
    });
};

watch(
    () => props.visible,
    async (isVisible) => {
        if (!isVisible) {
            return;
        }
        showJournalList.value = true;

        await nextTick();

        if (!windowEl.value) {
            return;
        }

        const resizeObserver = new ResizeObserver(() => {
            if (windowEl.value) {
                windowHeight.value = windowEl.value.offsetHeight;
            }
        });

        resizeObserver.observe(windowEl.value);
    }
);

const handleUnlockEntry = (entryId) => {
    emit("unlock-entries", entryId);
};

const handleDeleteEntry = (entryId) => {
    emit('delete-entry', entryId);
};

const pointerDownPos = ref({ x: 0, y: 0 })
const pointerDownInsideScrollbar = ref(false)

const handleListAreaClick = (event) => {
    if (pointerDownInsideScrollbar.value) return;

    const dx = (event.clientX || 0) - (pointerDownPos.value.x || 0)
    const dy = (event.clientY || 0) - (pointerDownPos.value.y || 0)
    const distSq = dx * dx + dy * dy
    if (distSq > 36) return

    const path = typeof event.composedPath === 'function' ? event.composedPath() : event.path || [];
    for (let node of path) {
        if (node && node.classList && node.classList.contains && (node.classList.contains('entry-item') || node.classList.contains('empty-state'))) {
            return;
        }
    }

    emit('close');
};

const onListPointerDown = (event) => {
    pointerDownPos.value = { x: event.clientX || 0, y: event.clientY || 0 }
    pointerDownInsideScrollbar.value = false
    const path = typeof event.composedPath === 'function' ? event.composedPath() : event.path || [];
    for (let node of path) {
        if (node && node.classList && node.classList.contains) {
            if (node.classList.contains('entries-list') && node.getBoundingClientRect) {
                const rect = node.getBoundingClientRect()
                const scrollbarArea = 18
                if ((event.clientX || 0) >= rect.right - scrollbarArea) {
                    pointerDownInsideScrollbar.value = true
                }
            }
        }
    }
}

const listAreaStyle = computed(() => {
    const style = { ...props.panelStyle };
    if (windowHeight.value > 0) {
        style.height = `calc(100vh - ${windowHeight.value}px - 3rem)`;
    }
    return style;
});


</script>

<template>
    <div v-if="props.visible">
        <section v-show="showJournalList" class="list-area" :style="listAreaStyle" @click="handleListAreaClick"
            @pointerdown="onListPointerDown">
            <JournalList :visible="showJournalList" :entries="props.entries" :emotion-tags="props.emotionTags"
                :is-unlocked="props.isUnlocked" @unlock-entries="handleUnlockEntry" @delete-entry="handleDeleteEntry" />
        </section>
        <div v-show="showJournalList" class="list-shadow" :style="props.panelStyle"></div>
        <section class="window" :style="props.panelStyle" role="dialog" aria-label="Micro journal" ref="windowEl">
            <header class="header">
                <p class="eyebrow">Micro Journal</p>
                <div class="header-buttons">
                    <Button variant="secondary list-button circle-small" aria-label="View journal entries"
                        :data-tooltip="showJournalList ? 'Hide list' : 'Show list'" @click="toggleJournalList"
                        :class="{ active: showJournalList }">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                            <path
                                d="M2 4a2 2 0 0 1 2-2h8a2 2 0 1 1 0 4H4a2 2 0 0 1-2-2ZM2 9.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 9.25ZM2.75 12.5a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H2.75Z" />
                        </svg>
                    </Button>
                    <Button variant="secondary close-button circle-small" aria-label="Close micro journal"
                        @click="$emit('close')">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                            <path
                                d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                        </svg>
                    </Button>
                </div>
            </header>

            <div v-if="!props.promptVisible || !props.emotionVisible || !props.textVisible" class="optional-actions">
                <Button v-if="!props.promptVisible" variant="secondary" @click="showPromptSection">
                    Show prompt
                </Button>

                <Button v-if="!props.emotionVisible" variant="secondary" @click="showEmotionSection">
                    Show emotion
                </Button>

                <Button v-if="!props.textVisible" variant="secondary" @click="showTextSection">
                    Show text field
                </Button>
            </div>
            <div v-if="props.promptVisible" class="subpanel optional">
                <button type="button" class="remove-option" aria-label="Remove prompt" @click="hidePromptSection">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                        <path
                            d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                    </svg>
                </button>
                <p class="label">Prompt</p>
                <div class="prompt-field field">

                    <p class="prompt">{{ props.prompt || "Just write anything." }}</p>
                    <Button variant="secondary circle-small" data-tooltip="New prompt" @click="$emit('rotate-prompt')">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                            <path fill-rule="evenodd"
                                d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.932.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-1.242l.842.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44 1.241l-.84-.84v1.371a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75H5.35a.75.75 0 0 1 0 1.5H3.98l.841.841a4.5 4.5 0 0 0 7.08-.932.75.75 0 0 1 1.025-.273Z"
                                clip-rule="evenodd" />
                        </svg>
                    </Button>
                </div>

            </div>

            <div v-if="props.emotionVisible" class="subpanel optional">
                <button class="remove-option" aria-label="Remove emotion" @click="hideEmotionSection">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                        <path
                            d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                    </svg>
                </button>
                <p class="label">Emotion</p>
                <div class="emotion-field field">

                    <Button v-for="tag in props.emotionTags" :key="tag.id" variant="secondary" class="emotion-chip"
                        :class="[tag.id, { active: props.selectedEmotion === tag.id }]"
                        :style="{ '--emotion-hue': `var(--${tag.id})` }" @click="$emit('select-emotion', tag.id)">
                        <div class="icon" v-html="tag.svg"></div>
                        <div v-if="props.selectedEmotion === tag.id">{{ tag.label }}</div>
                    </Button>
                </div>
            </div>

            <div v-if="props.textVisible" class="subpanel optional">
                <button type="button" class="remove-option" aria-label="Remove entry field" @click="hideTextSection">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                        <path
                            d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                    </svg>
                </button>
                <label class="label" for="micro-journal-entry">Entry</label>
                <textarea id="micro-journal-entry" class="textarea" :value="props.textValue"
                    :maxlength="props.maxLength" placeholder="Tell me something..."
                    @input="$emit('update:text', $event.target.value)" spellcheck="false" />
                <span class="char-count">{{ props.textValue.length }}/{{ props.maxLength }}</span>
            </div>

            <div class="actions">
                <Button variant="secondary" class="secret-toggle" :class="{active: isSecretEntry}"
                    @click="toggleSecretEntry">
                    <div v-if="!isSecretEntry">Make Secret</div>
                    <div v-else>Secret</div>
                    <svg v-if="isSecretEntry" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                        class="size-4">
                        <path fill-rule="evenodd"
                            d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z"
                            clip-rule="evenodd" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                        class="size-4">
                        <path
                            d="M11.5 1A3.5 3.5 0 0 0 8 4.5V7H2.5A1.5 1.5 0 0 0 1 8.5v5A1.5 1.5 0 0 0 2.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 9.5 7V4.5a2 2 0 1 1 4 0v1.75a.75.75 0 0 0 1.5 0V4.5A3.5 3.5 0 0 0 11.5 1Z" />
                    </svg>
                </Button>
                <Button variant="primary" class="save-button" :disabled="!props.canSubmit" @click="handleSubmit">
                    Submit
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                        <path
                            d="M2.87 2.298a.75.75 0 0 0-.812 1.021L3.39 6.624a1 1 0 0 0 .928.626H8.25a.75.75 0 0 1 0 1.5H4.318a1 1 0 0 0-.927.626l-1.333 3.305a.75.75 0 0 0 .811 1.022 24.89 24.89 0 0 0 11.668-5.115.75.75 0 0 0 0-1.175A24.89 24.89 0 0 0 2.869 2.298Z" />
                    </svg>
                </Button>
            </div>
        </section>
    </div>
</template>

<style scoped>
.list-area {
    position: fixed;
    z-index: 20;
    width: 30rem;
    top: 0;
    padding: 0 1.8rem;
    border-radius: 2rem;
    pointer-events: auto;
}

.window {
    position: fixed;
    z-index: 25;
    width: 30rem;
    height: auto;
    padding: 1.2rem 1.8rem 6rem 1.8rem;
}

.list-shadow {
    position: fixed;
    z-index: 15;
    width: 30rem;
    height: 60%;
    padding: 1.2rem 1.8rem 6rem 1.8rem;
    background: radial-gradient(color-mix(in srgb, var(--primary) 35%, transparent), transparent 60%);
    border-radius: 2rem;
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

.remove-option:focus-visible {
    outline: 3px solid var(--lighter);
    outline-offset: 2px;
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
    background: oklch(var(--darker-l) var(--darker-c) var(--emotion-hue));
}

.emotion-chip.active .icon {
    fill: var(--white);
}

.emotion-chip.active:hover {
    background: oklch(var(--primary-l) var(--primary-c) var(--emotion-hue));
}

.secret-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
}

.secret-toggle.active,
.list-button.active {
    background: var(--darker);
    color: var(--white);
}

.secret-toggle.active:hover,
.list-button.active:hover {
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

.textarea::placeholder {
    color: var(--text-muted);
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

.header-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}
</style>