import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { AYLAR_KISA, GUNLER_KISA, haftaGunu, parcala } from '@/lib/takvim';
import type { Durak, Gun } from '@/lib/tipler';
import { gunRengi, renk, yazi } from '@/theme';

type Props = {
  gunler: Gun[];
  duraklar: Durak[];
  seciliId: string | undefined;
  /** Bugünün indeksi (aktif seyahatte tarih turuncu). */
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

/** #53 §4: hücre alt satırı — tarihli "Cmt 10", tarihsiz "5 durak" / "boş". */
export function gunHucreAlti(gun: Gun, durakSayisi: number): string {
  if (gun.date) return `${GUNLER_KISA[haftaGunu(gun.date)]} ${parcala(gun.date).gun}`;
  return durakSayisi > 0 ? t('gunler.durakSayisi', { n: durakSayisi }) : t('gunler.bosKisa');
}

/** 3 güne kadar şerit kaymaz (eşit genişlik); 4+ günde yatay kayar. */
const KAYMADAN_SIGAN = 3;
const KAYAN_HUCRE = 84;

/**
 * #53 §4 gün seçici: tek parça beyaz şerit (4 px iç boşluk, 16 px köşe), eşit genişlikte 44 px hücreler —
 * renk noktası + "N. gün", altında "Cmt 10". Seçili gün siyah değil: #f1f1ef zemin, koyu yazı, altta günün renginde
 * 22×3 px çizgi; seçili olmayan gri yazı, nokta %50. Sonda "+" (gün ekle); uzun bas → Günü sil. Metin asla "…" değil.
 */
export function GunKartlari({ gunler, duraklar, seciliId, bugunIndex, onSec, onUzunBas, onEkle, ekleniyor }: Props) {
  const kayar = gunler.length > KAYMADAN_SIGAN;
  const hucreler = gunler.map((g) => {
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
        style={[s.hucre, kayar ? { width: KAYAN_HUCRE } : { flex: 1 }, aktif && s.hucreAktif]}>
        <View style={s.ustSatir}>
          <View style={[s.nokta, { backgroundColor: rengi }, !aktif && { opacity: 0.5 }]} />
          <Text style={[s.baslik, !aktif && s.soluk]}>{t('program.gunSec', { n: g.index })}</Text>
        </View>
        <Text style={[s.alt, g.index === bugunIndex && { color: renk.vurgu }]}>{gunHucreAlti(g, n)}</Text>
        {aktif ? <View style={[s.cizgi, { backgroundColor: rengi }]} /> : null}
      </Pressable>
    );
  });
  const arti = onEkle ? (
    <Pressable accessibilityRole="button" accessibilityLabel={t('gunler.gunEkle')} disabled={ekleniyor} onPress={onEkle} style={s.arti}>
      <Text style={s.artiIsaret}>+</Text>
    </Pressable>
  ) : null;
  return (
    <View style={[s.serit, s.golge]}>
      {kayar ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.icerik} keyboardShouldPersistTaps="handled">
          {hucreler}
          {arti}
        </ScrollView>
      ) : (
        <View style={[s.icerik, { flex: 1 }]}>
          {hucreler}
          {arti}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  serit: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: renk.zemin },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  icerik: { flexDirection: 'row', gap: 4 },
  hucre: { height: 44, borderRadius: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  hucreAktif: { backgroundColor: '#f1f1ef' },
  ustSatir: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nokta: { width: 8, height: 8, borderRadius: 4 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 13, lineHeight: 16, color: renk.metin },
  soluk: { color: renk.ikincil },
  alt: { fontFamily: yazi.normal, fontSize: 11, lineHeight: 14, color: renk.ikincil },
  cizgi: { position: 'absolute', bottom: 3, width: 22, height: 3, borderRadius: 1.5 },
  arti: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  artiIsaret: { fontFamily: yazi.kalin, fontSize: 22, lineHeight: 24, color: renk.metin },
});
