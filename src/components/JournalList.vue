<script setup>
import { computed } from 'vue'
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

const emit = defineEmits(['unlock-entries'])

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
            <p class="description">No entries yet. Start writing to create your first entry!</p>
        </div>

        <div v-for="entry in sortedEntries" :key="entry.id" class="entry-item">
            <div class="entry-content" :class="{ blurred: isEntryLocked(entry) }">
                <div class="entry-header">
                    <span v-if="entry.emotion" class="emotion-badge">
                        <span v-if="emotionTag(entry.emotion)?.svg" class="emotion-icon"
                            v-html="emotionTag(entry.emotion).svg"></span>
                        <span>{{ emotionLabel(entry.emotion) }}</span>
                    </span>
                    <span class="entry-date">{{ formatDate(entry.createdAt) }}</span>
                </div>

                <p v-if="entry.text || isEntryLocked(entry)" class="entry-text">{{ getEntryText(entry) }}</p>

                <p v-if="entry.prompt && entry.text" class="entry-prompt">{{ entry.prompt }}</p>
            </div>

            <div v-if="isEntryLocked(entry)" class="locked-overlay">
                <Button variant="secondary" class="unlock-button" @click="handleUnlock(entry.id)">
                    Unlock Secret Entries
                </Button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.entries-list {
    height: 100%;
    overflow-y: auto;
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
    background: radial-gradient(circle, white, var(--white));
}

.entry-item {
    position: relative;
    padding: 1rem;
    background: radial-gradient(circle, white, var(--white));
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
    background: linear-gradient(to right, var(--secondary) 50%, transparent);
    border-radius: 0.5rem;
    color: var(--text);
    font-size: 0.75rem;
    font-weight: 500;
}

.emotion-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    fill: currentColor;
    transform: scale(0.9);
}

.entry-date {
    color: var(--text);
    margin-left: auto;
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