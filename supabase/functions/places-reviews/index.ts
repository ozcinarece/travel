// places-reviews — #80 KK8: mekan panelinin Yorumlar sekmesi. Yalnız sekmeye dokununca çağrılır; Google en fazla 5 yorum
// verir (ek sayfa yok). Cevap bu izolatta 24 saat önbelleklenir (bellek); yorumlar DB'ye yazılmaz (PRD §7).
// #142 KK3: Google'a gitmeden önce günlük sınır (yorum_kotasi: api_sayac × panel ayarı `yorum_gunluk_sinir`); doluysa
// `{ sinir: true }` döner, uygulama sekmede "Google'da aç" gösterir. Kota cevabı izolatta 60 sn tutulur.
import { GoogleHatasi, yorumDetay, type YorumOzeti } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';
import { sayacli } from '../_shared/sayac.ts';

type Istek = { id: string };

const TTL_MS = 24 * 60 * 60 * 1000;
const onbellek = new Map<string, { zaman: number; deger: YorumOzeti }>();

const KOTA_TTL_MS = 60 * 1000;
let kota: { zaman: number; kullanilan: number; sinir: number | null } | null = null;
// Bu izolatın henüz sayaca yazılmamış istekleri de sayılır (kota okumasından sonra yapılanlar).
let kotaSonrasi = 0;

const kotaSonucu = () => !kota || kota.sinir === null || kota.kullanilan + kotaSonrasi < kota.sinir;

async function kotaVar(): Promise<boolean> {
  const simdi = Date.now();
  if (kota && simdi - kota.zaman < KOTA_TTL_MS) return kotaSonucu();
  const url = Deno.env.get('SUPABASE_URL');
  const anahtar = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anahtar) return true;
  try {
    const cevap = await fetch(`${url}/rest/v1/rpc/yorum_kotasi`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: anahtar, authorization: `Bearer ${anahtar}` },
      body: '{}',
    });
    if (!cevap.ok) throw new Error(`${cevap.status}`);
    const k = (await cevap.json()) as { kullanilan: number; sinir: number | null };
    kota = { zaman: simdi, kullanilan: k.kullanilan, sinir: k.sinir };
    kotaSonrasi = 0;
    return kotaSonucu();
  } catch (e) {
    // Kota okunamazsa yorumlar engellenmez (sayaç yine yazılır).
    console.error('yorum_kotasi', e);
    return true;
  }
}

Deno.serve(sayacli('places-reviews', async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;
  const g = await govde<Istek>(istek);
  if (typeof g.id !== 'string' || !g.id) return hata('id gerekli');
  const simdi = Date.now();
  const eski = onbellek.get(g.id);
  if (eski && simdi - eski.zaman < TTL_MS) return json(eski.deger);
  if (!(await kotaVar())) return json({ sinir: true });
  try {
    kotaSonrasi += 1;
    const ozet = await yorumDetay(g.id);
    onbellek.set(g.id, { zaman: simdi, deger: ozet });
    return json(ozet);
  } catch (e) {
    if (e instanceof GoogleHatasi) {
      console.error('places-reviews google', e.durum, e.message);
      return hata('yorumlar şu an alınamıyor', 502);
    }
    console.error('places-reviews', e);
    return hata('sunucu hatası', 500);
  }
}));
