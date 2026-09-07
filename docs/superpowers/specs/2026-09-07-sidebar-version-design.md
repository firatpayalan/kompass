# App version under sidebar brand

## Goal

Show the running app version under the **Kompass** title in the sidebar so users can confirm which build they have installed.

## UI

- Placement: directly under `Kompass`, above the primary navigation
- Copy: `v{version}` (e.g. `v0.1.2`), muted smaller text
- Not clickable; no changelog

## Version source

- Prefer Tauri `getVersion()` from `@tauri-apps/api/app` (matches bundled `tauri.conf.json` version)
- Fallback for non-Tauri (Vite/jsdom tests): `package.json` `version` via static import or inject

## Out of scope

- Version on Ayarlar
- Version pinned to sidebar footer
- Update checks / release notes link
