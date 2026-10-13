import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GeziAlYukleyici } from '@/components/icerik/GeziAl';
import { Ikon } from '@/components/ui/Ikon';
import { SegmentSecici } from '@/components/ui/SegmentSecici';
import { useIcerikCanli } from '@/features/icerik/fotolar';
import { yerGruplari } from '@/features/icerik/kaydedilen';
import { icerikPlaceId, useGezilerIle, useKaydedilenler, useKaydet, useYerlerIle } from '@/features/icerik/sorgular';
import { hedefSeyahatler, useYerleriEkle, varsayilanHedef } from '@/features/icerik/yerEkle';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { yeniGirisNo } from '@/features/sihirbaz/girisler';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { yonelmeEkli } from '@/lib/ek';
import { kategoriEtiketi } from '@/lib/kategori';
import { kategoriPini } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import type { Gezi, KaydedilenTuru, SeyahatOzet } from '@/lib/tipler';
import { bosluk, renk, yazi } from '@/theme';

const ZEMINLER = ['#c9d2f2', '#ffe2cc', '#dce6ff', '#d7f0e6', '#e6e0fa'];

/**
 * #100 A → #144 (kanvas 21 · 21b): Kaydettiklerim — segment Geziler · N / Yerler · N. Gezi satırı: 72 px kapak + "2 GÜN",
 * ad, şehir · mekan, doğrudan [Seyahatime al] (#143 alt sayfası), kalp = kaydedilenlerden çıkar (4 sn Geri al). Yerler şehirlere
 * göre gruplu: başlıkta "{seyahat}'e ekle" (aynı şehirdeki en yakın tarihli seyahat; grubun tamamı, mükerrer atlanır) ya da
 * "Bu şehre seyahat kur" (sihirbaz şehir seçili, mekanlar listede); 2 sütun kart → o seyahatin Keşfet'inde mekan paneli.
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
  const [alSlug, setAlSlug] = useState<string | null>(null);
  const [mesgulGrup, setMesgulGrup] = useState<string | null>(null);

  // Kaldır + geri al bildirimi (4 sn); diğer bildirimler 3 sn.
  const [kaldirilan, setKaldirilan] = useState<{ tur: KaydedilenTuru; id: string } | null>(null);
  const [bildirim, setBildirim] = useState<string | null>(null);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
  }, []);
  const goster = (b: { kaldirilan?: { tur: KaydedilenTuru; id: string }; metin?: string }) => {
    setKaldirilan(b.kaldirilan ?? null);
    setBildirim(b.metin ?? null);
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(
      () => {
        setKaldirilan(null);
        setBildirim(null);
      },
      b.kaldirilan ? 4000 : 3000,
    );
  };
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
        g.yerler.map(async (y) => ({ yerId: y.id, place_id: canli.data?.get(y.id)?.place_id ?? (await icerikPlaceId(y, g.sehirAd)), primary_type: canli.data?.get(y.id)?.hafif?.primary_type ?? y.kategori, lat: y.lat, lng: y.lng })),
      );
      const sonuc = await yerleriEkle.mutateAsync({ seyahatId: hedef.id, yerler: satirlar });
      const ad = seyahatAdi(hedef);
      goster({
        metin:
          sonuc.eklenen === 0 ? t('kaydettiklerim.hepsiListede', { seyahat: ad }) : sonuc.zaten > 0 ? t('kaydettiklerim.eklendiZaten', { n: sonuc.eklenen, zaten: sonuc.zaten }) : t('kaydettiklerim.eklendi', { n: sonuc.eklenen, seyahat: ad }),
      });
    } catch (e) {
      goster({ metin: t('kaydettiklerim.eklemeHata', { sebep: e instanceof Error ? e.message : String(e) }) });
    } finally {
      setMesgulGrup(null);
    }
  };
  const sehreKur = (g: (typeof gruplar)[number]) => router.navigate({ pathname: '/(tabs)/yeni', params: { sehir: g.sehirId, yerler: g.yerler.map((y) => y.id).join(','), n: yeniGirisNo() } });

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      {/* #138 KK6: Kaydettiklerim alt menüde sekme (geri yok). */}
      <Text accessibilityRole="header" style={s.baslik}>
        {t('kaydettiklerim.baslik')}
      </Text>
      <View style={s.segment}>
        <SegmentSecici
          buyuk
          deger={sekme}
          onDeger={setSekme}
          secenekler={[
            { deger: 'gezi', etiket: t('kaydettiklerim.geziler', { n: geziIdleri.length }) },
            { deger: 'yer', etiket: t('kaydettiklerim.yerler', { n: yerIdleri.length }) },
          ]}
        />
      </View>
      <ScrollView contentContainerStyle={s.icerik}>
        {sekme === 'gezi' ? (
          geziIdleri.length === 0 || (geziler.isSuccess && geziListesi.length === 0) ? (
            <Text style={s.bos}>{t('kaydettiklerim.bosGezi')}</Text>
          ) : (
            geziListesi.map((g, i) => (
              <GeziSatiri
                key={g.id}
                gezi={g}
                sira={i}
                onPress={() => router.push({ pathname: '/gezi/[slug]', params: { slug: g.slug } })}
                onAl={() => setAlSlug(g.slug)}
                onKaldir={() => kaldir('gezi', g.id)}
              />
            ))
          )
        ) : yerIdleri.length === 0 || (yerler.isSuccess && yerListesi.length === 0) ? (
          <Text style={s.bos}>{t('kaydettiklerim.bosYer')}</Text>
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
                    <Pressable accessibilityRole="button" disabled={mesgulGrup !== null} onPress={() => (hedef ? grubaEkle(g, hedef) : sehreKur(g))} style={({ pressed }) => [s.grupDugme, pressed && { opacity: 0.85 }]}>
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
                {/* 2 sütun: çiftler halinde satır; tek kalan kart yarım genişlikte. */}
                {g.yerler
                  .filter((_, i) => i % 2 === 0)
                  .map((y, i) => [y, g.yerler[i * 2 + 1]] as const)
                  .map(([sol, sag]) => (
                    <View key={sol.id} style={s.izgaraSatir}>
                      {[sol, sag].map((y, k) => {
                        if (!y) return <View key={k} style={s.kart} />;
                        const c = canli.data?.get(y.id);
                        const puan = puanMetni(c?.hafif?.puan);
                        const tur = c?.hafif?.primary_type ?? y.kategori;
                        return (
                          <Pressable key={y.id} accessibilityRole="button" accessibilityLabel={y.ad} onPress={() => yerAc(y, hedef)} style={({ pressed }) => [s.kart, pressed && { opacity: 0.9 }]}>
                            <View style={[s.kartFoto, { backgroundColor: kategoriPini(tur).kategoriRenk }]}>
                              {c?.foto_uri ? <Image source={{ uri: c.foto_uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
                              <Pressable accessibilityRole="button" accessibilityLabel={t('kaydettiklerim.kaldir')} onPress={() => kaldir('yer', y.id)} hitSlop={6} style={s.kartKalp}>
                                <Ikon ad="kalpDolu" boyut={18} renk={renk.vurgu} kalinlik={2.2} />
                              </Pressable>
                            </View>
                            <Text style={s.kartAd} numberOfLines={2}>
                              {y.ad}
                            </Text>
                            <Text style={s.kartAlt} numberOfLines={1}>
                              {[kategoriEtiketi(tur), puan ? `★ ${puan}` : null].filter(Boolean).join(' · ')}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
              </View>
            );
          })
        )}
      </ScrollView>
      {kaldirilan || bildirim ? (
        <View style={s.bildirim}>
          <Text style={s.bildirimMetin}>{bildirim ?? t('kaydettiklerim.kaldirildi')}</Text>
          {kaldirilan ? (
            <Pressable accessibilityRole="button" onPress={geriAl} hitSlop={8}>
              <Text style={s.geriAl}>{t('kaydettiklerim.geriAl')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {alSlug ? <GeziAlYukleyici slug={alSlug} onKapat={() => setAlSlug(null)} /> : null}
    </SafeAreaView>
  );
}

function GeziSatiri({ gezi, sira, onPress, onAl, onKaldir }: { gezi: Gezi; sira: number; onPress: () => void; onAl: () => void; onKaldir: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={gezi.baslik} onPress={onPress} style={({ pressed }) => [s.satir, pressed && { opacity: 0.85 }]}>
      <View style={[s.satirFoto, { backgroundColor: ZEMINLER[sira % ZEMINLER.length] }]}>
        {gezi.kapak_url ? <Image source={{ uri: gezi.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
        <Text style={s.rozet}>{t('kaydettiklerim.gunluk', { n: gezi.gun_sayisi })}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
        <Text style={s.satirAd} numberOfLines={2}>
          {gezi.baslik}
        </Text>
        <Text style={s.satirAlt} numberOfLines={1}>
          {t('kaydettiklerim.sehirMekan', { sehir: gezi.sehirler?.ad ?? '', n: gezi.mekan_sayisi })}
        </Text>
        <Pressable accessibilityRole="button" onPress={onAl} hitSlop={4} style={({ pressed }) => [s.al, pressed && { opacity: 0.85 }]}>
          <Text style={s.alMetin}>{t('kaydettiklerim.seyahatimeAl')}</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('kaydettiklerim.kaldir')} onPress={onKaldir} hitSlop={6} style={s.satirKalp}>
        <Ikon ad="kalpDolu" boyut={18} renk={renk.vurgu} kalinlik={2.2} />
      </Pressable>
    </Pressable>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  baslik: { fontFamily: yazi.baslik, fontSize: 30, letterSpacing: -0.9, color: renk.metin, paddingHorizontal: bosluk.kenar, paddingTop: 14 },
  segment: { paddingHorizontal: bosluk.kenar, paddingTop: 14 },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 18, paddingBottom: 90, gap: 14 },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 24 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  satirFoto: { width: 72, height: 72, borderRadius: 16, overflow: 'hidden' },
  rozet: { position: 'absolute', left: 6, bottom: 6, height: 20, lineHeight: 20, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden', backgroundColor: renk.ana, color: renk.zemin, fontFamily: yazi.ekstra, fontSize: 10 },
  satirAd: { fontFamily: yazi.baslik, fontSize: 16, letterSpacing: -0.2, color: renk.metin },
  satirAlt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  al: { marginTop: 6, height: 30, paddingHorizontal: 10, borderRadius: 9, backgroundColor: renk.vurgu, justifyContent: 'center' },
  alMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.metin },
  satirKalp: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff1e6', alignItems: 'center', justifyContent: 'center' },
  grup: { gap: 10, paddingBottom: 6 },
  grupUst: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grupBaslik: { flex: 1, fontFamily: yazi.baslik, fontSize: 18, color: renk.metin },
  grupSayi: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ikincil },
  grupDugme: { height: 32, maxWidth: '62%', paddingHorizontal: 10, borderRadius: 10, backgroundColor: renk.vurgu, justifyContent: 'center' },
  grupDugmeMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.metin },
  izgaraSatir: { flexDirection: 'row', gap: 12 },
  kart: { flex: 1, gap: 6 },
  kartFoto: { height: 104, borderRadius: 16, overflow: 'hidden' },
  kartKalp: { position: 'absolute', right: 6, top: 6, width: 34, height: 34, borderRadius: 10, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 14, lineHeight: 17, color: renk.metin },
  kartAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil, marginTop: -4 },
  bildirim: { position: 'absolute', left: bosluk.kenar, right: bosluk.kenar, bottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: renk.metin },
  bildirimMetin: { flex: 1, fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin },
  geriAl: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.vurgu },
});
