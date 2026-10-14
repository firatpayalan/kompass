import { build } from "esbuild";
import { resolve } from "node:path";

await build({
  entryPoints: { main: "electron/main.ts", preload: "electron/preload.ts" },
  outdir: "dist-electron", outExtension: { ".js": ".cjs" },
  bundle: true, platform: "node", target: "node24", format: "cjs",
  external: ["electron"], loader: { ".sql": "text" }, sourcemap: true,
  plugins: [{ name: "sql-raw", setup(build) {
    build.onResolve({ filter: /\.sql\?raw$/ }, (args) => ({ path: resolve(args.resolveDir, args.path.replace(/\?raw$/, "")) }));
  } }],
});
