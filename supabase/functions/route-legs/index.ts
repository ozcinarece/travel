// route-legs — #33: seçili günün bacakları için GERÇEK yol (Routes API computeRoutes, WALK; polyline).
// İstek: { trip_id, bacaklar: [{ from: {key, lat, lng}, to: {key, lat, lng} }] } (≤ 12 bacak).
// Yürüyüş > 40 dk olan bacak için aynı bacak DRIVE ile de alınır (mode 'DRIVE' = otomatik araba önerisi).
// #101 KK4: araba yolu ayrıca `arac: true` istenince (seçici açıldı) ya da bacak `bacak_modlari`nda araba seçiliyse alınır;
// `polyline` her zaman yürüme, `drive_polyline` araba (24 sa istemci / 30 gün sunucu önbelleği).
// Önbellek: walk_cache satırı (route-matrix ile aynı anahtar) polyline/mode/drive_* sütunlarıyla; ≤ 30 gün.
// Yalnızca polyline'ı eksik bacaklar (ya da arabası gerekip eksik olanlar) Google'a sorulur; service_role ile yazılır.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { GoogleHatasi } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';
import { rotaBacagi, type Nokta, type RotaModu } from '../_shared/routes.ts';
import { sayacli } from '../_shared/sayac.ts';

type IstekBacagi = { from: Nokta; to: Nokta };
type Istek = { trip_id: string; bacaklar: IstekBacagi[]; arac?: boolean };

type CevapBacagi = {
  from_key: string;
  to_key: string;
  /** Yürüyüş süresi/mesafesi (matrisle aynı anlam). */
  seconds: number;
  meters: number;
  mode: RotaModu;
  /** `mode`'a ait kodlu polyline. */
  polyline: string;
  /** Araç süresi/mesafesi — otomatik (> 40 dk), istenmiş (`arac`) ya da seçilmiş bacakta; yoksa null. */
  drive_seconds: number | null;
  drive_meters: number | null;
  /** #101: araba yolu (kodlu). */
  drive_polyline: string | null;
};

type Satir = CevapBacagi & { fetched_at?: string };

const ONBELLEK_GUN = 30;
const EN_FAZLA_BACAK = 12;
/** PRD §5.1 (güncel #33): bu süreyi aşan yürüyüş bacağı araçla alınır. */
const TAKSI_ESIGI_SN = 40 * 60;

const noktaMi = (n: unknown): n is Nokta =>
  !!n && typeof (n as Nokta).key === 'string' && (n as Nokta).key.length > 0 && Number.isFinite((n as Nokta).lat) && Number.isFinite((n as Nokta).lng);

Deno.serve(sayacli('route-legs', async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;
  const g = await govde<Istek>(istek);
  const tripId = typeof g.trip_id === 'string' ? g.trip_id : '';
  if (!/^[0-9a-f-]{36}$/.test(tripId)) return hata('trip_id geçersiz');
  const bacaklar = (Array.isArray(g.bacaklar) ? g.bacaklar : [])
    .filter((b): b is IstekBacagi => !!b && noktaMi(b.from) && noktaMi(b.to) && b.from.key !== b.to.key)
    .filter((b, i, dizi) => dizi.findIndex((x) => x.from.key === b.from.key && x.to.key === b.to.key) === i);
  if (bacaklar.length === 0) return json({ bacaklar: [] });
  if (bacaklar.length > EN_FAZLA_BACAK) return hata(`en fazla ${EN_FAZLA_BACAK} bacak`);
  const aracIstendi = g.arac === true;

  const url = Deno.env.get('SUPABASE_URL')!;
  const kullanici = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: istek.headers.get('authorization')! } },
  });
  const { data: seyahat, error: uyelikHatasi } = await kullanici.from('trips').select('id').eq('id', tripId).maybeSingle();
  if (uyelikHatasi) return hata('seyahat okunamadı', 500);
  if (!seyahat) return hata('seyahat bulunamadı', 404);

  const servis = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const esik = new Date(Date.now() - ONBELLEK_GUN * 86_400_000).toISOString();
  const anahtarlar = [...new Set(bacaklar.flatMap((b) => [b.from.key, b.to.key]))];
  const { data: eski, error: onbellekHatasi } = await servis
    .from('walk_cache')
    .select('from_key, to_key, seconds, meters, mode, polyline, drive_seconds, drive_meters, drive_polyline')
    .eq('trip_id', tripId)
    .in('from_key', anahtarlar)
    .in('to_key', anahtarlar)
    .gte('fetched_at', esik)
    .not('polyline', 'is', null);
  if (onbellekHatasi) return hata('önbellek okunamadı', 500);

  const bilinen = new Map<string, CevapBacagi>();
  for (const s of (eski ?? []) as Satir[]) bilinen.set(`${s.from_key}>${s.to_key}`, { ...s, mode: (s.mode ?? 'WALK') as RotaModu, drive_polyline: s.drive_polyline ?? null });

  // #101: araba seçili bacaklar (bacak_modlari) — araba yolu bunlar için de alınır.
  const { data: secimler } = await servis.from('bacak_modlari').select('from_key, to_key, mod').eq('trip_id', tripId).eq('mod', 'araba');
  const arabaSecili = new Set((secimler ?? []).map((x: { from_key: string; to_key: string }) => `${x.from_key}>${x.to_key}`));
  const aracGerekli = (b: IstekBacagi, yuruyusSn: number) => yuruyusSn > TAKSI_ESIGI_SN || aracIstendi || arabaSecili.has(`${b.from.key}>${b.to.key}`);

  let eksik = false;
  const yeni: CevapBacagi[] = [];
  await Promise.all(
    bacaklar.map(async (b) => {
      const cift = `${b.from.key}>${b.to.key}`;
      try {
        let satir = bilinen.get(cift);
        if (!satir) {
          const yuruyus = await rotaBacagi(b.from, b.to, 'WALK');
          if (!yuruyus) return;
          satir = {
            from_key: b.from.key,
            to_key: b.to.key,
            seconds: yuruyus.seconds,
            meters: yuruyus.meters,
            // mode = otomatik öneri: 40 dk üstü araba.
            mode: yuruyus.seconds > TAKSI_ESIGI_SN ? 'DRIVE' : 'WALK',
            polyline: yuruyus.polyline,
            drive_seconds: null,
            drive_meters: null,
            drive_polyline: null,
          };
        } else if (!aracGerekli(b, satir.seconds) || satir.drive_polyline) return;
        if (aracGerekli(b, satir.seconds) && !satir.drive_polyline) {
          const arac = await rotaBacagi(b.from, b.to, 'DRIVE');
          if (arac) satir = { ...satir, drive_seconds: arac.seconds, drive_meters: arac.meters, drive_polyline: arac.polyline };
        }
        yeni.push(satir);
      } catch (e) {
        if (e instanceof GoogleHatasi) {
          console.error('route-legs google', e.durum, e.message);
          eksik = true;
        } else throw e;
      }
    }),
  );
  for (const s of yeni) bilinen.set(`${s.from_key}>${s.to_key}`, s);
  if (yeni.length > 0) {
    const simdi = new Date().toISOString();
    const { error } = await servis.from('walk_cache').upsert(yeni.map((s) => ({ trip_id: tripId, ...s, fetched_at: simdi })), { onConflict: 'trip_id,from_key,to_key' });
    if (error) console.error('walk_cache upsert (route-legs)', error.message);
  }
  return json({ bacaklar: bacaklar.map((b) => bilinen.get(`${b.from.key}>${b.to.key}`)).filter(Boolean), ...(eksik ? { eksik: true } : {}) });
}));
