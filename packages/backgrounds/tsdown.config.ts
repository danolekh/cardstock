import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node20",
  // .js, as package.json's "type": "module" makes it ESM; the bin and exports point there.
  fixedExtension: false,
  dts: true,
  // The background format's pure functions are bundled in from core, so the CLI runs without
  // React or cardstock installed. sharp, a dependency, stays external: it ships native binaries.
  deps: { alwaysBundle: ["@danolekh/cardstock"] },
  clean: true,
});
