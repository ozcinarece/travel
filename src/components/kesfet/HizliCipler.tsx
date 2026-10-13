// #164 KK3 / #165 KK6 (kanvas 9 · 9c): Keşfet hızlı çipleri — Turistik · Yemek · Kafe · Park · Alışveriş · Tümü (tek seçim).
// Üst çubukta gölgeli beyaz haplar; çekmecenin tam halinde çerçeveli beyaz (aynı filtre durumu).
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { HIZLI_CIPLER, hizliCipBas, hizliCipSecili, type Filtre, type HizliCip } from '@/features/yerler/filtre';
import { t } from '@/i18n';
import { KATEGORI_PIN } from '@/lib/pinIkonu';
import { bosluk, renk, yazi } from '@/theme';

type Props = {
  filtre: Filtre;
  onFiltre: (f: Filtre) => void;
  /** Çekmece (tam hal) görünümü: gölgesiz, 1,5 px çerçeveli. */
  cerceveli?: boolean;
  /** Hiçbir çip seçili görünmez (ör. çekmecede "Rehberden" seçiliyken). */
  secimYok?: boolean;
  /** Çip dokunuşundan sonra (ör. çekmece "Rehberden"den bölgeye döner). */
  onSecildi?: () => void;
  /** Sondaki ek çip(ler). */
  ek?: ReactNode;
};

export function HizliCipler({ filtre, onFiltre, cerceveli, secimYok, onSecildi, ek }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.kaydirma} contentContainerStyle={s.cipler} keyboardShouldPersistTaps="handled">
      {HIZLI_CIPLER.map((c) => (
        <HizliCipDugmesi
          key={c}
          cip={c}
          secili={!secimYok && hizliCipSecili(filtre, c)}
          cerceveli={cerceveli}
          onPress={() => {
            onFiltre(hizliCipBas(filtre, c));
            onSecildi?.();
          }}
        />
      ))}
      {ek}
    </ScrollView>
  );
}

/**
 * #141 KK7 / #164 (kanvas 9): hızlı çip — seçili Gece dolu beyaz yazı; diğerleri beyaz, glif kategori renginde. Turistik grubun
 * glifi kamera (gezilecek); "Tümü" glifsiz.
 */
function HizliCipDugmesi({ cip, secili, cerceveli, onPress }: { cip: HizliCip; secili: boolean; cerceveli?: boolean; onPress: () => void }) {
  const k = cip === 'tumu' ? null : KATEGORI_PIN[cip === 'turistik' ? 'gezilecek' : cip];
  const metin = cip === 'tumu' ? t('kesfet.tumu') : cip === 'turistik' ? t('kesfet.filtre.turistik') : t(`kesfet.filtre.kategoriler.${cip}`);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: secili }} onPress={onPress} style={[s.cip, cerceveli ? s.cerceve : s.golge, secili && s.cipAktif]}>
      {k ? <Ikon ad={k.ikon} boyut={14} renk={secili ? renk.zemin : k.renk} kalinlik={2.4} /> : null}
      <Text style={[s.cipMetin, secili && s.cipMetinAktif]}>{metin}</Text>
    </Pressable>
  );
}

/** Çekmecenin "Rehberden" çipi (hızlı çiplerle aynı görünüm, çerçeveli). */
export function EkCip({ metin, secili, onPress }: { metin: string; secili: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: secili }} onPress={onPress} style={[s.cip, s.cerceve, secili && s.cipAktif]}>
      <Text style={[s.cipMetin, secili && s.cipMetinAktif]}>{metin}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  kaydirma: { marginHorizontal: -bosluk.kenar },
  cipler: { gap: 6, paddingHorizontal: bosluk.kenar },
  cip: { height: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.zemin, flexDirection: 'row', alignItems: 'center', gap: 5 },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3 },
  cerceve: { borderWidth: 1.5, borderColor: renk.ayrac },
  cipAktif: { backgroundColor: renk.ana, borderColor: renk.ana },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  cipMetinAktif: { color: renk.zemin },
});
