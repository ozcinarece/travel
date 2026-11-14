// #97 B KK2 → #143 (kanvas 17): seçili gezi gününün mini haritası (170 px, köşe 22; sağ üstte büyüt; dokununca tam ekran,
// yalnız bakma) — numaralı duraklar. #192: bacaklar gerçek yolla (gezi_rota_onbellek); yol gelene kadar / gelmezse kuş uçuşu.
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Harita } from '@/components/harita/Harita';
import type { HaritaCizgisi, HaritaPini, HaritaSigdirma } from '@/components/harita/tipler';
import { Ikon } from '@/components/ui/Ikon';
import { geziGunCizgileri, konumGecerli } from '@/features/icerik/gezi';
import type { GeziRotalari } from '@/features/icerik/geziRota';
import { t } from '@/i18n';
import type { GeziDuragi } from '@/lib/tipler';
import { gunRengi, renk, yazi } from '@/theme';

export function MiniHarita({ duraklar, gunIndex, baslik, rotalar }: { duraklar: GeziDuragi[]; gunIndex: number; baslik: string; rotalar?: GeziRotalari }) {
  const [acik, setAcik] = useState(false);
  const kenar = useSafeAreaInsets();
  const rengi = gunRengi(gunIndex);
  // #199 KK2: konumu bozuk durak haritaya girmez (numarası listedeki sırasıyla kalır).
  const pinler = useMemo<HaritaPini[]>(
    () => duraklar.flatMap((d, i): HaritaPini[] => (konumGecerli(d) ? [{ id: `gd:${d.id}`, tur: 'durak', konum: { lat: d.lat, lng: d.lng }, renk: rengi, etiket: String(i + 1), ad: d.ad }] : [])),
    [duraklar, rengi],
  );
  const cizgiler = useMemo<HaritaCizgisi[]>(() => geziGunCizgileri(duraklar, gunIndex, rotalar), [duraklar, gunIndex, rotalar]);
  const noktalar = pinler.map((p) => p.konum);
  const merkez = noktalar[0] ?? { lat: 39.78, lng: 30.52 };
  const sigdir = (ust: number, alt: number): HaritaSigdirma => ({ noktalar, ust, alt });
  if (noktalar.length === 0) return null;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={t('gezi.haritaBuyut')} onPress={() => setAcik(true)} style={s.kucuk}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Harita merkez={merkez} zoom={13} pinler={pinler} cizgiler={cizgiler} sigdir={sigdir(28, 20)} />
        </View>
        <View style={s.buyutRozet}>
          <Ikon ad="genislet" boyut={18} renk={renk.metin} kalinlik={2.2} />
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
  kucuk: { height: 170, borderRadius: 22, overflow: 'hidden', backgroundColor: '#f1f3f8' },
  buyutRozet: { position: 'absolute', right: 10, top: 10, width: 40, height: 40, borderRadius: 12, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  ust: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  kapat: { width: 40, height: 40, borderRadius: 12, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  baslikHap: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center', maxWidth: '75%' },
  baslikMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
});
