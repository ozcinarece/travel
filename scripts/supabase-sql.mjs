// Supabase Yönetim API'siyle tek seferlik SQL çalıştırır (tanı amaçlı; CI'da postgres rolüyle).
// Kullanım: SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… node scripts/supabase-sql.mjs "select 1"
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
const sql = process.argv.slice(2).join(' ').trim();
if (!token || !ref || !sql) {
  console.error('SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF ve SQL gerekli');
  process.exit(1);
}
const cevap = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const metin = await cevap.text();
console.log(`HTTP ${cevap.status}`);
console.log(metin.slice(0, 20000));
process.exit(cevap.ok ? 0 : 1);
