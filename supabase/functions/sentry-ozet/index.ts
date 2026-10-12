// sentry-ozet — #110 KK4: backoffice "Günün özeti" için Sentry'deki son 24 saatlik hata sayısı. Yalnız admin çağırır
// (is_admin() kullanıcının kendi JWT'siyle sorulur). Secret'lar SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT (isteğe bağlı
// SENTRY_HOST, varsayılan sentry.io); tanımlı değilse { bagli: false } döner. Sonuç izolatta 10 dk önbelleklenir.
import { govde, hata, json, onKontrol } from '../_shared/http.ts';

const TTL_MS = 10 * 60 * 1000;
let onbellek: { zaman: number; hata: number } | null = null;

async function adminMi(yetki: string): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) return false;
  const cevap = await fetch(`${url}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: anon, authorization: yetki },
    body: '{}',
  });
  return cevap.ok && (await cevap.json()) === true;
}

Deno.serve(async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;
  await govde(istek);
  if (!(await adminMi(istek.headers.get('authorization') ?? ''))) return hata('yalnız admin', 403);
  const token = Deno.env.get('SENTRY_AUTH_TOKEN');
  const org = Deno.env.get('SENTRY_ORG');
  const proje = Deno.env.get('SENTRY_PROJECT');
  if (!token || !org || !proje) return json({ bagli: false });
  if (onbellek && Date.now() - onbellek.zaman < TTL_MS) return json({ bagli: true, hata: onbellek.hata });
  const host = Deno.env.get('SENTRY_HOST') || 'sentry.io';
  const simdi = Math.floor(Date.now() / 1000);
  const parametre = new URLSearchParams({ stat: 'received', since: String(simdi - 24 * 60 * 60), until: String(simdi), resolution: '1h' });
  try {
    const cevap = await fetch(`https://${host}/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(proje)}/stats/?${parametre}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!cevap.ok) {
      console.error('sentry-ozet', cevap.status, (await cevap.text()).slice(0, 200));
      return hata('Sentry şu an yanıt vermiyor', 502);
    }
    // [[zaman, adet], …] saatlik
    const seri = (await cevap.json()) as [number, number][];
    const toplam = seri.reduce((t, [, adet]) => t + (Number(adet) || 0), 0);
    onbellek = { zaman: Date.now(), hata: toplam };
    return json({ bagli: true, hata: toplam });
  } catch (e) {
    console.error('sentry-ozet', e);
    return hata('sunucu hatası', 500);
  }
});
