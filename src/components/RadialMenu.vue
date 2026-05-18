<script setup>
import Button from "./Button.vue";

const props = defineProps({
    visible: {
        type: Boolean,
        default: false,
    },
    anchorStyle: {
        type: Object,
        default: () => ({}),
    },
    mode: {
        type: String,
        default: "primary",
    },
});

defineEmits(["open-journal", "sleep", "settings", "quit"]);
</script>

<template>
    <Transition name="menu-fade">
        <div v-if="props.visible" class="menu-anchor" :style="props.anchorStyle">
            <div class="radial-menu">
                <template v-if="props.mode === 'primary'">
                    <Button variant="secondary" class="menu-button button-journal" aria-label="Open micro journal"
                        data-tooltip="Micro Journal" @click.stop="$emit('open-journal')">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                            <path
                                d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
                            <path
                                d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 1 14 9v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
                        </svg>
                    </Button>

                    <Button variant="secondary" class="menu-button button-sleep" aria-label="Send to sleep"
                        data-tooltip="Send to Sleep" @click.stop="$emit('sleep')">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                            <path
                                d="M14.438 10.148c.19-.425-.321-.787-.748-.601A5.5 5.5 0 0 1 6.453 2.31c.186-.427-.176-.938-.6-.748a6.501 6.501 0 1 0 8.585 8.586Z" />
                        </svg>
                    </Button>

                    <Button variant="secondary" class="menu-button button-settings" aria-label="Open settings"
                        data-tooltip="Settings" @click.stop="$emit('settings')">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                            <path fill-rule="evenodd"
                                d="M6.955 1.45A.5.5 0 0 1 7.452 1h1.096a.5.5 0 0 1 .497.45l.17 1.699c.484.12.94.312 1.356.562l1.321-1.081a.5.5 0 0 1 .67.033l.774.775a.5.5 0 0 1 .034.67l-1.08 1.32c.25.417.44.873.561 1.357l1.699.17a.5.5 0 0 1 .45.497v1.096a.5.5 0 0 1-.45.497l-1.699.17c-.12.484-.312.94-.562 1.356l1.082 1.322a.5.5 0 0 1-.034.67l-.774.774a.5.5 0 0 1-.67.033l-1.322-1.08c-.416.25-.872.44-1.356.561l-.17 1.699a.5.5 0 0 1-.497.45H7.452a.5.5 0 0 1-.497-.45l-.17-1.699a4.973 4.973 0 0 1-1.356-.562L4.108 13.37a.5.5 0 0 1-.67-.033l-.774-.775a.5.5 0 0 1-.034-.67l1.08-1.32a4.971 4.971 0 0 1-.561-1.357l-1.699-.17A.5.5 0 0 1 1 8.548V7.452a.5.5 0 0 1 .45-.497l1.699-.17c.12-.484.312-.94.562-1.356L2.629 4.107a.5.5 0 0 1 .034-.67l.774-.774a.5.5 0 0 1 .67-.033L5.43 3.71a4.97 4.97 0 0 1 1.356-.561l.17-1.699ZM6 8c0 .538.212 1.026.558 1.385l.057.057a2 2 0 0 0 2.828-2.828l-.058-.056A2 2 0 0 0 6 8Z"
                                clip-rule="evenodd" />
                        </svg>
                    </Button>
                </template>

                <template v-else>
                    <Button variant="secondary" class="menu-button button-quit" aria-label="Quit application"
                        data-tooltip="Quit Application" @click.stop="$emit('quit')">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                            <path fill-rule="evenodd"
                                d="M3.05 3.05a7 7 0 1 1 9.9 9.9 7 7 0 0 1-9.9-9.9Zm1.627.566 7.707 7.707a5.501 5.501 0 0 0-7.707-7.707Zm6.646 8.768L3.616 4.677a5.501 5.501 0 0 0 7.707 7.707Z"
                                clip-rule="evenodd" />
                        </svg>
                    </Button>
                </template>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.menu-anchor {
    position: fixed;
    z-index: 15;
    pointer-events: none;
}

.radial-menu {
    position: absolute;
    width: 0;
    height: 0;
    pointer-events: none;
}

.menu-button {
    position: absolute;
    pointer-events: all;
    padding: 1rem;
    transform: translate(-50%, -50%);
}

.menu-button::after {
    content: attr(data-tooltip);
    position: absolute;
    left: 50%;
    bottom: 100%;
    padding: 0.5rem 1rem;
    border-radius: 1rem;
    background: var(--secondary);
    color: var(--text);
    font-size: 0.8rem;
    font-weight: 500;
    text-wrap: nowrap;
    z-index: 9999;
    pointer-events: none;
    opacity: 0;
    transform: translate(-50%, -0.3rem);
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.button-sleep::after {
    left: 0;
}

.button-settings::after {
    left: 75%;
}

.menu-button:hover::after,
.menu-button:focus-visible::after {
    opacity: 1;
    transform: translate(-50%, -0.5rem);
}

.menu-button:hover::before {
    content: '';
    position: absolute;
    border-radius: 50%;
    width: 120%;
    height: 120%;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: -1;

}

.button-journal,
.button-quit {
    transform: translate(-50%, -50%) translateY(-5.5rem);
}

.button-journal:hover,
.button-quit:hover {
    transform: translate(-50%, -50%) translateY(-5.8rem) scale(1.1);
}

.button-sleep {
    transform: translate(-50%, -50%) translate(-4rem, -4rem);
}

.button-sleep:hover {
    transform: translate(-50%, -50%) translate(-4.2rem, -4.2rem) scale(1.1);
}

.button-settings {
    transform: translate(-50%, -50%) translate(4rem, -4rem);
}

.button-settings:hover {
    transform: translate(-50%, -50%) translate(4.2rem, -4.2rem) scale(1.1);
}

.menu-fade-enter-active,
.menu-fade-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
    opacity: 0;
    transform: scale(0.9);
}
</style>
