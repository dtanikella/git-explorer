import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsdoc from "eslint-plugin-jsdoc";
import tsdoc from "eslint-plugin-tsdoc";

// The recommended-tsdoc preset configures ~60 JSDoc rules at "warn" level
// with TSDoc-friendly settings (check-tag-names with typed:true, no-types, etc.)
const jsdocPreset = jsdoc.configs["flat/recommended-tsdoc"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Apply TSDoc and JSDoc rules to source files only
  {
    ...jsdocPreset,
    files: ["app/**", "lib/**"],
    plugins: { tsdoc, jsdoc },
    rules: {
      ...jsdocPreset.rules,
      // === TSDoc syntax validation ===
      "tsdoc/syntax": "warn",

      // === Documentation presence ===
      // Require JSDoc blocks on:
      // - Function declarations (exported or not)
      // - Arrow function expressions (hooks, const components)
      // - Class declarations and expressions
      // - Interface, type alias, and enum declarations
      // - Exported const/variable declarations
      // publicOnly: interfaces, type aliases, and constants must be exported to require docs;
      // functions and classes always require docs regardless of export status.
      "jsdoc/require-jsdoc": [
        "warn",
        {
          publicOnly: {
            ancestorsOnly: true,
            cjs: true,
            esm: true,
          },
          exemptEmptyConstructors: true,
          checkConstructors: true,
          checkGetters: false,
          checkSetters: false,
          contexts: [
            // Arrow functions (hooks, const-based components, callbacks)
            "ArrowFunctionExpression",
            // Function declarations (named functions)
            "FunctionDeclaration",
            // Function expressions
            "FunctionExpression",
            // Class declarations and expressions
            "ClassDeclaration",
            "ClassExpression",
            // TypeScript declarations
            "TSInterfaceDeclaration",
            "TSTypeAliasDeclaration",
            "TSEnumDeclaration",
            // Method definitions in classes
            "MethodDefinition",
            // Property definitions (for class field annotations)
            "PropertyDefinition",
          ],
        },
      ],

      // === Required description ===
      "jsdoc/require-description": [
        "warn",
        {
          checkConstructors: false,
          checkGetters: false,
          checkSetters: false,
          contexts: [
            "ArrowFunctionExpression",
            "FunctionDeclaration",
            "FunctionExpression",
            "MethodDefinition",
          ],
        },
      ],

      // === Required @param ===
      "jsdoc/require-param": "warn",

      // === Required @param description ===
      "jsdoc/require-param-description": "warn",

      // === Required @returns ===
      "jsdoc/require-returns": "warn",
      "jsdoc/require-returns-description": "warn",
      "jsdoc/require-returns-check": "warn",

      // === Required @throws ===
      // The plan enables this; it will be refined when propagating @throws in step 5.
      "jsdoc/require-throws": "warn",

      // === @param validation ===
      // checkDestructured: false avoids flagging destructured params that aren't
      // individually documented (TS interfaces already describe the shape).
      "jsdoc/check-param-names": ["warn", { checkDestructured: false }],

      // === No type annotations in JSDoc (TSDoc style) ===
      "jsdoc/no-types": "error",

      // === Disable cosmetic/formatting rules that produce excessive noise ===
      "jsdoc/tag-lines": "off",
      "jsdoc/escape-inline-tags": "off",
    },
  },
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
    "scripts/**",
    "__tests__/fixtures/**",
    "*.log",
    ".env*",
  ]),
  // Allow CommonJS require() in Jest config and test files
  {
    files: [
      "jest.config.js",
      "jest.setup.js",
      "**/__tests__/**/*.ts",
      "**/__tests__/**/*.tsx",
    ],
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
  {
    files: ["app/page.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
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