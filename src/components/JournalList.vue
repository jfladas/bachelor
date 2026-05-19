<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import Button from './Button.vue'

const props = defineProps({
    visible: {
        type: Boolean,
        required: true,
    },
    entries: {
        type: Array,
        default: () => [],
    },
    emotionTags: {
        type: Array,
        default: () => [],
    },
    isUnlocked: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(['unlock-entries', 'delete-entry'])

const activeContextId = ref(null)
let _hideListener = null

const showContextFor = (entry) => {
    activeContextId.value = entry?.id ?? null
}

const handleDelete = (entryId) => {
    emit('delete-entry', entryId)
    activeContextId.value = null
}

onMounted(() => {
    _hideListener = () => (activeContextId.value = null)
    document.addEventListener('click', _hideListener)
})

onBeforeUnmount(() => {
    if (_hideListener) document.removeEventListener('click', _hideListener)
})

const sortedEntries = computed(() => {
    return [...(props.entries || [])].sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt)
    })
})

const formatDate = (isoString) => {
    const date = new Date(isoString)

    if (Number.isNaN(date.getTime())) {
        return 'Unknown date'
    }

    const currentYear = new Date().getFullYear()
    const dateParts = {
        month: 'short',
        day: 'numeric',
    }

    if (date.getFullYear() !== currentYear) {
        dateParts.year = 'numeric'
    }

    const formattedDate = date.toLocaleDateString('en-US', dateParts)
    const formattedTime = date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })

    return `${formattedDate}, ${formattedTime}`
}

const emotionLabel = (emotionId) => {
    if (!emotionId) return ''
    const emotion = props.emotionTags.find((e) => e.id === emotionId)
    return emotion ? emotion.label : ''
}

const emotionTag = (emotionId) => {
    if (!emotionId) return null
    return props.emotionTags.find((e) => e.id === emotionId) || null
}

const handleUnlock = (entryId) => {
    emit('unlock-entries', entryId)
}

const isEntryLocked = (entry) => {
    return Boolean(entry?.isLocked ?? (entry?.isSecret && !props.isUnlocked))
}

const getEntryText = (entry) => {
    if (isEntryLocked(entry)) {
        return 'Locked secret entry'
    }

    return entry.text || '(No text)'
}
</script>

<template>
    <div class="entries-list">
        <div v-if="sortedEntries.length === 0" class="empty-state">
            <p class="description">Create your first entry!</p>
        </div>

        <div v-for="entry in sortedEntries" :key="entry.id" class="entry-item"
            @contextmenu.prevent.stop="showContextFor(entry)" @click="activeContextId = null">
            <div class="entry-content" :class="{ blurred: isEntryLocked(entry) }">
                <div class="entry-header">
                    <span v-if="entry.emotion" class="emotion-badge"
                        :style="{ '--emotion-hue': `var(--${entry.emotion})` }">
                        <span v-if="emotionTag(entry.emotion)?.svg" class="emotion-icon"
                            v-html="emotionTag(entry.emotion).svg"></span>
                        <span>{{ emotionLabel(entry.emotion) }}</span>
                    </span>
                    <span class="entry-date">
                        {{ formatDate(entry.createdAt) }}
                        <svg v-if="entry.isSecret" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"
                            fill="currentColor" class="size-4 lock-icon">
                            <path fill-rule="evenodd"
                                d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z"
                                clip-rule="evenodd" />
                        </svg>
                    </span>
                </div>

                <p v-if="entry.text || isEntryLocked(entry)" class="entry-text">{{ getEntryText(entry) }}</p>

                <p v-if="entry.prompt && entry.text" class="entry-prompt">{{ entry.prompt }}</p>
            </div>

            <div v-if="isEntryLocked(entry)" class="locked-overlay">
                <Button variant="secondary" class="unlock-button" @click="handleUnlock(entry.id)">
                    Unlock Secret Entries
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                        <path
                            d="M11.5 1A3.5 3.5 0 0 0 8 4.5V7H2.5A1.5 1.5 0 0 0 1 8.5v5A1.5 1.5 0 0 0 2.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 9.5 7V4.5a2 2 0 1 1 4 0v1.75a.75.75 0 0 0 1.5 0V4.5A3.5 3.5 0 0 0 11.5 1Z" />
                    </svg>
                </Button>
            </div>

            <!-- Right-click context delete overlay -->
            <div v-if="activeContextId === entry.id" class="context-overlay" @click.stop>
                <Button variant="secondary circle-small" class="unlock-button delete-button" data-tooltip="Delete"
                    @click.stop="handleDelete(entry.id)">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                        <path fill-rule="evenodd"
                            d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z"
                            clip-rule="evenodd" />
                    </svg>
                </Button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.entries-list {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column-reverse;
    align-items: stretch;
    gap: 1rem;
    padding: 0 0.5rem;
    pointer-events: auto;
}

.empty-state {
    padding: 1rem;
    text-align: center;
    border-radius: 1rem 1rem 0 0;
    background: radial-gradient(circle, white, color-mix(in oklch, var(--white) 50%, white));
    box-shadow: 0 0 0.5rem color-mix(in oklch, var(--shadow) 50%, transparent);
}

.entry-item {
    position: relative;
    padding: 1rem;
    background: radial-gradient(circle, white, color-mix(in oklch, var(--white) 50%, white));
    box-shadow: 0 0 0.5rem color-mix(in oklch, var(--shadow) 50%, transparent);
    color: var(--text-strong);
    border-radius: 1rem;
}

.entries-list>.entry-item:last-of-type {
    margin-top: 1.5rem;
}

.entries-list>.entry-item:first-of-type {
    margin-bottom: 1.5rem;
}

.entry-content.blurred {
    filter: blur(4px);
}

.locked-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    border-radius: 1rem;
    pointer-events: all;
    z-index: 10;
    background: transparent;
    backdrop-filter: blur(2px);
}

.context-overlay {
    position: absolute;
    bottom: 0.5rem;
    right: 0.5rem;
    z-index: 20;
    pointer-events: all;
    display: flex;
    align-items: center;
}

.delete-button {
    display: inline-flex;
    align-items: center;
}

.entry-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
}

.emotion-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.5rem;
    background: radial-gradient(circle at 1rem 50% in oklch,
            oklch(var(--secondary-l) var(--secondary-c) var(--emotion-hue)) 25%,
            transparent);
    border-radius: 0.5rem;
    color: oklch(var(--text-l) var(--text-c) var(--emotion-hue));
    font-size: 0.8rem;
    font-weight: 500;
}

.emotion-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    fill: currentColor;
    transform: scale(0.9);
}

.lock-icon {
    width: 0.8rem;
    height: 0.8rem;
    margin-left: 0.2rem;
    fill: currentColor;
}

.entry-date {
    color: var(--text);
    margin-left: auto;
    display: flex;
    align-items: center;
}

.entry-text {
    margin: 0.5rem 0 0 0;
    padding-left: 0.2rem;
    color: var(--text-strong);
    font-size: 0.9rem;
    line-height: 1.4;
    display: -webkit-box;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}

.entry-prompt {
    margin: 0.5rem 0 0 0;
    padding-left: 0.2rem;
    color: var(--text);
    font-size: 0.8rem;
    font-family: 'GeneralSans-VariableItalic', 'GeneralSans-Italic', sans-serif;
    display: -webkit-box;
    line-clamp: 1;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>