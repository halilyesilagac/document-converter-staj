import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Bu dosyada kod kalite kurallarini yonetiyorum.
// Next'in kendi onerdigi kurallari temel alip, gereksiz klasorleri tarama disi biraktim.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Next'in varsayilan ignore listesini burada acikca veriyorum.
  globalIgnores([
    // Build ciktilari ve uretilen dosyalar:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
