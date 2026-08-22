import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "scratch/**",
      "out/**",
      "next-env.d.ts",
      "check-db.js",
      "check.ts",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // The codebase uses `any` extensively at Prisma/JSON boundaries;
      // tightening this is a separate refactor. Keep it visible, not blocking.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // React Compiler-era hooks rules flag many legacy-but-working patterns
      // across view components. Migrating those is a dedicated refactor task;
      // keep the findings visible without blocking CI until then.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
];

export default eslintConfig;
