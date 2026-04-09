<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Companion from "./components/Companion.vue";

const { ipcRenderer } = require("electron");
const isOnboardingWindow = new URLSearchParams(window.location.search).get("window") === "onboarding";

const onboardingLoaded = ref(false);
const onboardingCompleted = ref(false);
const onboardingSaving = ref(false);
const onboardingStep = ref(1);
const totalOnboardingSteps = 3;
const traitOptions = ["active", "optimistic", "gentle", "cool", "mysterious", "cute"];
const reactionOptions = ["sparkles", "flowers", "hearts"];
const selectedTraits = ref([]);
const questionAnswers = ref({
  reservedOpen: 0.5,
  calmAssertive: 0.5,
  rationalEmotional: 0.5,
  groundedCreative: 0.5,
});
const hueOverride = ref(false);
const onboardingData = ref({
  hue: 220,
  assignedHue: 220,
  symmetry: 0.5,
  variability: 0.5,
  activity: 0.5,
  reaction: "sparkles",
});

const clampHue = (value, fallback = 220) => {
  const numericHue = Number(value);
  if (!Number.isFinite(numericHue)) {
    return fallback;
  }

  return ((Math.round(numericHue) % 360) + 360) % 360;
};

const clampUnit = (value, fallback = 0.5) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, Number(numericValue.toFixed(2))));
};

const normalizeTraits = (traits) => {
  if (!Array.isArray(traits)) {
    return [];
  }

  const uniqueTraits = [...new Set(traits.filter((trait) => typeof trait === "string" && traitOptions.includes(trait)))];
  return uniqueTraits.length > 0 ? uniqueTraits.slice(0, 6) : [];
};

const normalizeReaction = (reaction, fallback = "sparkles") => {
  if (typeof reaction === "string" && reactionOptions.includes(reaction)) {
    return reaction;
  }

  if (typeof reaction === "number" && Number.isFinite(reaction)) {
    const index = Math.min(
      reactionOptions.length - 1,
      Math.max(0, Math.round(reaction * (reactionOptions.length - 1)))
    );
    return reactionOptions[index];
  }

  return fallback;
};

const normalizeOnboardingData = (data = {}) => ({
  hue: clampHue(data.hue, 220),
  assignedHue: clampHue(data.assignedHue ?? data.hue, 220),
  symmetry: clampUnit(data.symmetry, 0.5),
  variability: clampUnit(data.variability, 0.5),
  activity: clampUnit(data.activity, 0.5),
  reaction: normalizeReaction(data.reaction, "sparkles"),
});

const huePickerRef = ref(null);
let hueDragging = false;

const hueVariables = computed(() => ({
  "--hue": `${clampHue(onboardingData.value.hue)}deg`,
  "--white": "oklch(95% 0.01 var(--hue))",
  "--shadow": "oklch(20% 0.02 var(--hue) / 0.5)",
  "--primary": "oklch(71% 0.16 var(--hue))",
  "--lighter": "oklch(80% 0.1 var(--hue))",
  "--darker": "oklch(63% 0.14 var(--hue))",
  "--text-strong": "oklch(20% 0.04 var(--hue))",
  "--text": "oklch(40% 0.02 var(--hue))",
  "--text-muted": "oklch(80% 0.02 var(--hue))",
  "--secondary": "oklch(90% 0.02 var(--hue))",
  "--secondary-hover": "oklch(85% 0.03 var(--hue))",
}));

const toPercent = (value, fallback = 0.5) => `${Math.round(clampUnit(value, fallback) * 100)}%`;

const reservedOpenPercent = computed(() => toPercent(questionAnswers.value.reservedOpen, 0.5));
const calmAssertivePercent = computed(() => toPercent(questionAnswers.value.calmAssertive, 0.5));
const rationalEmotionalPercent = computed(() => toPercent(questionAnswers.value.rationalEmotional, 0.5));
const groundedCreativePercent = computed(() => toPercent(questionAnswers.value.groundedCreative, 0.5));

const calculateAssignedProfile = ({ sliders, traits, hue }) => {
  let calculatedHue = hue;
  let calculatedSymmetry = 0.5;
  let calculatedVariability = 0.5;
  let calculatedActivity = 0.5;
  let calculatedReaction = "sparkles";

  /*
    020 red
    050 orange
    100 yellow
    150 green
    200 cyan
    250 blue
    300 purple
    350 pink
  */

  const normalizedSliders = {
    reservedOpen: clampUnit(sliders?.reservedOpen, 0.5),
    calmAssertive: clampUnit(sliders?.calmAssertive, 0.5),
    rationalEmotional: clampUnit(sliders?.rationalEmotional, 0.5),
    groundedCreative: clampUnit(sliders?.groundedCreative, 0.5),
  };
  const normalizedTraits = normalizeTraits(traits);

  // Build weighted hue contributions and resolve with circular averaging.
  const hueContributions = [];
  const addHueContribution = (candidateHue, weight = 1) => {
    hueContributions.push({ hue: clampHue(candidateHue, 220), weight: Math.max(0, Number(weight) || 0) });
  };
  const addInterpolatedHue = (startHue, endHue, factor, weight = 1) => {
    const start = clampHue(startHue, 220);
    const end = clampHue(endHue, 220);
    const t = clampUnit(factor, 0.5);
    const centerDistance = Math.abs(t - 0.5) * 2;
    const effectiveWeight = weight * centerDistance;

    if (effectiveWeight <= 0) {
      return;
    }

    const shortestDelta = ((end - start + 540) % 360) - 180;
    addHueContribution(start + shortestDelta * t, effectiveWeight);
  };

  addInterpolatedHue(200, 20, normalizedSliders.calmAssertive, 1); // calm (cyan) -> assertive (red)
  addInterpolatedHue(275, 50, normalizedSliders.reservedOpen, 1); // reserved (blue/purple) -> open (orange)
  addInterpolatedHue(250, 50, normalizedSliders.rationalEmotional, 1); // rational (blue) -> emotional (orange)
  addInterpolatedHue(150, 325, normalizedSliders.groundedCreative, 1); // grounded (green) -> creative (purple/pink)

  const traitHueMap = {
    active: () => {
      addHueContribution(125, 0.4); // yellow/green
      addHueContribution(50, 0.4); // orange
    },
    optimistic: () => addHueContribution(100, 0.8), // yellow
    gentle: () => addHueContribution(200, 0.8), // cyan
    cool: () => addHueContribution(225, 0.8), // blue/cyan
    mysterious: () => addHueContribution(300, 0.8), // purple
    cute: () => addHueContribution(325, 0.8), // pink/purple
  };

  const traitOppositeHueMap = {
    active: () => addHueContribution(275, 0.2), // blue/purple
    optimistic: () => addHueContribution(225, 0.2), // cyan/blue
    gentle: () => addHueContribution(350, 0.2), // red
    cool: () => addHueContribution(50, 0.2), // orange
    mysterious: () => addHueContribution(125, 0.2), // yellow/green
    cute: () => addHueContribution(175, 0.2), // green/cyan
  };

  traitOptions.forEach((trait) => {
    if (normalizedTraits.includes(trait)) {
      traitHueMap[trait]?.();
      return;
    }

    traitOppositeHueMap[trait]?.();
  });

  const vector = hueContributions.reduce(
    (accumulator, entry) => {
      if (entry.weight <= 0) {
        return accumulator;
      }

      const radians = (entry.hue * Math.PI) / 180;
      accumulator.x += Math.cos(radians) * entry.weight;
      accumulator.y += Math.sin(radians) * entry.weight;
      accumulator.weight += entry.weight;
      return accumulator;
    },
    { x: 0, y: 0, weight: 0 }
  );

  if (vector.weight > 0 && (Math.abs(vector.x) > Number.EPSILON || Math.abs(vector.y) > Number.EPSILON)) {
    calculatedHue = clampHue((Math.atan2(vector.y, vector.x) * 180) / Math.PI, hue);
  }


  return {
    assignedHue: calculatedHue,
    symmetry: calculatedSymmetry,
    variability: calculatedVariability,
    activity: calculatedActivity,
    reaction: calculatedReaction,
  };
};

const updateAssignedProfile = () => {
  const calculated = calculateAssignedProfile({
    sliders: questionAnswers.value,
    traits: selectedTraits.value,
    hue: onboardingData.value.hue,
  });

  onboardingData.value.assignedHue = clampHue(calculated.assignedHue, onboardingData.value.hue);
  onboardingData.value.symmetry = clampUnit(calculated.symmetry, onboardingData.value.symmetry);
  onboardingData.value.variability = clampUnit(calculated.variability, onboardingData.value.variability);
  onboardingData.value.activity = clampUnit(calculated.activity, onboardingData.value.activity);
  onboardingData.value.reaction = normalizeReaction(calculated.reaction, onboardingData.value.reaction);

  if (!hueOverride.value) {
    onboardingData.value.hue = onboardingData.value.assignedHue;
  }
};

const hueThumbStyle = computed(() => {
  const radius = 38;
  const angle = (clampHue(onboardingData.value.hue) - 90) * (Math.PI / 180);

  return {
    left: `${50 + Math.cos(angle) * radius}%`,
    top: `${50 + Math.sin(angle) * radius}%`,
  };
});

const assignedHueMarkerStyle = computed(() => {
  const radius = 38;
  const angle = (clampHue(onboardingData.value.assignedHue) - 90) * (Math.PI / 180);

  return {
    left: `${50 + Math.cos(angle) * radius}%`,
    top: `${50 + Math.sin(angle) * radius}%`,
  };
});

const canResetToAssignedHue = computed(() => {
  return clampHue(onboardingData.value.hue) !== clampHue(onboardingData.value.assignedHue);
});

const setHueFromPointer = (event) => {
  const picker = huePickerRef.value;
  if (!picker) {
    return;
  }

  const rect = picker.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);

  hueOverride.value = true;
  onboardingData.value.hue = clampHue(angle + 90);
};

const onHuePointerMove = (event) => {
  if (!hueDragging) {
    return;
  }

  setHueFromPointer(event);
};

const stopHueDrag = () => {
  if (!hueDragging) {
    return;
  }

  hueDragging = false;
  window.removeEventListener("pointermove", onHuePointerMove);
  window.removeEventListener("pointerup", stopHueDrag);
};

const beginHueDrag = (event) => {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  hueDragging = true;
  setHueFromPointer(event);
  window.addEventListener("pointermove", onHuePointerMove);
  window.addEventListener("pointerup", stopHueDrag);
};

const onHueKeyDown = (event) => {
  const hueStep = event.shiftKey ? 10 : 1;

  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    event.preventDefault();
    hueOverride.value = true;
    onboardingData.value.hue = clampHue(onboardingData.value.hue + hueStep);
    return;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    event.preventDefault();
    hueOverride.value = true;
    onboardingData.value.hue = clampHue(onboardingData.value.hue - hueStep);
  }
};

const resetHueToAssigned = () => {
  onboardingData.value.hue = clampHue(onboardingData.value.assignedHue, onboardingData.value.hue);
  hueOverride.value = false;
};

const toggleTrait = (trait) => {
  const hasTrait = selectedTraits.value.includes(trait);
  if (hasTrait) {
    selectedTraits.value = selectedTraits.value.filter((entry) => entry !== trait);
    return;
  }

  selectedTraits.value = [...selectedTraits.value, trait].slice(0, 6);
};

const applyStateData = (data = {}) => {
  onboardingData.value = normalizeOnboardingData(data);
  selectedTraits.value = normalizeTraits(data.traits ?? data.selectedTraits);
  questionAnswers.value = {
    reservedOpen: clampUnit(data.questionAnswers?.reservedOpen, 0.5),
    calmAssertive: clampUnit(data.questionAnswers?.calmAssertive, 0.5),
    rationalEmotional: clampUnit(data.questionAnswers?.rationalEmotional, 0.5),
    groundedCreative: clampUnit(data.questionAnswers?.groundedCreative, 0.5),
  };
  hueOverride.value = Boolean(
    data.hueOverride ?? (onboardingData.value.hue !== onboardingData.value.assignedHue)
  );
  updateAssignedProfile();
};

const createOnboardingStatePayload = () => ({
  hue: onboardingData.value.hue,
  assignedHue: onboardingData.value.assignedHue,
  symmetry: onboardingData.value.symmetry,
  variability: onboardingData.value.variability,
  activity: onboardingData.value.activity,
  reaction: onboardingData.value.reaction,
  traits: [...selectedTraits.value],
  questionAnswers: {
    reservedOpen: questionAnswers.value.reservedOpen,
    calmAssertive: questionAnswers.value.calmAssertive,
    rationalEmotional: questionAnswers.value.rationalEmotional,
    groundedCreative: questionAnswers.value.groundedCreative,
  },
  hueOverride: hueOverride.value,
});

const handleOnboardingStateChanged = (_, state) => {
  onboardingCompleted.value = state.completed;
  applyStateData(state.data);
  if (!state.completed) {
    onboardingStep.value = 1;
  }
};

const goToNextStep = () => {
  if (onboardingStep.value < totalOnboardingSteps) {
    onboardingStep.value += 1;
  }
};

const goToPreviousStep = () => {
  if (onboardingStep.value > 1) {
    onboardingStep.value -= 1;
  }
};

const completeOnboarding = async () => {
  if (onboardingSaving.value) {
    return;
  }

  onboardingSaving.value = true;

  try {
    const payload = createOnboardingStatePayload();
    const savedState = await ipcRenderer.invoke("save-onboarding-state", payload);
    applyStateData(savedState.data);
    onboardingCompleted.value = true;
    ipcRenderer.send("set-ignore-mouse-events", true);
  } catch (error) {
    console.error("Failed to save onboarding state:", error);
  } finally {
    onboardingSaving.value = false;
  }
};

const setOnboardingPopupInteractive = (interactive) => {
  if (onboardingCompleted.value) {
    return;
  }

  ipcRenderer.send("set-ignore-mouse-events", !interactive);
};

const closeApplication = () => {
  ipcRenderer.send("quit-app");
};

onMounted(async () => {
  ipcRenderer.on("onboarding-state-changed", handleOnboardingStateChanged);

  try {
    const state = await ipcRenderer.invoke("get-onboarding-state");
    onboardingCompleted.value = state.completed;
    applyStateData(state.data);
  } catch (error) {
    console.error("Failed to read onboarding state:", error);
    onboardingCompleted.value = false;
  } finally {
    onboardingLoaded.value = true;
  }

  if (!onboardingCompleted.value) {
    ipcRenderer.send("set-ignore-mouse-events", true);
  }
});

watch(questionAnswers, updateAssignedProfile, { deep: true });
watch(selectedTraits, updateAssignedProfile, { deep: true });

onBeforeUnmount(() => {
  ipcRenderer.removeListener("onboarding-state-changed", handleOnboardingStateChanged);
  if (!onboardingCompleted.value) {
    ipcRenderer.send("set-ignore-mouse-events", true);
  }
  stopHueDrag();
});
</script>

<template>
  <Companion v-if="onboardingLoaded && onboardingCompleted" :onboarding-data="onboardingData" />

  <div v-else-if="onboardingLoaded && !onboardingCompleted" class="onboarding-shell" :style="hueVariables">
    <main class="onboarding-window" @mouseenter="setOnboardingPopupInteractive(true)"
      @mouseleave="setOnboardingPopupInteractive(false)">
      <button type="button" class="close-button button-secondary" aria-label="Close application"
        @click="closeApplication">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
          <path
            d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
        </svg>
      </button>
      <p class="eyebrow">My Self Companion</p>

      <div class="progress" aria-label="Onboarding progress">
        <span v-for="dot in totalOnboardingSteps" :key="dot" class="progress-item">
          <span class="progress-dot" :class="{ active: dot === onboardingStep, done: onboardingStep > dot }" />
          <span v-if="dot < totalOnboardingSteps" class="progress-line"
            :class="{ done: onboardingStep > dot, prev: onboardingStep-1 === dot }" />
        </span>
      </div>

      <section v-if="onboardingStep === 1">
        <h1>Welcome to your Self Companion!</h1>
        <p class="description">This onboarding will help you set up your companion's personality and appearance.</p>
      </section>

      <section v-else-if="onboardingStep === 2">
        <h1>Represent yourself</h1>
        <p class="description">Adjust these sliders and choose traits to reflect your personality. This will impact the
          appearance and behavior of your companion.</p>
        <div class="field sliders-field">
          <label for="reservedOpen" class="slider-label">
            <span>Reserved</span>
            <span>Open</span>
          </label>
          <input id="reservedOpen" class="slider" v-model.number="questionAnswers.reservedOpen" type="range" min="0"
            max="1" step="0.1" />
          <label for="calmAssertive" class="slider-label">
            <span>Calm</span>
            <span>Assertive</span>
          </label>
          <input id="calmAssertive" class="slider" v-model.number="questionAnswers.calmAssertive" type="range" min="0"
            max="1" step="0.1" />
          <label for="rationalEmotional" class="slider-label">
            <span>Rational</span>
            <span>Emotional</span>
          </label>
          <input id="rationalEmotional" class="slider" v-model.number="questionAnswers.rationalEmotional" type="range"
            min="0" max="1" step="0.1" />
          <label for="groundedCreative" class="slider-label">
            <span>Grounded</span>
            <span>Creative</span>
          </label>
          <input id="groundedCreative" class="slider" v-model.number="questionAnswers.groundedCreative" type="range"
            min="0" max="1" step="0.1" />
        </div>
        <h1>I am...</h1>
        <div class="field traits-field">
          <button v-for="trait in traitOptions" :key="trait" type="button" class="trait-chip button-secondary"
            :class="{ active: selectedTraits.includes(trait) }" @click="toggleTrait(trait)">
            {{ trait }}
          </button>
        </div>
      </section>

      <section v-else>
        <h1>Confirm your color</h1>
        <p class="description">Based on your answers, this color has been assigned to you. If you feel like it's not
          quite right, drag the wheel to adjust it. Choose a color that represents you!</p>
        <div class="field color-field">
          <div ref="huePickerRef" class="hue-picker" role="slider" tabindex="0" aria-label="Pet color hue"
            aria-valuemin="0" aria-valuemax="359" :aria-valuenow="Math.round(clampHue(onboardingData.hue))"
            @pointerdown="beginHueDrag" @keydown="onHueKeyDown">
            <span class="hue-picker-assigned-dot" :style="assignedHueMarkerStyle" aria-hidden="true" />
            <span class="hue-picker-thumb" :class="{ dragging: hueDragging }" :style="hueThumbStyle" />
            <span class="hue-picker-center">
            </span>
          </div>
          <button v-if="canResetToAssignedHue" type="button" class="button-secondary reset-hue-button"
            :disabled="onboardingSaving" @click="resetHueToAssigned">
            Reset to assigned color
          </button>
        </div>
      </section>

      <div class="actions">
        <button v-if="onboardingStep > 1" type="button" class="button-secondary" :disabled="onboardingSaving"
          @click="goToPreviousStep">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
            <path fill-rule="evenodd"
              d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z"
              clip-rule="evenodd" />
          </svg>
        </button>
        <button v-if="onboardingStep < totalOnboardingSteps" type="button" class="button-primary"
          :disabled="onboardingSaving" @click="goToNextStep">
          <div></div>
          Next
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
            <path fill-rule="evenodd"
              d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
              clip-rule="evenodd" />
          </svg>
        </button>
        <button v-else type="button" class="button-primary" :disabled="onboardingSaving" @click="completeOnboarding">
          <div></div>
          Finish
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
            <path fill-rule="evenodd"
              d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm3.844-8.791a.75.75 0 0 0-1.188-.918l-3.7 4.79-1.649-1.833a.75.75 0 1 0-1.114 1.004l2.25 2.5a.75.75 0 0 0 1.15-.043l4.25-5.5Z"
              clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
::selection {
  background: var(--lighter);
  color: black;
}

.onboarding-shell {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, transparent 50%, var(--shadow));
  pointer-events: none;
  z-index: 20;
}

.onboarding-window {
  position: relative;
  width: 40rem;
  height: 42rem;
  padding: 1.2rem 2rem 1.8rem 2rem;
  border-radius: 2rem;
  background: radial-gradient(circle, white 50%, var(--white));
  color: var(--text-strong);
  box-shadow: 0 0 3rem var(--shadow);
  pointer-events: auto;
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  border: none;
  border-radius: 2rem;
  padding: 0.8rem;
  font-size: 1rem;
  font-weight: 500;
  color: var(--white);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;

}

button svg {
  height: 1.2rem;
}

.button-primary {
  background: var(--darker);
  transform: scale(1);
}

.button-primary:hover {
  background: var(--primary);
  transform: scale(1.05);
}

.button-secondary {
  color: var(--text);
  background: var(--secondary);
}

.button-secondary:hover {
  background: var(--secondary-hover);
}

button:disabled {
  background: var(--disabled);
  cursor: wait;
}

button:focus-visible {
  outline: 3px solid var(--lighter);
  outline-offset: 2px;
}

.close-button {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 2rem;
  height: 2rem;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.eyebrow {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-muted);
}

.progress {
  display: flex;
  align-items: center;
  margin-top: 1rem;
}

.progress-item {
  display: inline-flex;
  align-items: center;

}

.progress-dot {
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 50%;
  background: var(--text-muted);
  z-index: 1;
}

.progress-dot.active {
  background: var(--darker);
  width: 1.2rem;
  height: 1.2rem;
}

.progress-dot.done {
  background: var(--lighter);
}

.progress-line {
  width: 1.5rem;
  height: 0.2rem;
  border-radius: 2rem;
  margin: 0 -0.1rem;
  background: var(--text-muted);
  z-index: 0;
}

.progress-line.done {
  background: var(--lighter);
}

.progress-line.prev {
  background: linear-gradient(to right, var(--lighter), var(--darker));
}

h1 {
  margin: 1rem 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-strong);
}

.description {
  color: var(--text);
  line-height: 1.5;
  font-size: 1rem;
  font-weight: 500;
}

.field {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
  position: absolute;
  bottom: 1.5rem;
  right: 2rem;
}

.traits-field {
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
}

.trait-chip {
  width: auto;
  padding: 0.8rem 2rem;
  transition: transform 0.2s ease, background 0.2s ease;
}

.trait-chip.active {
  padding: 0.8rem 4rem;
  font-weight: 600;
  color: var(--white);
  background: var(--darker);
}

.trait-chip.active:hover {
  background: var(--primary);
}

.sliders-field {
  margin-top: 2rem;
}

.slider {
  appearance: none;
  width: 100%;
  height: 0.5rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  background: var(--secondary);
  outline: none;
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 50%;
  background: var(--darker);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  background: var(--primary);
}

.slider:focus-visible::-webkit-slider-thumb {
  outline: 3px solid var(--lighter);
  outline-offset: 2px;
}

.slider-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-strong);
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
  background: conic-gradient(in oklch longer hue, oklch(80% 0.1 0deg), oklch(80% 0.1 360deg))
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