**Mac Build: local unsigned test build**

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
  - The repository now uses GitHub Actions for signed and notarized mac releases. Use that workflow when you have the Apple signing secrets configured.

- **Summary recommendation:**
  - Use this page for a quick local unsigned check on macOS. For public distribution, rely on the GitHub Actions build that produces the signed mac artifact and the existing Windows installer from `npm run build`.
