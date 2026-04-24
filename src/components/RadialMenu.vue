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
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                            <path fill-rule="evenodd"
                                d="M4.5 1.938a.75.75 0 0 1 1.025.274l.652 1.131c.351-.138.71-.233 1.073-.288V1.75a.75.75 0 0 1 1.5 0v1.306a5.03 5.03 0 0 1 1.072.288l.654-1.132a.75.75 0 1 1 1.298.75l-.652 1.13c.286.23.55.492.785.786l1.13-.653a.75.75 0 1 1 .75 1.3l-1.13.652c.137.351.233.71.288 1.073h1.305a.75.75 0 0 1 0 1.5h-1.306a5.032 5.032 0 0 1-.288 1.072l1.132.654a.75.75 0 0 1-.75 1.298l-1.13-.652c-.23.286-.492.55-.786.785l.652 1.13a.75.75 0 0 1-1.298.75l-.653-1.13c-.351.137-.71.233-1.073.288v1.305a.75.75 0 0 1-1.5 0v-1.306a5.032 5.032 0 0 1-1.072-.288l-.653 1.132a.75.75 0 0 1-1.3-.75l.653-1.13a4.966 4.966 0 0 1-.785-.786l-1.13.652a.75.75 0 0 1-.75-1.298l1.13-.653a4.965 4.965 0 0 1-.288-1.073H1.75a.75.75 0 0 1 0-1.5h1.306a5.03 5.03 0 0 1 .288-1.072l-1.132-.653a.75.75 0 0 1 .75-1.3l1.13.653c.23-.286.492-.55.786-.785l-.653-1.13A.75.75 0 0 1 4.5 1.937Zm1.14 3.476a3.501 3.501 0 0 0 0 5.172L7.135 8 5.641 5.414ZM8.434 8.75 6.94 11.336a3.491 3.491 0 0 0 2.81-.305 3.49 3.49 0 0 0 1.669-2.281H8.433Zm2.987-1.5H8.433L6.94 4.664a3.501 3.501 0 0 1 4.48 2.586Z"
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
    z-index: 6;
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
