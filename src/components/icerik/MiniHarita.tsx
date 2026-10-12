// #97 B KK2: seçili gezi gününün mini haritası (120 px; dokununca tam ekran, yalnız bakma) — numaralı duraklar + kuş uçuşu.
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Harita } from '@/components/harita/Harita';
import type { HaritaCizgisi, HaritaPini, HaritaSigdirma } from '@/components/harita/tipler';
import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import type { GeziDuragi } from '@/lib/tipler';
import { gunRengi, renk, yazi } from '@/theme';

export function MiniHarita({ duraklar, gunIndex, baslik }: { duraklar: GeziDuragi[]; gunIndex: number; baslik: string }) {
  const [acik, setAcik] = useState(false);
  const kenar = useSafeAreaInsets();
  const rengi = gunRengi(gunIndex);
  const pinler = useMemo<HaritaPini[]>(() => duraklar.map((d, i) => ({ id: `gd:${d.id}`, tur: 'durak', konum: { lat: d.lat, lng: d.lng }, renk: rengi, etiket: String(i + 1), ad: d.ad })), [duraklar, rengi]);
  const cizgiler = useMemo<HaritaCizgisi[]>(
    () => duraklar.slice(1).map((d, i) => ({ id: `gc:${duraklar[i].id}>${d.id}`, noktalar: [{ lat: duraklar[i].lat, lng: duraklar[i].lng }, { lat: d.lat, lng: d.lng }], renk: rengi, opaklik: 0.9, kesik: true, ince: true })),
    [duraklar, rengi],
  );
  const noktalar = duraklar.map((d) => ({ lat: d.lat, lng: d.lng }));
  const merkez = noktalar[0] ?? { lat: 39.78, lng: 30.52 };
  const sigdir = (ust: number, alt: number): HaritaSigdirma => ({ noktalar, ust, alt });
  if (duraklar.length === 0) return null;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={t('gezi.haritaBuyut')} onPress={() => setAcik(true)} style={s.kucuk}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Harita merkez={merkez} zoom={13} pinler={pinler} cizgiler={cizgiler} sigdir={sigdir(16, 16)} />
        </View>
        <View style={s.buyutRozet}>
          <Ikon ad="genislet" boyut={14} renk={renk.metin} kalinlik={2.2} />
        </View>
      </Pressable>
      <Modal visible={acik} animationType="slide" onRequestClose={() => setAcik(false)}>
        <View style={{ flex: 1 }}>
          <Harita merkez={merkez} zoom={13} pinler={pinler} cizgiler={cizgiler} sigdir={sigdir(kenar.top + 80, 40)} />
          <View style={[s.ust, { top: kenar.top + 10 }]} pointerEvents="box-none">
            <Pressable accessibilityRole="button" accessibilityLabel={t('gezi.haritaKapat')} onPress={() => setAcik(false)} style={s.kapat}>
              <Ikon ad="geri" boyut={20} renk={renk.metin} kalinlik={2.4} />
            </Pressable>
            <View style={s.baslikHap}>
              <Text style={s.baslikMetin} numberOfLines={1}>
                {baslik}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  kucuk: { height: 120, borderRadius: 16, overflow: 'hidden', backgroundColor: renk.yuzey },
  buyutRozet: { position: 'absolute', right: 8, bottom: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  ust: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  kapat: { width: 40, height: 40, borderRadius: 20, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  baslikHap: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center', maxWidth: '75%' },
  baslikMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
});
