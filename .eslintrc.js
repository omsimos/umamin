// This configuration only applies to the package manager root.
/** @type {import("eslint").Linter.Config} */
module.exports = {
  ignorePatterns: ["apps/**", "packages/**"],
  extends: ["@umamin/eslint/library"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
};
