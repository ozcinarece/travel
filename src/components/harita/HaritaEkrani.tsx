import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  /** Aramanın altı: öneri listesi, çipler, "Bu bölgede ara" hapı. */
  ustEk?: ReactNode;
  /** Alt panelin hemen üstünde küçük sağa yaslı not (ör. "Otel verisi: Google"). */
  altNot?: string;
  /** Alt katmanda serbest içerik (ör. 3.4 yatay kartlar + liste çubuğu); panel zemini yok. */
  altSerbest?: ReactNode;
  /** Alttaki beyaz, üstten yuvarlak panel (kart + düğmeler). Yoksa panel çizilmez. */
  altPanel?: ReactNode;
  harita: HaritaProps;
};

/**
 * #17 KK2: tam ekran harita kabuğu — 3.3 Otel, 3.4 Keşfet ve 3.5 bunu paylaşır.
 * Harita ekranın tamamını kaplar; üstte ve altta yüzen katmanlar dokunuşu yalnız kendi alanlarında yakalar.
 */
export function HaritaEkrani({ baslik, geri, sagUst, arama, ustEk, altNot, altSerbest, altPanel, harita }: Props) {
  const kenar = useSafeAreaInsets();
  return (
    <View style={s.ekran}>
      <Harita {...harita} />

      <View style={[s.ust, { paddingTop: kenar.top + 12 }]} pointerEvents="box-none">
        <View style={s.ustSatir} pointerEvents="box-none">
          <GeriHapi baslik={baslik} onPress={geri} />
          {sagUst}
        </View>
        {arama ? <View style={[s.arama, s.golge]}>{arama}</View> : null}
        {ustEk}
      </View>

      <View style={[s.alt, altPanel ? { paddingBottom: Math.max(kenar.bottom, 14) } : { paddingBottom: kenar.bottom }]} pointerEvents="box-none">
        {altSerbest}
        {altNot ? <Text style={s.altNot}>{altNot}</Text> : null}
        {altPanel ? <View style={[s.panel, s.panelGolge]}>{altPanel}</View> : null}
      </View>
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
  panelGolge: {
    shadowColor: renk.metin,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 26,
    elevation: 12,
  },
});
