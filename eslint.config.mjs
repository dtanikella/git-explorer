import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Additional common patterns
    "node_modules/**",
    "coverage/**",
    "*.log",
    ".env*",
  ]),
  // Allow CommonJS require() in Jest config and test files
  {
    files: ["jest.config.js", "jest.setup.js", "**/__tests__/**/*.ts", "**/__tests__/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
    },
  },
  // Allow any types in component files where type inference is complex
  {
    files: ["app/components/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Allow any types in test files for mocking
  {
    files: ["**/__tests__/**/*.ts", "**/__tests__/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
