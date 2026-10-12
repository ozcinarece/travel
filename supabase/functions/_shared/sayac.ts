// #110 API sayacı: her fonksiyon çağrısı (`cagri`) ve giden Google isteği (`google`) günlük toplanır (public.api_sayac).
// İzolat başına bellekte birikir, cevap gittikten sonra (waitUntil) tek RPC ile yazılır; yazılamazsa sonraki çağrıda
// yeniden denenir. Kullanıcı, yer ya da istek içeriği saklanmaz — yalnız gün × fonksiyon sayıları.

declare const EdgeRuntime: { waitUntil(is: Promise<unknown>): void } | undefined;

let fonksiyon = '';
let cagri = 0;
let google = 0;

/** Google'a giden her istek (Places, Photo, Routes) bir kez sayılır. */
export function googleSay(adet = 1) {
  google += adet;
}

async function bosalt() {
  const url = Deno.env.get('SUPABASE_URL');
  const anahtar = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anahtar || !fonksiyon || (cagri === 0 && google === 0)) return;
  const govde = { p_fonksiyon: fonksiyon, p_cagri: cagri, p_google: google };
  cagri = 0;
  google = 0;
  try {
    const cevap = await fetch(`${url}/rest/v1/rpc/api_sayac_artir`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: anahtar, authorization: `Bearer ${anahtar}` },
      body: JSON.stringify(govde),
    });
    if (!cevap.ok) throw new Error(`${cevap.status} ${(await cevap.text()).slice(0, 200)}`);
  } catch (e) {
    cagri += govde.p_cagri;
    google += govde.p_google;
    console.error('api_sayac', e);
  }
}

/** `Deno.serve(sayacli('places-full', async (istek) => …))`: POST çağrılarını sayar, cevaptan sonra yazar. */
export function sayacli(ad: string, isleyici: (istek: Request) => Promise<Response>) {
  fonksiyon = ad;
  return async (istek: Request): Promise<Response> => {
    if (istek.method === 'POST') cagri += 1;
    try {
      return await isleyici(istek);
    } finally {
      const is = bosalt();
      if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(is);
    }
  };
}
