// #234 KK4: günlük kova temizliği. kova-temizle Edge Function'ını service_role ile bir kez çağırır ve yalnız sayıları yazar
// (repo ve Actions logları herkese açık: trip_id, dosya adı ya da kullanıcı kimliği yazılmaz). service_role anahtarı
// çalışma anında Yönetim API'sinden alınır, rolü ve projesi doğrulanır, hemen maskelenir.
// Ortam: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, GITHUB_STEP_SUMMARY (isteğe bağlı).
import { appendFile } from 'node:fs/promises';

import { servisAnahtari } from './servis-anahtari.mjs';

const { anahtar, ref: REF } = await servisAnahtari();

const cevap = await fetch(`https://${REF}.supabase.co/functions/v1/kova-temizle`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${anahtar}`,
    apikey: anahtar,
    'content-type': 'application/json',
  },
  body: '{}',
});
const j = await cevap.json().catch(() => ({}));
const sayi = (v) => (Number.isInteger(v) ? v : '?');
const satir = `klasör ${sayi(j.klasor)} · kapanan ${sayi(j.kapanan)} · dosya ${sayi(j.dosya)} · hata ${sayi(j.hatali)}`;
console.log(`HTTP ${cevap.status} · ${satir}`);
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Kova temizliği (#234)\n- HTTP ${cevap.status} · ${satir}\n`);
process.exit(cevap.ok && j.hatali === 0 ? 0 : 1);
