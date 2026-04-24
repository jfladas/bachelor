<script setup>
import Blob from "./components/Blob.vue";
import Button from "./components/Button.vue";
import StepColor from "./components/onboarding/StepColor.vue";
import StepIntro from "./components/onboarding/StepIntro.vue";
import StepPersonality from "./components/onboarding/StepPersonality.vue";
import { useOnboarding } from "./composables/useOnboarding";

const {
  onboardingLoaded,
  onboardingCompleted,
  onboardingSaving,
  onboardingStep,
  totalOnboardingSteps,
  sliderOptions,
  traitOptions,
  selectedTraits,
  questionAnswers,
  onboardingData,
  hueVariables,
  onManualHueChange,
  onResetHueToAssigned,
  toggleTrait,
  updateQuestionAnswer,
  goToNextStep,
  goToPreviousStep,
  completeOnboarding,
  setOnboardingPopupInteractive,
  closeApplication,
} = useOnboarding();
</script>

<template>
  <Blob v-if="onboardingLoaded && onboardingCompleted" :onboarding-data="onboardingData" />

  <div v-else-if="onboardingLoaded && !onboardingCompleted" class="onboarding-shell" :style="hueVariables">
    <main class="window" @mouseenter="setOnboardingPopupInteractive(true)"
      @mouseleave="setOnboardingPopupInteractive(false)">
      <Button variant="secondary close-button circle-small" aria-label="Close application" @click="closeApplication">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
          <path
            d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
        </svg>
      </Button>
      <p class="eyebrow">Bachelor</p>

      <div class="progress" aria-label="Onboarding progress">
        <span v-for="dot in totalOnboardingSteps" :key="dot" class="progress-item">
          <span class="progress-dot" :class="{ active: dot === onboardingStep, done: onboardingStep > dot }" />
          <span v-if="dot < totalOnboardingSteps" class="progress-line"
            :class="{ done: onboardingStep > dot, prev: onboardingStep-1 === dot, next: onboardingStep === dot }" />
        </span>
      </div>

      <StepIntro v-if="onboardingStep === 1" />

      <StepPersonality v-else-if="onboardingStep === 2" :question-answers="questionAnswers"
        :slider-options="sliderOptions" :selected-traits="selectedTraits" :trait-options="traitOptions"
        @update-answer="updateQuestionAnswer" @toggle-trait="toggleTrait" />

      <StepColor v-else :hue="onboardingData.hue" :assigned-hue="onboardingData.assignedHue"
        :disabled="onboardingSaving" @manual-hue-change="onManualHueChange" @reset-hue="onResetHueToAssigned" />

      <div class="actions">
        <Button v-if="onboardingStep > 1" variant="secondary circle-big" :disabled="onboardingSaving"
          @click="goToPreviousStep">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
            <path fill-rule="evenodd"
              d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z"
              clip-rule="evenodd" />
          </svg>
        </Button>
        <Button v-if="onboardingStep < totalOnboardingSteps" variant="primary" :disabled="onboardingSaving"
          @click="goToNextStep">
          <div></div>
          {{ onboardingStep === 1 ? "Begin" : "Next" }}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
            <path fill-rule="evenodd"
              d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
              clip-rule="evenodd" />
          </svg>
        </Button>
        <Button v-else variant="primary" :disabled="onboardingSaving" @click="completeOnboarding">
          Finish
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
            <path fill-rule="evenodd"
              d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm3.844-8.791a.75.75 0 0 0-1.188-.918l-3.7 4.79-1.649-1.833a.75.75 0 1 0-1.114 1.004l2.25 2.5a.75.75 0 0 0 1.15-.043l4.25-5.5Z"
              clip-rule="evenodd" />
          </svg>
        </Button>
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

.window {
  position: relative;
  width: 40rem;
  height: 40rem;
  pointer-events: auto;
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

.progress-line.next {
  background: linear-gradient(to right, transparent, var(--text-muted));
}
</style>