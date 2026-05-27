<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
    modelValue: {
        type: [String, Number],
        default: "",
    },
    options: {
        type: Array,
        default: () => [],
    },
    ariaLabel: {
        type: String,
        default: "Custom select",
    },
    wrapperClass: {
        type: String,
        default: "",
    },
    toggleClass: {
        type: String,
        default: "",
    },
    optionsClass: {
        type: String,
        default: "",
    },
    optionClass: {
        type: String,
        default: "",
    },
    disabled: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["update:modelValue"]);

const selectOpen = ref(false);
const selectRef = ref(null);
const selectToggleRef = ref(null);

const normalizedOptions = computed(() => (Array.isArray(props.options) ? props.options : []));

const selectedOption = computed(() => {
    return normalizedOptions.value.find((option) => option.value === props.modelValue) || normalizedOptions.value[0] || null;
});

const selectedLabel = computed(() => selectedOption.value?.label ?? "Select");

const closeSelect = () => {
    selectOpen.value = false;
};

const openSelect = () => {
    if (props.disabled) {
        return;
    }

    selectOpen.value = true;
};

const toggleSelect = () => {
    if (props.disabled) {
        return;
    }

    selectOpen.value = !selectOpen.value;
};

const selectValue = (value) => {
    emit("update:modelValue", value);
    closeSelect();
};

const onDocClick = (event) => {
    const el = selectRef.value;
    if (!el) {
        return;
    }

    if (!el.contains(event.target)) {
        closeSelect();
    }
};

const focusToggle = async () => {
    await nextTick();
    selectToggleRef.value?.focus?.();
};

onMounted(() => {
    document.addEventListener("click", onDocClick);
});

onBeforeUnmount(() => {
    document.removeEventListener("click", onDocClick);
});

watch(
    () => props.disabled,
    (isDisabled) => {
        if (isDisabled) {
            closeSelect();
        }
    }
);

defineExpose({
    focusToggle,
    closeSelect,
    openSelect,
});
</script>

<template>
    <div ref="selectRef" class="custom-select" :class="wrapperClass" :disabled="disabled">
        <button ref="selectToggleRef" type="button" class="custom-select-toggle" :class="toggleClass"
            :aria-expanded="selectOpen" :aria-haspopup="'listbox'" :aria-label="ariaLabel" @click="toggleSelect">
            <span class="selectedcontent">{{ selectedLabel }}</span>
            <svg class="select-caret" viewBox="0 0 16 16" aria-hidden="true">
                <path
                    d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
            </svg>
        </button>

        <ul v-if="selectOpen" class="custom-select-options" :class="optionsClass" role="listbox"
            :aria-label="ariaLabel">
            <li v-for="option in normalizedOptions" :key="option.value" role="option"
                :aria-selected="modelValue === option.value">
                <button type="button" class="custom-select-option" :class="optionClass"
                    @click="selectValue(option.value)">
                    {{ option.label }}
                </button>
            </li>
        </ul>
    </div>
</template>

<style scoped>
.custom-select {
    position: relative;
    border-radius: 1rem;
    border: none;
    background: var(--white);
    color: var(--text-strong);
    padding: 0;
    font-size: 1.2rem;
    font-weight: 500;
    width: 100%;
}

.custom-select:disabled {
    opacity: 0.5;
}

.custom-select-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    padding: 0.8rem 0.5rem 0.8rem 1rem;
    background: transparent;
    border: none;
    border-radius: 1rem;
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

.custom-select:focus-within {
    outline: 3px solid var(--lighter);
    outline-offset: 2px;
}

.selectedcontent {
    display: flex;
    align-items: center;
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
    font-weight: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
}

.custom-select-option:focus-visible {
    outline: none;
    background: color-mix(in oklch, var(--lighter) 50%, var(--white));
}
</style>
