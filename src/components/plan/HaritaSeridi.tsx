// #182 KK3 (kanvas 24): Plan listesinin üstündeki 112 px harita şeridi — statik çizim, yalnız bu günün koordinatlarıyla: rota
// (önbellekte gerçek yol çizgisi varsa o, yoksa noktalar düz bağlanır), numaralı pinler ve otel. Sol üstte "09:30 – 18:10 · 2,1 km
// yürüme", sağ altta "Haritayı aç" (bugünkü harita ekranı tam ekran); şeridin tamamı dokunulabilir. Google'a istek yok; harita
// karosu da yok.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { Konum } from '@/components/harita/tipler';
import { Ikon } from '@/components/ui/Ikon';
import { seritProjeksiyonu } from '@/features/plan/planListesi';
import { t } from '@/i18n';
import { gunUstuMetin, renk, yazi } from '@/theme';

const YUKSEKLIK = 112;

type Props = {
  pinler: { id: string; konum: Konum; numara: number; renk: string }[];
  otel: Konum | null;
  /** Rota parçaları (otel → 1 → … → otel); her biri gerçek yol noktaları ya da iki uç. */
  cizgiler: Konum[][];
  cizgiRengi: string;
  etiket: string | null;
  onAc: () => void;
};

export function HaritaSeridi({ pinler, otel, cizgiler, cizgiRengi, etiket, onAc }: Props) {
  const [genislik, setGenislik] = useState(350);
  const tumu = [...pinler.map((p) => p.konum), ...(otel ? [otel] : []), ...cizgiler.flat()];
  const yansit = seritProjeksiyonu(tumu, genislik, YUKSEKLIK);
  const yol = cizgiler
    .filter((c) => c.length >= 2)
    .map((c) =>
      c
        .map((k, i) => {
          const n = yansit(k);
          return `${i === 0 ? 'M' : 'L'}${n.x.toFixed(1)} ${n.y.toFixed(1)}`;
        })
        .join(' '),
    )
    .join(' ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[etiket, t('plan.haritayiAc')].filter(Boolean).join(' · ')}
      onPress={onAc}
      onLayout={(e) => setGenislik(Math.round(e.nativeEvent.layout.width))}
      style={({ pressed }) => [s.kap, pressed && { opacity: 0.92 }]}>
      <Svg width={genislik} height={YUKSEKLIK} style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Kanvastaki gibi soluk sokak çizgileri (süs; konumla ilgisi yok). */}
        <Path d={`M-10 70 Q${genislik * 0.23} 40 ${genislik * 0.46} 70 T${genislik + 10} 50`} stroke={renk.zemin} strokeWidth={10} fill="none" />
        <Path d={`M${genislik * 0.34} -5 Q${genislik * 0.4} 50 ${genislik * 0.31} ${YUKSEKLIK + 8}`} stroke={renk.zemin} strokeWidth={8} fill="none" />
        {yol ? <Path d={yol} stroke={cizgiRengi} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
      </Svg>
      {otel ? (
        <View style={[s.otel, konumStili(yansit(otel), 22)]}>
          <Ikon ad="yatak" boyut={12} renk={renk.zemin} kalinlik={2.4} />
        </View>
      ) : null}
      {pinler.map((p) => (
        <View key={p.id} style={[s.pin, konumStili(yansit(p.konum), 24), { backgroundColor: p.renk }]}>
          <Text style={[s.pinMetin, { color: gunUstuMetin(p.renk) }]}>{p.numara}</Text>
        </View>
      ))}
      {etiket ? (
        <View style={s.etiket}>
          <Text style={s.etiketMetin} numberOfLines={1}>
            {etiket}
          </Text>
        </View>
      ) : null}
      <View style={s.ac} pointerEvents="none">
        <Ikon ad="harita" boyut={14} renk={renk.ana} kalinlik={2.3} />
        <Text style={s.acMetin}>{t('plan.haritayiAc')}</Text>
      </View>
    </Pressable>
  );
}

const konumStili = (n: { x: number; y: number }, boyut: number) => ({ left: n.x - boyut / 2, top: n.y - boyut / 2 });

const s = StyleSheet.create({
  kap: { height: YUKSEKLIK, borderRadius: 18, backgroundColor: '#e8ecf6', overflow: 'hidden' },
  pin: { position: 'absolute', width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  pinMetin: { fontFamily: yazi.ekstra, fontSize: 11 },
  otel: { position: 'absolute', width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: renk.zemin, backgroundColor: renk.ana, alignItems: 'center', justifyContent: 'center' },
  etiket: { position: 'absolute', left: 10, top: 10, height: 28, paddingHorizontal: 10, borderRadius: 9, backgroundColor: renk.zemin, justifyContent: 'center', maxWidth: '75%' },
  etiketMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
  ac: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: renk.zemin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    shadowColor: renk.metin,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  acMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
});
