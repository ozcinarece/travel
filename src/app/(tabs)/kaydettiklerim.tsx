import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { Ikon } from '@/components/ui/Ikon';
import { useIcerikCanli } from '@/features/icerik/fotolar';
import { useGezilerIle, useKaydedilenler, useKaydet, useYerlerIle } from '@/features/icerik/sorgular';
import { hedefSeyahatler } from '@/features/icerik/yerEkle';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { t } from '@/i18n';
import { kategoriPini } from '@/lib/pinIkonu';
import type { Gezi, KaydedilenTuru } from '@/lib/tipler';
import { bosluk, renk, yazi } from '@/theme';

const ZEMINLER = ['#2f6fed', '#f2783f', '#12a37a', '#8a4fd6', '#e0457b', '#0ea5e9'];

/**
 * #100 A (kanvas SavedGuide16 ekran 1): Profil → Kaydettiklerim — iki çip (Geziler · N / Yerler · N). Gezi satırı: foto 96×72 +
 * "N GÜNLÜK" rozeti, ad, şehir · mekan, sağda dolu kalp (dokununca kaldırır; alt bildirimde "Geri al"). Yerler: 2 sütun foto
 * karoları (ad, şehir) → mekan paneli (#80, yaklaşan seyahatin Keşfet'inde).
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
  const hedef = useMemo(() => hedefSeyahatler(seyahatler.data)[0] ?? null, [seyahatler.data]);
  // Kalp sırası = kaydetme sırası (yeni önce).
  const sira = (tur: KaydedilenTuru) => new Map((kaydedilenler.data ?? []).filter((k) => k.tur === tur).map((k, i) => [k.hedef_id, i]));
  const geziListesi = useMemo(() => {
    const s0 = sira('gezi');
    return [...(geziler.data ?? [])].sort((a, b) => (s0.get(a.id) ?? 0) - (s0.get(b.id) ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geziler.data, kaydedilenler.data]);
  const yerListesi = useMemo(() => {
    const s0 = sira('yer');
    return [...(yerler.data ?? [])].sort((a, b) => (s0.get(a.id) ?? 0) - (s0.get(b.id) ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yerler.data, kaydedilenler.data]);
  const canli = useIcerikCanli(yerListesi, (y) => yerListesi.find((x) => x.id === y.id)?.sehirler?.ad ?? '', sekme === 'yer' && yerListesi.length > 0);

  // KK2: kaldır + geri al bildirimi (4 sn).
  const [kaldirilan, setKaldirilan] = useState<{ tur: KaydedilenTuru; id: string } | null>(null);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
  }, []);
  const kaldir = (tur: KaydedilenTuru, id: string) => {
    kaydet.mutate({ tur, hedef_id: id, kayitli: true });
    setKaldirilan({ tur, id });
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => setKaldirilan(null), 4000);
  };
  const geriAl = () => {
    if (!kaldirilan) return;
    kaydet.mutate({ tur: kaldirilan.tur, hedef_id: kaldirilan.id, kayitli: false });
    setKaldirilan(null);
  };
  const [bildirim, setBildirim] = useState<string | null>(null);
  const yerAc = (y: (typeof yerListesi)[number]) => {
    const c = canli.data?.get(y.id);
    if (hedef && c?.place_id) router.push({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: { id: hedef.id, mekan: c.place_id } });
    else {
      setBildirim(t('kaydettiklerim.seyahatYok'));
      setTimeout(() => setBildirim(null), 2500);
    }
  };

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      {/* #138 KK6: Kaydettiklerim alt menüde sekme (geri yok). */}
      <EkranBasligi baslik={t('kaydettiklerim.baslik')} alt={t('kaydettiklerim.alt')} />
      <View style={s.cipler}>
        <Cip baslik={t('kaydettiklerim.geziler', { n: geziIdleri.length })} secili={sekme === 'gezi'} onPress={() => setSekme('gezi')} />
        <Cip baslik={t('kaydettiklerim.yerler', { n: yerIdleri.length })} secili={sekme === 'yer'} onPress={() => setSekme('yer')} />
      </View>
      <ScrollView contentContainerStyle={s.icerik}>
        {sekme === 'gezi' ? (
          geziIdleri.length === 0 || (geziler.isSuccess && geziListesi.length === 0) ? (
            <Text style={s.bos}>{t('kaydettiklerim.bosGezi')}</Text>
          ) : (
            geziListesi.map((g, i) => <GeziSatiri key={g.id} gezi={g} sira={i} onPress={() => router.push({ pathname: '/gezi/[slug]', params: { slug: g.slug } })} onKaldir={() => kaldir('gezi', g.id)} />)
          )
        ) : yerIdleri.length === 0 || (yerler.isSuccess && yerListesi.length === 0) ? (
          <Text style={s.bos}>{t('kaydettiklerim.bosYer')}</Text>
        ) : (
          <View style={s.mozaik}>
            {[0, 1].map((sutun) => (
              <View key={sutun} style={s.sutun}>
                {yerListesi
                  .filter((_, i) => i % 2 === sutun)
                  .map((y) => {
                    const c = canli.data?.get(y.id);
                    return (
                      <Pressable key={y.id} accessibilityRole="button" accessibilityLabel={y.ad} onPress={() => yerAc(y)} style={({ pressed }) => [s.karo, { backgroundColor: kategoriPini(c?.hafif?.primary_type ?? y.kategori).kategoriRenk }, pressed && { opacity: 0.9 }]}>
                        {c?.foto_uri ? <Image source={{ uri: c.foto_uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
                        <View style={s.karoGolge} />
                        <Pressable accessibilityRole="button" accessibilityLabel={t('kaydettiklerim.kaldir')} onPress={() => kaldir('yer', y.id)} hitSlop={6} style={s.karoKalp}>
                          <Ikon ad="kalpDolu" boyut={16} renk={renk.vurgu} kalinlik={2.2} />
                        </Pressable>
                        <View style={s.karoMetin}>
                          <Text style={s.karoAd} numberOfLines={1}>
                            {y.ad}
                          </Text>
                          <Text style={s.karoSehir} numberOfLines={1}>
                            {y.sehirler?.ad ?? ''}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      {kaldirilan || bildirim ? (
        <View style={s.bildirim}>
          <Text style={s.bildirimMetin}>{bildirim ?? t('kaydettiklerim.kaldirildi')}</Text>
          {kaldirilan && !bildirim ? (
            <Pressable accessibilityRole="button" onPress={geriAl} hitSlop={8}>
              <Text style={s.geriAl}>{t('kaydettiklerim.geriAl')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function GeziSatiri({ gezi, sira, onPress, onKaldir }: { gezi: Gezi; sira: number; onPress: () => void; onKaldir: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={gezi.baslik} onPress={onPress} style={({ pressed }) => [s.satir, pressed && { opacity: 0.85 }]}>
      <View style={[s.satirFoto, { backgroundColor: ZEMINLER[sira % ZEMINLER.length] }]}>
        {gezi.kapak_url ? <Image source={{ uri: gezi.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
        <View style={s.rozet}>
          <Text style={s.rozetMetin}>{t('kaydettiklerim.gunluk', { n: gezi.gun_sayisi })}</Text>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={s.satirAd} numberOfLines={2}>
          {gezi.baslik}
        </Text>
        <Text style={s.satirAlt} numberOfLines={1}>
          {t('kaydettiklerim.sehirMekan', { sehir: gezi.sehirler?.ad ?? '', n: gezi.mekan_sayisi })}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('kaydettiklerim.kaldir')} onPress={onKaldir} hitSlop={6} style={s.satirKalp}>
        <Ikon ad="kalpDolu" boyut={16} renk={renk.vurgu} kalinlik={2.2} />
      </Pressable>
    </Pressable>
  );
}

function Cip({ baslik, secili, onPress }: { baslik: string; secili: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: secili }} onPress={onPress} style={[s.cip, secili && s.cipSecili]}>
      <Text style={[s.cipMetin, secili && { color: renk.zemin }]}>{baslik}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  cipler: { flexDirection: 'row', gap: 8, paddingHorizontal: bosluk.kenar, paddingTop: 14, paddingBottom: 4 },
  cip: { height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#f6f6f4', justifyContent: 'center' },
  cipSecili: { backgroundColor: renk.metin },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 12.5, color: renk.metin },
  icerik: { paddingBottom: 90, gap: 0 },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingHorizontal: bosluk.kenar, paddingVertical: 24 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: bosluk.kenar, paddingVertical: 10 },
  satirFoto: { width: 96, height: 72, borderRadius: 12, overflow: 'hidden' },
  rozet: { position: 'absolute', left: 8, top: 8, height: 20, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(15,15,15,0.75)', justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 9.5, letterSpacing: 0.5, color: renk.zemin },
  satirAd: { fontFamily: yazi.ekstra, fontSize: 14.5, color: renk.metin },
  satirAlt: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  satirKalp: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f6f6f4', alignItems: 'center', justifyContent: 'center' },
  mozaik: { flexDirection: 'row', gap: 10, paddingHorizontal: bosluk.kenar, paddingTop: 10 },
  sutun: { flex: 1, gap: 10 },
  karo: { height: 110, borderRadius: 14, overflow: 'hidden', justifyContent: 'flex-end' },
  karoGolge: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,15,15,0.3)' },
  karoKalp: { position: 'absolute', right: 8, top: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  karoMetin: { padding: 10, gap: 1 },
  karoAd: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.zemin },
  karoSehir: { fontFamily: yazi.kalin, fontSize: 11, color: 'rgba(255,255,255,0.9)' },
  bildirim: { position: 'absolute', left: bosluk.kenar, right: bosluk.kenar, bottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: renk.metin },
  bildirimMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin },
  geriAl: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.vurgu },
});
