// #243 KK1: cihaza yalnız izin listesindeki (bizim tablolarımızdan gelen) sorgular yazılır; Google sorguları yazılmaz.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { describe, expect, it } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';

import { SEYAHAT_ALANLARI } from '@/features/seyahatler/alanlar';

import { kaliciSecenekler, ONBELLEK_ANAHTARI, ONBELLEK_OMRU_MS, profilKilitli, saklanabilir, saklananlariAyarla, seridenCoz, seriyeCevir } from '../kaliciOnbellek';

/** Uygulamada Google'dan (Edge Function üzerinden) gelen sorguların anahtarları. */
const GOOGLE = [['hafif-yerler', 'x'], ['tam-yer', 'p1'], ['place-foto', 'p1'], ['yer-foto', 'p1'], ['yorumlar', 'p1'], ['mekan-ozeti', 'p1']];
const BIZIM = [['profil', 'u1'], ['seyahatler'], ['mekanlar', 's1'], ['icerik-mekan', ['p1']], ['seyahat', 's1'], ['gunler', 's1'], ['duraklar', 's1'], ['icerik', 'yerler', 'c1'], ['icerik', 'rehber', 'c1'], ['icerik', 'yer-rehber', 'p1']];

describe('kalıcı önbellek (#243 KK1)', () => {
  it('izin listesi: bizim sorgularımız saklanır, Google sorguları ve diğerleri saklanmaz', () => {
    for (const k of BIZIM) expect(saklanabilir(k)).toBe(true);
    for (const k of GOOGLE) expect(saklanabilir(k)).toBe(false);
    expect(saklanabilir(['icerik', 'kesfet-akisi'])).toBe(false);
    expect(saklanabilir(['mesajlar', 's1'])).toBe(false);
    // stays.label'da eski Google adları olabilir (#250): konaklamalar cihaza yazılmaz.
    expect(saklanabilir(['konaklamalar', 's1'])).toBe(false);
  });

  it("saklanan `seyahat` sorgusu Google'dan gelmiş olabilecek otel alanlarını okumaz (#250)", () => {
    const alanlar = SEYAHAT_ALANLARI.split(',').map((a) => a.trim());
    for (const g of ['hotel_label', 'hotel_place_id', 'hotel_lat', 'hotel_lng']) expect(alanlar).not.toContain(g);
    expect(alanlar).toContain('invite_token');
  });

  it("AsyncStorage'a yazılan JSON'da Google sorgu anahtarı yok; bizimkiler var ve geri yüklenir", async () => {
    const qc = new QueryClient();
    saklananlariAyarla(qc);
    for (const k of [...BIZIM, ...GOOGLE]) qc.setQueryData(k, { k: k.join('/') });
    qc.setQueryData(['icerik-mekan', ['p1']], new Map([['p1', { ad: 'Kurşunlu Külliyesi' }]]));
    await persistQueryClientSave({ queryClient: qc, ...kaliciSecenekler });
    // Yazım kısılmış (throttle); bekle.
    await new Promise((r) => setTimeout(r, 1100));
    const ham = await AsyncStorage.getItem(ONBELLEK_ANAHTARI);
    expect(ham).toBeTruthy();
    const kayit = JSON.parse(ham!) as { clientState: { queries: { queryKey: unknown[] }[] } };
    const anahtarlar = kayit.clientState.queries.map((q) => JSON.stringify(q.queryKey));
    for (const k of GOOGLE) {
      expect(anahtarlar).not.toContain(JSON.stringify(k));
      expect(ham).not.toContain(k[0]);
    }
    for (const k of BIZIM) expect(anahtarlar).toContain(JSON.stringify(k));

    const yeni = new QueryClient();
    await persistQueryClientRestore({ queryClient: yeni, ...kaliciSecenekler });
    expect(yeni.getQueryData(['seyahat', 's1'])).toEqual({ k: 'seyahat/s1' });
    expect(yeni.getQueryData(['tam-yer', 'p1'])).toBeUndefined();
    // KK5: bizim mekan adlarımız (Map) geri yüklenince yine Map.
    expect(yeni.getQueryData<Map<string, unknown>>(['icerik-mekan', ['p1']])).toBeInstanceOf(Map);
    // 7 günlük gc zamanlayıcıları test sürecini açık tutmasın.
    qc.clear();
    yeni.clear();
  });

  it('saklanan sorgular bellekte en az 7 gün kalır; diğerlerinin süresi değişmez', () => {
    const qc = new QueryClient();
    saklananlariAyarla(qc);
    expect(qc.getQueryDefaults(['gunler', 's1']).gcTime).toBe(ONBELLEK_OMRU_MS);
    expect(qc.getQueryDefaults(['tam-yer', 'p1']).gcTime).toBeUndefined();
  });

  it('KK2: önbellekte profil varken okuma hatası kilitlemez; profil hiç yoksa ya da oluşturulamadıysa kilitler', () => {
    expect(profilKilitli({ hata: true, profil: { id: 'u1' }, olusturulamadi: false })).toBe(false);
    expect(profilKilitli({ hata: true, profil: undefined, olusturulamadi: false })).toBe(true);
    expect(profilKilitli({ hata: false, profil: null, olusturulamadi: true })).toBe(true);
    expect(profilKilitli({ hata: false, profil: { id: 'u1' }, olusturulamadi: false })).toBe(false);
  });
});

describe('Map serileştirme (#243 KK5)', () => {
  it('Map gidip gelir; düz nesne ve dizi değişmez', () => {
    const veri = { m: new Map([['a', { ad: 'x' }]]), d: [1, 2], n: { k: 'v' } };
    const geri = seridenCoz(seriyeCevir(veri)) as typeof veri;
    expect(geri.m).toBeInstanceOf(Map);
    expect(geri.m.get('a')).toEqual({ ad: 'x' });
    expect(geri.d).toEqual([1, 2]);
    expect(geri.n).toEqual({ k: 'v' });
  });
});
