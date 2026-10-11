// #91 B (kanvas OtherDayRoute10): diğer gün noktasının üstündeki siyah gün hapı — görünüm; yerleşim hap.ts'te.
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { renk, yazi } from '@/theme';

import { HAP_NOKTA_BOSLUGU_PX, HAP_UCGEN, HAP_YUKSEKLIK } from './hap';
import type { GunHapi } from './tipler';

type Props = {
  hap: GunHapi;
  /** Üçgenin hap içindeki x'i (sol kenardan, px) — hapYerlesimi. */
  uc: number;
  onLayout?: (e: LayoutChangeEvent) => void;
};

/**
 * Hap 30 px, siyah, 999 köşe; solda gün rengi 7 px nokta, "Cum 16 · Odunpazarı Evleri" 11 px / 700 beyaz, sağda beyaz
 * "Güne git" düğmesi (22 px, 10,5 px / 800). Altında 8 px üçgen (45° döndürülmüş kare). Gölge 0 4 12 %25. Görünüm altta
 * HAP_NOKTA_BOSLUGU_PX boşluk taşır: işaretçi çapası y = 1 → hapın altı nokta merkezinin 18 px üstünde kalır.
 * Düğme ayrı dokunma hedefi değildir: Android'de işaretçi bitmap'tir; hapın tamamına dokunmak "Güne git" sayılır.
 */
export function GunHapiIcerigi({ hap, uc, onLayout }: Props) {
  return (
    <View style={s.kap} collapsable={false}>
      <View style={[s.hap, s.golge]} onLayout={onLayout}>
        <View style={[s.nokta, { backgroundColor: hap.renk }]} />
        <Text style={s.metin} numberOfLines={1}>
          {hap.metin}
        </Text>
        <View style={s.dugme}>
          <Text style={s.dugmeMetin}>{hap.dugme}</Text>
        </View>
      </View>
      <View style={[s.ucgen, { left: uc - HAP_UCGEN / 2 }]} />
    </View>
  );
}

const s = StyleSheet.create({
  kap: { paddingBottom: HAP_NOKTA_BOSLUGU_PX, alignItems: 'flex-start' },
  hap: {
    height: HAP_YUKSEKLIK,
    borderRadius: 999,
    backgroundColor: renk.metin,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 6,
    gap: 8,
    maxWidth: 320,
  },
  golge: { shadowColor: '#0f0f0f', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  nokta: { width: 7, height: 7, borderRadius: 4 },
  metin: { color: renk.zemin, fontSize: 11, fontFamily: yazi.kalin, flexShrink: 1 },
  dugme: { height: 22, paddingHorizontal: 9, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center' },
  dugmeMetin: { color: renk.metin, fontSize: 10.5, fontFamily: yazi.ekstra },
  // Üçgen: hapın alt kenarının 4 px üstünden başlayan 45° kare; görünen ucu ~6 px aşağıda.
  ucgen: { position: 'absolute', top: HAP_YUKSEKLIK - HAP_UCGEN / 2, width: HAP_UCGEN, height: HAP_UCGEN, backgroundColor: renk.metin, transform: [{ rotate: '45deg' }] },
});
