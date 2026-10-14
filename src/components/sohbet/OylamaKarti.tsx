// #184 KK3 (kanvas 26): oylama mesajı — soru, seçenek çubukları (oran; benim oyumda ✓), oy verenlerin avatarları ve sayı; altta
// oy vermeyenler ve kapanış; seçenek mekansa ve tek kazanan varsa "Plana ekle". Seçeneğe dokununca oy verilir / değişir.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import type { Kisiler } from '@/features/harcama/metin';
import type { Oylama, OylamaOzeti, OylamaSecenegi } from '@/features/sohbet/sohbet';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

type Props = {
  oylama: Oylama;
  ozet: OylamaOzeti;
  k: Kisiler;
  benId: string | null;
  /** "yarın 12:00'de kapanır" / "kapandı" / null (kapanışsız). */
  kapanis: string | null;
  onOy: (secenekId: string) => void;
  /** Kazanan mekan seçeneği için (planda değilse). */
  onPlanaEkle?: (s: OylamaSecenegi) => void;
};

const KAZANAN = '#ffd9bf';
const DIGER = '#dce3f6';

export function OylamaKarti({ oylama, ozet, k, benId, kapanis, onOy, onPlanaEkle }: Props) {
  const vermeyenler = ozet.oyVermeyenler.filter((id) => id !== benId || ozet.kapali);
  const altMetin = [
    vermeyenler.length ? t('sohbet.oylama.vermedi', { adlar: vermeyenler.map((id) => (id === benId ? t('harcama.sen') : k.ad(id))).join(', ') }) : null,
    kapanis,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={s.kart}>
      <View style={s.ust}>
        <Ikon ad="grafik" boyut={14} renk={renk.ikincil} kalinlik={2.6} />
        <Text style={s.etiket}>{ozet.kapali ? t('sohbet.oylama.etiketKapali') : t('sohbet.oylama.etiket')}</Text>
      </View>
      <Text style={s.soru}>{oylama.soru}</Text>
      {ozet.secenekler.map(({ secenek, oy, oran, oyVerenler }) => {
        const benim = ozet.benimOyum === secenek.id;
        return (
          <Pressable
            key={secenek.id}
            accessibilityRole="button"
            accessibilityState={{ selected: benim, disabled: ozet.kapali }}
            accessibilityLabel={t('sohbet.oylama.secenekEtiketi', { metin: secenek.metin, n: oy })}
            disabled={ozet.kapali}
            onPress={() => onOy(secenek.id)}
            style={s.secenek}
          >
            <View style={[s.dolgu, { width: `${Math.round(oran * 100)}%`, backgroundColor: ozet.kazanan?.id === secenek.id ? KAZANAN : DIGER }]} />
            <View style={s.secenekMetin}>
              {benim ? <Ikon ad="tik" boyut={14} renk={renk.ana} kalinlik={2.8} /> : null}
              <Text style={s.secenekAd} numberOfLines={1}>
                {secenek.metin}
              </Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              {oyVerenler.slice(0, 4).map((id, i) => (
                <View key={id} style={[s.yuz, i > 0 && { marginLeft: -5 }]}>
                  <Avatar ad={k.ad(id)} url={k.foto(id)} boyut={20} arkaPlan={k.renk(id)} />
                </View>
              ))}
            </View>
            <Text style={s.sayi}>{oy}</Text>
          </Pressable>
        );
      })}
      {altMetin || (ozet.kazanan?.place_id && onPlanaEkle) ? (
        <View style={s.alt}>
          <Text style={s.altMetin}>{altMetin}</Text>
          {ozet.kazanan?.place_id && onPlanaEkle ? (
            <Text accessibilityRole="button" onPress={() => onPlanaEkle(ozet.kazanan!)} style={s.planaEkle}>
              {t('sohbet.oylama.planaEkle')}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  kart: { width: 280, padding: 12, borderRadius: 16, backgroundColor: renk.zemin, borderWidth: 1.5, borderColor: renk.ayrac, gap: 8 },
  ust: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, letterSpacing: 0.66, color: renk.ikincil },
  soru: { fontFamily: yazi.ekstra, fontSize: 14, lineHeight: 18, color: renk.metin },
  secenek: { height: 40, borderRadius: 10, backgroundColor: renk.yuzey, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8 },
  dolgu: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  secenekMetin: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  secenekAd: { flexShrink: 1, fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  yuz: { borderRadius: 7, borderWidth: 1.5, borderColor: renk.zemin },
  sayi: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ikincil, minWidth: 10, textAlign: 'right' },
  alt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  altMetin: { flex: 1, fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  planaEkle: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
});
