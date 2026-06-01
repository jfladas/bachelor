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

export const clampPercent = (value, min = 50, max = 150) => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return 100;
    }

    return Math.min(max, Math.max(min, Math.round(n)));
};

export const clampSleepAmount = (value, min = 1, max = 999) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < min) {
        return null;
    }

    return Math.min(max, Math.max(min, Math.round(n)));
};
