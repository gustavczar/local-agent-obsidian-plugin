import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
  { ignores: ["main.js", "esbuild.config.mjs", "eslint.config.mjs", "tests/**", "vitest.config.ts"] },
  ...tseslint.configs.recommendedTypeChecked,
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `display()` is only deprecated from 1.13.0; our minAppVersion is 1.7.2,
      // so we intentionally keep it for broader compatibility (shown as a
      // Recommendation by Obsidian's reviewer, not a blocker).
      "@typescript-eslint/no-deprecated": "off",
      // Sentence-case over-fires on placeholders, URLs and proper nouns
      // (e.g. "Nexo", "#a78bfa", "HTTPS://…"); the official reviewer doesn't run it.
      "obsidianmd/ui/sentence-case": "off",
      // A user-triggered "Validate agents" command logging its report is intentional.
      "obsidianmd/rule-custom-message": "off",
    },
  },
);
