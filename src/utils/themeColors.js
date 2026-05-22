import { clampHue } from "./validation";

export const createHueVariables = (hue) => {
    const base = clampHue(hue);

    return {
        "--hue": `${base}deg`,
        "--primary-l": "71%",
        "--primary-c": "0.16",
        "--secondary-l": "90%",
        "--secondary-c": "0.02",
        "--lighter-l": "80%",
        "--lighter-c": "0.1",
        "--darker-l": "63%",
        "--darker-c": "0.14",
        "--text-l": "40%",
        "--text-c": "0.02",
        "--white": "oklch(95% 0.01 var(--hue))",
        "--shadow": "oklch(20% 0.02 var(--hue) / 0.5)",
        "--primary": `oklch(var(--primary-l) var(--primary-c) var(--hue))`,
        "--lighter": "oklch(var(--lighter-l) var(--lighter-c) var(--hue))",
        "--darker": `oklch(var(--darker-l) var(--darker-c) var(--hue))`,
        "--text-strong": "oklch(20% 0.04 var(--hue))",
        "--text": "oklch(var(--text-l) var(--text-c) var(--hue))",
        "--text-muted": "oklch(80% 0.02 var(--hue))",
        "--secondary": `oklch(var(--secondary-l) var(--secondary-c) var(--hue))`,
        "--secondary-hover": `oklch(85% 0.03 var(--hue))`,
        "--disabled": "oklch(50% 0.1 var(--hue) / 0.5)",

        "--excited": 90,
        "--content": 162,
        "--sad": 234,
        "--anxious": 306,
        "--angry": 18,
    };
};
