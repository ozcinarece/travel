// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "supabase/functions/**"],
  },
  {
    // #390 (PRD §7): expo-image'ın varsayılanı disk önbelleği; Google fotoğrafı cihaza yazılmasın diye her fotoğraf
    // `@/components/ui/Foto` (Foto / GoogleFoto) ile çizilir. expo-image yalnız o sarmalayıcıda içe aktarılır.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/Foto.tsx", "src/**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "expo-image",
              importNames: ["Image", "ImageBackground"],
              message: "Fotoğrafı @/components/ui/Foto (Foto ya da GoogleFoto) ile çiz: Google fotoğrafı diske yazılmamalı (#390, PRD §7).",
            },
          ],
        },
      ],
    },
  },
]);
