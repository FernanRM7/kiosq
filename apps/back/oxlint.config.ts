import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import jest from "ultracite/oxlint/jest";
import nestjs from "ultracite/oxlint/nestjs";

export default defineConfig({
  extends: [core, nestjs, jest],
  ignorePatterns: core.ignorePatterns,
  rules: {
    "eslint/class-methods-use-this": "off",
    "eslint/func-style": "off",
    "typescript/consistent-type-imports": "off",
    "typescript/no-extraneous-class": ["error", { allowWithDecorator: true }],
    "typescript/parameter-properties": "off",
  },
});
