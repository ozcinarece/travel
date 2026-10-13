// #139 KK4 (kanvas 7): "Neleri görmek istersin?" mini haritası — seçilenler Gece kare, odaktaki Mandalina kare, seçilmeyenler
// küçük beyaz nokta; yakın seçilenler bölge halkasıyla gruplu (gün renkleri sırayla). Dokununca tam ekran (yalnız bakma).
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mesafeM } from '@/components/harita/geo';
import { Harita } from '@/components/harita/Harita';
import type { HaritaDairesi, HaritaPini, HaritaSigdirma, Konum } from '@/components/harita/tipler';
import { Ikon } from '@/components/ui/Ikon';
import { bolgeler } from '@/features/sihirbaz/planKur';
import { t } from '@/i18n';
import { kategoriPini } from '@/lib/pinIkonu';
import { gunRengi, kose, renk, yazi } from '@/theme';

export type HaritaNoktasi = { id: string; lat: number; lng: number; ad: string; primary_type: string | null };

type Props = { secilenler: HaritaNoktasi[]; digerleri: HaritaNoktasi[]; odakId: string | null; merkez: Konum; baslik: string };

export function SecimHaritasi({ secilenler, digerleri, odakId, merkez, baslik }: Props) {
  const [acik, setAcik] = useState(false);
  const kenar = useSafeAreaInsets();
  const pinler = useMemo<HaritaPini[]>(
    () => [
      ...digerleri.map((d): HaritaPini => ({ id: `d:${d.id}`, tur: 'oneri', konum: { lat: d.lat, lng: d.lng }, renk: renk.metin, kucuk: true, ...kategoriPini(d.primary_type) })),
      ...secilenler.map((d): HaritaPini => ({ id: `s:${d.id}`, tur: 'durak', konum: { lat: d.lat, lng: d.lng }, renk: renk.ana, etiket: '', secili: d.id === odakId, ad: d.id === odakId ? d.ad : undefined })),
    ],
    [secilenler, digerleri, odakId],
  );
  // Bölge halkası: kümenin merkezi, yarıçap en uzak mekan + 250 m (tek mekanlı bölgede halka yok).
  const daireler = useMemo<HaritaDairesi[]>(() => {
    const gruplar = bolgeler(secilenler.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, dakika: 0 })));
    return gruplar
      .filter((g) => g.length > 1)
      .map((g, i) => {
        const m = { lat: g.reduce((x, p) => x + p.lat, 0) / g.length, lng: g.reduce((x, p) => x + p.lng, 0) / g.length };
        return { id: `b:${i}`, merkez: m, yaricapM: Math.max(...g.map((p) => mesafeM(m, p))) + 250, renk: gunRengi(i + 1) };
      });
  }, [secilenler]);
  const noktalar = (secilenler.length ? secilenler : digerleri).map((d) => ({ lat: d.lat, lng: d.lng }));
  const sigdir = (ust: number, alt: number): HaritaSigdirma | undefined => (noktalar.length ? { noktalar, ust, alt } : undefined);
  const seciliId = odakId ? `s:${odakId}` : null;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={t('sihirbaz.onerilenler.haritaBuyut')} onPress={() => setAcik(true)} style={s.kucuk}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Harita merkez={merkez} zoom={12} pinler={pinler} daireler={daireler} sigdir={sigdir(24, 24)} seciliId={seciliId} />
        </View>
        <View style={s.buyut}>
          <Ikon ad="genislet" boyut={16} renk={renk.ana} kalinlik={2.6} />
        </View>
      </Pressable>
      <Modal visible={acik} animationType="slide" onRequestClose={() => setAcik(false)}>
        <View style={{ flex: 1, backgroundColor: renk.haritaZemin }}>
          <Harita merkez={merkez} zoom={12} pinler={pinler} daireler={daireler} sigdir={sigdir(kenar.top + 80, 40)} seciliId={seciliId} />
          <View style={[s.ust, { top: kenar.top + 10 }]} pointerEvents="box-none">
            <Pressable accessibilityRole="button" accessibilityLabel={t('sihirbaz.onerilenler.haritaKapat')} onPress={() => setAcik(false)} style={s.kapat}>
              <Ikon ad="geri" boyut={20} renk={renk.ana} kalinlik={2.6} />
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
  kucuk: { height: 196, borderRadius: kose.kart, overflow: 'hidden', backgroundColor: renk.haritaZemin },
  buyut: { position: 'absolute', right: 10, bottom: 10, width: 40, height: 40, borderRadius: kose.alan, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  ust: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  kapat: { width: 44, height: 44, borderRadius: kose.dugme, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  baslikHap: { height: 40, paddingHorizontal: 14, borderRadius: kose.alan, backgroundColor: renk.zemin, justifyContent: 'center', maxWidth: '75%' },
  baslikMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
});
