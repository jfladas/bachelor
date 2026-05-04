import { ref } from "vue";

export const STATES = {
    IDLE: "idle",
    ENGAGED: "engaged",
    ACTIVE: "active",
    SLEEPING: "sleeping",
};

const ENGAGED_PERSIST_MS = 2500;

const state = ref(STATES.IDLE);
const previous = ref(null);

let engagedStopTimeoutId = null;

const setState = (next) => {
    if (state.value === next) return;

    if (state.value === STATES.ENGAGED && next === STATES.IDLE && !engagedStopTimeoutId) {
        engagedStopTimeoutId = window.setTimeout(() => {
            engagedStopTimeoutId = null;
            if (state.value === STATES.ENGAGED) {
                previous.value = state.value;
                state.value = next;
            }
        }, ENGAGED_PERSIST_MS);
        return;
    }

    if (state.value === STATES.ENGAGED && next === STATES.IDLE && engagedStopTimeoutId) {
        return;
    }

    if (next === STATES.ENGAGED && engagedStopTimeoutId) {
        window.clearTimeout(engagedStopTimeoutId);
        engagedStopTimeoutId = null;
    }

    previous.value = state.value;
    state.value = next;
};

const getState = () => state.value;

export const useBlobState = () => ({ state, previous, setState, getState });
