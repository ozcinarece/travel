// kova-temizle — #234 KK3: silinen seyahatlerin `sohbet` ve `fisler` klasörlerini Storage API ile siler. Yalnız service_role
// çağırır (günlük GitHub Actions işi, kova-temizle.yml); kullanıcı oturumu ve anon anahtar 403 alır. İstek gövdesi
// okunmaz: silinecek klasörler yalnız kuyruktan (`kova_temizle_listesi`, en çok 50) gelir, önek kuyruk satırından kurulur.
// Klasör boşalınca `kova_temizle_bitir` satırı kapatır; yarıda kalan klasör sonraki turda devam eder. Log ve cevapta yalnız
// sayı vardır: trip_id, dosya adı ya da kullanıcı kimliği yazılmaz (KK5).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { hata, json, onKontrol } from '../_shared/http.ts';
import { onekKur, parcala, silinecekler, type KuyrukSatiri } from '../_shared/kovaTemizle.ts';

/** Sabit zamanlı karşılaştırma (anahtar uzunluğu dışında bilgi sızdırmaz). */
function esit(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let fark = 0;
  for (let i = 0; i < x.length; i++) fark |= x[i] ^ y[i];
  return fark === 0;
}

/**
 * Taşıyıcı ortamdaki service_role anahtarıyla aynıysa ya da PostgREST onu service_role kabul ediyorsa (yalnız service_role'e
 * açık `kova_temizle_listesi(0)` çağrılabiliyorsa) yetkilidir. Geçide (verify_jwt) güvenilmez.
 */
async function servisMi(istek: Request): Promise<boolean> {
  const token = (istek.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const servis = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (servis && esit(token, servis)) return true;
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) return false;
  try {
    const cevap = await fetch(`${url}/rest/v1/rpc/kova_temizle_listesi`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: token, authorization: `Bearer ${token}` },
      body: JSON.stringify({ p_adet: 0 }),
    });
    await cevap.body?.cancel();
    return cevap.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;
  if (!(await servisMi(istek))) return hata('yalnız service_role', 403);
  const url = Deno.env.get('SUPABASE_URL');
  const anahtar = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anahtar) return hata('yapılandırma eksik', 500);
  const servis = createClient(url, anahtar, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await servis.rpc('kova_temizle_listesi', { p_adet: 50 });
  if (error) {
    console.error('kova-temizle: liste okunamadı', error.code ?? '');
    return hata('kuyruk okunamadı', 500);
  }
  const sayi = { klasor: 0, kapanan: 0, dosya: 0, hatali: 0 };
  for (const satir of (data ?? []) as KuyrukSatiri[]) {
    const yol = onekKur(satir);
    if (!yol) {
      sayi.hatali += 1;
      continue;
    }
    sayi.klasor += 1;
    let tamam = true;
    for (const parca of parcala(silinecekler(yol.onek, satir.dosyalar))) {
      const { data: silinen, error: silmeHatasi } = await servis.storage.from(yol.kova).remove(parca);
      if (silmeHatasi) {
        tamam = false;
        sayi.hatali += 1;
        break;
      }
      sayi.dosya += silinen?.length ?? 0;
    }
    if (!tamam) continue;
    const { data: kapandi, error: bitirHatasi } = await servis.rpc('kova_temizle_bitir', { p_kova: yol.kova, p_trip_id: satir.trip_id });
    if (bitirHatasi) sayi.hatali += 1;
    else if (kapandi === true) sayi.kapanan += 1;
  }
  console.log(`kova-temizle: klasör ${sayi.klasor} · kapanan ${sayi.kapanan} · dosya ${sayi.dosya} · hata ${sayi.hatali}`);
  return json(sayi);
});
