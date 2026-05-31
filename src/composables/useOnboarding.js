import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { reactionOptions, sliderOptions, traitOptions } from "../constants/onboardingOptions";
import { calculateAssignedProfile } from "../utils/colorProfile";
import { createHueVariables } from "../utils/themeColors";
import { clampHue, clampUnit, normalizeReaction, normalizeTraits } from "../utils/validation";
import * as ipc from "../utils/ipc";

const TOTAL_ONBOARDING_STEPS = 3;
const DEFAULT_SLIDER_VALUE = 0.5;

const defaultQuestionAnswers = sliderOptions.reduce((answers, sliderOption) => {
    answers[sliderOption.key] = clampUnit(DEFAULT_SLIDER_VALUE, DEFAULT_SLIDER_VALUE, 2);
    return answers;
}, {});

const createDefaultQuestionAnswers = () => ({ ...defaultQuestionAnswers });

const normalizeQuestionAnswers = (answers = {}) => {
    return sliderOptions.reduce((normalizedAnswers, sliderOption) => {
        normalizedAnswers[sliderOption.key] = clampUnit(
            answers?.[sliderOption.key],
            defaultQuestionAnswers[sliderOption.key],
            2
        );
        return normalizedAnswers;
    }, {});
};

const createDefaultOnboardingData = () => ({
    hue: 220,
    assignedHue: 220,
    symmetry: 0.5,
    variability: 0.5,
    activity: 0.5,
    reaction: "sparkles",
});

const normalizeSelectedTraits = (traits) => normalizeTraits(traits, traitOptions, traitOptions.length);

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

        selectedTraits.value = [...selectedTraits.value, trait].slice(0, traitOptions.length);
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
        questionAnswers.value = normalizeQuestionAnswers(data.questionAnswers);

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
        questionAnswers: sliderOptions.reduce((answers, sliderOption) => {
            answers[sliderOption.key] = questionAnswers.value[sliderOption.key];
            return answers;
        }, {}),
        hueOverride: hueOverride.value,
    });

    const handleOnboardingStateChanged = (eventOrState, maybeState) => {
        const state = maybeState ?? eventOrState ?? {};
        const completed = Boolean(state.completed);

        onboardingCompleted.value = completed;
        applyStateData(state.data);
        try { ipc.send('set-ignore-mouse-events', !completed); } catch { }
        if (!completed) {
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
            const savedState = await ipc.invoke("save-onboarding-state", payload);
            applyStateData(savedState.data);
            onboardingCompleted.value = true;
            try { ipc.send('set-ignore-mouse-events', true); } catch { }
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

        try { ipc.send('set-ignore-mouse-events', !interactive); } catch { }
    };

    const closeApplication = () => {
        try { ipc.send('quit-app'); } catch { }
    };

    let removeOnboardingListener = null;
    onMounted(async () => {
        (async () => {
            const _ipc = await ipc.ipc();
            _ipc?.on?.("onboarding-state-changed", handleOnboardingStateChanged);
            removeOnboardingListener = () => _ipc?.removeListener?.("onboarding-state-changed", handleOnboardingStateChanged);
        })();

        try {
            const state = await ipc.invoke("get-onboarding-state");
            onboardingCompleted.value = state.completed;
            applyStateData(state.data);
        } catch (error) {
            console.error("Failed to read onboarding state:", error);
            onboardingCompleted.value = false;
        } finally {
            onboardingLoaded.value = true;
        }

        try { ipc.send('set-ignore-mouse-events', true); } catch { }
    });

    watch(questionAnswers, updateAssignedProfile, { deep: true });
    watch(selectedTraits, updateAssignedProfile, { deep: true });

    onBeforeUnmount(() => {
        if (typeof removeOnboardingListener === 'function') {
            try { removeOnboardingListener(); } catch { }
        }
        try { ipc.send('set-ignore-mouse-events', true); } catch { }
    });

    return {
        onboardingLoaded,
        onboardingCompleted,
        onboardingSaving,
        onboardingStep,
        totalOnboardingSteps: TOTAL_ONBOARDING_STEPS,
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
    };
};
