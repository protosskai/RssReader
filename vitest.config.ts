import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Use happy-dom for DOM environment (Vue component testing)
    environment: "happy-dom",
    // Global test utilities (describe, it, expect, etc.)
    globals: true,
    // Setup files run before each test file (minimal — old setup moved to __archived)
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "src-electron/**/*.ts"],
      exclude: [
        "node_modules",
        "test/**",
        "**/*.d.ts",
        "**/*.spec.ts",
        "**/*.test.ts",
      ],
    },
    // Test match patterns
    include: ["test/**/*.{test,spec}.ts"],
    exclude: ["test/__archived-old-tests/**", "test/e2e/**"],
    // Timeout for individual tests
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      // Quasar and app aliases (mirrors quasar.config.js)
      src: path.resolve(__dirname, "src"),
      app: path.resolve(__dirname, "src-electron"),
      "src-electron": path.resolve(__dirname, "src-electron"),
      components: path.resolve(__dirname, "src/components"),
      layouts: path.resolve(__dirname, "src/layouts"),
      pages: path.resolve(__dirname, "src/pages"),
      stores: path.resolve(__dirname, "src/stores"),
      boot: path.resolve(__dirname, "src/boot"),
      router: path.resolve(__dirname, "src/router"),
      assets: path.resolve(__dirname, "src/assets"),
      // Mock Electron modules
      // Note: Electron mock was moved to __archived-old-tests/; override per-test if needed
      // electron: path.resolve(__dirname, 'test/__archived-old-tests/electron.ts'),
    },
  },
});
