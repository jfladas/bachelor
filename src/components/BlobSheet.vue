<script setup>
import { computed } from "vue";
import { traitOptions } from "../constants/onboardingOptions";
import { journalEmotions } from "../constants/microJournalOptions";
import fadeoutPng from "../assets/fadeout.png";

const dev = true;

const props = defineProps({
    onboardingData: {
        type: Object,
        required: true,
    },
    selectedTraits: {
        type: Array,
        default: () => [],
    },
    questionAnswers: {
        type: Object,
        default: () => ({
            reservedOpen: 0.5,
            calmAssertive: 0.5,
            rationalEmotional: 0.5,
        }),
    },
    entries: {
        type: Array,
        default: () => [],
    },
    blobSize: {
        type: Number,
        default: 100,
    },
});

const assignedHue = computed(() => Number(props.onboardingData?.assignedHue ?? props.onboardingData?.hue ?? 220));

const baseHue = computed(() => Number(props.onboardingData?.hue ?? assignedHue.value ?? 220));

const mostCommonEmotion = computed(() => {
    const counts = {};
    for (const e of Array.isArray(props.entries) ? props.entries : []) {
        if (!e || !e.emotion) continue;
        counts[e.emotion] = (counts[e.emotion] || 0) + 1;
    }
    const entries = Object.entries(counts);
    if (entries.length === 0) return baseHue.value;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
});

const mostCommonEmotionId = computed(() => {
    const emotionValue = mostCommonEmotion.value;
    return typeof emotionValue === "string" ? emotionValue : null;
});

const mostCommonEmotionTag = computed(() => emotionTag(mostCommonEmotionId.value));

const mostCommonEmotionVar = computed(() => {
    if (!mostCommonEmotionId.value) return `hsl(${baseHue.value} 92% 58%)`;
    return `hsl(from var(--${mostCommonEmotionId.value}) h s l)`;
});

const chosenHueColor = computed(() => `hsl(${baseHue.value} 92% 58%)`);

const reportSignals = computed(() => {
    const fallbackActivity = Number(props.questionAnswers?.calmAssertive) || 0;
    const fallbackSymmetry = 1 - (
        Math.abs((Number(props.questionAnswers?.calmAssertive) || 0) - 0.5) +
        Math.abs((Number(props.questionAnswers?.reservedOpen) || 0) - 0.5) +
        Math.abs((Number(props.questionAnswers?.rationalEmotional) || 0) - 0.5)
    ) / 1.5;
    const fallbackExpressiveness = (
        (Number(props.questionAnswers?.reservedOpen) || 0) +
        (Number(props.questionAnswers?.rationalEmotional) || 0)
    ) / 2;

    const activity = Number(props.onboardingData?.activity ?? fallbackActivity) || 0;
    const symmetry = Number(props.onboardingData?.symmetry ?? fallbackSymmetry) || 0;
    const expressiveness = Number(props.onboardingData?.expressiveness ?? fallbackExpressiveness) || 0;

    return [
        { id: "activity", label: "Activity", value: activity },
        { id: "symmetry", label: "Symmetry", value: symmetry },
        { id: "expressiveness", label: "Expressiveness", value: expressiveness },
    ];
});

const allEntries = computed(() => {
    return [...(Array.isArray(props.entries) ? props.entries : [])]
        .filter((entry) => entry && (entry.text || entry.emotion || entry.prompt))
        .map((entry) => ({
            id: entry.id,
            createdAt: new Date(entry.createdAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
            }),
            emotion: entry.emotion || "default",
            prompt: entry.prompt || "",
            text: (entry.text || "").trim(),
            isSecret: Boolean(entry.isSecret),
        }));
});

const leftEntries = computed(() => allEntries.value.filter((_, index) => index % 2 === 0));

const rightEntries = computed(() => allEntries.value.filter((_, index) => index % 2 === 1));

const emotionTag = (emotionId) => {
    if (!emotionId) return null;
    return journalEmotions.find((emotion) => emotion.id === emotionId) || null;
};

const emotionLabel = (emotionId) => {
    if (!emotionId) return "";
    const emotion = journalEmotions.find((item) => item.id === emotionId);
    return emotion ? emotion.label : "";
};

const formatDate = (isoString) => {
    const date = new Date(isoString);

    if (Number.isNaN(date.getTime())) {
        return "Unknown date";
    }

    const currentYear = new Date().getFullYear();
    const dateParts = {
        month: "short",
        day: "numeric",
    };

    if (date.getFullYear() !== currentYear) {
        dateParts.year = "numeric";
    }

    const formattedDate = date.toLocaleDateString("en-US", dateParts);
    const formattedTime = date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });

    return `${formattedDate}, ${formattedTime}`;
};

const traitHueLookup = {
    active: 125,
    optimistic: 100,
    gentle: 199,
    chill: 225,
    mysterious: 300,
    cute: 335,
    grounded: 150,
    creative: 325,
};

const hueLineSpecs = [
    { a: 201, b: 21, valueKey: "calmAssertive", labela: "calm", labelb: "assertive" },
    { a: 275, b: 53, valueKey: "reservedOpen", labela: "reserved", labelb: "open" },
    { a: 248, b: 49, valueKey: "rationalEmotional", labela: "rational", labelb: "emotional" },
];

const degToPoint = (deg, r = 56) => {
    const rad = (deg - 90) * (Math.PI / 180);
    return {
        x: 50 + Math.cos(rad) * r,
        y: 50 + Math.sin(rad) * r,
    };
};

const hueLines = computed(() => {
    const rLine = 47;
    const rLabel = 49;
    return hueLineSpecs.map(({ a, b, valueKey, labela, labelb }) => {
        const p1 = degToPoint(a, rLine);
        const p2 = degToPoint(b, rLine);
        const l1 = degToPoint(a, rLabel);
        const l2 = degToPoint(b, rLabel);
        const value = Math.min(0.95, Math.max(0.05, Number(props.questionAnswers?.[valueKey]) || 0));
        return {
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            lax: l1.x,
            lay: l1.y,
            lbx: l2.x,
            lby: l2.y,
            dotx: p1.x + (p2.x - p1.x) * value,
            doty: p1.y + (p2.y - p1.y) * value,
            labela,
            labelb,
        };
    });
});

const traitLabels = computed(() => {
    const rTraitLabel = 40;
    const selectedTraitSet = new Set(Array.isArray(props.selectedTraits) ? props.selectedTraits : []);

    return traitOptions
        .filter((trait) => selectedTraitSet.has(trait))
        .filter((trait) => Object.prototype.hasOwnProperty.call(traitHueLookup, trait))
        .map((trait) => {
            const angle = traitHueLookup[trait];
            const point = degToPoint(angle, rTraitLabel);
            return {
                trait,
                x: point.x,
                y: point.y,
                anchor: point.x < 50 ? "start" : "end",
                fill: `oklch(63% 0.14 ${angle})`,
            };
        });
});

const hueMarkers = computed(() => {
    const rHueMarker = 42.5;
    const markers = [
        { hue: baseHue.value, kind: "chosen" },
    ];

    const assignedHueValue = assignedHue.value;
    const hueDelta = Math.abs(((assignedHueValue - baseHue.value + 540) % 360) - 180);

    if (hueDelta > 0.5) {
        markers.push({ hue: assignedHueValue, kind: "assigned" });
    }

    return markers.map((marker) => {
        const point = degToPoint(marker.hue, rHueMarker);
        return {
            ...marker,
            x: point.x - 0.5,
            y: point.y - 0.5,
        };
    });
});
</script>

<template>
    <section class="blob-sheet" :class="{ dev }" aria-hidden="true">
        <p class="eyebrow">Amorphous Blob</p>
        <h1 class="title">Personal Report</h1>

        <div class="qr">
            <img src="../assets/qr.png" alt="QR Code" />
            <p>blob.jfladas.com</p>
        </div>

        <section class="diagram-wrap" aria-label="Blob profile diagram">
            <div class="color-ring"></div>
            <div class="ring-center"></div>

            <svg class="diagram" viewBox="0 0 100 100" role="img" aria-label="Personality radar diagram">
                <defs>
                    <radialGradient id="blobFill" cx="50%" cy="50%" r="50%">
                        <stop offset="50%" :stop-color="`oklch(71% 0.16 ${baseHue})`" />
                        <stop offset="100%" :stop-color="`oklch(71% 0.16 var(--${mostCommonEmotion}))`" />
                    </radialGradient>
                </defs>
            </svg>

            <svg class="diagram-overlay" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                <g pointer-events="none">
                    <g v-for="trait in traitLabels" :key="trait.trait">
                        <text :x="trait.x" :y="trait.y" class="trait-label" :text-anchor="trait.anchor"
                            :style="{ fill: trait.fill }">{{ trait.trait }}</text>
                    </g>
                    <g v-for="(l, i) in hueLines" :key="i">
                        <line :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" class="hue-line" />
                        <circle :cx="l.dotx" :cy="l.doty" r="1" class="hue-dot" />
                        <text :x="l.lax" :y="l.lay" class="hue-label left">{{ l.labela }}</text>
                        <text :x="l.lbx" :y="l.lby" class="hue-label">{{ l.labelb }}</text>
                    </g>
                    <g v-for="marker in hueMarkers" :key="marker.kind">
                        <circle :cx="marker.x" :cy="marker.y" :class="['hue-marker', marker.kind]"
                            :style="marker.kind === 'assigned' ? { stroke: `oklch(71% 0.16 ${marker.hue})` } : null"
                            r="1" />
                    </g>
                </g>
            </svg>

        </section>

        <section class="report-signals" aria-label="Report signals">
            <div class="emotion-core" aria-hidden="true">
                <div class="emotion-core-inner">
                    <span v-if="mostCommonEmotionTag?.svg" class="emotion-core-icon"
                        v-html="mostCommonEmotionTag.svg"></span>
                    <span v-else class="emotion-core-icon">
                        <svg width="100%" height="100%" viewBox="0 0 362 307" version="1.1"
                            xmlns="http://www.w3.org/2000/svg">
                            <g transform="matrix(1,0,0,1,-5389.03377,-109.805792)">
                                <g transform="matrix(1,0,0,1,3198.953269,0)">
                                    <g transform="matrix(1,0,0,1,1087.3439,-550.35639)">
                                        <g transform="matrix(2.525763,0,0,2.525763,1093.544539,840.524624)">
                                            <path
                                                d="M30.455,19.835C38.729,9.477 56.699,22.843 78.193,24.078C101.761,25.432 109.878,13.389 118.001,19.887C126.401,26.608 118.568,36.889 97.809,46.276C85.278,51.942 66.582,50.943 54.234,44.889C47.704,41.687 22.448,29.859 30.455,19.835Z" />
                                        </g>
                                        <g transform="matrix(2.525763,0,0,2.525763,1097.834582,400.651036)">
                                            <path
                                                d="M43.133,160.654C32.557,163.478 12.72,161.597 5.664,147.767C-11.416,114.288 34.673,89.48 54.807,110.506C71.475,127.913 60.548,156.005 43.133,160.654Z" />
                                        </g>
                                        <g transform="matrix(-2.525763,0,0,2.525763,1468.683698,400.651036)">
                                            <path
                                                d="M43.133,160.654C32.557,163.478 12.72,161.597 5.664,147.767C-11.416,114.288 34.673,89.48 54.807,110.506C71.475,127.913 60.548,156.005 43.133,160.654Z" />
                                        </g>
                                    </g>
                                </g>
                            </g>
                        </svg>
                    </span>
                </div>
            </div>

            <div class="signal-bars">
                <div v-for="signal in reportSignals" :key="signal.id" class="signal-row">
                    <span class="signal-label">{{ signal.label }}</span>
                    <span class="signal-track"
                        :style="{ '--signal-fill': `${(signal.value * 100).toFixed(0)}%` }"></span>
                </div>
            </div>
        </section>

        <section class="entries-wrap" aria-label="Journal entries">
            <template v-if="allEntries.length > 0">
                <div class="entry-lane">
                    <div v-for="entry in leftEntries" :key="entry.id" class="entry-item">
                        <div class="entry-content" :class="{ blurred: entry.isSecret }">
                            <div class="entry-header">
                                <span class="emotion-badge"
                                    :style="{ '--emotion-hue': entry.emotion ? `var(--${entry.emotion})` : 'var(--hue)' }">
                                    <span v-if="emotionTag(entry.emotion)?.svg" class="emotion-icon"
                                        v-html="emotionTag(entry.emotion).svg"></span>
                                    <span v-else class="emotion-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                                            class="size-4">
                                            <path d="M3.75 7.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z" />
                                        </svg>
                                    </span>
                                    <span v-if="emotionLabel(entry.emotion)">{{ emotionLabel(entry.emotion) }}</span>
                                </span>
                                <span class="entry-date">
                                    {{ formatDate(entry.createdAt) }}
                                    <svg v-if="entry.isSecret" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"
                                        fill="currentColor" class="size-4 lock-icon">
                                        <path fill-rule="evenodd"
                                            d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z"
                                            clip-rule="evenodd" />
                                    </svg>
                                </span>
                            </div>

                            <p v-if="entry.text" class="entry-text">{{ entry.text }}</p>

                            <p v-if="entry.prompt && entry.text" class="entry-prompt">{{ entry.prompt }}</p>
                        </div>
                    </div>
                </div>

                <div class="entry-lane">
                    <div v-for="entry in rightEntries" :key="entry.id" class="entry-item">
                        <div class="entry-content" :class="{ blurred: entry.isSecret }">
                            <div class="entry-header">
                                <span class="emotion-badge"
                                    :style="{ '--emotion-hue': entry.emotion ? `var(--${entry.emotion})` : 'var(--hue)' }">
                                    <span v-if="emotionTag(entry.emotion)?.svg" class="emotion-icon"
                                        v-html="emotionTag(entry.emotion).svg"></span>
                                    <span v-else class="emotion-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                                            class="size-4">
                                            <path d="M3.75 7.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z" />
                                        </svg>
                                    </span>
                                    <span v-if="emotionLabel(entry.emotion)">{{ emotionLabel(entry.emotion) }}</span>
                                </span>
                                <span class="entry-date">
                                    {{ formatDate(entry.createdAt) }}
                                    <svg v-if="entry.isSecret" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"
                                        fill="currentColor" class="size-4 lock-icon">
                                        <path fill-rule="evenodd"
                                            d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z"
                                            clip-rule="evenodd" />
                                    </svg>
                                </span>
                            </div>

                            <p v-if="entry.text" class="entry-text">{{ entry.text }}</p>

                            <p v-if="entry.prompt && entry.text" class="entry-prompt">{{ entry.prompt }}</p>
                        </div>
                    </div>
                </div>
            </template>
            <img class="entries-fade" :src="fadeoutPng" alt="" aria-hidden="true" />
            <div class="entries-fade-white"></div>
        </section>
    </section>
</template>

<style scoped>
.blob-sheet {
    box-sizing: border-box;
    position: relative;
    width: 100%;
    min-height: 100%;
    padding: 1.1cm 1.1cm 0.8cm;
    background: white;
    color: black;
    font-family: "GeneralSans-Variable", "GeneralSans-Regular", sans-serif;
}

.blob-sheet,
.blob-sheet * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

.eyebrow {
    color: var(--text-muted);
}

.qr {
    position: absolute;
    right: 1.1cm;
    top: 1.1cm;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 0.6rem;
    font-weight: 500;
    color: black;
}

.qr img {
    width: 5rem;
    height: auto;
    display: block;
}

.report-signals {
    position: absolute;
    top: 13.825cm;
    left: 2cm;
    right: 2cm;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    z-index: 2;
}

.emotion-core {
    width: 2cm;
    height: 2cm;
    border-radius: 50%;
    background: white;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
}

.emotion-core-inner {
    width: 2cm;
    height: 2cm;
    border-radius: 50%;
    background: white;
    border: 1.5px solid var(--primary);
    display: grid;
    place-items: center;
}

.emotion-core-icon {
    width: 1cm;
    height: 1cm;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--primary);
}

.emotion-core-icon :deep(svg) {
    width: 100%;
    height: 100%;
    fill: currentColor;
}

.signal-bars {
    width: 10cm;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.signal-row {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
}

.signal-label {
    font-size: 1rem;
    text-transform: lowercase;
    color: black;
    text-align: right;
}

.signal-track {
    position: relative;
    display: inline-block;
    width: 10cm;
    max-width: 100%;
    height: 2px;
    background: transparent;
    overflow: hidden;
}

.signal-track::before {
    content: "";
    position: absolute;
    top: 0;
    left: calc(100% - var(--signal-fill, 0%));
    width: var(--signal-fill, 0%);
    height: 100%;
    background: black;
}

.diagram-wrap {
    position: relative;
    width: 100%;
    max-width: 15cm;
    margin: 0.15cm auto 0.55cm;
}

.diagram-wrap {
    overflow: visible;
    box-sizing: border-box;
}

.color-ring {
    position: absolute;
    left: 0;
    top: 0;
    width: 99%;
    height: 99%;
    transform: scale(0.86);
    border-radius: 50%;
    background: conic-gradient(in hsl, hsl(339.08 79.56% 69.13%), hsl(46.44 100% 39.24%), hsl(171.93 100% 37.38%), hsl(226.16 100% 74.15%), hsl(339.08 79.56% 69.13%));
}

.color-ring,
.ring-center {
    z-index: 1;
}

.diagram-overlay {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: 6;
    pointer-events: none;
}

.diagram,
.diagram-overlay {
    overflow: visible;
}

.hue-line {
    stroke: black;
    stroke-width: 0.2;
}

.hue-dot {
    fill: white;
    stroke: black;
    stroke-width: 0.2;
}

.hue-marker {
    stroke-width: 0.2;
}

.hue-marker.chosen {
    fill: var(--primary);
    stroke: var(--primary);
}

.hue-marker.assigned {
    fill: white;
}

.hue-label {
    font-size: 3px;
    fill: black;
    text-anchor: left;
    dominant-baseline: central;
    font-weight: 400;
}

.hue-label.left {
    text-anchor: end;
}

.trait-label {
    font-size: 3px;
    dominant-baseline: central;
    text-transform: lowercase;
    font-weight: 500;
}

.ring-center {
    position: absolute;
    left: 0;
    top: 0;
    width: 99%;
    height: 99%;
    transform: scale(0.855);
    border-radius: 50%;
    background: white;
}

.diagram {
    width: 100%;
    aspect-ratio: 1 / 1;
    display: block;
}

.entries-wrap {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    width: 100%;
    height: 28rem;
    box-sizing: border-box;
    padding-inline: 0.2cm;
    padding-bottom: 1.2cm;
    margin-top: 3rem;
    overflow: visible;
}

.entries-fade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 4.8cm;
    width: 100%;
    height: 1.6cm;
    object-fit: fill;
    pointer-events: none;
    z-index: 1;
}

.entries-fade-white {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 3.2cm;
    width: 100%;
    height: 1.6cm;
    background: white;
}

.entry-lane {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
}

.axis {
    stroke: black;
    stroke-width: 0.1;
}

.axis-label {
    font-size: 0.8rem;
    fill: black;
    text-transform: lowercase;
}

.entry-item {
    position: relative;
    padding: 0.5rem;
    margin: 0;
    background: white;
    box-shadow: 0 0 0.5rem oklch(from var(--shadow) l 0 h / 0.2);
    color: oklch(from var(--text-strong) l 0 h / a);
    border-radius: 1rem;
}

.entry-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-right: 0.5rem;
    font-size: 0.8rem;
}

.emotion-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.5rem;
    background: white;
    outline: 1px solid oklch(var(--lighter-l) var(--lighter-c) var(--emotion-hue));
    border-radius: 0.5rem;
    color: oklch(var(--text-l) 0 0);
    font-size: 0.8rem;
    font-weight: 500;
}

.emotion-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    fill: currentColor;
    transform: scale(0.9);
}

.emotion-icon svg {
    width: 1rem;
    height: 1rem;
    display: block;
    fill: currentColor;
}

.lock-icon {
    width: 0.8rem;
    height: 0.8rem;
    margin-left: 0.2rem;
    fill: currentColor;
}

.entry-date {
    color: black;
    opacity: 0.8;
    margin-left: auto;
    display: flex;
    align-items: center;
}

.entry-text {
    margin: 0.5rem 0 0 0;
    padding-left: 0.5rem;
    color: black;
    font-size: 1rem;
    line-height: 1.4;
    display: -webkit-box;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}

.entry-prompt {
    margin: 0.5rem 0;
    padding-left: 0.5rem;
    color: black;
    opacity: 0.8;
    font-size: 0.8rem;
    font-family: 'GeneralSans-VariableItalic', 'GeneralSans-Italic', sans-serif;
    display: -webkit-box;
    line-clamp: 1;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.entry-content.blurred {
    filter: blur(4px);
}
</style>