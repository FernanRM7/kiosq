import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, react, vitest],
  ignorePatterns: core.ignorePatterns,
  rules: {
    "eslint/func-style": "off",
    "typescript/no-non-null-assertion": "off",
    "unicorn/filename-case": "off",
  },
});
