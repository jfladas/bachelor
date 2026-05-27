<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useMicroJournal } from '@/composables/useMicroJournal'
import Button from './Button.vue'
import NumberInput from './NumberInput.vue'

const emit = defineEmits(['password-set', 'password-unlocked', 'cancel'])

const journal = useMicroJournal()
const pin = ref('')
const pinConfirm = ref('')
const errorMessage = ref('')
const isLoading = ref(false)
const mode = ref('setup') // 'setup' or 'unlock'
const pinInputRef = ref(null)

const focusPinInput = async () => {
    await nextTick()

    const input = pinInputRef.value
    if (!input) {
        return
    }

    await input.focusInput()
    await input.selectInput()
}

const initialize = async () => {
    const isProtected = await journal.isPinProtected()
    mode.value = isProtected ? 'unlock' : 'setup'
}

onMounted(initialize)

watch(mode, async () => {
    await focusPinInput()
}, { immediate: true })

const pinFull = computed(() => pin.value.length === 4)
const pinConfirmFull = computed(() => pinConfirm.value.length === 4)

const handleSetupPin = async () => {
    errorMessage.value = ''

    if (pin.value.length !== 4) {
        errorMessage.value = 'PIN must be exactly 4 digits'
        return
    }

    if (pin.value !== pinConfirm.value) {
        errorMessage.value = 'PINs do not match'
        return
    }

    isLoading.value = true
    const result = await journal.initializeEncryption(pin.value)
    isLoading.value = false

    if (result.success) {
        pin.value = ''
        pinConfirm.value = ''
        emit('password-set')
    } else {
        errorMessage.value = result.error || 'Failed to set up encryption'
    }
}

const handleUnlockPin = async () => {
    errorMessage.value = ''

    if (pin.value.length !== 4) {
        errorMessage.value = 'PIN must be exactly 4 digits'
        return
    }

    isLoading.value = true
    const result = await journal.unlockJournal(pin.value)
    isLoading.value = false

    if (result.success) {
        pin.value = ''
        emit('password-unlocked')
    } else {
        errorMessage.value = result.error || 'Unlock failed'
        await focusPinInput()
    }
}

</script>

<template>
    <div class="overlay">
        <section class="window">
            <Button variant="secondary close-button circle-small" aria-label="Close PIN prompt" @click="emit('cancel')">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path
                        d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
            </Button>
            <p class="eyebrow">{{ mode === 'setup' ? 'Set Journal PIN' : 'Unlock Journal' }}</p>
            <!-- Setup Mode -->
            <div v-if="mode === 'setup'" class="password-form">
                <p class="description">Set a 4-digit PIN to encrypt all your journal entries locally</p>

                <div class="field pin-inputs">
                    <NumberInput ref="pinInputRef" v-model="pin" variant="pin" max-length="4" placeholder="PIN"
                        :disabled="isLoading" aria-label="PIN" wrapper-class="pin-input-field" />
                    <NumberInput v-model="pinConfirm" variant="pin" max-length="4" placeholder="Confirm"
                        :disabled="isLoading" aria-label="Confirm PIN" wrapper-class="pin-input-field"
                        @enter="handleSetupPin" />
                </div>

                <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

                <div class="actions">
                    <Button variant="primary" :disabled="isLoading || !pinFull || !pinConfirmFull"
                        @click="handleSetupPin">
                        {{ isLoading ? 'Setting up...' : 'Set Journal PIN' }}
                    </Button>
                </div>

                <p class="hint">If you forget this PIN, you cannot recover your entries!</p>
            </div>

            <!-- Unlock Mode -->
            <div v-else-if="mode === 'unlock'" class="password-form">
                <p class="description">Enter your 4-digit PIN to access your entries</p>

                <div class="field">
                    <NumberInput ref="pinInputRef" v-model="pin" variant="pin" max-length="4" placeholder="PIN"
                        :disabled="isLoading" aria-label="PIN" @enter="handleUnlockPin" />
                </div>

                <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
                <div class="actions">
                    <Button variant="primary" :disabled="isLoading || !pinFull" @click="handleUnlockPin">
                        {{ isLoading ? 'Unlocking...' : 'Unlock Journal' }}
                    </Button>
                </div>
            </div>
        </section>
    </div>
</template>

<style scoped>
.window {
    position: relative;
    width: 40rem;
    height: auto;
    z-index: 1001;
    pointer-events: auto;
    padding-bottom: 6rem;
}

.pin-inputs {
    display: flex;
    gap: 1rem;
}

.pin-input-field {
    flex: 1;
}
</style>
