import { clampHue } from "./validation";

export const createHueVariables = (hue) => ({
    "--hue": `${clampHue(hue)}deg`,
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
    "--disabled": "oklch(50% 0.1 var(--hue) / 0.5)",
});
