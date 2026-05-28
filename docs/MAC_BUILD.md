**Mac Build: how to create a free (unsigned) mac build**

- **Quick steps to build locally on a Mac (unsigned test build):**
  1.  Install dependencies:

      ```bash
      npm ci
      ```

  2.  (Optional) Generate `electron/assets/icon.icns` from your PNG source:

      ```bash
      sh scripts/generate_icns.sh electron/assets/icon256.png electron/assets/icon.icns
      ```

  3.  Build renderer:

      ```bash
      npm run build:renderer
      ```

  4.  Build the mac app (unsigned test build):

      ```bash
      npx electron-builder --mac --publish never
      ```

  5.  Find output in `dist_electron`.

- **Signing & notarization (recommended for public releases):**
  - To avoid Gatekeeper warnings, sign and notarize your app. This requires an Apple Developer account and CI secrets (certificate, Apple ID + app-specific password or API key). I did not add signing in the workflow; you can add signing later when you have credentials.

- **Summary recommendation for a public free release:**
  - Produce `dmg` (consumer-friendly) + `zip` on mac and upload them wherever you want to distribute the app. Get an Apple Developer account if you want a smooth user experience without Gatekeeper prompts. For Windows, distribute the `nsis` installer you already produce with `npm run build`.
