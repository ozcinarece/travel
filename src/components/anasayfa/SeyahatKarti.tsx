// #569 KK2–KK5 (UX önerileri kanvası, "Ana sayfa v9 · ONAYLI": `Ana_v9_GeziOncesi` · `Ana_v9_GeziSirasi` · `Ana_v9_GeziYok`):
// ana sayfanın seyahat kartı. 214 pt, köşe 20, tam fotoğraf ve alttan koyulaşan geçiş (#0E1430 %0 → %72, üst %25'ten sonra);
// içerik soldan, sağdan ve alttan 16. Kapak: seyahatin kapağı, yoksa şehrin BO kapağı (`seyahatKapagi`); ikisi de yoksa
// kanvastaki yer tutucu. Atıf sağ üstte (sağdan 12, üstten 10). Google fotoğrafı kullanılmaz.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { KapakAtfi } from '@/components/icerik/KapakAtfi';
import { SeyahatKapagi } from '@/components/seyahatler/SeyahatKapagi';
import { Avatar } from '@/components/ui/Avatar';
import { Foto } from '@/components/ui/Foto';
import { KART_KOSE, KART_YUKSEKLIK, type Kapak } from '@/features/anasayfa/v9';
import { useOkunmamis } from '@/features/sohbet/sorgular';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

import { SiradakiSatiri } from './SiradakiSatiri';

/** Kanvastaki yüz sırası: Mandalina, açık mavi, Gece. */
const YUZ_RENKLERI = [renk.vurgu, renk.anaAcik, renk.ana] as const;

type Yuz = { id: string; ad: string };

/** KK3: gezi öncesi — ad, "N gün kaldı · K kişi"; yüzler sol altta, beyaz "Aç" sağ altta. Karta dokununca seyahat açılır. */
export function GeziOncesiKarti({ id, ad, alt, yuzler, kapak, genislik, onAc }: { id: string; ad: string; alt: string; yuzler: Yuz[]; kapak: Kapak | null; genislik: number; onAc: () => void }) {
  return (
    <View style={[s.kart, { width: genislik }]} testID={`seyahat-karti-${id}`}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.v9.kartEtiket', { ad, alt })} onPress={onAc} style={({ pressed }) => [StyleSheet.absoluteFill, pressed && s.basili]}>
        <KartZemini kimlik={id} kapak={kapak} />
        <View style={s.icerik}>
          <View style={s.metinler}>
            <Text style={s.baslik} numberOfLines={1}>
              {ad}
            </Text>
            <Text style={s.alt} numberOfLines={1}>
              {alt}
            </Text>
          </View>
          <View style={s.altSira}>
            <Yuzler yuzler={yuzler} />
            <View style={s.hap}>
              <Text style={s.hapMetin}>{t('anasayfa.v9.ac')}</Text>
            </View>
          </View>
        </View>
      </Pressable>
      {kapak?.atif ? <KapakAtfi atif={kapak.atif} sade stil={s.atif} /> : null}
    </View>
  );
}

/**
 * KK4: gezi sırasında — üstte "Bugün N. gün", ad, "Sıradaki: durak · saat" (Gezi sayfasının Şimdi verisi); yüzler sol üstte;
 * altta beyaz Sohbet (okunmamış rozeti) ve Harcama hapları. Karta dokununca Gezi açılır.
 */
export function GeziSirasiKarti({
  id,
  ad,
  ust,
  yuzler,
  kapak,
  genislik,
  onAc,
  onSohbet,
  onHarcama,
}: {
  id: string;
  ad: string;
  ust: string;
  yuzler: Yuz[];
  kapak: Kapak | null;
  genislik: number;
  onAc: () => void;
  onSohbet: () => void;
  onHarcama: () => void;
}) {
  const okunmamis = useOkunmamis(id).data ?? 0;
  return (
    <View style={[s.kart, { width: genislik }]} testID={`seyahat-karti-${id}`}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.v9.kartEtiket', { ad, alt: ust })} onPress={onAc} style={({ pressed }) => [StyleSheet.absoluteFill, pressed && s.basili]}>
        <KartZemini kimlik={id} kapak={kapak} />
        <View style={[s.icerik, s.icerikHapli]}>
          <View style={s.metinler}>
            <Text style={s.ust}>{ust}</Text>
            <Text style={s.baslik} numberOfLines={1}>
              {ad}
            </Text>
            <SiradakiSatiri seyahatId={id} stil={s.alt} />
          </View>
        </View>
        <View style={s.ustYuzler}>
          <Yuzler yuzler={yuzler} />
        </View>
      </Pressable>
      <View style={s.haplar}>
        <Hap metin={t('anasayfa.v9.sohbet')} etiket={okunmamis > 0 ? t('anasayfa.v9.sohbetEtiket', { n: okunmamis }) : t('anasayfa.v9.sohbet')} onPress={onSohbet} rozet={okunmamis} testID="kart-sohbet">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={renk.metin} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <Path d="M4 5h16v11H9l-5 4z" />
          </Svg>
        </Hap>
        <Hap metin={t('anasayfa.v9.harcama')} etiket={t('anasayfa.v9.harcama')} onPress={onHarcama} testID="kart-harcama">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={renk.metin} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <Rect x={3} y={6} width={18} height={13} rx={2} />
            <Path d="M3 10h18" />
          </Svg>
        </Hap>
      </View>
      {kapak?.atif ? <KapakAtfi atif={kapak.atif} sade stil={s.atif} /> : null}
    </View>
  );
}

/** KK5: gezisi olmayan — "Sıradaki rota neresi?", alt satır ve turuncu tam genişlik "+ Yeni gezi oluştur" (sihirbaz). */
export function GeziYokKarti({ kapak, genislik, onYeni }: { kapak: Kapak | null; genislik: number; onYeni: () => void }) {
  return (
    <View style={[s.kart, { width: genislik }]} testID="seyahat-karti-yok">
      <KartZemini kimlik="karsilama" kapak={kapak} />
      <View style={s.icerik}>
        <View style={s.metinler}>
          <Text accessibilityRole="header" style={s.baslik}>
            {t('anasayfa.v9.yokBaslik')}
          </Text>
          <Text style={s.alt}>{t('anasayfa.v9.yokAlt')}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.v9.yeniGezi')} onPress={onYeni} style={({ pressed }) => [s.yeniDugme, pressed && s.basili]}>
          <ArtiIkonu />
          <Text style={s.yeniMetin}>{t('anasayfa.v9.yeniGezi')}</Text>
        </Pressable>
      </View>
      {kapak?.atif ? <KapakAtfi atif={kapak.atif} sade stil={s.atif} /> : null}
    </View>
  );
}

/** Kanvastaki artı: 18 px, 2,6 çizgi. */
export function ArtiIkonu({ renk: r = renk.metin }: { renk?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={r} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

function KartZemini({ kimlik, kapak }: { kimlik: string; kapak: Kapak | null }) {
  return (
    <>
      {kapak ? (
        <Foto source={{ uri: kapak.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} testID="kart-kapak" />
      ) : (
        <SeyahatKapagi kimlik={kimlik} yukseklik={KART_YUKSEKLIK} kose={KART_KOSE} stil={StyleSheet.absoluteFill} />
      )}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden pointerEvents="none">
        <Defs>
          <LinearGradient id="v9KartGecis" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.25" stopColor="#0E1430" stopOpacity={0} />
            <Stop offset="1" stopColor="#0E1430" stopOpacity={0.72} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill="url(#v9KartGecis)" />
      </Svg>
    </>
  );
}

/** Yüzler: 32 px daire, 2 px beyaz kenar, 12 px baş harf; üst üste 9 px biner. */
function Yuzler({ yuzler }: { yuzler: Yuz[] }) {
  if (yuzler.length === 0) return <View />;
  return (
    <View style={s.yuzler} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {yuzler.map((y, i) => (
        <View key={y.id} style={[s.yuzKenar, i > 0 && s.yuzBinme]}>
          <Avatar ad={y.ad} boyut={32} arkaPlan={YUZ_RENKLERI[i % YUZ_RENKLERI.length]} yuvarlak harfBoyutu={12} />
        </View>
      ))}
    </View>
  );
}

/** Beyaz hap: 36 pt (dokunma 44), köşe 18, 14/700; ikon 16, aralık 6. Rozet: 18 px Mandalina, 11/800. */
function Hap({ metin, etiket, onPress, rozet = 0, children, testID }: { metin: string; etiket: string; onPress: () => void; rozet?: number; children: ReactNode; testID?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={etiket} onPress={onPress} hitSlop={4} style={({ pressed }) => [s.hap, pressed && s.basili]} testID={testID}>
      {children}
      <Text style={s.hapMetin}>{metin}</Text>
      {rozet > 0 ? (
        <View style={s.rozet}>
          <Text style={s.rozetMetin}>{rozet > 99 ? '99+' : rozet}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  kart: { height: KART_YUKSEKLIK, borderRadius: KART_KOSE, overflow: 'hidden', backgroundColor: renk.yuzey },
  basili: { opacity: 0.9 },
  icerik: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 10 },
  // Haplar kartın Pressable'ının kardeşi (iç içe düğme olmasın); metinler hap satırının (36) ve aralığın (10) üstünde.
  icerikHapli: { bottom: 16 + 36 + 10 },
  metinler: { gap: 2 },
  ust: { fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin, opacity: 0.95 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 24, letterSpacing: -0.24, color: renk.zemin },
  alt: { fontFamily: yazi.yari, fontSize: 14, color: renk.zemin },
  altSira: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ustYuzler: { position: 'absolute', left: 14, top: 14 },
  yuzler: { flexDirection: 'row' },
  yuzKenar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: renk.zemin, overflow: 'hidden' },
  yuzBinme: { marginLeft: -9 },
  haplar: { position: 'absolute', left: 16, bottom: 16, flexDirection: 'row', gap: 8 },
  hap: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: renk.zemin, flexDirection: 'row', alignItems: 'center', gap: 6 },
  hapMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  rozet: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: renk.vurgu, alignItems: 'center', justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.metin },
  yeniDugme: { height: 48, borderRadius: 24, backgroundColor: renk.vurgu, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  yeniMetin: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  atif: { right: 12, top: 10, bottom: undefined },
});
