# Technical Implementation

## Technology Stack

- **Frontend:** Vue 3 (Composition API) with Vite; UI components live in `src/components`, business logic in `src/composables`.
- **Backend:** Electron main process (Node.js) provides native APIs, IPC, and filesystem access (`electron/main.cjs`).
- **Desktop Framework:** Electron (see `package.json`).
- **Data Storage:** File-based in the app user-data folder: entries stored as `.json` (plain) or `.enc` (encrypted), index in `entries-metadata.json`, salt in `journal.salt`.
- **Animation / Physics:** `matter-js` for physics, `flubber` for SVG shape morphing, combined Canvas/SVG rendering and CSS transitions.
- **AI:** No AI/ML libraries in the prototype; all reactions are rule-based and deterministic.
- **Other Libraries:** `fs-extra`, `concurrently`, `electron-builder`, `@vitejs/plugin-vue`.

## Architecture

- Renderer (Vue): presentation, interaction, animation; communicates with the main process via `ipcRenderer`.
- Main Process (Electron): window and tray management, native integrations, `StorageService`, encryption routines and central IPC handlers.
- StorageService: implemented in `electron/storageService.cjs`, encapsulates file access, metadata management and CRUD for entries.
- Preload / IPC: a secure bridge (`electron/preload.js`) and helpers in `src/utils` expose allowed channels.

## Storage

- Physical location: `app.getPath('userData')` → `journal-entries/` and metadata files.
- Formats: `<id>.json` (plain) or `<id>.enc` (encrypted with `{ nonce, ciphertext, authTag }`), metadata in `entries-metadata.json`.
- Encryption: PBKDF2 (100,000 iterations, SHA-256) for key derivation from the PIN + `journal.salt`, AES-256-GCM for confidentiality and integrity (encrypt/decrypt logic in `electron/main.cjs`).
- Metadata index: fast listing without decrypting entries; `StorageService.repairMetadata()` synchronizes `isSecret` flags when needed.

## Blob System (technical details)

- Physics simulation: `src/composables/useBlobPhysics.js` uses `matter-js` for bodies, forces and events; user interactions (drag, poke) are converted into applied forces.
- Visuals: SVG/Canvas rendering in `Blob.vue` and `BlobVisuals.vue`; shape morphing via `flubber` for smooth transitions.
- State & events: `useBlobState.js` and `useBlobFace.js` control facial expressions, idle behaviour and reactions to journal events.
- Performance: simulations run on `requestAnimationFrame`; level-of-detail is reduced for inactive or offscreen blobs.

## Emotions (model)

- Representation: entries contain an `emotion` attribute; metadata stores aggregated information (e.g., frequency over time periods).
- Influence: onboarding parameters (`expressiveness`, `activity`, `symmetry`) modulate intensity and style of animations and facial expressions.
- Implementation: rule-based mapping Emotion → face preset → animation parameters implemented in `useBlobFace.js`.

## Journal (flow & security)

- Create: the UI constructs an entry object (id, text, emotion, createdAt, isSecret...) and calls `ipcRenderer.invoke('journal:save-entry', entry)`.
- Load: `journal:load-entries` returns (decrypted) entries and the UI constructs lists using `entries-metadata.json`.
- PIN flow: `journal:setup-password` creates a salt and derives a key; `journal:verify-password` validates the key by attempting to decrypt existing `.enc` entries when present. The key is only kept in RAM and cleared by `journal:lock`.
- Migration: when a PIN is set, entries marked as secret that currently exist as plain `.json` files are re-encrypted after successful verification.
