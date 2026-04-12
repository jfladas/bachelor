import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { reactionOptions, traitOptions } from "../constants/onboardingOptions";
import { calculateAssignedProfile } from "../utils/colorProfile";
import { createHueVariables } from "../utils/themeColors";
import { clampHue, clampUnit, normalizeReaction, normalizeTraits } from "../utils/validation";

const { ipcRenderer } = require("electron");

const TOTAL_ONBOARDING_STEPS = 3;

const createDefaultQuestionAnswers = () => ({
    reservedOpen: 0.5,
    calmAssertive: 0.5,
    rationalEmotional: 0.5,
    groundedCreative: 0.5,
});

const createDefaultOnboardingData = () => ({
    hue: 220,
    assignedHue: 220,
    symmetry: 0.5,
    variability: 0.5,
    activity: 0.5,
    reaction: "sparkles",
});

const normalizeSelectedTraits = (traits) => normalizeTraits(traits, traitOptions, 6);

const normalizeSelectedReaction = (reaction, fallback = "sparkles", allowNumeric = true) => {
    return normalizeReaction(reaction, reactionOptions, fallback, allowNumeric);
};

const normalizeOnboardingData = (data = {}) => ({
    hue: clampHue(data.hue, 220),
    assignedHue: clampHue(data.assignedHue ?? data.hue, 220),
    symmetry: clampUnit(data.symmetry, 0.5, 2),
    variability: clampUnit(data.variability, 0.5, 2),
    activity: clampUnit(data.activity, 0.5, 2),
    reaction: normalizeSelectedReaction(data.reaction, "sparkles"),
});

export const useOnboarding = () => {
    const onboardingLoaded = ref(false);
    const onboardingCompleted = ref(false);
    const onboardingSaving = ref(false);
    const onboardingStep = ref(1);
    const selectedTraits = ref([]);
    const questionAnswers = ref(createDefaultQuestionAnswers());
    const hueOverride = ref(false);
    const onboardingData = ref(createDefaultOnboardingData());

    const hueVariables = computed(() => createHueVariables(onboardingData.value.hue));

    const updateAssignedProfile = () => {
        const calculated = calculateAssignedProfile({
            sliders: questionAnswers.value,
            traits: selectedTraits.value,
            hue: onboardingData.value.hue,
        });

        onboardingData.value.assignedHue = clampHue(calculated.assignedHue, onboardingData.value.hue);
        onboardingData.value.symmetry = clampUnit(calculated.symmetry, onboardingData.value.symmetry, 2);
        onboardingData.value.variability = clampUnit(calculated.variability, onboardingData.value.variability, 2);
        onboardingData.value.activity = clampUnit(calculated.activity, onboardingData.value.activity, 2);
        onboardingData.value.reaction = normalizeSelectedReaction(
            calculated.reaction,
            onboardingData.value.reaction,
            false
        );

        if (!hueOverride.value) {
            onboardingData.value.hue = onboardingData.value.assignedHue;
        }
    };

    const onManualHueChange = (nextHue) => {
        hueOverride.value = true;
        onboardingData.value.hue = clampHue(nextHue, onboardingData.value.hue);
    };

    const onResetHueToAssigned = () => {
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

    const updateQuestionAnswer = ({ key, value }) => {
        if (!Object.prototype.hasOwnProperty.call(questionAnswers.value, key)) {
            return;
        }

        questionAnswers.value = {
            ...questionAnswers.value,
            [key]: clampUnit(value, questionAnswers.value[key], 2),
        };
    };

    const applyStateData = (data = {}) => {
        onboardingData.value = normalizeOnboardingData(data);
        selectedTraits.value = normalizeSelectedTraits(data.traits ?? data.selectedTraits);
        questionAnswers.value = {
            reservedOpen: clampUnit(data.questionAnswers?.reservedOpen, 0.5, 2),
            calmAssertive: clampUnit(data.questionAnswers?.calmAssertive, 0.5, 2),
            rationalEmotional: clampUnit(data.questionAnswers?.rationalEmotional, 0.5, 2),
            groundedCreative: clampUnit(data.questionAnswers?.groundedCreative, 0.5, 2),
        };

        hueOverride.value = Boolean(data.hueOverride ?? (onboardingData.value.hue !== onboardingData.value.assignedHue));
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
        if (onboardingStep.value < TOTAL_ONBOARDING_STEPS) {
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
    });

    return {
        onboardingLoaded,
        onboardingCompleted,
        onboardingSaving,
        onboardingStep,
        totalOnboardingSteps: TOTAL_ONBOARDING_STEPS,
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
    };
};
