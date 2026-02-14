import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/main/**/*.{test,spec}.ts"],
    exclude: ["node_modules/**", "dist/**", "out/**"],
    environment: "node",
  },
});
