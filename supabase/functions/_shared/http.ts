// Edge Function ortak yardımcıları: CORS, JSON cevap, hata, kullanıcı doğrulama.
// Geçit (verify_jwt) yalnız JWT'nin imzasına bakar; yalın anon anahtar da geçer. #226: Places fonksiyonları ayrıca
// `kullaniciDogrula` ile oturumlu bir kullanıcı ister (anonim oturumla giren misafir dahil, `misafir: true`).
import { createClient } from 'npm:@supabase/supabase-js@2';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(govde: unknown, durum = 200): Response {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  });
}

export function hata(mesaj: string, durum = 400): Response {
  return json({ hata: mesaj }, durum);
}

/** OPTIONS ön uçuşu ve yöntem kontrolü; sorun yoksa null döner. */
export function onKontrol(istek: Request): Response | null {
  if (istek.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (istek.method !== 'POST') return hata('yalnızca POST', 405);
  if (!istek.headers.get('authorization')) return hata('oturum gerekli', 401);
  return null;
}

/** Doğrulanmış çağıran: kimliğin SHA-256 özeti (hex; kimlik açık yazılmaz, KK5) ve misafir mi. */
export type Kullanici = { ozet: string; misafir: boolean };

async function ozetle(metin: string): Promise<string> {
  const ham = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(metin));
  return [...new Uint8Array(ham)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * #226 KK1: `onKontrol` + çağıranın oturumu. JWT `getClaims` ile doğrulanır; `sub`'u olmayan ya da rolü `authenticated`
 * olmayan istek (yalnız anon anahtar) 401 alır. Başarılıysa kullanıcıyı, değilse hazır cevabı döner.
 */
export async function kullaniciDogrula(istek: Request): Promise<Kullanici | Response> {
  const on = onKontrol(istek);
  if (on) return on;
  const jeton = (istek.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!jeton || !url || !anon) return hata('oturum gerekli', 401);
  try {
    const istemci = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await istemci.auth.getClaims(jeton);
    const c = data?.claims as { sub?: string; role?: string; is_anonymous?: boolean } | undefined;
    if (error || !c?.sub || c.role !== 'authenticated') return hata('oturum gerekli', 401);
    return { ozet: await ozetle(c.sub), misafir: c.is_anonymous === true };
  } catch {
    return hata('oturum gerekli', 401);
  }
}

/** İstek gövdesini JSON olarak okur; bozuksa boş nesne. */
export async function govde<T extends Record<string, unknown>>(istek: Request): Promise<Partial<T>> {
  try {
    return (await istek.json()) as Partial<T>;
  } catch {
    return {};
  }
}
