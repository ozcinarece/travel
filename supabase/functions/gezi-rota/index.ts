// gezi-rota — #192: önerilen gezinin bir günü için GERÇEK yol (Routes API computeRoutes WALK, ara noktalı tek istek). İstek:
// { gezi_gun_id }. Günün ardışık durakları arasındaki bacakların hepsi önbellekte (gezi_rota_onbellek, ≤ 30 gün) varsa Google'a
// gidilmez; biri bile eksik ya da eskiyse gün tek istekte yeniden hesaplanır ve yazılır (service_role). Yürüyüşü 40 dk'yı aşan
// bacak ayrıca DRIVE ile alınır (mevcut bacak modu kuralı; route-legs ile aynı eşik). Yayınlı gezide herkes (anon dahil)
// çağırabilir; yayınlanmamış gezide (BO önizleme) yalnız admin. Cevap yalnız çağırana döner.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { GoogleHatasi } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';
import { gunRotasi, rotaBacagi, type Nokta } from '../_shared/routes.ts';
import { sayacli } from '../_shared/sayac.ts';

type Istek = { gezi_gun_id: string };

/** gezi_rota_onbellek satırı (istemciye aynı biçimde döner). */
type Satir = {
  gezi_gun_id: string;
  kimden_durak_id: string;
  kime_durak_id: string;
  mod: 'WALK' | 'DRIVE';
  polyline: string;
  saniye: number;
  metre: number;
  arac_saniye: number | null;
  arac_metre: number | null;
  arac_polyline: string | null;
  fetched_at: string;
};

const ONBELLEK_GUN = 30;
/** PRD §5.1 (#33): bu süreyi aşan yürüyüş bacağı araçla alınır (route-legs ile aynı). */
const TAKSI_ESIGI_SN = 40 * 60;
const SUTUNLAR = 'gezi_gun_id, kimden_durak_id, kime_durak_id, mod, polyline, saniye, metre, arac_saniye, arac_metre, arac_polyline, fetched_at';

Deno.serve(sayacli('gezi-rota', async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;
  const g = await govde<Istek>(istek);
  const gunId = typeof g.gezi_gun_id === 'string' ? g.gezi_gun_id : '';
  if (!/^[0-9a-f-]{36}$/.test(gunId)) return hata('gezi_gun_id geçersiz');

  const url = Deno.env.get('SUPABASE_URL')!;
  const servis = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Gün + duraklar (sıralı) ve yetki: yayınlı gezi herkese, taslak yalnız admine.
  const { data: gun, error: gunHata } = await servis
    .from('gezi_gunleri')
    .select('id, gezi_id, gezi_duraklari!gezi_duraklari_gezi_gun_id_fkey(id, sira, lat, lng)')
    .eq('id', gunId)
    .maybeSingle();
  if (gunHata) return hata('sunucu hatası', 500);
  if (!gun) return hata('gün bulunamadı', 404);
  const { data: yayinda } = await servis.rpc('gezi_yayinda', { p_gezi: gun.gezi_id });
  if (!yayinda) {
    const kullanici = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: istek.headers.get('authorization')! } } });
    const { data: admin } = await kullanici.rpc('is_admin');
    if (admin !== true) return hata('gün bulunamadı', 404);
  }

  const duraklar = ((gun.gezi_duraklari ?? []) as { id: string; sira: number; lat: number; lng: number }[]).sort((a, b) => a.sira - b.sira);
  const ciftler = duraklar.slice(1).map((b, i) => ({ a: duraklar[i], b }));
  if (ciftler.length === 0) return json({ bacaklar: [] });

  // Önbellek. Hesap gerekmez: (a) bütün bacaklar taze, ya da (b) gün bu 30 gün içinde hesaplanmış — satırların hepsi taze ve
  // güncel çiftlere ait (duraklar değişince tetikleyici günü boşaltır) ama bazı bacakların yolu Google'da çıkmamış. (b) olmasa
  // yolu olmayan bacak her açılışta Google'a yeniden sorulurdu (KK8).
  const sinir = Date.now() - ONBELLEK_GUN * 24 * 60 * 60 * 1000;
  const { data: eski } = await servis.from('gezi_rota_onbellek').select(SUTUNLAR).eq('gezi_gun_id', gunId);
  const anahtar = (k: string, z: string) => `${k}>${z}`;
  const guncel = new Set(ciftler.map((c) => anahtar(c.a.id, c.b.id)));
  const onceki = (eski ?? []) as Satir[];
  const taze = onceki.filter((s) => Date.parse(s.fetched_at) >= sinir);
  const bilinen = new Map(taze.map((s) => [anahtar(s.kimden_durak_id, s.kime_durak_id), s]));
  const hazir = ciftler.map((c) => bilinen.get(anahtar(c.a.id, c.b.id)));
  const tamam = hazir.every(Boolean);
  const hesaplanmis = onceki.length > 0 && taze.length === onceki.length && onceki.every((s) => guncel.has(anahtar(s.kimden_durak_id, s.kime_durak_id)));
  if (tamam || hesaplanmis) return json({ bacaklar: hazir.filter(Boolean), onbellek: true, ...(tamam ? {} : { eksik: true }) });

  // Gün tek istekte (11 bacaktan uzunsa parçalı) yeniden hesaplanır; 40 dk'yı aşan bacak için ayrıca DRIVE (alınamazsa yürüyüş
  // yolu yine yazılır; Program'daki route-legs araç yolunu sonra tamamlar).
  try {
    const nokta = (d: { id: string; lat: number; lng: number }): Nokta => ({ key: d.id, lat: d.lat, lng: d.lng });
    const yuruyus = await gunRotasi(duraklar.map(nokta), 'WALK');
    const simdi = new Date().toISOString();
    const satirlar = (
      await Promise.all(
        ciftler.map(async ({ a, b }, i): Promise<Satir | null> => {
          const w = yuruyus[i];
          if (!w) return null;
          const uzun = w.seconds > TAKSI_ESIGI_SN;
          let arac: Awaited<ReturnType<typeof rotaBacagi>> = null;
          if (uzun) {
            try {
              arac = await rotaBacagi(nokta(a), nokta(b), 'DRIVE');
            } catch (e) {
              if (!(e instanceof GoogleHatasi)) throw e;
              console.error('gezi-rota google (DRIVE)', e.durum, e.message);
            }
          }
          return {
            gezi_gun_id: gunId,
            kimden_durak_id: a.id,
            kime_durak_id: b.id,
            // route-legs ile aynı anlam: mode otomatik öneridir (yürüyüş 40 dk'yı aşarsa DRIVE); araç yolu ayrı sütunlarda.
            mod: uzun ? 'DRIVE' : 'WALK',
            polyline: w.polyline,
            saniye: w.seconds,
            metre: w.meters,
            arac_saniye: arac?.seconds ?? null,
            arac_metre: arac?.meters ?? null,
            arac_polyline: arac?.polyline ?? null,
            fetched_at: simdi,
          };
        }),
      )
    ).filter((x): x is Satir => !!x);
    // Günün eski satırları (sırası değişmiş çiftler dahil) atılır, yenileri yazılır. Yazılamazsa cevap yine döner.
    // Aynı anda açan iki kişi yarışırsa upsert çakışmaz (son yazan kalır).
    const { error: silHata } = await servis.from('gezi_rota_onbellek').delete().eq('gezi_gun_id', gunId);
    const { error: yazHata } =
      silHata || satirlar.length === 0 ? { error: silHata } : await servis.from('gezi_rota_onbellek').upsert(satirlar, { onConflict: 'gezi_gun_id,kimden_durak_id,kime_durak_id' });
    if (yazHata) console.error('gezi-rota yazım', yazHata.message);
    return json({ bacaklar: satirlar, onbellek: false, ...(satirlar.length < ciftler.length ? { eksik: true } : {}) });
  } catch (e) {
    if (e instanceof GoogleHatasi) {
      console.error('gezi-rota google', e.durum, e.message);
      // Kısmi önbellek varsa onu döndür; istemci eksik bacakları düz çizgiyle gösterir.
      return json({ bacaklar: hazir.filter(Boolean), onbellek: true, eksik: true });
    }
    console.error('gezi-rota', e);
    return hata('sunucu hatası', 500);
  }
}));
