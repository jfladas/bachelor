import { traitOptions } from "../constants/onboardingOptions";
import { clampHue, clampUnit, normalizeTraits } from "./validation";

const addInterpolatedHue = (hueContributions, startHue, endHue, factor, weight = 1) => {
    const start = clampHue(startHue, 220);
    const end = clampHue(endHue, 220);
    const t = clampUnit(factor, 0.5, 2);
    const centerDistance = Math.abs(t - 0.5) * 2;
    const effectiveWeight = weight * centerDistance;

    if (effectiveWeight <= 0) {
        return;
    }

    const shortestDelta = ((end - start + 540) % 360) - 180;
    hueContributions.push({
        hue: clampHue(start + shortestDelta * t, 220),
        weight: Math.max(0, Number(effectiveWeight) || 0),
    });
};

const createHueVector = (entries) => {
    return entries.reduce(
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
};

export const calculateAssignedProfile = ({ sliders, traits, hue }) => {
    let calculatedHue = hue;

    const normalizedSliders = {
        reservedOpen: clampUnit(sliders?.reservedOpen, 0.5, 2),
        calmAssertive: clampUnit(sliders?.calmAssertive, 0.5, 2),
        rationalEmotional: clampUnit(sliders?.rationalEmotional, 0.5, 2),
    };

    const normalizedTraits = normalizeTraits(traits, traitOptions, traitOptions.length);
    const hueContributions = [];
    const addHueContribution = (candidateHue, weight = 1) => {
        hueContributions.push({
            hue: clampHue(candidateHue, 220),
            weight: Math.max(0, Number(weight) || 0),
        });
    };

    addInterpolatedHue(hueContributions, 200, 20, normalizedSliders.calmAssertive, 1);
    addInterpolatedHue(hueContributions, 275, 50, normalizedSliders.reservedOpen, 1);
    addInterpolatedHue(hueContributions, 250, 50, normalizedSliders.rationalEmotional, 1);

    const traitHueMap = {
        active: () => {
            addHueContribution(125, 0.4);
            addHueContribution(50, 0.4);
        },
        optimistic: () => addHueContribution(100, 0.8),
        gentle: () => addHueContribution(200, 0.8),
        chill: () => addHueContribution(225, 0.8),
        mysterious: () => addHueContribution(300, 0.8),
        cute: () => addHueContribution(325, 0.8),
        grounded: () => addHueContribution(150, 0.8),
        creative: () => addHueContribution(325, 0.8),
    };

    const traitOppositeHueMap = {
        active: () => addHueContribution(275, 0.2),
        optimistic: () => addHueContribution(225, 0.2),
        gentle: () => addHueContribution(350, 0.2),
        chill: () => addHueContribution(50, 0.2),
        mysterious: () => addHueContribution(125, 0.2),
        cute: () => addHueContribution(175, 0.2),
    };

    traitOptions.forEach((trait) => {
        if (normalizedTraits.includes(trait)) {
            traitHueMap[trait]?.();
            return;
        }

        traitOppositeHueMap[trait]?.();
    });

    const vector = createHueVector(hueContributions);
    if (vector.weight > 0 && (Math.abs(vector.x) > Number.EPSILON || Math.abs(vector.y) > Number.EPSILON)) {
        calculatedHue = clampHue((Math.atan2(vector.y, vector.x) * 180) / Math.PI, hue);
    }

    const calculatedSymmetry =
        0.25 +
        (normalizedTraits.includes("grounded") ? 0.5 : 0) -
        (normalizedTraits.includes("creative") ? 0.5 : 0) +
        (normalizedTraits.includes("chill") ? 0.25 : 0);

    const calculatedExpressiveness =
        normalizedSliders.reservedOpen * 0.25 +
        normalizedSliders.rationalEmotional * 0.25 +
        0.25 +
        (normalizedTraits.includes("cute") ? 0.25 : 0) -
        (normalizedTraits.includes("mysterious") ? 0.25 : 0);

    const calculatedActivity =
        normalizedSliders.calmAssertive * 0.25 +
        (normalizedTraits.includes("gentle") ? 0 : 0.25) +
        (normalizedTraits.includes("active") ? 0.5 : 0);

    return {
        assignedHue: calculatedHue,
        symmetry: calculatedSymmetry,
        expressiveness: calculatedExpressiveness,
        activity: calculatedActivity,
    };
};
