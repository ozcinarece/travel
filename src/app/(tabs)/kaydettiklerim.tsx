import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FotoKutusu } from '@/components/gezi/GeziParcalari';
import { AnaGeziKarti } from '@/components/ortak/AnaGeziKarti';
import { Sekme, SekmeSatiri } from '@/components/ortak/Sekme';
import { Ikon } from '@/components/ui/Ikon';
import { TEKRAR_HIT_SLOP, useIosDuyuru } from '@/components/ui/EklemeDurumSatiri';
import { eklemeHatasi } from '@/features/ekleme/eklemeDurumu';
import { kapakTonu } from '@/features/anasayfa/v5';
import { useIcerikCanli } from '@/features/icerik/fotolar';
import { yerGruplari } from '@/features/icerik/kaydedilen';
import { icerikPlaceId, useGezilerIle, useKaydedilenler, useKaydet, useYerlerIle } from '@/features/icerik/sorgular';
import { hedefSeyahatler, useYerleriEkle, varsayilanHedef } from '@/features/icerik/yerEkle';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { yeniGirisNo } from '@/features/sihirbaz/girisler';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { useCevrimdisi } from '@/lib/baglanti';
import { yonelmeEkli } from '@/lib/ek';
import { kategoriEtiketi } from '@/lib/kategori';
import type { KaydedilenTuru, SeyahatOzet } from '@/lib/tipler';
import { anaV5, baslikStili, bosluk, minDokunma, renk, yazi } from '@/theme';

/**
 * #100 A → #144 → #395 (UX önerileri kanvası, `Sayfa_v5_Kaydettiklerim`): ‹ geri, "Kaydettiklerim" (28 px), altı çizili
 * sekmeler Geziler · N / Yerler · N. Geziler tek sütun `AnaGeziKarti` (büyük kapak, dolu ♥, 3 satır; kapaksızda `AmacKapagi`),
 * satırda Seyahatime al yok. Yerler şehirlere göre gruplu (başlıkta "{seyahat}'e ekle" ya da "Bu şehre seyahat kur"), her yer
 * sade satır: 56 px kare foto ya da kategori ikonu, ad, kategori, sağda ♥ → o seyahatin Keşfet'inde mekan paneli.
 * ♥ = kayıttan çıkar + altta "Geri al" (4 sn). Boş halde tek satır yazı ve "Keşfet'e göz at" bağlantısı.
 */
export default function KaydettiklerimEkrani() {
  const kaydedilenler = useKaydedilenler();
  const kaydet = useKaydet();
  const geziIdleri = useMemo(() => (kaydedilenler.data ?? []).filter((k) => k.tur === 'gezi').map((k) => k.hedef_id), [kaydedilenler.data]);
  const yerIdleri = useMemo(() => (kaydedilenler.data ?? []).filter((k) => k.tur === 'yer').map((k) => k.hedef_id), [kaydedilenler.data]);
  const geziler = useGezilerIle(geziIdleri);
  const yerler = useYerlerIle(yerIdleri);
  const [sekme, setSekme] = useState<KaydedilenTuru>('gezi');
  const seyahatler = useSeyahatler();
  const hedefler = useMemo(() => hedefSeyahatler(seyahatler.data), [seyahatler.data]);
  // Kalp sırası = kaydetme sırası (yeni önce).
  const sira = (tur: KaydedilenTuru) => new Map((kaydedilenler.data ?? []).filter((k) => k.tur === tur).map((k, i) => [k.hedef_id, i]));
  const geziListesi = useMemo(() => {
    const s0 = sira('gezi');
    return [...(geziler.data ?? [])].sort((a, b) => (s0.get(a.id) ?? 0) - (s0.get(b.id) ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geziler.data, kaydedilenler.data]);
  const gruplar = useMemo(
    () => yerGruplari(yerler.data ?? [], sira('yer'), t('kaydettiklerim.diger')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yerler.data, kaydedilenler.data],
  );
  const yerListesi = useMemo(() => gruplar.flatMap((g) => g.yerler), [gruplar]);
  const canli = useIcerikCanli(yerListesi, (y) => yerListesi.find((x) => x.id === y.id)?.sehirler?.ad ?? '', sekme === 'yer' && yerListesi.length > 0);
  const yerleriEkle = useYerleriEkle();
  const [mesgulGrup, setMesgulGrup] = useState<string | null>(null);

  // Kaldır + geri al bildirimi (4 sn); diğer bildirimler 3 sn.
  const [kaldirilan, setKaldirilan] = useState<{ tur: KaydedilenTuru; id: string } | null>(null);
  const [bildirim, setBildirim] = useState<string | null>(null);
  // #388 KK1: bağlantı hatasında bildirimde "Tekrar dene".
  const [tekrar, setTekrar] = useState<(() => void) | null>(null);
  // #388 KK5 (kanvas 23c): bağlantı yokken "listesine ekle" pasif.
  const cevrimdisi = useCevrimdisi();
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
  }, []);
  const goster = (b: { kaldirilan?: { tur: KaydedilenTuru; id: string }; metin?: string; tekrar?: () => void }) => {
    setKaldirilan(b.kaldirilan ?? null);
    setBildirim(b.metin ?? null);
    setTekrar(() => b.tekrar ?? null);
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(
      () => {
        setKaldirilan(null);
        setBildirim(null);
        setTekrar(null);
      },
      b.kaldirilan || b.tekrar ? 4000 : 3000,
    );
  };
  // #388 inceleme: çevrimdışıyken "listesine ekle" pasif; nedeni bantta (mevcut `ekleme.baglantiYok`, düğmesiz).
  const cevrimdisiEkle = cevrimdisi && sekme === 'yer' && gruplar.some((g) => !!g.sehirId && !!varsayilanHedef(hedefler, g.sehirAd));
  const bandMetni = bildirim ?? (kaldirilan ? t('kaydettiklerim.kaldirildi') : cevrimdisiEkle ? t('ekleme.baglantiYok') : '');
  // iOS'ta bildirim de duyurulur (Android'de bant yeni açılınca okunmuyor; iki platformda tek yol).
  useIosDuyuru(bildirim ?? (cevrimdisiEkle ? t('ekleme.baglantiYok') : null));
  const kaldir = (tur: KaydedilenTuru, id: string) => {
    kaydet.mutate({ tur, hedef_id: id, kayitli: true });
    goster({ kaldirilan: { tur, id } });
  };
  const geriAl = () => {
    if (!kaldirilan) return;
    kaydet.mutate({ tur: kaldirilan.tur, hedef_id: kaldirilan.id, kayitli: false });
    setKaldirilan(null);
  };

  const yerAc = (y: (typeof yerListesi)[number], hedef: SeyahatOzet | null) => {
    const c = canli.data?.get(y.id);
    if (hedef && c?.place_id) router.push({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: { id: hedef.id, mekan: c.place_id } });
    else goster({ metin: t('kaydettiklerim.seyahatYok') });
  };
  // KK3: grubun tamamı seyahatin listesine (mükerrer atlanır) ya da o şehre yeni seyahat (sihirbaz şehir seçili).
  const grubaEkle = async (g: (typeof gruplar)[number], hedef: SeyahatOzet) => {
    setMesgulGrup(g.sehirId);
    try {
      const satirlar = await Promise.all(
        g.yerler.map(async (y) => ({ yerId: y.id, place_id: canli.data?.get(y.id)?.place_id ?? (await icerikPlaceId(y, g.sehirAd)), primary_type: y.kategori, lat: y.lat, lng: y.lng })),
      );
      const sonuc = await yerleriEkle.mutateAsync({ seyahatId: hedef.id, yerler: satirlar });
      const ad = seyahatAdi(hedef);
      goster({
        metin:
          sonuc.eklenen === 0 ? t('kaydettiklerim.hepsiListede', { seyahat: ad }) : sonuc.zaten > 0 ? t('kaydettiklerim.eklendiZaten', { n: sonuc.eklenen, zaten: sonuc.zaten }) : t('kaydettiklerim.eklendi', { n: sonuc.eklenen, seyahat: ad }),
      });
    } catch (e) {
      // #388 KK1 · KK2: ham hata yalnız Sentry'ye.
      const durum = eklemeHatasi(e, 'kaydettiklerim-ekle', () => void grubaEkle(g, hedef));
      goster({ metin: durum.metin, tekrar: durum.tekrar });
    } finally {
      setMesgulGrup(null);
    }
  };
  // ‹: yığında önceki ekran varsa ona, yoksa (derin bağlantı) ana ekrana.
  const geri = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const sehreKur = (g: (typeof gruplar)[number]) => router.navigate({ pathname: '/(tabs)/yeni', params: { sehir: g.sehirId, yerler: g.yerler.map((y) => y.id).join(','), n: yeniGirisNo() } });

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <View style={s.ust}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={geri} style={({ pressed }) => [s.geri, pressed && { opacity: 0.7 }]}>
          <Ikon ad="geri" boyut={22} renk={renk.metin} kalinlik={2.4} />
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={s.baslik}>
        {t('kaydettiklerim.baslik')}
      </Text>
      <SekmeSatiri aralik={24}>
        <Sekme boyut={15} baslik={t('kaydettiklerim.geziler', { n: geziIdleri.length })} secili={sekme === 'gezi'} onPress={() => setSekme('gezi')} />
        <Sekme boyut={15} baslik={t('kaydettiklerim.yerler', { n: yerIdleri.length })} secili={sekme === 'yer'} onPress={() => setSekme('yer')} />
      </SekmeSatiri>
      <ScrollView contentContainerStyle={s.icerik}>
        {sekme === 'gezi' ? (
          geziIdleri.length === 0 || (geziler.isSuccess && geziListesi.length === 0) ? (
            <BosHal metin={t('kaydettiklerim.bosGezi')} />
          ) : (
            geziListesi.map((g) => (
              <AnaGeziKarti
                key={g.id}
                gezi={g}
                ton={kapakTonu(g.amaclar, null)}
                onAc={() => router.push({ pathname: '/gezi/[slug]', params: { slug: g.slug } })}
                onKalp={() => kaldir('gezi', g.id)}
              />
            ))
          )
        ) : yerIdleri.length === 0 || (yerler.isSuccess && yerListesi.length === 0) ? (
          <BosHal metin={t('kaydettiklerim.bosYer')} />
        ) : (
          gruplar.map((g) => {
            const hedef = g.sehirId ? varsayilanHedef(hedefler, g.sehirAd) : null;
            const hedefAd = hedef ? seyahatAdi(hedef) : '';
            const ekli = hedef ? yonelmeEkli(hedefAd) : null;
            return (
              <View key={g.sehirId || 'diger'} style={s.grup}>
                <View style={s.grupUst}>
                  <Text style={s.grupBaslik} numberOfLines={1}>
                    {g.sehirAd}
                    <Text style={s.grupSayi}>{t('kaydettiklerim.sehirSayi', { n: g.yerler.length })}</Text>
                  </Text>
                  {g.sehirId ? (
                    <Pressable accessibilityRole="button" accessibilityHint={hedef && cevrimdisi ? t('ekleme.baglantiYokIpucu') : undefined} disabled={mesgulGrup !== null || (!!hedef && cevrimdisi)} accessibilityState={{ disabled: mesgulGrup !== null || (!!hedef && cevrimdisi) }} onPress={() => (hedef ? grubaEkle(g, hedef) : sehreKur(g))} style={({ pressed }) => [s.grupDugme, pressed && { opacity: 0.85 }, !!hedef && cevrimdisi && { opacity: 0.4 }]}>
                      {mesgulGrup === g.sehirId ? (
                        <ActivityIndicator color={renk.metin} />
                      ) : (
                        <Text style={s.grupDugmeMetin} numberOfLines={1}>
                          {hedef ? (ekli ? t('kaydettiklerim.seyahateEkle', { seyahat: ekli }) : t('kaydettiklerim.seyahateEkleListe', { seyahat: hedefAd })) : t('kaydettiklerim.sehreKur')}
                        </Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
                {g.yerler.map((y) => {
                  const c = canli.data?.get(y.id);
                  // #172 KK7–KK9: kaydedilen yer bizim içeriğimiz — kategori DB'den, puan gösterilmez.
                  return (
                    <View key={y.id} style={s.yerSatiri}>
                      <Pressable accessibilityRole="button" accessibilityLabel={[y.ad, kategoriEtiketi(y.kategori)].filter(Boolean).join(', ')} onPress={() => yerAc(y, hedef)} style={({ pressed }) => [s.yerGovde, pressed && { opacity: 0.85 }]}>
                        <FotoKutusu uri={c?.foto_uri ?? null} tip={y.kategori} boyut={56} kose={12} />
                        <View style={s.yerMetin}>
                          <Text style={s.yerAd} numberOfLines={1}>
                            {y.ad}
                          </Text>
                          <Text style={s.yerAlt} numberOfLines={1}>
                            {kategoriEtiketi(y.kategori)}
                          </Text>
                        </View>
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={t('kaydettiklerim.kaldir')} onPress={() => kaldir('yer', y.id)} style={s.yerKalp}>
                        <Ikon ad="kalpDolu" boyut={22} renk={renk.vurgu} kalinlik={2.2} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
      {kaldirilan || bildirim || cevrimdisiEkle ? (
        <View style={s.bildirim}>
          <Text style={s.bildirimMetin}>{bandMetni}</Text>
          {kaldirilan ? (
            <Pressable accessibilityRole="button" onPress={geriAl} hitSlop={TEKRAR_HIT_SLOP}>
              <Text style={s.geriAl}>{t('kaydettiklerim.geriAl')}</Text>
            </Pressable>
          ) : tekrar ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setBildirim(null);
                setTekrar(null);
                tekrar();
              }}
              hitSlop={TEKRAR_HIT_SLOP}>
              <Text style={s.geriAl}>{t('ekleme.tekrarDene')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** KK5: tek satır yazı ve "Keşfet'e göz at" bağlantısı; çizim yok. */
function BosHal({ metin }: { metin: string }) {
  return (
    <View style={s.bos}>
      <Text style={s.bosMetin}>{metin}</Text>
      <Pressable accessibilityRole="link" onPress={() => router.navigate('/(tabs)')} hitSlop={10} style={({ pressed }) => [s.bosBaglanti, pressed && { opacity: 0.6 }]}>
        <Text style={s.bosBaglantiMetin}>{t('kaydettiklerim.kesfeteGozAt')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  // Kanvas: geri satırı 44 px, 16 px kenar; başlık 28 px 800, üstte 4 altta 6.
  ust: { paddingHorizontal: 16, height: minDokunma, justifyContent: 'center' },
  geri: { width: minDokunma, height: minDokunma, marginLeft: -11, alignItems: 'center', justifyContent: 'center' },
  baslik: { ...baslikStili(28), color: renk.metin, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6 },
  icerik: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 90, gap: 20 },
  bos: { paddingVertical: 24, gap: 6, alignItems: 'flex-start' },
  bosMetin: { fontFamily: yazi.normal, fontSize: 15, color: anaV5.ikincil },
  bosBaglanti: { minHeight: minDokunma, justifyContent: 'center' },
  bosBaglantiMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.ana, textDecorationLine: 'underline' },
  grup: { gap: 12, paddingBottom: 6 },
  yerSatiri: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  yerGovde: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  yerMetin: { flex: 1, minWidth: 0, gap: 1 },
  yerAd: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  yerAlt: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  yerKalp: { width: minDokunma, height: minDokunma, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  grupUst: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grupBaslik: { flex: 1, ...baslikStili(18), color: renk.metin },
  grupSayi: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ikincil },
  grupDugme: { height: 32, maxWidth: '62%', paddingHorizontal: 10, borderRadius: 10, backgroundColor: renk.vurgu, justifyContent: 'center' },
  grupDugmeMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.metin },
  bildirim: { position: 'absolute', left: bosluk.kenar, right: bosluk.kenar, bottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: renk.metin },
  bildirimMetin: { flex: 1, fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin },
  geriAl: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.vurgu },
});
