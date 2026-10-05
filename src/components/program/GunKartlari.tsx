import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { AYLAR_KISA, GUNLER_KISA, haftaGunu, parcala } from '@/lib/takvim';
import type { Durak, Gun } from '@/lib/tipler';
import type { TempoEtiketi } from '@/schedule/tempo';
import { bosluk, gunRengi, renk, yazi } from '@/theme';

export type KartEtiketi = TempoEtiketi | 'bos';

type Props = {
  gunler: Gun[];
  duraklar: Durak[];
  seciliId: string | undefined;
  /** Gün kimliği → tempo etiketi (Rahat/Normal/Yoğun/Boş). */
  etiketler: Map<string, KartEtiketi>;
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
 * #39 KK3: yatay kaydırmalı gün kartları — "N. gün", gün rengi noktası, kısa tarih, durak sayısı, tempo etiketi.
 * Seçili kart siyah zemin; sonda "+" kartı (gün ekle); karta uzun bas → Günü sil. Harita ve Çizelge aynı bileşeni kullanır.
 */
export function GunKartlari({ gunler, duraklar, seciliId, etiketler, bugunIndex, onSec, onUzunBas, onEkle, ekleniyor }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.kaydirma} contentContainerStyle={s.kartlar} keyboardShouldPersistTaps="handled">
      {gunler.map((g) => {
        const aktif = g.id === seciliId;
        const rengi = gunRengi(g.index);
        const n = duraklar.filter((d) => d.day_id === g.id).length;
        const etiket = etiketler.get(g.id) ?? 'bos';
        return (
          <Pressable
            key={g.id}
            accessibilityRole="button"
            accessibilityState={{ selected: aktif }}
            accessibilityLabel={`${t('program.gunSec', { n: g.index })} · ${t('gunler.durakSayisi', { n })} · ${t(`gunler.tempo.${etiket}`)}`}
            onPress={() => onSec(g.id)}
            onLongPress={onUzunBas ? () => onUzunBas(g) : undefined}
            style={[s.kart, s.golge, aktif && s.kartAktif, !aktif && g.index === bugunIndex && { borderColor: renk.vurgu }]}>
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
            <Text style={[s.etiket, ETIKET_RENK[etiket], aktif && ETIKET_RENK_AKTIF[etiket]]}>{t(`gunler.tempo.${etiket}`)}</Text>
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

const ETIKET_RENK = {
  rahat: { color: renk.basari },
  normal: { color: renk.ikincil },
  yogun: { color: renk.uyari },
  bos: { color: renk.soluk },
} as const;
const ETIKET_RENK_AKTIF = {
  rahat: { color: '#7fd6a0' },
  normal: { color: '#c4c4c4' },
  yogun: { color: '#ff9a6b' },
  bos: { color: '#8a8a8a' },
} as const;

const s = StyleSheet.create({
  kaydirma: { marginHorizontal: -bosluk.kenar },
  kartlar: { gap: 8, paddingHorizontal: bosluk.kenar, paddingVertical: 2 },
  kart: { width: 128, height: 76, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: renk.zemin, borderWidth: 1.5, borderColor: renk.zemin, justifyContent: 'space-between' },
  kartAktif: { backgroundColor: renk.metin, borderColor: renk.metin },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  ustSatir: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nokta: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: renk.zemin },
  baslik: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin, flexShrink: 1 },
  acik: { color: renk.zemin },
  acikSoluk: { color: '#a3a3a3' },
  alt: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  etiket: { fontFamily: yazi.kalin, fontSize: 11 },
  ekle: { width: 56, alignItems: 'center', justifyContent: 'center', borderColor: renk.ayrac },
  ekleIsaret: { fontFamily: yazi.kalin, fontSize: 24, lineHeight: 26, color: renk.metin },
});
