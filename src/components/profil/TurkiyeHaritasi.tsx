// #578 KK2 (kanvas `Profil_v12_*`): 81 il sınırı, react-native-svg ile. Yollar `src/assets/turkiye-iller.json`
// (turkey-map-react 2.4.6, MIT; lisans "Lisanslar" ekranında). Gittiği il turuncu dolu; gitmek istediği il #C9D2F2 zemin,
// lacivert kenar (kenar en üstte ikinci kez çizilir, komşunun beyaz sınırı örtmesin); diğerleri #E3E7F0, aralarında beyaz.
import { memo, useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';

import { ILLER } from '@/features/profil/profilV12';

/** Kanvastaki görünüm kutusu ve oranı (342 × 154). */
const GORUNUM = '14 136 1023 460';
const ORAN = 460 / 1023;

export const haritaRenk = {
  bos: '#E3E7F0',
  gidilen: '#FF7A1A',
  istek: '#C9D2F2',
  istekKenar: '#152A6B',
  sinir: '#FFFFFF',
} as const;

type Props = { genislik: number; gidilen: number[]; istek: number[]; etiket: string };

export const TurkiyeHaritasi = memo(function TurkiyeHaritasi({ genislik, gidilen, istek, etiket }: Props) {
  const gittigi = useMemo(() => new Set(gidilen), [gidilen]);
  // Gittiği il önceliklidir (aynı il iki listede olsa turuncu).
  const istedigi = useMemo(() => new Set(istek.filter((p) => !gittigi.has(p))), [istek, gittigi]);
  return (
    <Svg width={genislik} height={genislik * ORAN} viewBox={GORUNUM} accessibilityRole="image" accessibilityLabel={etiket} testID="turkiye-haritasi">
      {ILLER.map((il) => {
        const tur = gittigi.has(il.plaka) ? 'gidilen' : istedigi.has(il.plaka) ? 'istek' : 'bos';
        return (
          <Path
            key={il.plaka}
            d={il.d}
            fill={haritaRenk[tur]}
            stroke={tur === 'istek' ? haritaRenk.istekKenar : haritaRenk.sinir}
            strokeWidth={tur === 'istek' ? 2.2 : 1.2}
            strokeLinejoin="round"
            testID={`il-${il.plaka}-${tur}`}
          />
        );
      })}
      {ILLER.filter((il) => istedigi.has(il.plaka)).map((il) => (
        <Path key={`k${il.plaka}`} d={il.d} fill="none" stroke={haritaRenk.istekKenar} strokeWidth={2.4} strokeLinejoin="round" />
      ))}
    </Svg>
  );
});
