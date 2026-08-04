import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/__tests__/**/*.test.{ts,tsx}",
      "scripts/**/__tests__/**/*.test.{ts,tsx}",
      // Migration guards. They assert the TEXT of a .sql file (privileges,
      // signatures, rollback), so they belong beside the migrations rather
      // than under src/. Without this line the files are silently never
      // collected — a guard that does not run is the failure mode these
      // guards exist to prevent.
      "supabase/migrations/__tests__/**/*.test.ts",
      // Repo-root operational tooling (`scripts/ops/**`). It lives outside this
      // app on purpose — it monitors production, it is not part of the bundle —
      // but there is only one test runner in the monorepo, so its tests are
      // collected here rather than standing up a second vitest.
      "../../scripts/ops/**/__tests__/**/*.test.ts",
    ],
    exclude: ["node_modules", ".next", "e2e", ".tmp"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
