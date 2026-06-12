<script setup>
import { computed } from "vue";
import Button from "../ui/Button.vue";

const props = defineProps({
    remainingLabel: {
        type: String,
        required: true,
    },
    isPrinting: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["print-sheet", "skip-printing", "pointer-enter", "pointer-leave"]);

const wrapUpText = computed(() => `This session will reset in ${props.remainingLabel}.`);
</script>

<template>
    <div class="overlay">
        <section class="window" role="dialog" aria-label="End of session" @pointerenter="emit('pointer-enter')"
            @pointerleave="emit('pointer-leave')">
            <p class="eyebrow">Session ended</p>
            <h1 class="title">Print your report?</h1>
            <p class="description">Choose whether to print your personal statistics before the next user starts.</p>
            <p class="hint">{{ wrapUpText }}</p>

            <div class="actions">
                <Button variant="secondary" :disabled="props.isPrinting" @click="emit('skip-printing')">
                    Skip Printing
                </Button>
                <Button variant="primary" :disabled="props.isPrinting" @click="emit('print-sheet')">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                        <path fill-rule="evenodd"
                            d="M4 5a2 2 0 0 0-2 2v3a2 2 0 0 0 1.51 1.94l-.315 1.896A1 1 0 0 0 4.18 15h7.639a1 1 0 0 0 .986-1.164l-.316-1.897A2 2 0 0 0 14 10V7a2 2 0 0 0-2-2V2a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v3Zm1.5 0V2.5h5V5h-5Zm5.23 5.5H5.27l-.5 3h6.459l-.5-3Z"
                            clip-rule="evenodd" />
                    </svg>
                    Print Report
                </Button>
            </div>
        </section>
    </div>
</template>

<style scoped>
.window {
    height: fit-content;
    padding-bottom: 6rem;
}
</style>
