<script setup>
import { computed, nextTick, ref, watch } from "vue";

const props = defineProps({
    modelValue: {
        type: [String, Number],
        default: "",
    },
    ariaLabel: {
        type: String,
        default: "Number input",
    },
    placeholder: {
        type: String,
        default: "",
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    maxLength: {
        type: Number,
        default: 3,
    },
    width: {
        type: String,
        default: "100%",
    },
    variant: {
        type: String,
        default: "default",
    },
    allowEmpty: {
        type: Boolean,
        default: true,
    },
});

const emit = defineEmits(["update:modelValue", "enter"]);

const inputRef = ref(null);

const normalizedValue = computed(() => (props.modelValue === null || props.modelValue === undefined ? "" : String(props.modelValue)));

const sanitizeDigits = (value) => {
    const nextValue = String(value ?? "").replace(/[^0-9]/g, "").slice(0, Math.max(1, props.maxLength || 1));
    if (nextValue === "" && props.allowEmpty) {
        return "";
    }

    return nextValue;
};

const handleInput = (event) => {
    emit("update:modelValue", sanitizeDigits(event.target.value));
};

const handleKeyup = (event) => {
    if (event.key === "Enter") {
        emit("enter", event);
    }
};

const focusInput = async () => {
    await nextTick();
    inputRef.value?.focus?.();
};

const selectInput = async () => {
    await nextTick();
    inputRef.value?.select?.();
};

const calcMaxNum = (maxLength) => {
    return Math.pow(10, maxLength) - 1;
};

const handleKeydown = (event) => {
    const key = event.key;
    const isModifier = event.ctrlKey || event.metaKey || event.altKey;
    if (isModifier) return;

    const allowed = [
        "Backspace",
        "Delete",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "Tab",
        "Enter",
    ];
    if (allowed.includes(key)) return;

    if (/^[0-9]$/.test(key)) return;

    event.preventDefault();
};

const handlePaste = (event) => {
    const paste = (event.clipboardData || window.clipboardData).getData("text") || "";
    const cleaned = sanitizeDigits(paste);
    event.preventDefault();

    const el = inputRef.value;
    const current = String(normalizedValue.value || "");
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = (current.slice(0, start) + cleaned + current.slice(end)).slice(0, Math.max(1, props.maxLength || 1));

    emit("update:modelValue", next);
    nextTick(() => {
        const pos = Math.min(next.length, start + cleaned.length);
        try {
            el.setSelectionRange(pos, pos);
        } catch (e) {
            // ignore
        }
    });
};

defineExpose({
    focusInput,
    selectInput,
});

watch(
    () => props.maxLength,
    (nextMaxLength) => {
        emit("update:modelValue", sanitizeDigits(normalizedValue.value).slice(0, Math.max(1, nextMaxLength || 1)));
    }
);
</script>

<template>
    <div class="number-input-field" :class="[variant, props.disabled ? 'disabled' : '']" :style="{ width }">
        <input type="text" ref="inputRef" :value="normalizedValue" :maxlength="maxLength" min="1"
            :max="calcMaxNum(maxLength)" :placeholder="placeholder" :disabled="disabled" :aria-label="ariaLabel"
            class="number-input" @input="handleInput" @keyup="handleKeyup" @keydown="handleKeydown" @paste="handlePaste"
            inputmode="numeric" pattern="\d*" />
    </div>
</template>

<style scoped>
.number-input-field {
    display: inline-flex;
    min-width: 0;
}

.number-input {
    width: 100%;
    border-radius: 1rem;
    border: none;
    background: var(--white);
    color: var(--text-strong);
    padding: 0.8rem 1rem;
    font-size: 1.2rem;
    font-weight: 500;
    text-align: center;
    box-sizing: border-box;
}

.number-input::placeholder {
    color: var(--text-muted);
}

.number-input:disabled {
    opacity: 0.5;
}

.number-input:focus-visible {
    outline: 3px solid var(--lighter);
    outline-offset: 2px;
}

.number-input-field.pin .number-input {
    font-size: 2rem;
    letter-spacing: 0.5rem;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
</style>
