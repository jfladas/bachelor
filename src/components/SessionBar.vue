<script setup>
import Button from "./ui/Button.vue";

const props = defineProps({
    remainingLabel: {
        type: String,
        required: true,
    },
    showExtend: {
        type: Boolean,
        default: false,
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    isSubTen: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["quit-session", "extend-session", "pointer-enter", "pointer-leave"]);
</script>

<template>
    <div class="glow"></div>
    <div class="session-bar" role="status" aria-label="Session timer" @pointerenter="emit('pointer-enter')"
        @pointerleave="emit('pointer-leave')">
        <div class="timer" :class="{ low: props.isSubTen }">
            {{ props.remainingLabel }}
        </div>

        <div class="buttons">
            <Button v-if="props.showExtend" variant="secondary" :disabled="props.disabled"
                @click="emit('extend-session')">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                    <path fill-rule="evenodd"
                        d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm.75-10.25v2.5h2.5a.75.75 0 0 1 0 1.5h-2.5v2.5a.75.75 0 0 1-1.5 0v-2.5h-2.5a.75.75 0 0 1 0-1.5h2.5v-2.5a.75.75 0 0 1 1.5 0Z"
                        clip-rule="evenodd" />
                </svg>
                Extend 3 min
            </Button>
            <Button variant="primary" :disabled="props.disabled" @click="emit('quit-session')">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                    <path fill-rule="evenodd"
                        d="M3.05 3.05a7 7 0 1 1 9.9 9.9 7 7 0 0 1-9.9-9.9Zm1.627.566 7.707 7.707a5.501 5.501 0 0 0-7.707-7.707Zm6.646 8.768L3.616 4.677a5.501 5.501 0 0 0 7.707 7.707Z"
                        clip-rule="evenodd" />
                </svg>
                End Session
            </Button>
        </div>
    </div>
</template>

<style scoped>
.session-bar {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 60;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 30rem;
    height: fit-content;
    padding: 0.75rem 0.85rem;
    border-radius: 3rem;
    background: var(--white);
    color: var(--text-strong);
    box-shadow: 0 0 1rem var(--shadow), 0 -2rem 5rem color-mix(in oklch, var(--primary) 25%, transparent);
    user-select: none;
}

.timer {
    padding-left: 0.5rem;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text);
}

.timer.low {
    color: var(--darker);
}

.buttons {
    display: flex;
    gap: 0.75rem;
}

.value {
    font-size: 1.45rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}
</style>
