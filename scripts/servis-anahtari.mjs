// Zamanlanmış işler (kova-temizle, places-yenile) için service_role anahtarı: çalışma anında Yönetim API'sinden alınır,
// hemen maskelenir, rolü ve projesi doğrulanır. Hata olursa süreci 1 ile bitirir. Ortam: SUPABASE_ACCESS_TOKEN,
// SUPABASE_PROJECT_REF.

export async function servisAnahtari() {
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
  return { anahtar, ref: REF };
}
