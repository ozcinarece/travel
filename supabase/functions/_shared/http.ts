// Edge Function ortak yardımcıları: CORS, JSON cevap, hata.
// Kimlik doğrulama Supabase geçidinde (verify_jwt) yapılır; anonim oturumlar da geçerli JWT taşır.

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

/** İstek gövdesini JSON olarak okur; bozuksa boş nesne. */
export async function govde<T extends Record<string, unknown>>(istek: Request): Promise<Partial<T>> {
  try {
    return (await istek.json()) as Partial<T>;
  } catch {
    return {};
  }
}
