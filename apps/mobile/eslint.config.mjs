import path from "path";
import { fileURLToPath } from "url";

import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  // Wrap the legacy config in compatibility layer
  // We'll use a relative path to the tooling config to avoid package resolution issues in flat config
  ...compat.extends("../../tooling/eslint/index.js"),
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      "react/react-in-jsx-scope": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    ignores: ["node_modules/", ".expo/", ".turbo/", "dist/"],
  },
];
