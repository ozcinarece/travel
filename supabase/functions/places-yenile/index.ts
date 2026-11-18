// places-yenile — #262 (#205 KK3, Ece'nin kararı A): kullanıcı tablolarının (places, trips şehri ve oteli, stays) Google
// koordinatı 30 günü geçmeden yenilenir; Google 404 dönen place_id'nin koordinatı hemen, 30 günü geçen her koordinat turun
// sonunda boşaltılır (satır silinmez; place_id ve kullanıcının yazdıkları kalır). Yalnız service_role çağırır (günlük GitHub Actions işi, places-yenile.yml); kullanıcı oturumu ve anon anahtar
// 403 alır. İstek gövdesi okunmaz: place_id'ler yalnız veritabanından (`places_yenilenecekler`, 25 günü geçen, en eski önce)
// gelir; o gün denenen place_id ikinci kez verilmez (son_deneme). Her place_id için tek Place Details Essentials isteği (yalnız `location`); koordinat o place_id'nin bütün satırlarına
// yazılır. Sayaç kullanıcıların günlük Places sınırından ayrı ve aylık (`places_yenileme_artir`); 8.000'de durur.
// Log ve cevapta yalnız sayı vardır: place_id ya da koordinat yazılmaz.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleHatasi, konumYenile } from '../_shared/google.ts';
import { hata, json, onKontrol } from '../_shared/http.ts';
import {
  ART_ARDA_HATA,
  AYLIK_SINIR,
  bosaltilanToplami,
  bosSonuc,
  KONUM_MASKESI,
  konumAyikla,
  ozetSatiri,
  placeIdGecerli,
  TUR_BASINA,
  turKesildi,
  type YenilemeSonucu,
} from '../_shared/placesYenile.ts';
import { sayacli } from '../_shared/sayac.ts';
import { servisMi } from '../_shared/servis.ts';

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

    // Her çıkışta (durma ve boş tur dahil) 30 günü geçen koordinatlar boşaltılır: Google koşulu süresiz ihlal edilmesin.
    // #318 inceleme 2: tur Google hatalarıyla kesildiyse (anahtar eksik ya da kısıtlı, kota) toplu boşaltma yapılmaz; bir
    // sonraki başarılı tura kalır (yenileme 25. günde başlar, 5 günlük pay var). Bu turdaki 404 boşaltmaları zaten yapıldı.
    const bitir = async (s: YenilemeSonucu) => {
      if (s.kesildi) {
        console.log(`places-yenile: ${ozetSatiri(s)}`);
        return json(s);
      }
      const { data: bos, error: bosHatasi } = await servis.rpc('places_koordinat_bosalt');
      if (bosHatasi) {
        s.hatali += 1;
        console.error('places-yenile: boşaltma', bosHatasi.code ?? '');
      } else {
        s.bosaltilan += bosaltilanToplami(bos);
      }
      console.log(`places-yenile: ${ozetSatiri(s)}`);
      return json(s);
    };

    const { data, error } = await servis.rpc('places_yenilenecekler', { p_adet: TUR_BASINA });
    if (error) {
      console.error('places-yenile: liste okunamadı', error.code ?? '');
      await bitir(sonuc);
      return hata('liste okunamadı', 500);
    }
    const adaylar = ((data ?? []) as { place_id: unknown }[]).map((r) => r.place_id);
    const gecerli = adaylar.filter(placeIdGecerli);
    sonuc.aday = adaylar.length;
    sonuc.hatali += adaylar.length - gecerli.length;
    if (gecerli.length === 0) return bitir(sonuc);

    // Aylık sayaç Google isteğinden önce, bütün tur için bir kez artar; sığmazsa hiç istek gitmez.
    const { data: sigdi, error: sayacHatasi } = await servis.rpc('places_yenileme_artir', { p_adet: gecerli.length, p_sinir: AYLIK_SINIR });
    if (sayacHatasi) {
      console.error('places-yenile: sayaç okunamadı', sayacHatasi.code ?? '');
      await bitir(sonuc);
      return hata('sayaç okunamadı', 500);
    }
    if (sigdi !== true) {
      sonuc.durdu = true;
      const { data: ilk } = await servis.rpc('places_yenileme_durdu');
      sonuc.ilk_durma = ilk === true;
      return bitir(sonuc);
    }

    let artArda = 0;
    let googleHatasi = 0;
    for (const placeId of gecerli) {
      if (artArda >= ART_ARDA_HATA) break;
      try {
        const cevap = await konumYenile(placeId, KONUM_MASKESI);
        if (cevap === null) {
          // 404: place_id artık yok → koordinatı hemen boşalt (satır kalır); listeden de çıkar.
          sonuc.bulunamadi += 1;
          artArda = 0;
          const { data: bos, error: bosHatasi } = await servis.rpc('places_koordinat_bosalt', { p_place_id: placeId });
          if (bosHatasi) sonuc.hatali += 1;
          else sonuc.bosaltilan += bosaltilanToplami(bos);
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
        googleHatasi += 1;
        console.error('places-yenile: google', e instanceof GoogleHatasi ? e.durum : 'ag');
      }
    }
    sonuc.kesildi = turKesildi({ artArda, googleHatasi, yenilenen: sonuc.yenilenen, bulunamadi: sonuc.bulunamadi });
    return bitir(sonuc);
  }),
);
