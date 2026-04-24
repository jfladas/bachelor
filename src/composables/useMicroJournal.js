import { computed, ref } from "vue";
import { journalEmotions, journalPromptsGeneric, journalPromptsByEmotion } from "../constants/microJournalOptions";

const ENTRIES_STORAGE_KEY = "bachelor:micro-journal";
const MAX_ENTRY_LENGTH = 600;
const MAX_STORED_ENTRIES = 80;

const createEntryId = () => `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

const sanitizeEntryText = (value) => {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim().slice(0, MAX_ENTRY_LENGTH);
};

const readStoredEntries = () => {
    if (typeof window === "undefined" || !window.localStorage) {
        return [];
    }

    try {
        const raw = window.localStorage.getItem(ENTRIES_STORAGE_KEY);
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map((entry) => ({
                id: typeof entry?.id === "string" ? entry.id : createEntryId(),
                text: sanitizeEntryText(entry?.text),
                emotion: typeof entry?.emotion === "string" ? entry.emotion : null,
                prompt: typeof entry?.prompt === "string" ? entry.prompt : null,
                createdAt: typeof entry?.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
            }))
            .filter((entry) => Boolean(entry.text || entry.emotion));
    } catch {
        return [];
    }
};

const persistEntries = (entries) => {
    if (typeof window === "undefined" || !window.localStorage) {
        return;
    }

    try {
        window.localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
    } catch {
        // Local storage might be unavailable in some environments.
    }
};

const getInitialPromptIndex = () => {
    const prompts = journalPromptsGeneric;
    if (!Array.isArray(prompts) || prompts.length === 0) {
        return 0;
    }

    return Math.floor(Math.random() * prompts.length);
};

const getPromptsForEmotion = (emotionId) => {
    if (!emotionId || !journalPromptsByEmotion[emotionId]) {
        return journalPromptsGeneric;
    }
    return journalPromptsByEmotion[emotionId];
};

export const useMicroJournal = () => {
    const journalText = ref("");
    const selectedEmotion = ref("");
    const promptIndex = ref(getInitialPromptIndex());
    const entries = ref(readStoredEntries());

    const activePrompt = computed(() => {
        const prompts = getPromptsForEmotion(selectedEmotion.value);
        if (prompts.length === 0) {
            return "";
        }

        const index = Math.max(0, Math.min(prompts.length - 1, promptIndex.value));
        return prompts[index];
    });

    const canSubmit = computed(() => {
        const hasText = sanitizeEntryText(journalText.value).length > 0;
        const hasEmotion = Boolean(selectedEmotion.value);
        return hasText || hasEmotion;
    });

    const setJournalText = (nextText) => {
        if (typeof nextText !== "string") {
            journalText.value = "";
            return;
        }

        journalText.value = nextText.slice(0, MAX_ENTRY_LENGTH);
    };

    const setEmotionTag = (emotionId) => {
        if (typeof emotionId !== "string") {
            selectedEmotion.value = "";
            return;
        }

        selectedEmotion.value = selectedEmotion.value === emotionId ? "" : emotionId;
        promptIndex.value = getInitialPromptIndex();
    };

    const rotatePrompt = () => {
        const prompts = getPromptsForEmotion(selectedEmotion.value);
        if (prompts.length < 2) {
            return;
        }

        const current = promptIndex.value;
        let next = Math.floor(Math.random() * prompts.length);
        if (next === current) {
            next = (next + 1) % prompts.length;
        }

        promptIndex.value = next;
    };

    const resetDraft = ({ rotatePromptAfterReset = false } = {}) => {
        journalText.value = "";
        selectedEmotion.value = "";
        if (rotatePromptAfterReset) {
            rotatePrompt();
        }
    };

    const saveEntry = ({ includeEmotion = true, includePrompt = true, includeText = true } = {}) => {
        const text = includeText ? sanitizeEntryText(journalText.value) : "";
        const hasText = text.length > 0;
        const hasEmotion = includeEmotion && Boolean(selectedEmotion.value);

        if (!hasText && !hasEmotion) {
            return null;
        }

        const entry = {
            id: createEntryId(),
            text: hasText ? text : "",
            emotion: includeEmotion ? selectedEmotion.value || null : null,
            prompt: includePrompt ? activePrompt.value || null : null,
            createdAt: new Date().toISOString(),
        };

        const nextEntries = [entry, ...entries.value].slice(0, MAX_STORED_ENTRIES);
        entries.value = nextEntries;
        persistEntries(nextEntries);
        resetDraft({ rotatePromptAfterReset: true });

        return entry;
    };

    return {
        emotionTags: journalEmotions,
        prompts: journalPromptsGeneric,
        journalText,
        selectedEmotion,
        activePrompt,
        entries,
        canSubmit,
        maxEntryLength: MAX_ENTRY_LENGTH,
        setJournalText,
        setEmotionTag,
        rotatePrompt,
        resetDraft,
        saveEntry,
    };
};
