# Feature Implementation Guide and Checklist

Use this guide before and during feature work to keep the current clean boundaries intact.

## Core Boundaries

- Renderer shell lives in src/App.vue and should stay thin.
- Onboarding state, orchestration, and IPC sync belong in src/composables/useOnboarding.js.
- Blob physics, drag, hover, and animation lifecycle belong in src/composables/useBlobPhysics.js.
- Blob rendering belongs in src/components/BlobVisuals.vue.
- Shared pure logic belongs in src/utils/\*.js.
- Shared option lists and static config belong in src/constants/\*.js.
- Archived or experimental components belong in src/components/archive/.

## Placement Rules

- UI-only feature with local state: add a focused component in src/components/.
- Multi-component state or lifecycle logic: add or extend a composable in src/composables/.
- Pure transformations, math, normalization: add utilities in src/utils/.
- New static labels/options/maps: add constants in src/constants/.
- Persistence or OS-level behavior: wire through Electron IPC, not direct renderer hacks.

## Feature Checklist

### 1) Define scope first

- [ ] Write a one-paragraph feature goal.
- [ ] List which layer is affected: UI, state orchestration, physics, pure logic, or IPC.
- [ ] Confirm where source of truth should live.

### 2) Choose file ownership

- [ ] New UI markup does not inflate App.vue or Blob.vue unnecessarily.
- [ ] Complex side effects are moved into a composable.
- [ ] Reusable transforms are extracted into src/utils/.
- [ ] Duplicated literals are moved to src/constants/.

### 3) Keep interfaces narrow

- [ ] Components use explicit props and emits.
- [ ] Composables return only what callers need.
- [ ] Avoid passing entire large state objects when a few fields are enough.

### 4) Keep side effects contained

- [ ] onMounted/onBeforeUnmount side effects stay inside composables.
- [ ] Event listeners/timers/animation loops have matching cleanup.
- [ ] IPC calls are centralized and error-handled.

### 5) Styling guardrails

- [ ] Prefer scoped styles in feature components.
- [ ] Reuse existing hue/theme variables when possible.
- [ ] Avoid adding global selectors unless truly shared.

### 6) Cleanup before merge

- [ ] Remove dead imports and unused refs/computed values.
- [ ] Remove stale comments and temporary debug flags.
- [ ] Archive abandoned experiments in src/components/archive/ or delete them.

### 7) Validation checklist

- [ ] Run diagnostics and fix new errors.
- [ ] Run npm run build:renderer.
- [ ] If Electron main/preload changed, run npm run build.
- [ ] Smoke-test the touched flow manually.

## Quick Review Questions

- Does this change put logic in the right layer?
- Is any file becoming a new monolith?
- Can another feature reuse what was just added?
- Is cleanup and lifecycle handling complete?
- Is the behavior preserved outside the new feature scope?
