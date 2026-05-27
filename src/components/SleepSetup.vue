<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref } from "vue";
import Button from "./Button.vue";
import Checkbox from "./Checkbox.vue";
import Select from "./Select.vue";
import NumberInput from "./NumberInput.vue";

const props = defineProps({
    initialAmount: {
        type: [Number, String],
        default: 1,
    },
    initialUnit: {
        type: String,
        default: "hours",
    },
    initialRemember: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["confirm", "cancel", "draft-change"]);

const normalizeAmount = (value) => {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue) || nextValue < 1) {
        return 1;
    }

    return Math.min(999, Math.round(nextValue));
};

const normalizeUnit = (value) => (value === "minutes" || value === "until-woken-up" ? value : "hours");

const amount = ref(normalizeAmount(props.initialAmount));
const unit = ref(normalizeUnit(props.initialUnit));
const rememberAsDefault = ref(Boolean(props.initialRemember));
const amountInputRef = ref(null);
const selectRef = ref(null);
const now = ref(Date.now());
let nowTimerId = null;

const unitOptions = [
    { value: "minutes", label: "Minutes" },
    { value: "hours", label: "Hours" },
    { value: "until-woken-up", label: "Until woken up" },
];

const unitFactors = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
};

const focusAmountInput = async () => {
    await nextTick();
    if (unit.value === "until-woken-up") {
        selectRef.value?.focusToggle?.();
        return;
    }

    await amountInputRef.value?.focusInput?.();
    await amountInputRef.value?.selectInput?.();
};

onMounted(focusAmountInput);

onMounted(() => {
    nowTimerId = window.setInterval(() => {
        now.value = Date.now();
    }, 30000);
});

const emitDraftChange = () => {
    emit("draft-change", {
        amount: amount.value,
        unit: unit.value,
        rememberAsDefault: rememberAsDefault.value,
    });
};

const durationMs = computed(() => {
    if (unit.value === "until-woken-up") {
        return null;
    }

    const numericAmount = Number(amount.value) || 1;
    const factor = unitFactors[unit.value] || unitFactors.hours;
    return Math.max(60 * 1000, Math.round(Math.max(1, numericAmount) * factor));
});

const durationLabel = computed(() => {
    if (unit.value === "until-woken-up") {
        return "until woken up";
    }

    const numericAmount = Number(amount.value) || 1;
    const isMinutes = unit.value === "minutes";
    const unitLabel = isMinutes ? (numericAmount === 1 ? "minute" : "minutes") : (numericAmount === 1 ? "hour" : "hours");
    return `${numericAmount} ${unitLabel}`;
});

const wakeTimeLabel = computed(() => {
    if (unit.value === "until-woken-up") {
        return "until woken up";
    }

    const wakeTime = new Date(now.value + durationMs.value);
    const timeLabel = wakeTime.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
    });

    const startOfToday = new Date(now.value);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWakeDay = new Date(wakeTime);
    startOfWakeDay.setHours(0, 0, 0, 0);

    const dayDifference = Math.round(
        (Date.UTC(startOfWakeDay.getFullYear(), startOfWakeDay.getMonth(), startOfWakeDay.getDate()) -
            Date.UTC(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate())) /
        86400000
    );

    if (dayDifference === 1) {
        return `${timeLabel} tomorrow`;
    }

    if (dayDifference > 1) {
        return `${timeLabel} on ${wakeTime.toLocaleDateString([], { month: "long", day: "numeric" })}`;
    }

    return timeLabel;
});

const isSendDisabled = computed(() => unit.value !== "until-woken-up" && Number(amount.value) <= 0);

const handleConfirm = () => {
    emitDraftChange();
    emit("confirm", {
        durationMs: durationMs.value,
        unit: unit.value,
        amount: amount.value,
    });
};

const toggleRememberAsDefault = () => {
    rememberAsDefault.value = !rememberAsDefault.value;
    emitDraftChange();
};

onMounted(() => {
    if (nowTimerId) {
        window.clearInterval(nowTimerId);
        nowTimerId = null;
    }
});
</script>

<template>
    <div class="overlay">
        <section class="window">
            <Button variant="secondary" class="close-button circle-small" aria-label="Close sleep prompt"
                @click="emit('cancel')">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path
                        d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 0 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
            </Button>

            <p class="eyebrow">Send to Sleep</p>
            <p class="description">Choose how long sleep should last.</p>

            <div>
                <div class="field duration-field">
                    <NumberInput ref="amountInputRef" v-model="amount" :disabled="unit === 'until-woken-up'"
                        :max-length="3" width="10rem" aria-label="Sleep duration amount" @enter="handleConfirm" />

                    <Select ref="selectRef" v-model="unit" :options="unitOptions" aria-label="Sleep duration unit"
                        wrapper-class="duration-select" />
                </div>

                <Checkbox v-model="rememberAsDefault" @change="emitDraftChange">
                    Don't ask next time
                </Checkbox>

                <p class="hint">
                    <template v-if="unit === 'until-woken-up'">Blob will sleep until woken up</template>
                    <template v-else>Blob will wake up at {{ wakeTimeLabel }}</template>
                </p>

                <div class="actions">
                    <Button variant="primary" :disabled="isSendDisabled" @click="handleConfirm">Send to Sleep</Button>
                </div>
            </div>
        </section>
    </div>
</template>

<style scoped>
.window {
    position: relative;
    width: 40rem;
    height: auto;
    z-index: 1001;
    pointer-events: auto;
    padding-bottom: 6rem;
}
</style>