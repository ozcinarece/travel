// #550: web uçtan uca testleri (e2e/). Önce web çıktısı derlenir:
//   EXPO_PUBLIC_SUPABASE_URL=https://ornek.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=ornek npm run web:derle
// sonra `npm run e2e`. Supabase taklit edilir (e2e/supabaseTaklidi.ts); gerçek veri yok. Tarayıcı kurulu Chromium.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4310);

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'pixel', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `node e2e/sunucu.mjs ${process.env.WEB_DIST ?? 'dist'} ${PORT}`,
    url: `http://127.0.0.1:${PORT}/r/${'Ab3dE5gH'}`,
    reuseExistingServer: !process.env.CI,
  },
});
