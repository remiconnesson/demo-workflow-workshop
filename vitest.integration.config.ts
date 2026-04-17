import { defineConfig } from "vitest/config";
import { workflowTransformPlugin } from "@workflow/rollup";

export default defineConfig({
  plugins: [
    workflowTransformPlugin({
      exclude: [process.cwd() + "/.workflow-vitest/"],
    }),
  ],
  test: {
    include: ["examples/**/*.integration.test.ts"],
    testTimeout: 60_000,
    globalSetup: ["./vitest.integration.setup.ts"],
    setupFiles: ["./vitest.integration.env.ts"],
  },
});
