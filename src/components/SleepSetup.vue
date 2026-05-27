<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref } from "vue";
import Button from "./Button.vue";

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
const selectToggleRef = ref(null);
const selectOpen = ref(false);
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
        selectToggleRef.value?.focus?.();
        return;
    }

    amountInputRef.value?.focus?.();
    amountInputRef.value?.select?.();
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

const handleAmountInput = (event) => {
    const nextValue = event.target.value.replace(/[^0-9]/g, "").slice(0, 3);
    amount.value = nextValue === "" ? "" : Number(nextValue);
    emitDraftChange();
};

const isSendDisabled = computed(() => unit.value !== "until-woken-up" && Number(amount.value) <= 0);

const handleConfirm = () => {
    emitDraftChange();
    emit("confirm", {
        durationMs: durationMs.value,
        unit: unit.value,
        amount: amount.value,
    });
};

const toggleSelect = () => {
    selectOpen.value = !selectOpen.value;
};

const closeSelect = () => {
    selectOpen.value = false;
};

const selectUnit = (val) => {
    unit.value = val;
    if (val === "until-woken-up") {
        closeSelect();
        emitDraftChange();
        return;
    }

    if (Number(amount.value) <= 0) {
        amount.value = 1;
    }
    closeSelect();
    emitDraftChange();
};

const toggleRememberAsDefault = () => {
    rememberAsDefault.value = !rememberAsDefault.value;
    emitDraftChange();
};

const onDocClick = (e) => {
    const el = selectRef.value;
    if (!el) return;
    if (!el.contains(e.target)) closeSelect();
};

onMounted(() => {
    document.addEventListener("click", onDocClick);
});

onBeforeUnmount(() => {
    document.removeEventListener("click", onDocClick);
    if (nowTimerId) {
        window.clearInterval(nowTimerId);
        nowTimerId = null;
    }
});
</script>

<template>
    <div class="sleep-overlay">
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

            <div class="sleep-form">
                <div class="field duration-field">
                    <input ref="amountInputRef" v-model="amount" :disabled="unit === 'until-woken-up'" type="text"
                        inputmode="numeric" maxlength="3" class="duration-input" aria-label="Sleep duration amount"
                        @input="handleAmountInput" @keyup.enter="handleConfirm" />

                    <div class="duration-select custom-select" ref="selectRef">
                        <button ref="selectToggleRef" type="button" class="custom-select-toggle" @click="toggleSelect"
                            :aria-expanded="selectOpen" aria-haspopup="listbox">
                            <span class="selectedcontent">{{ unit === 'minutes' ? 'Minutes' : unit === 'until-woken-up'
                                ? 'Until woken up' : 'Hours' }}</span>
                            <svg class="select-caret" viewBox="0 0 16 16" aria-hidden="true">
                                <path
                                    d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
                            </svg>
                        </button>
                        <ul v-if="selectOpen" class="custom-select-options" role="listbox"
                            aria-label="Sleep duration unit">
                            <li v-for="opt in unitOptions" :key="opt.value" role="option"
                                :aria-selected="unit === opt.value">
                                <button type="button" class="custom-select-option" @click="selectUnit(opt.value)">
                                    {{ opt.label }}
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>

                <label class="remember-default">
                    <input v-model="rememberAsDefault" type="checkbox" class="remember-default-input"
                        @change="emitDraftChange" />
                    <span class="remember-default-box" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                            class="remember-default-check" aria-hidden="true">
                            <path fill-rule="evenodd"
                                d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                                clip-rule="evenodd" />
                        </svg>
                    </span>
                    <span class="remember-default-text">Don't ask next time</span>
                </label>

                <p class="hint">
                    <template v-if="unit === 'until-woken-up'">Blob will sleep until woken up</template>
                    <template v-else>Blob will wake up again at {{ wakeTimeLabel }}</template>
                </p>

                <div class="actions">
                    <Button variant="primary" :disabled="isSendDisabled" @click="handleConfirm">Send to Sleep</Button>
                </div>
            </div>
        </section>
    </div>
</template>

<style scoped>
.sleep-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle, transparent 50%, var(--shadow));
    pointer-events: auto;
    z-index: 1000;
}

.window {
    position: relative;
    width: 40rem;
    height: auto;
    z-index: 1001;
    pointer-events: auto;
    padding-bottom: 6rem;
}

.duration-field {
    display: flex;
    flex-direction: row;
    justify-content: stretch;
    gap: 1rem;
    width: 100%;
}

.duration-input,
.duration-select {
    border-radius: 1rem;
    border: none;
    background: var(--white);
    color: var(--text-strong);
    padding: 0.8rem 1rem;
    font-size: 1.2rem;
    font-weight: 600;
}

.duration-input {
    text-align: center;
    width: 10rem;
}

.duration-input:disabled {
    opacity: 0.5;
    cursor: default;
}

.duration-select {
    cursor: pointer;
    padding: 0;
    overflow: visible;
    width: 100%;
}

.selectedcontent {
    display: flex;
    align-items: center;
}

.custom-select {
    position: relative;
}

.custom-select-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    border-radius: 1rem;
    padding: 0.8rem 1rem;
    font: inherit;
    cursor: pointer;
    color: inherit;
    outline: none;
    box-shadow: none;
    appearance: none;
}

.custom-select-toggle:focus,
.custom-select-toggle:focus-visible {
    outline: none;
    box-shadow: none;
}

.select-caret {
    width: 1.2rem;
    height: 1.2rem;
    flex: none;
    fill: currentColor;
}

.custom-select-options {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 0.5rem);
    background: var(--white);
    border-radius: 1rem;
    list-style: none;
    margin: 0;
    padding: 0;
    z-index: 1002;
    max-height: 12rem;
    overflow: auto;
}

.custom-select-options li {
    padding: 0;
}

.custom-select-options li[aria-selected="true"] {
    background: var(--lighter);
}

.custom-select-options li:hover {
    background: color-mix(in oklch, var(--lighter) 50%, var(--white));
}

.custom-select-option {
    display: block;
    width: 100%;
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    font: inherit;
    font-weight: 600;
    color: inherit;
    text-align: left;
    cursor: pointer;
}

.custom-select-option:focus-visible {
    outline: none;
    background: color-mix(in oklch, var(--lighter) 50%, var(--white));
}

.duration-input:focus-visible,
.custom-select:focus-within {
    outline: 3px solid var(--lighter);
    outline-offset: 2px;
}

.remember-default {
    margin-top: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 1rem;
    border: none;
    color: var(--text);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    user-select: none;
}

.remember-default:focus-within {
    outline: none;
}

.remember-default-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
}

.remember-default-box {
    position: relative;
    width: 1.5rem;
    height: 1.5rem;
    flex: none;
    border-radius: 0.5rem;
    background: var(--secondary);
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--white);
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.remember-default:hover .remember-default-box {
    background: var(--secondary-hover);
}

.remember-default-check {
    width: 1.2rem;
    height: 1.2rem;
    opacity: 0;
    transform: scale(0.5);
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.remember-default-input:checked+.remember-default-box {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--white);
}

.remember-default-input:checked+.remember-default-box .remember-default-check {
    opacity: 1;
    transform: scale(1);
}

.remember-default-input:focus-visible+.remember-default-box {
    outline: 3px solid var(--lighter);
    outline-offset: 2px;
}

.hint {
    font-size: 1.2rem;
    font-weight: 500;
    font-family: 'GeneralSans-VariableItalic', 'GeneralSans-Italic', sans-serif;
    color: var(--darker);
    margin-bottom: 0rem;
}
</style>