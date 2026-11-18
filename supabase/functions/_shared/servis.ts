// Yalnız service_role'ün çağırdığı zamanlanmış işler (kova-temizle, places-yenile) için çağıran doğrulaması.
// Geçide (verify_jwt) güvenilmez: taşıyıcı ortamdaki service_role anahtarıyla aynıysa ya da PostgREST onu service_role kabul
// ediyorsa (yalnız service_role'e açık bir RPC, yan etkisiz bir gövdeyle çağrılabiliyorsa) yetkilidir.

/** Sabit zamanlı karşılaştırma (anahtar uzunluğu dışında bilgi sızdırmaz). */
function esit(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let fark = 0;
  for (let i = 0; i < x.length; i++) fark |= x[i] ^ y[i];
  return fark === 0;
}

/** `sinama`: yalnız service_role'e açık, verilen gövdeyle yan etkisiz bir RPC (ör. `kova_temizle_listesi(0)`). */
export async function servisMi(istek: Request, sinama: { rpc: string; govde: Record<string, unknown> }): Promise<boolean> {
  const token = (istek.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const servis = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (servis && esit(token, servis)) return true;
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) return false;
  try {
    const cevap = await fetch(`${url}/rest/v1/rpc/${sinama.rpc}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: token, authorization: `Bearer ${token}` },
      body: JSON.stringify(sinama.govde),
    });
    await cevap.body?.cancel();
    return cevap.ok;
  } catch {
    return false;
  }
}
