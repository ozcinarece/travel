// places-yenile — #262 (#205 KK3, Ece'nin kararı A): seyahat mekânlarının (`places`) Google koordinatı 30 günü geçmeden
// yenilenir. Yalnız service_role çağırır (günlük GitHub Actions işi, places-yenile.yml); kullanıcı oturumu ve anon anahtar
// 403 alır. İstek gövdesi okunmaz: place_id'ler yalnız veritabanından (`places_yenilenecekler`, 25 günü geçen, en eski önce)
// gelir. Her place_id için tek Place Details Essentials isteği (yalnız `location`); koordinat o place_id'nin bütün satırlarına
// yazılır. Sayaç kullanıcıların günlük Places sınırından ayrı ve aylık (`places_yenileme_artir`); 8.000'de durur.
// Log ve cevapta yalnız sayı vardır: place_id ya da koordinat yazılmaz.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleHatasi, konumYenile } from '../_shared/google.ts';
import { hata, json, onKontrol } from '../_shared/http.ts';
import { AYLIK_SINIR, bosSonuc, KONUM_MASKESI, konumAyikla, ozetSatiri, placeIdGecerli, TUR_BASINA } from '../_shared/placesYenile.ts';
import { sayacli } from '../_shared/sayac.ts';
import { servisMi } from '../_shared/servis.ts';

/** Art arda bu kadar Google hatasından sonra tur biter (anahtar ya da kota sorunu; boşuna istek gitmesin). */
const ART_ARDA_HATA = 5;

Deno.serve(
  sayacli('places-yenile', async (istek) => {
    const on = onKontrol(istek);
    if (on) return on;
    if (!(await servisMi(istek, { rpc: 'places_yenilenecekler', govde: { p_adet: 0 } }))) return hata('yalnız service_role', 403);
    const url = Deno.env.get('SUPABASE_URL');
    const anahtar = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anahtar) return hata('yapılandırma eksik', 500);
    const servis = createClient(url, anahtar, { auth: { persistSession: false, autoRefreshToken: false } });
    const sonuc = bosSonuc();

    const { data, error } = await servis.rpc('places_yenilenecekler', { p_adet: TUR_BASINA });
    if (error) {
      console.error('places-yenile: liste okunamadı', error.code ?? '');
      return hata('liste okunamadı', 500);
    }
    const adaylar = ((data ?? []) as { place_id: unknown }[]).map((r) => r.place_id);
    const gecerli = adaylar.filter(placeIdGecerli);
    sonuc.aday = adaylar.length;
    sonuc.hatali += adaylar.length - gecerli.length;
    if (gecerli.length === 0) {
      console.log(`places-yenile: ${ozetSatiri(sonuc)}`);
      return json(sonuc);
    }

    // Aylık sayaç Google isteğinden önce, bütün tur için bir kez artar; sığmazsa hiç istek gitmez.
    const { data: sigdi, error: sayacHatasi } = await servis.rpc('places_yenileme_artir', { p_adet: gecerli.length, p_sinir: AYLIK_SINIR });
    if (sayacHatasi) {
      console.error('places-yenile: sayaç okunamadı', sayacHatasi.code ?? '');
      return hata('sayaç okunamadı', 500);
    }
    if (sigdi !== true) {
      sonuc.durdu = true;
      const { data: ilk } = await servis.rpc('places_yenileme_durdu');
      sonuc.ilk_durma = ilk === true;
      console.log(`places-yenile: ${ozetSatiri(sonuc)}`);
      return json(sonuc);
    }

    let artArda = 0;
    for (const placeId of gecerli) {
      if (artArda >= ART_ARDA_HATA) break;
      try {
        const cevap = await konumYenile(placeId, KONUM_MASKESI);
        if (cevap === null) {
          sonuc.bulunamadi += 1;
          artArda = 0;
          continue;
        }
        const konum = konumAyikla(cevap);
        if (!konum) {
          sonuc.hatali += 1;
          artArda += 1;
          continue;
        }
        const { data: yazilan, error: yazmaHatasi } = await servis.rpc('places_koordinat_yenile', {
          p_place_id: placeId,
          p_lat: konum.lat,
          p_lng: konum.lng,
        });
        if (yazmaHatasi) {
          sonuc.hatali += 1;
          artArda += 1;
          continue;
        }
        sonuc.yenilenen += 1;
        sonuc.satir += typeof yazilan === 'number' ? yazilan : 0;
        artArda = 0;
      } catch (e) {
        sonuc.hatali += 1;
        artArda += 1;
        console.error('places-yenile: google', e instanceof GoogleHatasi ? e.durum : 'ag');
      }
    }
    console.log(`places-yenile: ${ozetSatiri(sonuc)}`);
    return json(sonuc);
  }),
);
