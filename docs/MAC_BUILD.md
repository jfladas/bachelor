**Mac Build: local unsigned test build**

Note: mac builds are produced automatically by the repository's GitHub Actions workflow on push to the `main` branch. The steps below are only for quick local unsigned testing.

**Quick steps to build locally on a Mac (unsigned test build):**

1. Install dependencies:

```bash
npm ci
```

2. (Optional) Generate `electron/assets/icon.icns` from your PNG source:

```bash
sh scripts/generate_icns.sh electron/assets/icon256.png electron/assets/icon.icns
```

3. Build renderer:

```bash
npm run build:renderer
```

4. Build the mac app (unsigned test build):

```bash
npx electron-builder --mac --publish never
```

5. Find output in `dist_electron`.
