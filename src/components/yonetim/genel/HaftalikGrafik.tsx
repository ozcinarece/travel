import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { GRAFIK, grafik, type Ozet } from '@/features/yonetim/genelBakis';
import { ty } from '@/features/yonetim/metin';
import { yazi } from '@/theme';

import { yGolge, yRenk } from '../tema';

const SEYAHAT = yRenk.vurgu;
const SOLUK = yRenk.soluk;

/**
 * KK2 (kanvas "Haftalık · yeni kullanıcı ve seyahat"): 560 × 190 SVG, 6 yatay çizgi (#ebebeb, etiket 10 px #9a9a9a),
 * x ekseninde çift haftalar + son hafta; kullanıcı siyah, seyahat turuncu, 2,5 kalınlık, son noktada 3 px daire.
 * Ek bağımlılık yok: uygulamada zaten olan react-native-svg.
 */
export function HaftalikGrafik({ seri }: { seri: Ozet['haftalik'] }) {
  const g = grafik(seri);
  return (
    <View style={s.kart}>
      <View style={s.ust}>
        <Text style={s.baslik}>{ty('genel.grafik')}</Text>
        <View style={s.lejant}>
          <Lejant renk={yRenk.metin} metin={ty('genel.kullanici')} />
          <Lejant renk={SEYAHAT} metin={ty('genel.seyahat')} />
        </View>
      </View>
      <Svg width={GRAFIK.genislik} height={GRAFIK.yukseklik} viewBox={`0 0 ${GRAFIK.genislik} ${GRAFIK.yukseklik}`} accessibilityLabel={ty('genel.grafikEtiket')}>
        {g.cizgiler.map((c) => (
          <Cizgi key={c.y} y={c.y} etiket={c.etiket} />
        ))}
        {g.xEtiketleri.map((e, i) => (
          <SvgText key={i} x={e.x.toFixed(1)} y={180} fontSize={10} fill={SOLUK} textAnchor="middle" fontFamily={yazi.normal}>
            {e.etiket}
          </SvgText>
        ))}
        {[
          { cizim: g.kullanici, renk: yRenk.metin },
          { cizim: g.seyahat, renk: SEYAHAT },
        ].map(({ cizim, renk }) =>
          cizim.son ? (
            <Seri key={renk} yol={cizim.yol} son={cizim.son} renk={renk} />
          ) : null,
        )}
      </Svg>
    </View>
  );
}

function Cizgi({ y, etiket }: { y: number; etiket: string }) {
  return (
    <>
      <Line x1={GRAFIK.sol} x2={GRAFIK.sag} y1={y.toFixed(1)} y2={y.toFixed(1)} stroke={yRenk.ayrac} />
      <SvgText x={4} y={(y + 4).toFixed(1)} fontSize={10} fill={SOLUK} fontFamily={yazi.normal}>
        {etiket}
      </SvgText>
    </>
  );
}

function Seri({ yol, son, renk }: { yol: string; son: { x: number; y: number }; renk: string }) {
  return (
    <>
      <Path d={yol} fill="none" stroke={renk} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={son.x.toFixed(1)} cy={son.y.toFixed(1)} r={3} fill={renk} />
    </>
  );
}

function Lejant({ renk, metin }: { renk: string; metin: string }) {
  return (
    <View style={s.lejantOge}>
      <View style={[s.lejantCizgi, { backgroundColor: renk }]} />
      <Text style={s.lejantMetin}>{metin}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  kart: { flex: 1, minWidth: 0, padding: 20, borderRadius: 22, backgroundColor: yRenk.zemin, boxShadow: yGolge, gap: 10 },
  ust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baslik: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.metin },
  lejant: { flexDirection: 'row', gap: 14 },
  lejantOge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lejantCizgi: { width: 10, height: 3 },
  lejantMetin: { fontFamily: yazi.kalin, fontSize: 11.5, color: yRenk.ikincil },
});
