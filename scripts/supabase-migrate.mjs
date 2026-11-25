// supabase/migrations/*.sql dosyalarını Supabase Yönetim API'siyle sırayla uygular.
// Gerekli ortam: SUPABASE_ACCESS_TOKEN (kişisel erişim token'ı), SUPABASE_PROJECT_REF.
// Uygulananlar supabase_migrations.schema_migrations tablosuna yazılır (Supabase CLI ile aynı tablo);
// yeniden çalıştırmak güvenlidir, yalnızca yeni dosyalar uygulanır.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error('SUPABASE_ACCESS_TOKEN ve SUPABASE_PROJECT_REF gerekli');
  process.exit(1);
}

async function sorgu(sql) {
  const cevap = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const metin = await cevap.text();
  if (!cevap.ok) throw new Error(`HTTP ${cevap.status}: ${metin.slice(0, 1000)}`);
  try {
    return JSON.parse(metin);
  } catch {
    return metin;
  }
}

await sorgu(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[],
    name text
  );
`);
const uygulanan = new Set((await sorgu('select version from supabase_migrations.schema_migrations')).map((s) => s.version));

const klasor = path.resolve('supabase/migrations');
const dosyalar = (await readdir(klasor)).filter((d) => d.endsWith('.sql')).sort();

// #494 bekçi (otomatik çalışmada VERI_SILEN_DURDUR=1): bekleyen (henüz uygulanmamış) migration'lardan biri veri
// silebiliyorsa hiçbirini uygulamadan dur. §4: geri dönüşsüz iş Ece onayıyla, elle (workflow_dispatch) gider.
// Yalnız bekleyen dosyalara bakılır; eskiden uygulanmış dosyalardaki kalıplar durdurmaz, önceki bir çalışmada
// düşüp bekleyen dosya da atlanmaz.
const VERI_SILEN = /\bdrop\s+table\b|\bdrop\s+column\b|\btruncate\b|\bdelete\s+from\b|\balter\s+column\s+\S+\s+(set\s+data\s+)?type\b/i;
if (process.env.VERI_SILEN_DURDUR === '1') {
  const riskli = [];
  for (const dosya of dosyalar) {
    if (uygulanan.has(dosya.split('_')[0])) continue;
    if (VERI_SILEN.test(await readFile(path.join(klasor, dosya), 'utf8'))) riskli.push(dosya);
  }
  if (riskli.length > 0) {
    console.error(
      `::error::veri silen migration: ece-karari gerekli, Ece onayından sonra elle (workflow_dispatch) çalıştırın (${riskli.join(', ')})`,
    );
    process.exit(1);
  }
}

let sayi = 0;
for (const dosya of dosyalar) {
  const surum = dosya.split('_')[0];
  const ad = dosya.slice(surum.length + 1, -4);
  if (uygulanan.has(surum)) {
    console.log(`atlandı (uygulanmış): ${dosya}`);
    continue;
  }
  const sql = await readFile(path.join(klasor, dosya), 'utf8');
  console.log(`uygulanıyor: ${dosya}`);
  try {
    // Tek istek = tek işlem: dosya ve schema_migrations kaydı ya birlikte uygulanır ya da hiçbiri.
    await sorgu(
      `${sql}\n;\ninsert into supabase_migrations.schema_migrations (version, name, statements) values ('${surum}', '${ad.replace(/'/g, "''")}', array[]::text[]);`,
    );
  } catch (e) {
    console.error(`HATA ${dosya}: ${e.message}`);
    process.exit(1);
  }
  sayi++;
}
console.log(sayi === 0 ? 'yeni migration yok' : `${sayi} migration uygulandı`);

const kontrol = await sorgu(`
  select to_regclass('public.profiles') is not null as profiles_var,
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'username_available') as rpc_var
`);
console.log('kontrol:', JSON.stringify(kontrol));
