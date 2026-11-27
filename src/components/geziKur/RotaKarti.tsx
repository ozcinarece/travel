// #574 KK4 (UX önerileri kanvası `Kur_v11_Acilis` · `Kur_v11_Sehir`): rota kartları.
// - Hazır rota: tam genişlik, köşe 20 (açılışta 236 pt, şehir yazılınca 210 pt); kapak, %30'dan sonra #0E1430 %72'ye koyulaşan
//   geçiş; altta 16 içeride ad 22/800, "N gün · M durak · Editör seçimi" 14/600; altında yüzler (32 pt, 2 pt beyaz kenar,
//   -9 üst üste) + "X bu rotayla gitti" 13/600 ve sağda beyaz "Bunu seç" (36 pt, köşe 18, 14/700). Yüz satırı yalnız gerçek
//   arkadaşlar o geziyi seyahatine aldıysa (`gidenArkadaslar`); yoksa gizli. Sağ üstte kapak atfı (10 px beyaz %85).
// - Arkadaş rotası: 200 pt, 130 pt kapak (köşe 14), 26 pt yüz, "Mardin, 3 gün" 14/700 ve "Ayşe'nin rotası" 12 #5B6178.
// Kapaksız kartta kanvastaki yer tutucu (`SeyahatKapagi`). Google fotoğrafı yok.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { KapakAtfi } from '@/components/icerik/KapakAtfi';
import { SeyahatKapagi } from '@/components/seyahatler/SeyahatKapagi';
import { Avatar } from '@/components/ui/Avatar';
import { Foto } from '@/components/ui/Foto';
import type { ArkadasPaylasimi } from '@/features/arkadaslar/sorgular';
import { gittiMetni, YUZ_EN_COK, type GidenArkadas } from '@/features/geziKur/geziKur';
import type { KapakAtfi as Atif } from '@/features/icerik/kapakAtfi';
import { ilkAd } from '@/features/paylasim/baslik';
import { t } from '@/i18n';
import { ilgiEkli } from '@/lib/ek';
import { arkadasRenkleri, renk, yazi } from '@/theme';

/** Kanvastaki renkler (`Kur_v11_*`). */
export const kurRenk = {
  metin: '#0E1430',
  ikincil: '#5B6178',
  lacivert: '#152A6B',
  turuncu: '#FF7A1A',
  cizgi: '#E4E7EE',
  acikMavi: '#C9D2F2',
  beyaz: '#FFFFFF',
} as const;

/** Kanvas: yüzlerin zemini ve harfi sırayla (A lacivert/beyaz, M açık mavi/lacivert). */
const YUZLER: readonly (readonly [string, string])[] = [
  [kurRenk.lacivert, kurRenk.beyaz],
  [kurRenk.acikMavi, kurRenk.lacivert],
];

export type Kapak = { uri: string | null; atif: Atif | null };

type RotaProps = {
  id: string;
  ad: string;
  alt: string;
  kapak: Kapak;
  gidenler: GidenArkadas[];
  yukseklik: number;
  onSec: () => void;
};

export function RotaKarti({ id, ad, alt, kapak, gidenler, yukseklik, onSec }: RotaProps) {
  const yuzler = gidenler.slice(0, YUZ_EN_COK);
  const gitti = gittiMetni(gidenler.map((g) => g.ad));
  return (
    <View style={[s.kart, { height: yukseklik }]} testID={`rota-${id}`}>
      {kapak.uri ? (
        <Foto source={{ uri: kapak.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
      ) : (
        <SeyahatKapagi kimlik={id} yukseklik={yukseklik} kose={20} />
      )}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden pointerEvents="none">
        <Defs>
          <LinearGradient id="v11RotaGecis" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.3" stopColor="#0E1430" stopOpacity={0} />
            <Stop offset="1" stopColor="#0E1430" stopOpacity={0.72} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill="url(#v11RotaGecis)" />
      </Svg>
      <View style={s.alt}>
        <View style={s.metinler}>
          <Text style={s.ad} numberOfLines={2}>
            {ad}
          </Text>
          <Text style={s.ozet} numberOfLines={1}>
            {alt}
          </Text>
        </View>
        <View style={s.satir}>
          {gitti ? (
            <View style={s.gidenler} testID={`gidenler-${id}`}>
              <View style={s.yuzler}>
                {yuzler.map((g, i) => {
                  const [zemin, harf] = YUZLER[i % YUZLER.length];
                  return (
                    <View key={g.id} style={[s.yuzKenar, { marginLeft: i === 0 ? 0 : -9 }]}>
                      <Avatar ad={g.ad} url={g.foto} boyut={32} arkaPlan={zemin} harfRengi={harf} harfBoyutu={12} yuvarlak />
                    </View>
                  );
                })}
              </View>
              <Text style={s.gitti} numberOfLines={1}>
                {gitti}
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Pressable accessibilityRole="button" accessibilityLabel={t('geziKur.bunuSecEtiket', { ad })} onPress={onSec} hitSlop={4} style={({ pressed }) => [s.sec, pressed && { opacity: 0.85 }]}>
            <Text style={s.secMetin}>{t('geziKur.bunuSec')}</Text>
          </Pressable>
        </View>
      </View>
      {kapak.uri && kapak.atif ? <KapakAtfi atif={kapak.atif} sade /> : null}
    </View>
  );
}

const ARKADAS_KART = 200;
const ARKADAS_KAPAK = 130;

/** "Ayşe'nin rotası"; ad yoksa ya da ek konamazsa yalnız şehir/gün satırı kalır (null). */
export function arkadasRotasiMetni(p: Pick<ArkadasPaylasimi, 'paylasan_ad'>): string | null {
  const ad = ilkAd(p.paylasan_ad);
  const ekli = ad ? ilgiEkli(ad) : null;
  return ekli ? t('geziKur.arkadasAlt', { ad: ekli }) : null;
}

export function ArkadasRotaKarti({ p, sira, onSec }: { p: ArkadasPaylasimi; sira: number; onSec: () => void }) {
  const ad = ilkAd(p.paylasan_ad) ?? t('seyahatV7.adsiz');
  const baslik = t('geziKur.arkadasBaslik', { sehir: p.sehir, n: p.gun_sayisi });
  const alt = arkadasRotasiMetni(p);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[baslik, alt].filter(Boolean).join(', ')}
      onPress={onSec}
      style={({ pressed }) => [s.arkadasKart, pressed && { opacity: 0.9 }]}
      testID={`arkadas-rotasi-${p.id}`}
    >
      <SeyahatKapagi kimlik={p.id} yukseklik={ARKADAS_KAPAK} kose={14} />
      <View style={s.arkadasSatir}>
        <Avatar ad={ad} url={p.foto} boyut={26} arkaPlan={arkadasRenkleri[sira % arkadasRenkleri.length]} yuvarlak harfBoyutu={11} />
        <View style={{ flex: 1 }}>
          <Text style={s.arkadasBaslik} numberOfLines={1}>
            {baslik}
          </Text>
          {alt ? (
            <Text style={s.arkadasAlt} numberOfLines={1}>
              {alt}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  kart: { marginTop: 12, marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', backgroundColor: renk.yuzey },
  alt: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 10 },
  metinler: { gap: 2 },
  ad: { fontFamily: yazi.ekstra, fontSize: 22, letterSpacing: -0.22, color: kurRenk.beyaz },
  ozet: { fontFamily: yazi.yari, fontSize: 14, color: kurRenk.beyaz },
  satir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  gidenler: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  yuzler: { flexDirection: 'row' },
  yuzKenar: { borderWidth: 2, borderColor: kurRenk.beyaz, borderRadius: 18 },
  gitti: { flexShrink: 1, fontFamily: yazi.yari, fontSize: 13, color: kurRenk.beyaz },
  sec: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: kurRenk.beyaz, flexDirection: 'row', alignItems: 'center', gap: 6 },
  secMetin: { fontFamily: yazi.kalin, fontSize: 14, color: kurRenk.metin },
  arkadasKart: { width: ARKADAS_KART, gap: 8 },
  arkadasSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arkadasBaslik: { fontFamily: yazi.kalin, fontSize: 14, color: kurRenk.metin },
  arkadasAlt: { fontFamily: yazi.normal, fontSize: 12, color: kurRenk.ikincil },
});
