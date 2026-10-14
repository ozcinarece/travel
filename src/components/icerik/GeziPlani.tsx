// #97 B KK2 → #143 KK2 (kanvas 17 · Rota & plan): gün çipleri ("1. gün · 6"; seçili gün renginde dolu, diğerleri çerçeveli +
// renk noktası), seçili günün mini haritası (büyüt), gün özeti ("5 sa 40 dk · 3,4 km yürüyüş"), numaralı duraklar (foto 46,
// ad, kategori · süre, EkleDugmesi) ve aralarında noktalı çizgiyle "N dk yürüyüş". #192: süreler ve çizgi gerçek yoldan
// (gezi_rota_onbellek; gün başına bir kez hesaplanır, 30 gün saklanır); yol gelene kadar kestirim ve özet "~" ile.
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BolumSiniri } from '@/components/ui/BolumSiniri';
import { EkleDugmesi } from '@/components/ui/EkleDugmesi';
import type { IcerikCanli } from '@/features/icerik/fotolar';
import { geziGunOzeti } from '@/features/icerik/gezi';
import { useGeziRotasi } from '@/features/icerik/geziRota';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni } from '@/lib/kategori';
import { mesafeMetni } from '@/lib/mesafe';
import { kategoriPini } from '@/lib/pinIkonu';
import type { GeziDetay, GeziDuragi } from '@/lib/tipler';
import { gunRengi, gunUstuMetin, renk, yazi } from '@/theme';

import { MiniHarita } from './MiniHarita';

type Props = {
  gezi: GeziDetay;
  canli: Map<string, IcerikCanli> | undefined;
  listede: (d: GeziDuragi) => boolean;
  mesgulId: string | null;
  onDurakEkle: (d: GeziDuragi) => void;
  /** Satıra dokunuldu (mekan rehberi). */
  onDurak?: (d: GeziDuragi) => void;
  /** Seçili gün (sıra indeksi); sayfada tutulur, sekme değişince korunur. */
  gunSira: number;
  onGunSira: (i: number) => void;
};

export function GeziPlani({ gezi, canli, listede, mesgulId, onDurakEkle, onDurak, gunSira, onGunSira }: Props) {
  const gun = gezi.gezi_gunleri[gunSira] ?? gezi.gezi_gunleri[0];
  const { rotalar } = useGeziRotasi(gun);
  const ozet = useMemo(() => geziGunOzeti(gun?.gezi_duraklari ?? [], rotalar), [gun, rotalar]);
  if (!gun) return null;
  const rengi = gunRengi(gun.sira);
  return (
    <View style={s.kap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cipler} style={s.ciplerSerit}>
        {gezi.gezi_gunleri.map((g, i) => {
          const secili = i === gunSira;
          const r = gunRengi(g.sira);
          return (
            <Pressable key={g.id} accessibilityRole="button" accessibilityState={{ selected: secili }} onPress={() => onGunSira(i)} style={[s.cip, secili ? { backgroundColor: r, borderColor: r } : null]}>
              {secili ? null : <View style={[s.cipNokta, { backgroundColor: r }]} />}
              <Text style={[s.cipMetin, secili && { color: gunUstuMetin(r) }]}>{t('gezi.gunCip', { n: g.sira, mekan: g.gezi_duraklari.length })}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* #199 KK3: harita hata verirse yalnız harita kutusu "açılamadı" kartına döner; durak listesi çalışır. */}
      <BolumSiniri ad="gezi-harita" sifirla={gun.id}>
        <MiniHarita duraklar={gun.gezi_duraklari} gunIndex={gun.sira} rotalar={rotalar} baslik={`${t('gezi.gunKisa', { n: gun.sira })}${gun.baslik ? ` · ${gun.baslik}` : ''}`} />
      </BolumSiniri>
      <View style={s.liste}>
        {gun.gezi_duraklari.length > 1 ? <Text style={s.ozet}>{t(ozet.kestirim ? 'gezi.gunOzeti' : 'gezi.gunOzetiGercek', { sure: sureMetni(ozet.toplamDk), mesafe: mesafeMetni(ozet.yuruyusM) })}</Text> : null}
        {gun.gezi_duraklari.map((d, i) => {
          const c = canli?.get(d.id);
          const icinde = listede(d);
          return (
            <View key={d.id}>
              {i > 0 ? (
                <View style={s.bacak}>
                  <View style={s.noktalar}>
                    {[0, 1, 2, 3].map((k) => (
                      <View key={k} style={s.nokta} />
                    ))}
                  </View>
                  <Text style={s.bacakMetin}>{t(ozet.bacakMod[i - 1] === 'DRIVE' ? 'gezi.arac' : 'gezi.yuruyus', { n: ozet.bacakDk[i - 1] })}</Text>
                </View>
              ) : null}
              {/* #172 KK7: satır DB'den çizilir; panel için yalnız Google kimliği gerekir. */}
              <Pressable accessibilityRole="button" disabled={!onDurak || !c?.place_id} onPress={() => onDurak?.(d)} style={({ pressed }) => [s.satir, pressed && { opacity: 0.85 }]}>
                <View style={[s.numara, { backgroundColor: rengi }]}>
                  <Text style={[s.numaraMetin, { color: gunUstuMetin(rengi) }]}>{i + 1}</Text>
                </View>
                <View style={[s.foto, { backgroundColor: kategoriPini(d.kategori).kategoriRenk }]}>{c?.foto_uri ? <Image source={{ uri: c.foto_uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : null}</View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.ad} numberOfLines={1}>
                    {d.ad}
                  </Text>
                  <Text style={s.meta} numberOfLines={1}>
                    {`${kategoriEtiketi(d.kategori)} · ${sureMetni(d.sure_dk)}`}
                  </Text>
                </View>
                <EkleDugmesi listede={icinde} mesgul={mesgulId === d.id} onPress={() => onDurakEkle(d)} />
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 12 },
  ciplerSerit: { marginHorizontal: -20 },
  cipler: { gap: 8, paddingHorizontal: 20 },
  cip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: renk.ayrac, backgroundColor: renk.zemin },
  cipNokta: { width: 8, height: 8, borderRadius: 4 },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  liste: { gap: 8, paddingTop: 2 },
  ozet: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  numara: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  numaraMetin: { fontFamily: yazi.ekstra, fontSize: 13 },
  foto: { width: 46, height: 46, borderRadius: 12, overflow: 'hidden' },
  ad: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  meta: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  // Kanvas 17: 28 px numaranın ortasından noktalı çizgi (13 px içeride), yazı 26 px sağında.
  bacak: { flexDirection: 'row', alignItems: 'center', height: 26, paddingLeft: 13 },
  noktalar: { width: 2, height: 26, justifyContent: 'space-between', paddingVertical: 1 },
  nokta: { width: 2, height: 2, borderRadius: 1, backgroundColor: '#b4bbd3' },
  bacakMetin: { marginLeft: 24, fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
});
