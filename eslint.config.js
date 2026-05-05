import astro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".astro/**",
      ".wrangler/**",
      "public/**",
      "src/snaker/**",
    ],
  },
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
];
