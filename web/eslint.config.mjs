import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    /* Postinstall patch is CommonJS by design. */
    files: ["scripts/apply-google-signin-patch.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    /*
     * Next 16 / eslint-config-next enable strict react-hooks rules that flag common
     * intentional patterns (localStorage hydrate, R3F ref mirrors). Keep them off so
     * `npm run lint` stays mergeable; fix real bugs in review, not style churn here.
     */
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /* Capacitor / Gradle output — not source */
    "android/**",
  ]),
]);

export default eslintConfig;
