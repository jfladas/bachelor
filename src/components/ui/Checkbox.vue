<script setup>
const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false,
    },
    disabled: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["update:modelValue", "change"]);

const handleChange = (event) => {
    const nextValue = Boolean(event.target.checked);
    emit("update:modelValue", nextValue);
    emit("change", nextValue);
};
</script>

<template>
    <label class="custom-checkbox">
        <input :checked="Boolean(props.modelValue)" :disabled="disabled" type="checkbox" class="custom-checkbox-input"
            @change="handleChange" />
        <span class="custom-checkbox-box" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                class="custom-checkbox-check" aria-hidden="true">
                <path fill-rule="evenodd"
                    d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                    clip-rule="evenodd" />
            </svg>
        </span>
        <span class="custom-checkbox-text">
            <slot />
        </span>
    </label>
</template>

<style scoped>
.custom-checkbox {
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

.custom-checkbox:focus-within {
    outline: none;
}

.custom-checkbox-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
}

.custom-checkbox-box {
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

.custom-checkbox:hover .custom-checkbox-box {
    background: var(--secondary-hover);
}

.custom-checkbox-check {
    width: 1.2rem;
    height: 1.2rem;
    opacity: 0;
    transform: scale(0.5);
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.custom-checkbox-input:checked+.custom-checkbox-box {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--white);
}

.custom-checkbox-input:checked+.custom-checkbox-box .custom-checkbox-check {
    opacity: 1;
    transform: scale(1);
}

.custom-checkbox-input:focus-visible+.custom-checkbox-box {
    outline: 3px solid var(--lighter);
    outline-offset: 2px;
}

.custom-checkbox-text {
    line-height: 1.2;
}
</style>
