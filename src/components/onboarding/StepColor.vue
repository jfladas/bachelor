<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { clampHue } from "../../utils/validation";
import Button from "../Button.vue";

const props = defineProps({
    hue: {
        type: Number,
        required: true,
    },
    assignedHue: {
        type: Number,
        required: true,
    },
    disabled: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["manual-hue-change", "reset-hue"]);

const huePickerRef = ref(null);
const hueDragging = ref(false);

const hueThumbStyle = computed(() => {
    const radius = 38;
    const angle = (clampHue(props.hue) - 90) * (Math.PI / 180);

    return {
        left: `${50 + Math.cos(angle) * radius}%`,
        top: `${50 + Math.sin(angle) * radius}%`,
    };
});

const assignedHueMarkerStyle = computed(() => {
    const radius = 38;
    const angle = (clampHue(props.assignedHue) - 90) * (Math.PI / 180);

    return {
        left: `${50 + Math.cos(angle) * radius}%`,
        top: `${50 + Math.sin(angle) * radius}%`,
    };
});

const canResetToAssignedHue = computed(() => {
    return clampHue(props.hue) !== clampHue(props.assignedHue);
});

const emitManualHue = (nextHue) => {
    emit("manual-hue-change", clampHue(nextHue));
};

const setHueFromPointer = (event) => {
    const picker = huePickerRef.value;
    if (!picker) {
        return;
    }

    const rect = picker.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);

    emitManualHue(angle + 90);
};

const onHuePointerMove = (event) => {
    if (!hueDragging.value) {
        return;
    }

    setHueFromPointer(event);
};

const stopHueDrag = () => {
    if (!hueDragging.value) {
        return;
    }

    hueDragging.value = false;
    window.removeEventListener("pointermove", onHuePointerMove);
    window.removeEventListener("pointerup", stopHueDrag);
};

const beginHueDrag = (event) => {
    if (event.button !== 0 || props.disabled) {
        return;
    }

    event.preventDefault();
    hueDragging.value = true;
    setHueFromPointer(event);
    window.addEventListener("pointermove", onHuePointerMove);
    window.addEventListener("pointerup", stopHueDrag);
};

const onHueKeyDown = (event) => {
    if (props.disabled) {
        return;
    }

    const hueStep = event.shiftKey ? 10 : 1;

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        emitManualHue(props.hue + hueStep);
        return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        emitManualHue(props.hue - hueStep);
    }
};

const resetHueToAssigned = () => {
    emit("reset-hue");
};

onBeforeUnmount(() => {
    stopHueDrag();
});
</script>

<template>
    <section>
        <h1 class="title">Confirm your color</h1>
        <p class="description">
            Based on your answers, this color has been assigned to you. If you feel like it's not quite right, drag the
            wheel to adjust it. Choose a color that represents you!
        </p>

        <div class="field color-field">
            <div ref="huePickerRef" class="hue-picker" role="slider" tabindex="0" aria-label="Pet color hue"
                aria-valuemin="0" aria-valuemax="359" :aria-valuenow="Math.round(clampHue(props.hue))"
                @pointerdown="beginHueDrag" @keydown="onHueKeyDown">
                <span class="hue-picker-assigned-dot" :style="assignedHueMarkerStyle" aria-hidden="true" />
                <span class="hue-picker-thumb" :class="{ dragging: hueDragging }" :style="hueThumbStyle" />
                <span class="hue-picker-center" />
            </div>

            <Button v-if="canResetToAssignedHue" variant="secondary" class="reset-hue-button" :disabled="props.disabled"
                @click="resetHueToAssigned">
                Reset to assigned color
            </Button>
        </div>
    </section>
</template>

<style scoped>
.field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.color-field {
    margin-top: 2rem;
    align-items: center;
    gap: 1rem;
}

.hue-picker {
    position: relative;
    width: 20rem;
    height: 20rem;
    border-radius: 50%;
    padding: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    touch-action: none;
    background: conic-gradient(in oklch longer hue, oklch(80% 0.1 0deg), oklch(80% 0.1 360deg));
}

.hue-picker::before {
    content: "";
    position: absolute;
    inset: 0.75rem;
    border-radius: 50%;
    background: conic-gradient(in oklch longer hue, oklch(71% 0.16 0deg), oklch(71% 0.16 360deg));
}

.hue-picker-thumb {
    position: absolute;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    border: 3px solid white;
    transform: translate(-50%, -50%);
    background: var(--primary);
    z-index: 3;
    cursor: pointer;
    transition: transform 0.2s ease;
}

.hue-picker-assigned-dot {
    position: absolute;
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: white;
    z-index: 2;
    pointer-events: none;
}

.hue-picker-thumb:hover,
.hue-picker-thumb.dragging {
    transform: translate(-50%, -50%) scale(1.2);
    background: var(--lighter);
}

.hue-picker-center {
    position: relative;
    z-index: 1;
    width: 13rem;
    height: 13rem;
    border-radius: 50%;
    background: white;
}

.reset-hue-button {
    width: auto;
    padding: 0.8rem 1.5rem;
}

.hue-picker:focus-visible {
    outline: 3px solid var(--lighter);
    outline-offset: 2px;
}
</style>
