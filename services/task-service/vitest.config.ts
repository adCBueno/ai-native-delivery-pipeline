import { defineConfig } from "vitest/config";

// junit.xml and cobertura coverage are picked up by GitLab to show
// test results and coverage directly in merge requests.
export default defineConfig({
  test: {
    reporters: ["default", "junit"],
    outputFile: { junit: "junit.xml" },
    coverage: {
      provider: "v8",
      include: ["src"],
      exclude: ["src/server.ts"],
      reporter: ["text", "cobertura"],
    },
  },
});
