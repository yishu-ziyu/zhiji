import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "tmp/**",
    ".tmp/**",
    "node_modules/**",
    ".desktop-stage/**",
    ".electron-zip/**",
    "data/**",
    ".ship/**",
    "mcp-service/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
