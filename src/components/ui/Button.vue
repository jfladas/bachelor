<script setup>
const props = defineProps({
    variant: {
        type: String,
        default: "secondary",
    },
    disabled: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["click"]);

const handleClick = (event) => {
    emit("click", event);
};
</script>

<template>
    <button :disabled="props.disabled" :class="`${props.variant}`" @click="handleClick">
        <slot />
    </button>
</template>

<style scoped>
button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: auto;
    border: none;
    border-radius: 2rem;
    padding: 0.8rem 1rem;
    font-size: 1rem;
    font-weight: 500;
    color: var(--white);
    cursor: pointer;
    transition: transform 0.2s ease, background 0.2s ease;
}

.primary {
    background: var(--darker);
    transform: scale(1);
}

.primary:hover {
    background: var(--primary);
    transform: scale(1.05);
}

.secondary {
    color: var(--text);
    background: var(--secondary);
}

.secondary:hover {
    background: var(--secondary-hover);
}

button:disabled,
button:disabled:hover {
    background: var(--disabled);
    cursor: default;
    transform: none;
}

button:focus-visible {
    outline: 3px solid var(--lighter);
    outline-offset: 2px;
}

button :slotted(svg),
button :slotted(.icon svg) {
    height: 1.2rem;
    margin: 0;
}

.close-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
}

.list-button {
    position: absolute;
    top: 1rem;
    right: 3.5rem;
}

.circle-small {
    width: 2rem;
    height: 2rem;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.circle-big {
    width: 3rem;
    height: 3rem;
}
</style>
