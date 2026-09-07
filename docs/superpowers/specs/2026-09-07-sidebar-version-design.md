# App version in sidebar

## Goal

Show the running app version at the bottom of the sidebar so users can confirm which build they have installed.

## UI

- Placement: bottom of the sidebar, below primary navigation
- Copy: `v{version}` (e.g. `v0.1.2`), muted secondary text
- Not clickable; no changelog

## Version source

- Prefer Tauri `getVersion()` from `@tauri-apps/api/app` (matches bundled `tauri.conf.json` version)
- Fallback for non-Tauri (Vite/jsdom tests): `package.json` `version` via static import or inject

## Out of scope

- Version on Ayarlar
- Update checks / release notes link
