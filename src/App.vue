<script setup>
import { ref, onMounted, watch } from "vue";
import Blob from "./components/Blob.vue";
import OnboardingWindow from "./components/window/OnboardingWindow.vue";
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
  <Blob v-if="onboardingLoaded && onboardingCompleted" :onboarding-data="onboardingData"
    :selected-traits="selectedTraits" :question-answers="questionAnswers" />

  <OnboardingWindow v-if="onboardingLoaded && !onboardingCompleted" :onboarding-loaded="onboardingLoaded"
    :onboarding-completed="onboardingCompleted" :onboarding-saving="onboardingSaving" :onboarding-step="onboardingStep"
    :total-onboarding-steps="totalOnboardingSteps" :slider-options="sliderOptions" :trait-options="traitOptions"
    :selected-traits="selectedTraits" :question-answers="questionAnswers" :onboarding-data="onboardingData"
    :hue-variables="hueVariables" :on-manual-hue-change="onManualHueChange"
    :on-reset-hue-to-assigned="onResetHueToAssigned" :toggle-trait="toggleTrait"
    :update-question-answer="updateQuestionAnswer" :go-to-next-step="goToNextStep"
    :go-to-previous-step="goToPreviousStep" :complete-onboarding="completeOnboarding"
    :set-onboarding-popup-interactive="setOnboardingPopupInteractive" :close-application="closeApplication" />
</template>

<style scoped>
::selection {
  background: var(--lighter);
  color: black;
}
</style>