import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { AYLAR_KISA, GUNLER_KISA, haftaGunu, parcala } from '@/lib/takvim';
import type { Durak, Gun } from '@/lib/tipler';
import { bosluk, gunRengi, renk, yazi } from '@/theme';

type Props = {
  gunler: Gun[];
  duraklar: Durak[];
  seciliId: string | undefined;
  /** Bugünün indeksi (aktif seyahatte turuncu çerçeve). */
  bugunIndex?: number | null;
  onSec: (id: string) => void;
  /** Uzun basma: "Günü sil" onayı (3.5 KK7). */
  onUzunBas?: (gun: Gun) => void;
  onEkle?: () => void;
  ekleniyor?: boolean;
};

/** "Pzt 12 Eki" */
export function kisaGunTarihi(tarih: string): string {
  const { ay, gun } = parcala(tarih);
  return `${GUNLER_KISA[haftaGunu(tarih)]} ${gun} ${AYLAR_KISA[ay - 1]}`;
}

/**
 * #42 KK3–4: yatay gün kartları — yalnız renk noktası, "N. gün", kısa tarih, durak sayısı (tempo etiketi yok).
 * Seçili kart siyah; diğerleri %55 soluk. Sonda "+" kartı (gün ekle); karta uzun bas → Günü sil.
 */
export function GunKartlari({ gunler, duraklar, seciliId, bugunIndex, onSec, onUzunBas, onEkle, ekleniyor }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.kaydirma} contentContainerStyle={s.kartlar} keyboardShouldPersistTaps="handled">
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
            style={[s.kart, s.golge, aktif ? s.kartAktif : s.kartSoluk, !aktif && g.index === bugunIndex && { borderColor: renk.vurgu }]}>
            <View style={s.ustSatir}>
              <View style={[s.nokta, { backgroundColor: rengi }, aktif && { borderColor: renk.metin }]} />
              <Text style={[s.baslik, aktif && s.acik]} numberOfLines={1}>
                {t('program.gunSec', { n: g.index })}
              </Text>
            </View>
            <Text style={[s.alt, aktif && s.acikSoluk]} numberOfLines={1}>
              {g.date ? `${kisaGunTarihi(g.date)} · ` : ''}
              {n > 0 ? t('gunler.durakSayisi', { n }) : t('gunler.durakYokKart')}
            </Text>
          </Pressable>
        );
      })}
      {onEkle ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('gunler.gunEkle')} disabled={ekleniyor} onPress={onEkle} style={[s.kart, s.golge, s.ekle]}>
          <Text style={s.ekleIsaret}>+</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  kaydirma: { marginHorizontal: -bosluk.kenar },
  kartlar: { gap: 8, paddingHorizontal: bosluk.kenar, paddingVertical: 2 },
  kart: { width: 124, height: 58, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: renk.zemin, borderWidth: 1.5, borderColor: renk.zemin, justifyContent: 'space-between' },
  kartAktif: { backgroundColor: renk.metin, borderColor: renk.metin },
  kartSoluk: { opacity: 0.55 },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  ustSatir: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nokta: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: renk.zemin },
  baslik: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin, flexShrink: 1 },
  acik: { color: renk.zemin },
  acikSoluk: { color: '#a3a3a3' },
  alt: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  ekle: { width: 48, alignItems: 'center', justifyContent: 'center', borderColor: renk.ayrac, opacity: 1 },
  ekleIsaret: { fontFamily: yazi.kalin, fontSize: 24, lineHeight: 26, color: renk.metin },
});
