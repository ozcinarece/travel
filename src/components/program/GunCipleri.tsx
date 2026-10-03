import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import type { Durak, Gun } from '@/lib/tipler';
import { bosluk, gunRengi, renk, yazi } from '@/theme';

type Props = {
  gunler: Gun[];
  duraklar: Durak[];
  seciliId: string | undefined;
  /** Bugünün indeksi (aktif seyahatte turuncu çerçeve). */
  bugunIndex?: number | null;
  onSec: (id: string) => void;
  /** Uzun basma: gün silme onayı (3.5 KK7). */
  onUzunBas?: (gun: Gun) => void;
  onEkle?: () => void;
  ekleniyor?: boolean;
  /** Harita üstünde (gölgeli, beyaz) ya da düz zeminde. */
  yuzen?: boolean;
};

/** #34: Program sekmesinin ortak gün çipleri (numara + durak sayısı, gün rengi; sonda "+ gün"). Harita ve Çizelge aynı bileşeni kullanır. */
export function GunCipleri({ gunler, duraklar, seciliId, bugunIndex, onSec, onUzunBas, onEkle, ekleniyor, yuzen }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.kaydirma} contentContainerStyle={s.cipler} keyboardShouldPersistTaps="handled">
      {gunler.map((g) => {
        const aktif = g.id === seciliId;
        const rengi = gunRengi(g.index);
        const n = duraklar.filter((d) => d.day_id === g.id).length;
        return (
          <Pressable
            key={g.id}
            accessibilityRole="button"
            accessibilityState={{ selected: aktif }}
            accessibilityLabel={`${t('program.gunSec', { n: g.index })} · ${t('gunler.durakSayisi', { n })}`}
            onPress={() => onSec(g.id)}
            onLongPress={onUzunBas ? () => onUzunBas(g) : undefined}
            style={[
              s.cip,
              yuzen ? s.golge : s.duz,
              aktif ? { backgroundColor: rengi, borderColor: rengi } : { borderColor: g.index === bugunIndex ? renk.vurgu : yuzen ? rengi : renk.ayrac },
            ]}>
            <View style={[s.numara, { backgroundColor: aktif ? renk.zemin : rengi }]}>
              <Text style={[s.numaraMetin, { color: aktif ? rengi : renk.zemin }]}>{g.index}</Text>
            </View>
            <Text style={[s.metin, aktif && { color: renk.zemin }]}>{n > 0 ? t('gunler.durakSayisi', { n }) : t('gunler.durakYok')}</Text>
          </Pressable>
        );
      })}
      {onEkle ? (
        <Pressable accessibilityRole="button" disabled={ekleniyor} onPress={onEkle} style={[s.cip, yuzen ? s.golge : s.duz, s.ekle]}>
          <Text style={s.metin}>{t('gunler.gunEkle')}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  kaydirma: { marginHorizontal: -bosluk.kenar },
  cipler: { gap: 8, paddingHorizontal: bosluk.kenar },
  cip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingLeft: 5, paddingRight: 12, borderRadius: 999, backgroundColor: renk.zemin, borderWidth: 1.5 },
  duz: { backgroundColor: renk.zemin },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  ekle: { borderColor: renk.ayrac, paddingLeft: 12 },
  numara: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  numaraMetin: { fontFamily: yazi.ekstra, fontSize: 11 },
  metin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
});
