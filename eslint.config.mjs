import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Suppress set-state-in-effect (allow setState in useEffect — legacy React pattern)
  // Suppress react-hooks rules that come from react-hooks plugin but can't be targeted by name
  // Suppress no-explicit-any (used intentionally in jsPDF autoTable calls)
  { rules: {
    'react-hooks/exhaustive-deps': 'warn',
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/static-components': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
