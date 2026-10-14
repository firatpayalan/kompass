import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react(), {
    name: "development-csp",
    // React Refresh injects an inline module in development; packaged builds retain script-src 'self'.
    transformIndexHtml: (html: string) => command === "serve"
      ? html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'") : html,
  }],
  base: "./",
  clearScreen: false,
  server: { host: "127.0.0.1", port: 1420, strictPort: true },
}));
