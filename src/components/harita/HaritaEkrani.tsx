import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Ikon } from '@/components/ui/Ikon';

import { AltSayfa, type SayfaHali } from './AltSayfa';

import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

import { Harita } from './Harita';
import type { HaritaProps } from './tipler';

type Props = {
  /** Sol üstteki beyaz hapta geri okunun yanındaki metin. */
  baslik: string;
  geri: () => void;
  /** Sağ üst: bilgi hapı (otel: "Roma · 2/2") ya da üye avatarları (3.4). */
  sagUst?: ReactNode;
  /** Arama kutusu (beyaz, 48 yüksek) — kabuk gölgeli kabı sağlar. */
  arama?: ReactNode;
  /** #69: aramanın sağında kare düğme (filtre); kabuk yan yana dizer. */
  aramaSag?: ReactNode;
  /** Aramanın altı: öneri listesi, çipler, "Bu bölgede ara" hapı. */
  ustEk?: ReactNode;
  /** Alt panelin hemen üstünde küçük sağa yaslı not (ör. "Otel verisi: Google"). */
  altNot?: string;
  /** Alt katmanda serbest içerik (ör. 3.4 yatay kartlar + liste çubuğu); panel zemini yok. */
  altSerbest?: ReactNode;
  /** Alttaki beyaz, üstten yuvarlak panel (kart + düğmeler). Yoksa panel çizilmez. */
  altPanel?: ReactNode;
  /** #45: üst katmanın (geri hapı + ustEk) yüksekliği; tam ekran panel bunun altından başlar. */
  onUstYukseklik?: (yukseklik: number) => void;
  /** #47 A1: ekranın altında uygulama alt menüsü var — panel menüye yapışık (alt güvenli alanı menü karşılar). */
  altMenuVar?: boolean;
  /** #47 A2: panel tam ekran — üst katmanın (gün kartları) hemen altından başlar, köşesiz; arkada harita görünmez. */
  panelTam?: boolean;
  /**
   * #53 §3: büyük başlık — solda 36 px yuvarlak geri, yanında büyük `baslik` (şehir), altında bu satır (gün özeti);
   * haritanın üstünde 250 px yumuşak geçiş. Verilmezse eski "‹ Şehir" hapı.
   */
  altBaslik?: string;
  /**
   * #55 §B7: alt panel yerine üç durma noktalı alt sayfa. `govde(yukseklik)` sayfanın görünür gövde yüksekliğini alır.
   * `ustunde`: sayfanın hemen üstünde yüzen içerik (sayfayla hareket eder).
   */
  altSayfa?: { hal: SayfaHali; onHal: (h: SayfaHali) => void; ust: ReactNode; govde: (yukseklik: number) => ReactNode; ustunde?: ReactNode };
  harita: HaritaProps;
};

/** #55 §B7: yarı açık sayfa ekranın ~%45'i. */
const YARI_ORAN = 0.45;
const SAYFA_UST_DOLGU = 10;

/** #53 §3: haritanın üstündeki yumuşak geçiş (#f6f6f4 %98 → %0). */
const GECIS_YUKSEKLIK = 250;

/**
 * #17 KK2: tam ekran harita kabuğu — 3.3 Otel, 3.4 Keşfet ve 3.5 bunu paylaşır.
 * Harita ekranın tamamını kaplar; üstte ve altta yüzen katmanlar dokunuşu yalnız kendi alanlarında yakalar.
 */
export function HaritaEkrani({ baslik, geri, sagUst, arama, aramaSag, ustEk, altNot, altSerbest, altPanel, onUstYukseklik, altMenuVar, panelTam, altBaslik, altSayfa, harita }: Props) {
  const kenar = useSafeAreaInsets();
  const [ustY, setUstY] = useState(0);
  const [panelY, setPanelY] = useState(0);
  const [ekranH, setEkranH] = useState(0);
  const [seritH, setSeritH] = useState(52);
  const altDolgu = altMenuVar ? 0 : altPanel ? Math.max(kenar.bottom, 14) : kenar.bottom;
  // #55 §B7: sayfa yükseklikleri — katlı = üst şerit, yarı ≈ %45, tam = başlık alanının altından alta.
  const sayfaAlt = altMenuVar ? 0 : kenar.bottom;
  const yukseklik = {
    katli: SAYFA_UST_DOLGU + seritH + sayfaAlt,
    yari: Math.max(SAYFA_UST_DOLGU + seritH + 160, Math.round(ekranH * YARI_ORAN)),
    tam: Math.max(SAYFA_UST_DOLGU + seritH + 200, ekranH - ustY),
  };
  const sayfaAcik = !!altSayfa && !altPanel;
  const haritaAlt = sayfaAcik ? (altSayfa!.hal === 'tam' ? 0 : yukseklik[altSayfa!.hal]) : altPanel && !panelTam ? panelY : 0;
  return (
    <View style={s.ekran} onLayout={(e) => setEkranH(e.nativeEvent.layout.height)}>
      <Harita {...harita} altBosluk={haritaAlt} />
      {/* #47 A2: tam ekranda harita şeridi görünmez (beyaz arka plan). */}
      {panelTam || (sayfaAcik && altSayfa!.hal === 'tam') ? <View style={[StyleSheet.absoluteFill, { backgroundColor: renk.zemin }]} /> : null}
      {altBaslik !== undefined && !panelTam ? (
        <View style={s.gecis} pointerEvents="none">
          <Svg width="100%" height={GECIS_YUKSEKLIK}>
            <Defs>
              <LinearGradient id="ustGecis" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#f6f6f4" stopOpacity={0.98} />
                <Stop offset="0.55" stopColor="#f6f6f4" stopOpacity={0.75} />
                <Stop offset="1" stopColor="#f6f6f4" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height={GECIS_YUKSEKLIK} fill="url(#ustGecis)" />
          </Svg>
        </View>
      ) : null}

      <View
        style={[s.ust, { paddingTop: kenar.top + 12 }]}
        pointerEvents="box-none"
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setUstY(h);
          onUstYukseklik?.(h);
        }}>
        <View style={s.ustSatir} pointerEvents="box-none">
          {altBaslik !== undefined ? <BuyukBaslik baslik={baslik} alt={altBaslik} onGeri={geri} /> : <GeriHapi baslik={baslik} onPress={geri} />}
          {sagUst}
        </View>
        {arama ? (
          <View style={s.aramaSatir} pointerEvents="box-none">
            <View style={[s.arama, s.golge, { flex: 1 }]}>{arama}</View>
            {aramaSag}
          </View>
        ) : null}
        {ustEk}
      </View>

      {sayfaAcik && ekranH > 0 ? (
        <AltSayfa
          hal={altSayfa!.hal}
          onHal={altSayfa!.onHal}
          yukseklik={yukseklik}
          ust={altSayfa!.ust}
          onUstYukseklik={setSeritH}
          ustunde={
            altSayfa!.hal !== 'tam' && (altSerbest || altSayfa!.ustunde) ? (
              <>
                {altSerbest}
                {altSayfa!.ustunde}
              </>
            ) : undefined
          }
          altDolgu={sayfaAlt}>
          {altSayfa!.govde(yukseklik[altSayfa!.hal] - SAYFA_UST_DOLGU - seritH - sayfaAlt)}
        </AltSayfa>
      ) : panelTam && altPanel ? (
        <View style={[s.panel, s.panelTam, { top: ustY, paddingBottom: altMenuVar ? 10 : Math.max(kenar.bottom, 14) }]}>{altPanel}</View>
      ) : (
        <View style={[s.alt, { paddingBottom: altPanel ? 0 : altDolgu }]} pointerEvents="box-none">
          {altSerbest}
          {altNot ? <Text style={s.altNot}>{altNot}</Text> : null}
          {altPanel ? (
            // #47 A1: panel alt menüye yapışık; harita dolgusu panel yüksekliği kadar (logo panelin üstünde).
            <View style={[s.panel, s.panelGolge, { paddingBottom: altMenuVar ? 12 : altDolgu }]} onLayout={(e) => setPanelY(e.nativeEvent.layout.height)}>
              {altPanel}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** Sol üst beyaz geri hapı ("‹ İstanbul"); #39 ile Çizelge de kullanır. */
export function GeriHapi({ baslik, onPress }: { baslik: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('genel.geri')}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [s.geriHap, s.golge, pressed && { opacity: 0.8 }]}>
      <Text style={s.geriIsaret}>‹</Text>
      <Text style={s.geriMetin} numberOfLines={1}>
        {baslik}
      </Text>
    </Pressable>
  );
}

/** #53 §3: 36 px yuvarlak geri + büyük şehir adı (22 px) + altında gün özeti. */
function BuyukBaslik({ baslik, alt, onGeri }: { baslik: string; alt: string; onGeri: () => void }) {
  return (
    <View style={s.buyukBaslik}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={onGeri} hitSlop={8} style={({ pressed }) => [s.geriDaire, s.golge, pressed && { opacity: 0.8 }]}>
        <Ikon ad="geri" boyut={20} renk={renk.metin} kalinlik={2.4} />
      </Pressable>
      <View style={{ flexShrink: 1 }}>
        <Text style={s.sehir} numberOfLines={1}>
          {baslik}
        </Text>
        {alt ? (
          <Text style={s.sehirAlt} numberOfLines={1}>
            {alt}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Sağ üst bilgi hapı (kanvas: "Roma · 2/2"). */
export function BilgiHapi({ metin }: { metin: string }) {
  return (
    <View style={[s.bilgiHap, s.golge]}>
      <Text style={s.bilgiMetin} numberOfLines={1}>
        {metin}
      </Text>
    </View>
  );
}

/** Aramanın altında ortalanmış siyah eylem hapı (kanvas: "Bu bölgede ara"). */
export function EylemHapi({ metin, onPress, yukleniyor }: { metin: string; onPress: () => void; yukleniyor?: boolean }) {
  return (
    <View style={s.eylemSatir} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: !!yukleniyor, disabled: !!yukleniyor }}
        disabled={yukleniyor}
        onPress={onPress}
        style={({ pressed }) => [s.eylemHap, s.golge, pressed && { opacity: 0.85 }]}>
        <Text style={s.eylemMetin}>{yukleniyor ? t('genel.yukleniyor') : `⌕ ${metin}`}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.yuzey },
  gecis: { position: 'absolute', left: 0, right: 0, top: 0, height: GECIS_YUKSEKLIK },
  buyukBaslik: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  geriDaire: { width: 36, height: 36, borderRadius: 18, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  sehir: { fontFamily: yazi.ekstra, fontSize: 22, lineHeight: 28, color: renk.metin },
  sehirAlt: { fontFamily: yazi.yari, fontSize: 12, color: renk.ikincil },
  golge: {
    shadowColor: renk.metin,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  ust: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: bosluk.kenar, gap: 10 },
  ustSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  geriHap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    minHeight: 36,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: renk.zemin,
    maxWidth: '70%',
  },
  geriIsaret: { fontFamily: yazi.kalin, fontSize: 22, lineHeight: 24, color: renk.metin, marginTop: -2 },
  geriMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin, flexShrink: 1 },
  bilgiHap: { height: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center' },
  bilgiMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  aramaSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arama: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: renk.zemin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eylemSatir: { alignItems: 'center' },
  eylemHap: { height: 34, minHeight: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.metin, justifyContent: 'center' },
  eylemMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.zemin },
  alt: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  altNot: { fontFamily: yazi.normal, fontSize: 10, color: renk.ikincil, textAlign: 'right', paddingHorizontal: bosluk.kenar, paddingBottom: 8 },
  panel: {
    marginHorizontal: 0,
    paddingHorizontal: bosluk.kenar,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: renk.zemin,
  },
  panelTam: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  panelGolge: {
    shadowColor: renk.metin,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 26,
    elevation: 12,
  },
});
