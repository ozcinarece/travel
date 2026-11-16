// #234 KK4: günlük kova temizliği. kova-temizle Edge Function'ını service_role ile bir kez çağırır ve yalnız sayıları yazar
// (repo ve Actions logları herkese açık: trip_id, dosya adı ya da kullanıcı kimliği yazılmaz). service_role anahtarı
// çalışma anında Yönetim API'sinden alınır, rolü ve projesi doğrulanır, hemen maskelenir.
// Ortam: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, GITHUB_STEP_SUMMARY (isteğe bağlı).
import { appendFile } from 'node:fs/promises';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? '';
const REF = process.env.SUPABASE_PROJECT_REF ?? '';
if (!TOKEN || !REF) {
  console.error('SUPABASE_ACCESS_TOKEN ve SUPABASE_PROJECT_REF gerekli');
  process.exit(1);
}

const keys = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
  headers: { authorization: `Bearer ${TOKEN}` },
});
if (!keys.ok) {
  console.error(`api anahtarları alınamadı (${keys.status})`);
  process.exit(1);
}
const liste = await keys.json();
const anahtar = (Array.isArray(liste) ? liste : []).find((k) => k?.name === 'service_role' && typeof k.api_key === 'string')?.api_key;
if (!anahtar) {
  console.error('service_role anahtarı bulunamadı');
  process.exit(1);
}
console.log(`::add-mask::${anahtar}`);
let yuk = {};
try {
  yuk = JSON.parse(Buffer.from(anahtar.split('.')[1] ?? '', 'base64url').toString('utf8'));
} catch {
  // aşağıda reddedilir
}
if (yuk.role !== 'service_role' || yuk.ref !== REF) {
  console.error('service_role anahtarı doğrulanamadı (rol ya da proje farklı)');
  process.exit(1);
}

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
