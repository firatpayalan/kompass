# Daily Leadership Tool

Yerel çalışan mühendislik yöneticisi masaüstü uygulaması.
Local-first desktop app for engineering managers.

## Çalıştırma / Run

Gereksinimler / Prerequisites:

- Node.js ve npm / Node.js and npm
- Rust toolchain (`rustup`, `cargo`)

Bağımlılıkları kurun ve masaüstü uygulamasını geliştirme modunda başlatın:
Install dependencies and start the desktop app in development mode:

```bash
npm install
npm run tauri dev
```

Yalnızca web arayüzü / Web UI only:

```bash
npm run dev
```

## Test ve derleme / Test and build

```bash
npm test
npm run build
```

Rust doğrulaması / Rust verification:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```
