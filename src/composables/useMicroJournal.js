import { computed, ref } from "vue";
import { journalEmotions, journalPromptsGeneric, journalPromptsByEmotion } from "../constants/microJournalOptions";
import { getElectronIPC } from "../utils/electronHelper";

const MAX_ENTRY_LENGTH = 600;
const MAX_STORED_ENTRIES = 80;

const createEntryId = () => `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

const sanitizeEntryText = (value) => {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim().slice(0, MAX_ENTRY_LENGTH);
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

let journalUnlocked = false;
let cachedIPC = null;
let lockStateListenerAttached = false;

const mergeLoadedEntries = (metadataList, loadedEntries) => {
    const loadedById = new Map((loadedEntries || []).map((entry) => [entry.id, entry]));
    const isUnlocked = journalUnlocked;

    return (metadataList || [])
        .map((metadataEntry) => {
            const loadedEntry = loadedById.get(metadataEntry.id) || {};
            const isSecret = Boolean(metadataEntry.isSecret);

            return {
                id: metadataEntry.id,
                createdAt: loadedEntry.createdAt || metadataEntry.createdAt,
                updatedAt: loadedEntry.updatedAt || metadataEntry.updatedAt || null,
                text: loadedEntry.text || "",
                emotion: loadedEntry.emotion ?? metadataEntry.emotion ?? null,
                prompt: loadedEntry.prompt ?? metadataEntry.prompt ?? null,
                isSecret,
                isLocked: isSecret && !isUnlocked,
            };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

/**
 * Get or wait for Electron IPC to be available
 */
async function getIPC() {
    if (cachedIPC) {
        return cachedIPC;
    }

    cachedIPC = await getElectronIPC();
    return cachedIPC;
}

async function attachLockStateListener(ipc, loadEntries) {
    if (lockStateListenerAttached || !ipc?.on) {
        return;
    }

    lockStateListenerAttached = true;
    ipc.on('journal:lock-state-changed', async (nextUnlocked) => {
        journalUnlocked = Boolean(nextUnlocked);
        loadEntries();
    });
}

export const useMicroJournal = () => {
    const journalText = ref("");
    const selectedEmotion = ref("");
    const promptIndex = ref(getInitialPromptIndex());
    const entries = ref([]);
    const isUnlocked = ref(false);
    const isSecret = ref(false);

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

    const initializeEncryption = async (password) => {
        const ipc = await getIPC();

        if (!ipc) {
            return { success: false, error: 'Electron IPC not available' };
        }

        try {
            const result = await ipc.invoke('journal:setup-password', password);
            journalUnlocked = false;
            isUnlocked.value = false;
            await loadEntries();
            return result;
        } catch (error) {
            console.error("Failed to initialize encryption:", error);
            return { success: false, error: 'Setup failed' };
        }
    };

    const unlockJournal = async (password) => {
        const ipc = await getIPC();

        if (!ipc) {
            return { success: false, error: 'Electron IPC not available' };
        }

        try {
            const result = await ipc.invoke('journal:verify-password', password);
            if (!result.success) {
                return { success: false, error: result.error || 'Unlock failed' };
            }

            journalUnlocked = true;
            isUnlocked.value = true;
            return { success: true };
        } catch (error) {
            console.error("Failed to unlock journal:", error);
            return { success: false, error: 'Unlock failed' };
        }
    };

    const refreshUnlockState = async () => {
        const ipc = await getIPC();

        if (!ipc) {
            journalUnlocked = false;
            return false;
        }

        try {
            journalUnlocked = await ipc.invoke('journal:is-unlocked');
            isUnlocked.value = journalUnlocked;
            return journalUnlocked;
        } catch (error) {
            console.error("Failed to refresh unlock state:", error);
            journalUnlocked = false;
            return false;
        }
    };

    const loadEntries = async () => {
        const ipc = await getIPC();

        if (!ipc) {
            console.error("Electron IPC not available");
            return;
        }

        try {
            await attachLockStateListener(ipc, loadEntries);
            await refreshUnlockState();

            const [metadataEntries, loadedEntries] = await Promise.all([
                ipc.invoke('journal:get-metadata'),
                ipc.invoke('journal:load-entries'),
            ]);

            entries.value = mergeLoadedEntries(metadataEntries, loadedEntries);
        } catch (error) {
            console.error("Failed to load entries:", error);
            entries.value = [];
        }
    };

    const isPinProtected = async () => {
        const ipc = await getIPC();

        if (!ipc) {
            return false;
        }

        try {
            return await ipc.invoke('journal:is-password-protected');
        } catch (error) {
            console.error("Failed to check PIN status:", error);
            return false;
        }
    };

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

    const resetDraft = ({ rotatePromptAfterReset = false, preserveEmotion = false } = {}) => {
        journalText.value = "";
        if (!preserveEmotion) {
            selectedEmotion.value = "";
        }
        if (rotatePromptAfterReset) {
            rotatePrompt();
        }
    };


    const saveEntry = async ({ includeEmotion = true, includePrompt = true, includeText = true, isSecret: nextIsSecret = false } = {}) => {
        const text = includeText ? sanitizeEntryText(journalText.value) : "";
        const hasText = text.length > 0;
        const hasEmotion = includeEmotion && Boolean(selectedEmotion.value);

        if (!hasText && !hasEmotion) {
            return null;
        }

        const entryIsSecret = Boolean(nextIsSecret);
        isSecret.value = entryIsSecret;

        const ipc = await getIPC();

        if (!ipc) {
            console.error("Electron IPC not available");
            return null;
        }

        try {
            const entry = {
                id: createEntryId(),
                text: hasText ? text : "",
                emotion: includeEmotion ? selectedEmotion.value || null : null,
                prompt: includePrompt ? activePrompt.value || null : null,
                isSecret: entryIsSecret,
                isLocked: entryIsSecret && !journalUnlocked,
                createdAt: new Date().toISOString(),
            };

            const result = await ipc.invoke('journal:save-entry', entry);

            if (!result?.success) {
                return null;
            }

            const nextEntries = [entry, ...entries.value].slice(0, MAX_STORED_ENTRIES);
            entries.value = nextEntries;
            resetDraft({ rotatePromptAfterReset: true, preserveEmotion: true });
            isSecret.value = false;

            return entry;
        } catch (error) {
            console.error("Failed to save entry:", error);
            return null;
        }
    };

    /**
     * Delete an encrypted entry
     */
    const deleteEntry = async (entryId) => {
        const ipc = await getIPC();

        if (!ipc) {
            console.error("Electron IPC not available");
            return false;
        }

        try {
            await ipc.invoke('journal:delete-entry', entryId);
            entries.value = entries.value.filter((e) => e.id !== entryId);
            return true;
        } catch (error) {
            console.error("Failed to delete entry:", error);
            return false;
        }
    };

    const lockJournal = async () => {
        const ipc = await getIPC();
        try {
            await ipc?.invoke('journal:lock');
        } catch (error) {
            console.error("Failed to lock journal:", error);
        }
        journalUnlocked = false;
        isUnlocked.value = false;
    };

    return {
        emotionTags: journalEmotions,
        prompts: journalPromptsGeneric,
        journalText,
        selectedEmotion,
        activePrompt,
        entries,
        canSubmit,
        isUnlocked,
        isSecret,
        maxEntryLength: MAX_ENTRY_LENGTH,
        setJournalText,
        setEmotionTag,
        rotatePrompt,
        resetDraft,
        saveEntry,
        deleteEntry,
        loadEntries,
        initializeEncryption,
        unlockJournal,
        refreshUnlockState,
        isPinProtected,
        lockJournal,
    };
};

