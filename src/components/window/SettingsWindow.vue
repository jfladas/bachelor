<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Button from "../ui/Button.vue";
import Checkbox from "../ui/Checkbox.vue";
import Select from "../ui/Select.vue";
import NumberInput from "../ui/NumberInput.vue";
import RangeSlider from "../ui/RangeSlider.vue";

const props = defineProps({
    visible: {
        type: Boolean,
        default: false,
    },
    blobSize: {
        type: Number,
        default: 100,
    },
    sleepAmount: {
        type: [Number, String],
        default: 1,
    },
    sleepUnit: {
        type: String,
        default: "hours",
    },
    askEveryTime: {
        type: Boolean,
        default: true,
    },
    sleepTagVisible: {
        type: Boolean,
        default: true,
    },
    startOnSystemRestart: {
        type: Boolean,
        default: true,
    },
});

const emit = defineEmits([
    "close",
    "confirm",
    "update:blob-size",
    "update:sleep-amount",
    "update:sleep-unit",
    "update:ask-every-time",
    "update:sleep-tag-visible",
    "update:start-on-system-restart",
    "redo-onboarding",
    "clear-journal",
    "hard-reset",
]);

const normalizeAmount = (value) => {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue) || nextValue < 1) {
        return 1;
    }

    return Math.min(999, Math.round(nextValue));
};

const normalizeUnit = (value) => (value === "minutes" || value === "until-woken-up" ? value : "hours");

const amountInputRef = ref(null);
const selectRef = ref(null);
const dangerDialog = ref({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    action: null,
});

const amountModel = computed({
    get: () => normalizeAmount(props.sleepAmount),
    set: (value) => emit("update:sleep-amount", normalizeAmount(value)),
});

const unitModel = computed({
    get: () => normalizeUnit(props.sleepUnit),
    set: (value) => emit("update:sleep-unit", normalizeUnit(value)),
});

const blobSizeModel = computed({
    get: () => Math.min(150, Math.max(50, Math.round(Number(props.blobSize) || 100))),
    set: (value) => {
        const nextValue = Math.min(150, Math.max(50, Math.round(Number(value) || 100)));
        emit("update:blob-size", nextValue);
    },
});

const askEveryTimeModel = computed({
    get: () => Boolean(props.askEveryTime),
    set: (value) => emit("update:ask-every-time", Boolean(value)),
});

const sleepTagVisibleModel = computed({
    get: () => Boolean(props.sleepTagVisible),
    set: (value) => emit("update:sleep-tag-visible", Boolean(value)),
});

const startOnSystemRestartModel = computed({
    get: () => Boolean(props.startOnSystemRestart),
    set: (value) => emit("update:start-on-system-restart", Boolean(value)),
});

const sleepUnitLabel = computed(() => {
    if (unitModel.value === "minutes") {
        return "Minutes";
    }

    if (unitModel.value === "until-woken-up") {
        return "Until woken up";
    }

    return "Hours";
});

const settingsSummary = computed(() => `${blobSizeModel.value}% blob size`);

const unitOptions = [
    { value: "minutes", label: "Minutes" },
    { value: "hours", label: "Hours" },
    { value: "until-woken-up", label: "Until woken up" },
];

const focusAmountInput = async () => {
    await nextTick();
    if (unitModel.value === "until-woken-up") {
        selectRef.value?.focusToggle?.();
        return;
    }

    await amountInputRef.value?.focusInput?.();
    await amountInputRef.value?.selectInput?.();
};

const openDangerDialog = (action, title, message, confirmLabel) => {
    dangerDialog.value = {
        open: true,
        action,
        title,
        message,
        confirmLabel,
    };
};

const handleRedoOnboarding = () => {
    openDangerDialog("redo-onboarding", "Redo Onboarding", "Restart the onboarding and remove your personality data? This will not impact your journal.", "Redo Onboarding");
};

const handleClearJournal = () => {
    openDangerDialog("clear-journal", "Clear Journal", "Remove all journal entries and reset PIN? This will not impact your personality and blob.", "Clear Journal");
};

const handleHardReset = () => {
    openDangerDialog("hard-reset", "Hard Reset", "Reset onboarding, journal, and settings? This will revert all data to initial state.", "Reset Everything");
};

const closeDangerDialog = () => {
    dangerDialog.value.open = false;
    dangerDialog.value.action = null;
};

const confirmDangerDialog = () => {
    const action = dangerDialog.value.action;
    closeDangerDialog();

    if (action === "redo-onboarding") {
        emit("redo-onboarding");
    } else if (action === "clear-journal") {
        emit("clear-journal");
    } else if (action === "hard-reset") {
        emit("hard-reset");
    }
};

const handleConfirm = () => {
    emit("confirm");
    emit("close");
};

onBeforeUnmount(() => { });

watch(
    () => props.visible,
    async (isVisible) => {
        if (!isVisible) {
            return;
        }

        await focusAmountInput();
    },
    { immediate: true }
);
</script>

<template>
    <div class="overlay">
        <section class="window" role="dialog" aria-label="Settings">
            <Button variant="secondary close-button circle-small" aria-label="Close settings" @click="emit('close')">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path
                        d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 0 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
            </Button>

            <p class="eyebrow">Settings</p>

            <h1 class="title">Blob Size</h1>
            <RangeSlider id="blob-size-slider" v-model="blobSizeModel" left-label="50%" right-label="150%"
                center-label="100%" :show-markers="true" aria-label="Blob size" :min="50" :max="150" :step="10" />

            <h1 class="title">Sleep Behavior</h1>
            <div class="field duration-field">
                <NumberInput ref="amountInputRef" v-model="amountModel" :disabled="unitModel === 'until-woken-up'"
                    :max-length="3" width="10rem" aria-label="Default sleep duration amount" @enter="handleConfirm" />

                <Select ref="selectRef" v-model="unitModel" :options="unitOptions" aria-label="Default sleep time unit"
                    wrapper-class="duration-select" />
            </div>

            <Checkbox v-model="askEveryTimeModel">
                Ask for duration every time
            </Checkbox>

            <Checkbox v-model="sleepTagVisibleModel">
                Show Wake-up Tag
            </Checkbox>

            <h1 class="title">Startup</h1>
            <Checkbox v-model="startOnSystemRestartModel">
                Auto-start on system restart
            </Checkbox>

            <h1 class="title">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                    <path fill-rule="evenodd"
                        d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 1 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                        clip-rule="evenodd" />
                </svg>
                Danger Zone
            </h1>
            <p class="hint">
                These actions are irreversible. Please proceed with caution.
            </p>
            <div class="danger-actions">
                <Button variant="secondary" class="danger-button" @click="handleRedoOnboarding">
                    Redo Onboarding
                </Button>
                <Button variant="secondary" class="danger-button" @click="handleClearJournal">
                    Clear Journal
                </Button>
                <Button variant="secondary" class="danger-button" @click="handleHardReset">
                    Hard Reset
                </Button>
            </div>

            <div v-if="dangerDialog.open" class="danger-dialog-backdrop overlay" role="presentation"
                @click.self="closeDangerDialog">
                <section class="danger-dialog window" role="dialog" :aria-label="dangerDialog.title">
                    <Button variant="secondary close-button circle-small" aria-label="Close settings"
                        @click="closeDangerDialog">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                            <path
                                d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 0 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                        </svg>
                    </Button>
                    <p class="eyebrow">{{ dangerDialog.title }}</p>
                    <p class="description">{{ dangerDialog.message }}</p>
                    <div class="actions">
                        <Button variant="secondary" @click="closeDangerDialog">
                            Cancel
                        </Button>
                        <Button variant="primary" @click="confirmDangerDialog">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                                class="size-4">
                                <path fill-rule="evenodd"
                                    d="M8.074.945A4.993 4.993 0 0 0 6 5v.032c.004.6.114 1.176.311 1.709.16.428-.204.91-.61.7a5.023 5.023 0 0 1-1.868-1.677c-.202-.304-.648-.363-.848-.058a6 6 0 1 0 8.017-1.901l-.004-.007a4.98 4.98 0 0 1-2.18-2.574c-.116-.31-.477-.472-.744-.28Zm.78 6.178a3.001 3.001 0 1 1-3.473 4.341c-.205-.365.215-.694.62-.59a4.008 4.008 0 0 0 1.873.03c.288-.065.413-.386.321-.666A3.997 3.997 0 0 1 8 8.999c0-.585.126-1.14.351-1.641a.42.42 0 0 1 .503-.235Z"
                                    clip-rule="evenodd" />
                            </svg>
                            {{ dangerDialog.confirmLabel }}
                        </Button>
                    </div>
                </section>
            </div>

            <div class="actions footer-actions">
                <Button variant="primary" @click="handleConfirm">
                    Done
                </Button>
            </div>
        </section>
    </div>
</template>

<style scoped>
.window {
    width: 40rem;
    max-width: calc(100vw - 2rem);
    max-height: calc(100vh - 2rem);
    overflow: auto;
    z-index: 1001;
    padding-bottom: 3rem;
}

.title {
    margin: 2rem 0 0 0;
}

.title:first-of-type {
    margin-top: 1rem;
}

.danger-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
}

.hint {
    margin-top: 0.5rem;
}

.danger-dialog-backdrop {
    z-index: 1002;
    background: radial-gradient(circle, var(--shadow) 50%, transparent);
}

.danger-dialog {
    position: fixed;
    width: 30rem;
    height: fit-content;
    padding-bottom: 4.5rem;
}
</style>
