// #189 Keşfet süzgecinin ayarları: yorum / puan eşikleri (yonetim_ayarlari.kesfet_esikleri) ve gizleme listesi (kesfet_gizli).
// Tek RPC (`kesfet_suzgec_ayarlari`, yalnız service_role) ile okunur; izolat belleğinde 60 sn tutulur — gizlenen yer en geç bir
// dakikada düşer. Okunamazsa Keşfet durmaz: son bilinen ayar, o da yoksa varsayılan eşikler ve boş liste (30 sn sonra yeniden).
import { esikleriCoz, VARSAYILAN_ESIKLER, type KesfetEsikleri } from './google.ts';

export type KesfetAyari = { esikler: KesfetEsikleri; gizli: ReadonlySet<string> };

const TTL_MS = 60 * 1000;
const HATA_TTL_MS = 30 * 1000;
let bellek: { zaman: number; ttl: number; deger: KesfetAyari } | null = null;

export async function kesfetAyari(): Promise<KesfetAyari> {
  const simdi = Date.now();
  if (bellek && simdi - bellek.zaman < bellek.ttl) return bellek.deger;
  const url = Deno.env.get('SUPABASE_URL');
  const anahtar = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  try {
    if (!url || !anahtar) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yok');
    const cevap = await fetch(`${url}/rest/v1/rpc/kesfet_suzgec_ayarlari`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: anahtar, authorization: `Bearer ${anahtar}` },
      body: '{}',
    });
    if (!cevap.ok) throw new Error(`${cevap.status} ${(await cevap.text()).slice(0, 200)}`);
    const g = (await cevap.json()) as { esikler?: unknown; gizli?: unknown };
    const gizli = new Set(Array.isArray(g.gizli) ? g.gizli.filter((x): x is string => typeof x === 'string') : []);
    bellek = { zaman: simdi, ttl: TTL_MS, deger: { esikler: esikleriCoz(g.esikler), gizli } };
  } catch (e) {
    console.error('kesfet_suzgec_ayarlari', e);
    bellek = { zaman: simdi, ttl: HATA_TTL_MS, deger: bellek?.deger ?? { esikler: VARSAYILAN_ESIKLER, gizli: new Set() } };
  }
  return bellek.deger;
}
