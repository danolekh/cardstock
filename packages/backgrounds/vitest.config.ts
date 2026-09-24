import { defineConfig } from "vitest/config";

export default defineConfig({
  // sharp's encoders take a moment on the full-size renders.
  test: { environment: "node", include: ["test/**/*.test.ts"], testTimeout: 30_000 },
});
