# My Self Companion

Desktop companion built with Vue, Vite, Electron, and Matter.js.

## Development

- Start app (renderer + Electron): `npm run dev`
- Build renderer: `npm run build:renderer`
- Build packaged app: `npm run build`
- Feature implementation guide: [docs/feature-implementation-checklist.md](docs/feature-implementation-checklist.md)

## Architecture Boundaries

### Onboarding flow

- `src/App.vue` is the top-level renderer shell.
- `src/composables/useOnboarding.js` owns onboarding state, IPC sync, persistence payload creation, and navigation between onboarding steps.
- `src/components/onboarding/*` are presentational onboarding components that receive state via props and communicate through emits.

### Companion flow

- `src/components/Companion.vue` adapts onboarding-derived values (hue/symmetry/activity) and wires rendering to the physics composable.
- `src/composables/usePhysicsBlob.js` owns Matter.js lifecycle, drag and hover interaction, wall/bounds management, blob position persistence, and animation loop.
- `src/components/BlobVisuals.vue` is a pure visual layer for SVG blob paths, face placement, and optional dev overlays.

### Shared pure logic

- `src/utils/validation.js` holds normalization and clamp helpers.
- `src/utils/colorProfile.js` calculates assigned profile values from sliders and traits.
- `src/utils/themeColors.js` generates hue-driven CSS variables.
- `src/constants/onboardingOptions.js` defines trait and reaction option lists.

## Notes

- `src/components/archive/ChainPet.vue` is archived and not wired into the active flow.
