export const clampHue = (value, fallback = 220) => {
    const numericHue = Number(value);
    if (!Number.isFinite(numericHue)) {
        return fallback;
    }

    return ((Math.round(numericHue) % 360) + 360) % 360;
};

export const clampUnit = (value, fallback = 0.5, decimals = null) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return fallback;
    }

    const clamped = Math.min(1, Math.max(0, numericValue));
    if (Number.isInteger(decimals) && decimals >= 0) {
        return Number(clamped.toFixed(decimals));
    }

    return clamped;
};

export const normalizeTraits = (traits, allowedTraits = [], maxCount = 6) => {
    if (!Array.isArray(traits)) {
        return [];
    }

    const uniqueTraits = [
        ...new Set(traits.filter((trait) => typeof trait === "string" && allowedTraits.includes(trait))),
    ];

    return uniqueTraits.length > 0 ? uniqueTraits.slice(0, maxCount) : [];
};

export const normalizeReaction = (
    reaction,
    allowedReactions = [],
    fallback = allowedReactions[0] ?? "sparkles",
    allowNumeric = true
) => {
    if (typeof reaction === "string" && allowedReactions.includes(reaction)) {
        return reaction;
    }

    if (allowNumeric && typeof reaction === "number" && Number.isFinite(reaction) && allowedReactions.length > 0) {
        const index = Math.min(
            allowedReactions.length - 1,
            Math.max(0, Math.round(reaction * (allowedReactions.length - 1)))
        );
        return allowedReactions[index];
    }

    return fallback;
};
