// route-matrix — PRD §5.1 / 3.7: gün bazlı yürüyüş matrisi (Routes API computeRouteMatrix, WALK).
// İstek: { trip_id, noktalar: [{key, lat, lng}] } (key = place_id | 'hotel', ≤ 25 nokta).
// walk_cache'ten (≤ 30 gün) okunur; yalnızca eksik çiftler Google'a sorulur ve service_role ile yazılır (T9).
// Üyelik: çağıranın JWT'siyle is_member(trip_id) RLS üzerinden doğrulanır.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { GoogleHatasi } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';
import { yuruyusMatrisi, type Bacak, type Nokta } from '../_shared/routes.ts';

type Istek = { trip_id: string; noktalar: Nokta[] };

const ONBELLEK_GUN = 30;

Deno.serve(async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;
  const g = await govde<Istek>(istek);
  const tripId = typeof g.trip_id === 'string' ? g.trip_id : '';
  if (!/^[0-9a-f-]{36}$/.test(tripId)) return hata('trip_id geçersiz');
  const noktalar = (Array.isArray(g.noktalar) ? g.noktalar : [])
    .filter((n): n is Nokta => !!n && typeof n.key === 'string' && n.key.length > 0 && Number.isFinite(n.lat) && Number.isFinite(n.lng))
    .filter((n, i, dizi) => dizi.findIndex((x) => x.key === n.key) === i);
  if (noktalar.length < 2) return json({ bacaklar: [] });
  if (noktalar.length > 25) return hata('en fazla 25 nokta');

  const url = Deno.env.get('SUPABASE_URL')!;
  const kullanici = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: istek.headers.get('authorization')! } },
  });
  // RLS: üye değilse satır dönmez.
  const { data: seyahat, error: uyelikHatasi } = await kullanici.from('trips').select('id').eq('id', tripId).maybeSingle();
  if (uyelikHatasi) return hata('seyahat okunamadı', 500);
  if (!seyahat) return hata('seyahat bulunamadı', 404);

  const servis = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
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

  // Eksik çiftler: yalnız eksik satırların/sütunların kesişimini sor (eleman başına fatura, T9).
  const eksikKaynak = new Set<string>();
  const eksikHedef = new Set<string>();
  for (const a of noktalar) {
    for (const b of noktalar) {
      if (a.key !== b.key && !bilinen.has(`${a.key}>${b.key}`)) {
        eksikKaynak.add(a.key);
        eksikHedef.add(b.key);
      }
    }
  }

  try {
    if (eksikKaynak.size > 0) {
      const yeni = await yuruyusMatrisi(
        noktalar.filter((n) => eksikKaynak.has(n.key)),
        noktalar.filter((n) => eksikHedef.has(n.key)),
      );
      const yazilacak = yeni.filter((b) => !bilinen.has(`${b.from_key}>${b.to_key}`));
      for (const b of yeni) bilinen.set(`${b.from_key}>${b.to_key}`, b);
      if (yazilacak.length > 0) {
        const { error } = await servis
          .from('walk_cache')
          .upsert(yazilacak.map((b) => ({ trip_id: tripId, ...b, fetched_at: new Date().toISOString() })), { onConflict: 'trip_id,from_key,to_key' });
        if (error) console.error('walk_cache upsert', error.message);
      }
    }
    return json({ bacaklar: [...bilinen.values()] });
  } catch (e) {
    if (e instanceof GoogleHatasi) {
      console.error('route-matrix google', e.durum, e.message);
      // Kısmi veri varsa onu döndür; istemci eksik bacaklar için kestirim kullanır (KK10 iskelet).
      return json({ bacaklar: [...bilinen.values()], eksik: true });
    }
    console.error('route-matrix', e);
    return hata('sunucu hatası', 500);
  }
});
