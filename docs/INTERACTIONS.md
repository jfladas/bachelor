# Amorphous Blob

This document describes the app from a user-facing perspective and is strictly limited to features currently implemented in the repository. It focuses on user-visible functions and interactions rather than internal architecture.

## Overview

- Amorphous Blob is a lightweight desktop companion and micro-journal with a playful animated "blob" interface. It targets short, frequent entries and gentle engagement.

## Primary user flows

- **First-run / Onboarding**
  - On first run the app shows an onboarding flow where users adjust simple personality sliders/traits and finally confirm/choose a color.
  - The selected values are persisted to an onboarding state file and used to style the blob visuals and affect its behaviour.

- **Create a micro-journal entry**
  - The Micro Journal panel (`src/components/MicroJournal.vue`) accepts short text, an emotion tag, and inspiration.
  - Submitting saves the entry via Electron IPC to the local journal storage and triggers a small blob response animation.

- **View and browse entries**
  - Entries are listed chronologically in the journal list (`src/components/JournalList.vue`) with timestamp, emotion badge and a text preview. They are grouped by month, the month heading background color gradient reflects the emotion distribution in the timeframe.
  - Deleting removes the entry from storage and the metadata index.

- **PIN & Encryption**
  - The app supports optional 4-digit PIN protection for entries. The PIN setup and unlock flows are implemented in `src/components/window/PINWindow.vue` and the `useMicroJournal` composable.
  - PIN actions drive encryption/decryption handled by the main process (`electron/main.cjs`) and `electron/storageService.cjs`.

- **Blob interactions (physics & face reactions)**
  - The blob reacts visually to users emotion: face presets and animations are handled in `src/composables/useBlobFace.js`.
  - Physics-driven interactions (dragging, poking, idle nudges) are implemented with `matter-js` in `src/composables/useBlobPhysics.js`.
  - The renderer coordinates reactions (jump, face changes) when entries are saved or when the user interacts.

- **Sleep mode**
  - Sleep mode is implemented. While sleeping the blob is not visible on screen and can be woken by clicking on tag or via system tray.
  - Sleep duration can be set in minutes/hours or unlimited. Sleep drafting and preferences are persisted to localStorage (`src/utils/storage.js`).

- **Settings actions**
  - The Settings UI (`src/components/window/SettingsWindow.vue`) supports adjusting blob size, sleep defaults, and startup behavior.
  - Danger actions implemented: redo onboarding, clear journal (reset journal storage), and a hard reset. These call IPC handlers in the main process.

## Data access & persistence (implemented)

- Entries & metadata are stored under the app user-data folder using `electron/storageService.cjs` (plain `.json` or encrypted `.enc` files) and indexed in `entries-metadata.json`.
- The renderer talks to the main process using the preload bridge (`electron/preload.js`) and IPC helpers (`src/utils/ipc.js`, `src/utils/electronHelper.js`).
- Implemented IPC handlers include: `journal:save-entry`, `journal:load-entries`, `journal:delete-entry`, `journal:get-metadata`, `journal:setup-password`, `journal:verify-password`, `journal:lock`, and state/reset handlers for onboarding and app-wide resets.
