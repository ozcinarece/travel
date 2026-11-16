// route-matrix — PRD §5.1 / 3.7: gün bazlı yürüyüş matrisi (Routes API computeRouteMatrix, WALK).
// İstek: { trip_id, noktalar: [{key}] } (key = place_id | stay:<id> | 'hotel', ≤ 25 nokta).
// #246 KK1: koordinat istemciden alınmaz; anahtar bu seyahatin noktası olmalı, koordinat DB'den okunur (gövdedeki lat/lng yok
// sayılır). Seyahatte olmayan anahtar → 400, Google'a gidilmez. KK2: Google'a giden eleman sayısı (kaynak × hedef) `rota`
// sayacından geçer. KK3: walk_cache'e yalnız doğrulanmış anahtar çiftleri yazılır.
// walk_cache'ten (≤ 30 gün) okunur; yalnızca eksik çiftler Google'a sorulur ve service_role ile yazılır (T9).
// Üyelik: çağıranın JWT'siyle is_member(trip_id) RLS üzerinden doğrulanır.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { GoogleHatasi } from '../_shared/google.ts';
import { govde, hata, json, kullaniciDogrula } from '../_shared/http.ts';
import { matrisPlani } from '../_shared/matrisPlani.ts';
import { anahtarAl, noktalariCoz, noktalariOku } from '../_shared/rotaNoktalari.ts';
import { yuruyusMatrisi, type Bacak, type Nokta } from '../_shared/routes.ts';
import { sayacli } from '../_shared/sayac.ts';
import { sinirKontrol } from '../_shared/sinir.ts';

type Istek = { trip_id: string; noktalar: unknown[] };

const ONBELLEK_GUN = 30;

Deno.serve(sayacli('route-matrix', async (istek) => {
  const k = await kullaniciDogrula(istek);
  if (k instanceof Response) return k;
  const g = await govde<Istek>(istek);
  const tripId = typeof g.trip_id === 'string' ? g.trip_id : '';
  if (!/^[0-9a-f-]{36}$/.test(tripId)) return hata('trip_id geçersiz');
  const istenen = [...new Set((Array.isArray(g.noktalar) ? g.noktalar : []).map(anahtarAl).filter((x): x is string => x !== null))];
  if (istenen.length < 2) return json({ bacaklar: [] });
  if (istenen.length > 25) return hata('en fazla 25 nokta');

  const url = Deno.env.get('SUPABASE_URL')!;
  const kullanici = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: istek.headers.get('authorization')! } },
  });
  // RLS: üye değilse satır dönmez.
  const { data: seyahat, error: uyelikHatasi } = await kullanici.from('trips').select('id').eq('id', tripId).maybeSingle();
  if (uyelikHatasi) return hata('seyahat okunamadı', 500);
  if (!seyahat) return hata('seyahat bulunamadı', 404);

  const servis = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // #246 KK1: koordinat DB'den; seyahatte olmayan anahtar varsa Google'a gidilmez.
  let db: Awaited<ReturnType<typeof noktalariOku>>;
  try {
    db = await noktalariOku(servis, tripId, istenen);
  } catch {
    return hata('seyahat noktaları okunamadı', 500);
  }
  const cozum = noktalariCoz(istenen, db);
  if ('bilinmeyen' in cozum) return hata('nokta bu seyahatte yok');
  const dbNoktalari = cozum.noktalar;
  const noktalar: Nokta[] = istenen.map((a) => dbNoktalari.get(a)!);

  const esik = new Date(Date.now() - ONBELLEK_GUN * 86_400_000).toISOString();
  const anahtarlar = noktalar.map((n) => n.key);
  const { data: eski, error: onbellekHatasi } = await servis
    .from('walk_cache')
    .select('from_key, to_key, seconds, meters')
    .eq('trip_id', tripId)
    .in('from_key', anahtarlar)
    .in('to_key', anahtarlar)
    .gte('fetched_at', esik);
  if (onbellekHatasi) return hata('önbellek okunamadı', 500);

  const bilinen = new Map<string, Bacak>();
  for (const b of (eski ?? []) as Bacak[]) bilinen.set(`${b.from_key}>${b.to_key}`, b);

  // #253: eksik çiftler en ucuz planla istenir (tek dikdörtgen ya da yeni × hepsi + eski × yeni; en çok iki istek).
  // Plan dikdörtgen olduğu için eski noktalar arasında da boşluk varsa önbellekteki bazı çiftler yeniden istenir (ve faturalanır);
  // bunlar da plan.eleman'a, dolayısıyla sayaca dahildir.
  const plan = matrisPlani(anahtarlar, (a, b) => bilinen.has(`${a}>${b}`));

  // #246 KK2 / #253 KK2: Google eleman başına faturalar; sayaç planın gerçek eleman sayısıyla artar, sığmazsa 429.
  if (plan.eleman > 0) {
    const sinir = await sinirKontrol(k, 'rota', plan.eleman);
    if (sinir) return sinir;
  }

  const yazilacak: Bacak[] = [];
  const onbellegeYaz = async () => {
    if (yazilacak.length === 0) return;
    const { error } = await servis
      .from('walk_cache')
      .upsert(yazilacak.map((b) => ({ trip_id: tripId, ...b, fetched_at: new Date().toISOString() })), { onConflict: 'trip_id,from_key,to_key' });
    if (error) console.error('walk_cache upsert', error.message);
  };

  try {
    for (const p of plan.istekler) {
      const yeni = await yuruyusMatrisi(p.kaynaklar.map((a) => dbNoktalari.get(a)!), p.hedefler.map((a) => dbNoktalari.get(a)!));
      for (const b of yeni) {
        const anahtar = `${b.from_key}>${b.to_key}`;
        if (bilinen.has(anahtar)) continue;
        bilinen.set(anahtar, b);
        yazilacak.push(b);
      }
    }
    await onbellegeYaz();
    return json({ bacaklar: [...bilinen.values()] });
  } catch (e) {
    if (e instanceof GoogleHatasi) {
      console.error('route-matrix google', e.durum, e.message);
      // Gelen (faturalanan) istek önbelleğe yazıldı. Kısmi veri varsa onu döndür; istemci eksik bacaklar için kestirim kullanır (KK10 iskelet).
      await onbellegeYaz();
      return json({ bacaklar: [...bilinen.values()], eksik: true });
    }
    console.error('route-matrix', e);
    // #255: ağ hatası ya da bozuk yanıt ikinci istekte olsa bile ilk isteğin faturalanmış sonucu kaybolmasın; tekrar denemede
    // Google'a yeniden gidilmez.
    await onbellegeYaz();
    return hata('sunucu hatası', 500);
  }
}));
