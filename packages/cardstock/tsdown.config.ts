import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/carousel/index.ts", "src/frost/index.ts", "src/limit/index.ts"],
  format: "esm",
  platform: "browser",
  target: "es2022",
  dts: true,
  // One output file per source file, so each keeps its own "use client" and trees shake cleanly.
  unbundle: true,
  external: [/^react($|\/)/, /^react-dom($|\/)/, /^@base-ui\/react($|\/)/],
  clean: true,
  inputOptions: {
    // With `unbundle` no module is merged into another, so the directive-merging warning is moot;
    // scripts/check-directives.mjs verifies every one survived.
    onLog(level, log, handler) {
      if (log.code === "MODULE_LEVEL_DIRECTIVE") return;
      handler(level, log);
    },
  },
});
