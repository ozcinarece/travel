import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { yazi } from '@/theme';

import { Hap } from './Hap';
import { yGolge, yGolgeKucuk, yRenk } from './tema';

// #155 ortak bileşenler (kanvas BO-0 / BO-1 / BO-2). Düğme: ./Hap.

export type RozetTuru = 'notr' | 'ana' | 'basari' | 'bekliyor' | 'vurgu' | 'hata';

const ROZET: Record<RozetTuru, { zemin: string; metin: string }> = {
  /** "Örnek veri" */
  notr: { zemin: yRenk.yuzey, metin: yRenk.ikincil },
  /** Bölüm numarası, "Kart" etiketi */
  ana: { zemin: yRenk.yuzey, metin: yRenk.ana },
  /** "hedefte", Yayında */
  basari: { zemin: yRenk.basariZemin, metin: yRenk.basariMetin },
  /** "Taslak değişiklik var" */
  bekliyor: { zemin: yRenk.bekliyorZemin, metin: yRenk.bekliyorMetin },
  /** Seçili bölüm numarası */
  vurgu: { zemin: yRenk.vurgu, metin: yRenk.metin },
  hata: { zemin: yRenk.hataZemin, metin: yRenk.hata },
};

/** Rozet: 26 px, 8 köşe, 12 px 800 (kanvas "Taslak değişiklik var", "Örnek veri"). */
export function Rozet({ etiket, tur = 'notr' }: { etiket: string; tur?: RozetTuru }) {
  return (
    <View style={[s.rozet, { backgroundColor: ROZET[tur].zemin }]}>
      <Text numberOfLines={1} style={[s.rozetMetin, { color: ROZET[tur].metin }]}>
        {etiket}
      </Text>
    </View>
  );
}

/** Segment (kanvas BO-0 Bugün / 7 gün / 30 gün): Buz iz, 3 iç boşluk; 34 px düğmeler, seçili beyaz + gölge. */
export function Segment<T extends string>({ secili, secenekler, onSec, etiket }: { secili: T; secenekler: { deger: T; etiket: string }[]; onSec: (d: T) => void; etiket?: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={etiket} style={s.segment}>
      {secenekler.map((o) => {
        const aktif = o.deger === secili;
        return (
          <Pressable
            key={o.deger}
            accessibilityRole="radio"
            accessibilityState={{ checked: aktif }}
            onPress={() => onSec(o.deger)}
            style={StyleSheet.flatten([s.segmentDugme, aktif && s.segmentAktif])}>
            <Text style={[s.segmentMetin, aktif && s.segmentMetinAktif]}>{o.etiket}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type SekmeTanimi<T extends string> = { secili: T; sekmeler: { anahtar: T; etiket: string }[]; onSec: (a: T) => void };

/** Alt çizgili sekmeler (kanvas BO-1 başlık): 44 px, 24 aralık, 14 px 800; seçili Lacivert + 3 px Mandalina çizgi. */
export function AltCizgiliSekmeler<T extends string>({ secili, sekmeler, onSec }: SekmeTanimi<T>) {
  return (
    <View accessibilityRole="tablist" style={s.sekmeler}>
      {sekmeler.map((sk) => {
        const aktif = sk.anahtar === secili;
        return (
          <Pressable
            key={sk.anahtar}
            accessibilityRole="tab"
            accessibilityState={{ selected: aktif }}
            onPress={() => onSec(sk.anahtar)}
            style={StyleSheet.flatten([s.sekme, aktif && s.sekmeAktif])}>
            <Text style={[s.sekmeMetin, aktif && s.sekmeMetinAktif]}>{sk.etiket}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Kart: beyaz, 22 köşe, 20 iç boşluk, hafif Gece gölgesi (kanvas BO-0 KPI ve tablo kartları). */
export function Kart({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.kart, style]}>{children}</View>;
}

/** Kart üst etiketi: 12 px 800 büyük harf, .06em, #6A7290 (kanvas "İLK SAATLİK PLANA KADAR"). */
export function KartEtiketi({ children }: { children: string }) {
  return <Text style={s.kartEtiket}>{children.toLocaleUpperCase('tr-TR')}</Text>;
}

/**
 * Liste satırı (kanvas BO-1 bölüm listesi): 44 px, 10 köşe, 8 aralık; seçili Buz zemin. Sol öğe (numara rozeti, ikon),
 * 14 px 800 başlık (seçili Gece), sağda 12 px ikincil açıklama.
 */
export function ListeSatiri({ baslik, aciklama, sol, sag, secili, onPress }: { baslik: string; aciklama?: string; sol?: ReactNode; sag?: ReactNode; secili?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!secili }}
      onPress={onPress}
      style={StyleSheet.flatten([s.satir, secili && s.satirSecili])}>
      {sol}
      <Text numberOfLines={1} style={[s.satirBaslik, secili && s.satirBaslikSecili]}>
        {baslik}
      </Text>
      {aciklama ? <Text style={s.satirAciklama}>{aciklama}</Text> : null}
      {sag}
    </Pressable>
  );
}

/** Kayıt durumu (kanvas BO-1): 8 px yeşil nokta + 13 px Gri mavi "Kaydedildi 11:20"; hatada kırmızı. */
export function KayitDurumu({ metin, hata }: { metin: string; hata?: boolean }) {
  return (
    <View accessibilityRole="text" style={s.kayit}>
      <View style={[s.nokta, { backgroundColor: hata ? yRenk.hata : yRenk.basari }]} />
      <Text style={[s.kayitMetin, hata && { color: yRenk.hata }]}>{metin}</Text>
    </View>
  );
}

/** Bildirim (kanvas BO-2): altta ortada, 48 px, 14 köşe, Lacivert zemin, beyaz 14 px; sağda Mandalina eylem ("Geri al"). */
export function Bildirim({ metin, eylem, onEylem }: { metin: string; eylem?: string; onEylem?: () => void }) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.bildirim}>
      <Text style={s.bildirimMetin}>{metin}</Text>
      {eylem && onEylem ? <Hap kucuk tur="vurgu" baslik={eylem} onPress={onEylem} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  rozet: { height: 26, paddingHorizontal: 10, borderRadius: 8, justifyContent: 'center', flexShrink: 0 },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 12 },
  segment: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 12, backgroundColor: yRenk.yuzey, alignSelf: 'flex-start' },
  segmentDugme: { height: 34, paddingHorizontal: 12, borderRadius: 9, justifyContent: 'center' },
  segmentAktif: { backgroundColor: yRenk.zemin, boxShadow: yGolgeKucuk },
  segmentMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.ikincil },
  segmentMetinAktif: { color: yRenk.metin },
  sekmeler: { flexDirection: 'row', gap: 24 },
  sekme: { height: 44, paddingHorizontal: 2, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  sekmeAktif: { borderBottomColor: yRenk.vurgu },
  sekmeMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: yRenk.soluk },
  sekmeMetinAktif: { color: yRenk.metin },
  kart: { backgroundColor: yRenk.zemin, borderRadius: 22, padding: 20, boxShadow: yGolge },
  kartEtiket: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.72, color: yRenk.soluk },
  satir: { height: 44, paddingHorizontal: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  satirSecili: { backgroundColor: yRenk.yuzey },
  satirBaslik: { flex: 1, minWidth: 0, fontFamily: yazi.ekstra, fontSize: 14, color: yRenk.metin },
  satirBaslikSecili: { color: yRenk.ana },
  satirAciklama: { fontFamily: yazi.normal, fontSize: 12, color: yRenk.ikincil },
  kayit: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nokta: { width: 8, height: 8, borderRadius: 4 },
  kayitMetin: { fontFamily: yazi.normal, fontSize: 13, color: yRenk.ikincil },
  bildirim: {
    position: 'absolute',
    left: '50%',
    bottom: 24,
    transform: [{ translateX: '-50%' }],
    zIndex: 40,
    height: 48,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: 14,
    backgroundColor: yRenk.metin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    boxShadow: '0 12px 28px rgba(14,20,48,0.3)',
  },
  bildirimMetin: { fontFamily: yazi.normal, fontSize: 14, color: yRenk.zemin },
});
