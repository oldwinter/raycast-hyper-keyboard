import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // tests/*.test.mjs are node:test suites, not vitest suites; run them with `node --test`.
    exclude: [...configDefaults.exclude, "**/*.test.mjs"],
  },
});
