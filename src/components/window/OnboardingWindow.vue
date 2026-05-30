<script setup>
import Button from "../ui/Button.vue";
import StepColor from "../onboarding/StepColor.vue";
import StepIntro from "../onboarding/StepIntro.vue";
import StepPersonality from "../onboarding/StepPersonality.vue";

const props = defineProps({
  onboardingLoaded: { type: Boolean, required: true },
  onboardingCompleted: { type: Boolean, required: true },
  onboardingSaving: { type: Boolean, required: true },
  onboardingStep: { type: Number, required: true },
  totalOnboardingSteps: { type: Number, required: true },
  sliderOptions: { type: Array, required: true },
  traitOptions: { type: Array, required: true },
  selectedTraits: { type: Array, required: true },
  questionAnswers: { type: Object, required: true },
  onboardingData: { type: Object, required: true },
  hueVariables: { type: Object, required: true },
  onManualHueChange: { type: Function, required: true },
  onResetHueToAssigned: { type: Function, required: true },
  toggleTrait: { type: Function, required: true },
  updateQuestionAnswer: { type: Function, required: true },
  goToNextStep: { type: Function, required: true },
  goToPreviousStep: { type: Function, required: true },
  completeOnboarding: { type: Function, required: true },
  setOnboardingPopupInteractive: { type: Function, required: true },
  closeApplication: { type: Function, required: true },
});
</script>

<template>
  <Transition name="overlay-fade" appear>
    <div v-if="props.onboardingLoaded && !props.onboardingCompleted" class="onboarding-shell"
      :style="props.hueVariables" @mouseenter="props.setOnboardingPopupInteractive(true)"
      @mouseleave="props.setOnboardingPopupInteractive(false)">
      <main class="window">
        <Button variant="secondary close-button circle-small" aria-label="Close application"
          @click="props.closeApplication">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
            <path
              d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 0 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
          </svg>
        </Button>
        <p class="eyebrow">Onboarding</p>

        <div class="progress" aria-label="Onboarding progress">
          <span v-for="dot in props.totalOnboardingSteps" :key="dot" class="progress-item">
            <span class="progress-dot"
              :class="{ active: dot === props.onboardingStep, done: props.onboardingStep > dot }" />
            <span v-if="dot < props.totalOnboardingSteps" class="progress-line"
              :class="{ done: props.onboardingStep > dot, prev: props.onboardingStep-1 === dot, next: props.onboardingStep === dot }" />
          </span>
        </div>

        <StepIntro v-if="props.onboardingStep === 1" />

        <StepPersonality v-else-if="props.onboardingStep === 2" :question-answers="props.questionAnswers"
          :slider-options="props.sliderOptions" :selected-traits="props.selectedTraits"
          :trait-options="props.traitOptions" @update-answer="props.updateQuestionAnswer"
          @toggle-trait="props.toggleTrait" />

        <StepColor v-else :hue="props.onboardingData.hue" :assigned-hue="props.onboardingData.assignedHue"
          :disabled="props.onboardingSaving" @manual-hue-change="props.onManualHueChange"
          @reset-hue="props.onResetHueToAssigned" />

        <div class="actions">
          <Button v-if="props.onboardingStep > 1" variant="secondary circle-big" :disabled="props.onboardingSaving"
            @click="props.goToPreviousStep">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
              <path fill-rule="evenodd"
                d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z"
                clip-rule="evenodd" />
            </svg>
          </Button>
          <Button v-if="props.onboardingStep < props.totalOnboardingSteps" variant="primary"
            :disabled="props.onboardingSaving" @click="props.goToNextStep">
            <div></div>
            {{ props.onboardingStep === 1 ? "Begin" : "Next" }}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
              <path fill-rule="evenodd"
                d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
                clip-rule="evenodd" />
            </svg>
          </Button>
          <Button v-else variant="primary" :disabled="props.onboardingSaving" @click="props.completeOnboarding">
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
  </Transition>
</template>

<style scoped>
.onboarding-shell {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, transparent 50%, var(--shadow));
  pointer-events: auto;
  z-index: 20;
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
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
