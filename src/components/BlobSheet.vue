<script setup>
import { computed } from "vue";
import { traitOptions } from "../constants/onboardingOptions";

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

const traitLabelMap = traitOptions.reduce((labels, trait) => {
    labels[trait] = trait.charAt(0).toUpperCase() + trait.slice(1);
    return labels;
}, {});

const formattedTraits = computed(() => {
    const traits = Array.isArray(props.selectedTraits) ? props.selectedTraits : [];
    return traits.length > 0 ? traits.map((trait) => traitLabelMap[trait] || trait) : ["No traits selected"];
});

const appearanceSummary = computed(() => [
    { label: "Hue", value: `${Math.round(Number(props.onboardingData?.hue) || 0)}°` },
    { label: "Assigned", value: `${Math.round(Number(props.onboardingData?.assignedHue) || 0)}°` },
    { label: "Symmetry", value: `${Math.round((Number(props.onboardingData?.symmetry) || 0) * 100)}%` },
    { label: "Expressiveness", value: `${Math.round((Number(props.onboardingData?.expressiveness) || 0) * 100)}%` },
    { label: "Activity", value: `${Math.round((Number(props.onboardingData?.activity) || 0) * 100)}%` },
    { label: "Size", value: `${Math.round(Number(props.blobSize) || 100)}%` },
]);

const entryPreview = computed(() => {
    return [...props.entries]
        .filter((entry) => entry && (entry.text || entry.emotion || entry.prompt))
        .slice(0, 4)
        .map((entry) => ({
            id: entry.id,
            createdAt: entry.createdAt ? new Date(entry.createdAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "Recently",
            emotion: entry.emotion || "Neutral",
            prompt: entry.prompt || "Journal entry",
            text: (entry.text || "No written entry").trim(),
        }));
});

const swatchStyle = computed(() => ({
    background: `linear-gradient(135deg, oklch(72% 0.18 ${Number(props.onboardingData?.hue) || 220}), oklch(55% 0.12 ${Number(props.onboardingData?.assignedHue ?? props.onboardingData?.hue) || 220}))`,
    transform: `scale(${Math.min(1.35, Math.max(0.75, (Number(props.blobSize) || 100) / 100))})`,
}));
</script>

<template>
    <section class="blob-sheet" aria-hidden="true">
        <header class="blob-sheet__header">
            <p class="blob-sheet__eyebrow">Amorphous Blob</p>
            <h1>Blob Sheet</h1>
            <p class="blob-sheet__lede">A one-page summary of personality, appearance, and journal notes.</p>
        </header>

        <div class="blob-sheet__grid">
            <section class="blob-sheet__card blob-sheet__portrait-card">
                <p class="blob-sheet__card-label">Appearance</p>
                <div class="blob-sheet__portrait" :style="swatchStyle">
                    <div class="blob-sheet__portrait-inner">
                        <span>{{ Math.round(Number(props.blobSize) || 100) }}%</span>
                    </div>
                </div>
                <ul class="blob-sheet__stat-list">
                    <li v-for="stat in appearanceSummary" :key="stat.label">
                        <span>{{ stat.label }}</span>
                        <strong>{{ stat.value }}</strong>
                    </li>
                </ul>
            </section>

            <section class="blob-sheet__card">
                <p class="blob-sheet__card-label">Personality</p>
                <div class="blob-sheet__traits">
                    <span v-for="trait in formattedTraits" :key="trait">{{ trait }}</span>
                </div>
                <div class="blob-sheet__summary-grid">
                    <div>
                        <span>Reserved / Open</span>
                        <strong>{{ Math.round((Number(props.questionAnswers?.reservedOpen) || 0) * 100) }}%</strong>
                    </div>
                    <div>
                        <span>Calm / Assertive</span>
                        <strong>{{ Math.round((Number(props.questionAnswers?.calmAssertive) || 0) * 100) }}%</strong>
                    </div>
                    <div>
                        <span>Rational / Emotional</span>
                        <strong>{{ Math.round((Number(props.questionAnswers?.rationalEmotional) || 0) * 100)
                            }}%</strong>
                    </div>
                </div>
            </section>
        </div>

        <section class="blob-sheet__card blob-sheet__journal-card">
            <p class="blob-sheet__card-label">Journal Entries</p>
            <div v-if="entryPreview.length > 0" class="blob-sheet__entries">
                <article v-for="entry in entryPreview" :key="entry.id" class="blob-sheet__entry">
                    <div class="blob-sheet__entry-head">
                        <strong>{{ entry.prompt }}</strong>
                        <span>{{ entry.createdAt }} · {{ entry.emotion }}</span>
                    </div>
                    <p>{{ entry.text }}</p>
                </article>
            </div>
            <p v-else class="blob-sheet__empty">No journal entries yet.</p>
        </section>
    </section>
</template>

<style scoped>
.blob-sheet {
    position: fixed;
    inset: 0;
    padding: 1.5rem;
    background: white;
    color: var(--text-strong);
    font-family: "GeneralSans-Variable", "GeneralSans-Regular", sans-serif;
}

.blob-sheet__header {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-bottom: 1rem;
}

.blob-sheet__eyebrow,
.blob-sheet__card-label {
    margin: 0;
    font-size: 0.8rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.blob-sheet__header h1 {
    margin: 0;
    font-size: 2.2rem;
}

.blob-sheet__lede {
    margin: 0;
    max-width: 40rem;
    color: var(--text);
}

.blob-sheet__grid {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 1rem;
    margin-bottom: 1rem;
}

.blob-sheet__card {
    border-radius: 1.5rem;
    padding: 1rem;
    background: color-mix(in oklch, var(--secondary) 42%, white);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--shadow) 15%, transparent);
}

.blob-sheet__portrait-card {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    align-items: center;
}

.blob-sheet__portrait {
    width: min(100%, 14rem);
    aspect-ratio: 1;
    margin: 0 auto;
    border-radius: 38% 62% 57% 43% / 46% 38% 62% 54%;
    display: grid;
    place-items: center;
    box-shadow: inset 0 0 2rem rgba(255, 255, 255, 0.2), 0 0 2rem var(--shadow);
}

.blob-sheet__portrait-inner {
    width: 58%;
    aspect-ratio: 1;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: color-mix(in oklch, white 85%, transparent);
    font-size: 1.75rem;
    font-weight: 700;
}

.blob-sheet__stat-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.55rem;
}

.blob-sheet__stat-list li,
.blob-sheet__summary-grid div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.65rem 0.75rem;
    border-radius: 1rem;
    background: color-mix(in oklch, white 78%, transparent);
}

.blob-sheet__stat-list span,
.blob-sheet__summary-grid span,
.blob-sheet__entry span {
    color: var(--text);
    font-size: 0.9rem;
}

.blob-sheet__traits {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.85rem 0 1rem 0;
}

.blob-sheet__traits span {
    padding: 0.45rem 0.7rem;
    border-radius: 999px;
    background: var(--white);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--shadow) 10%, transparent);
}

.blob-sheet__summary-grid {
    display: grid;
    gap: 0.65rem;
}

.blob-sheet__summary-grid div {
    flex-direction: column;
    gap: 0.2rem;
}

.blob-sheet__summary-grid strong,
.blob-sheet__stat-list strong {
    font-size: 1rem;
}

.blob-sheet__journal-card {
    min-height: 18rem;
}

.blob-sheet__entries {
    display: grid;
    gap: 0.75rem;
    margin-top: 0.85rem;
}

.blob-sheet__entry {
    padding: 0.85rem 0.95rem;
    border-radius: 1rem;
    background: color-mix(in oklch, white 82%, transparent);
}

.blob-sheet__entry-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.35rem;
}

.blob-sheet__entry-head strong {
    font-size: 1rem;
}

.blob-sheet__entry p,
.blob-sheet__empty {
    margin: 0;
    color: var(--text-strong);
    line-height: 1.45;
}

@media screen {
    .blob-sheet {
        display: none;
    }
}

@media print {
    .blob-sheet {
        display: grid;
    }

    :global(body) {
        background: white;
    }
}
</style>
