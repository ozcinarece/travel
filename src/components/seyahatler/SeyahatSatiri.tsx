// #144 → #275 (kanvas 29d · Profil › Gezilerim): geçmiş seyahat satırı — harf karosu, ad, "Ay yıl · N mekan gezildi · N kişi",
// Tekrar kur; yaklaşan seyahat satırı — harf karosu, ad, "12–14 Aralık · N kişi" ya da "Taslak · tarih yok", sağda chevron.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';

import { kisiMetni, type SeyahatDurumu } from '@/features/seyahatler/durum';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { ayYil, tarihAraligi } from '@/lib/takvim';
import type { SeyahatOzet } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

/** #174 KK1: `onUzunBas` — kartın eylem menüsü (sahip: Seyahati sil · üye: Seyahatten ayrıl). */
type Ortak = { seyahat: SeyahatOzet; durum: SeyahatDurumu | undefined; onPress: () => void; onUzunBas?: () => void };

const KARO_ZEMINLERI = ['#ffe2cc', '#dce6ff', '#d7f0e6', '#e6e0fa', '#ffd9bf'];

export function GecmisSatiri({ seyahat, durum, onPress, onUzunBas, onTekrar, sira }: Ortak & { onTekrar: () => void; sira: number }) {
  const parcalar = [seyahat.end_date ? ayYil(seyahat.end_date) : t('seyahatler.tarihBelliDegil'), t('seyahatler.gezildi', { n: durum?.gezilen ?? 0 })];
  if (seyahat.members.length > 1) parcalar.push(kisiMetni(seyahat.members.length));
  return (
    <Pressable accessibilityRole="button" onPress={onPress} onLongPress={onUzunBas} style={({ pressed }) => [s.gecmis, pressed && { opacity: 0.85 }]}>
      <View style={[s.karo, { backgroundColor: KARO_ZEMINLERI[(sira + 1) % KARO_ZEMINLERI.length] }]}>
        <Text style={s.harf}>{seyahat.city_label.trim().charAt(0).toLocaleUpperCase('tr')}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.satirAd} numberOfLines={1}>
          {seyahatAdi(seyahat)}
        </Text>
        <Text style={s.satirAlt} numberOfLines={1}>
          {parcalar.join(' · ')}
        </Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onTekrar} hitSlop={6} style={s.tekrar}>
        <Text style={s.tekrarMetin}>{t('seyahatler.tekrarKur')}</Text>
      </Pressable>
    </Pressable>
  );
}

/** #275 (kanvas 29d · YAKLAŞAN): bitmemiş seyahat ya da taslak; satırın tamamı seyahati açar, düğme yok. */
export function YaklasanSatiri({ seyahat, onPress, onUzunBas, sira }: Omit<Ortak, 'durum'> & { sira: number }) {
  const tarih = seyahat.start_date && seyahat.end_date ? tarihAraligi(seyahat.start_date, seyahat.end_date) : null;
  const parcalar = [tarih ?? t('seyahatler.taslakTarihYok')];
  if (tarih && seyahat.members.length > 1) parcalar.push(kisiMetni(seyahat.members.length));
  return (
    <Pressable accessibilityRole="button" onPress={onPress} onLongPress={onUzunBas} style={({ pressed }) => [s.gecmis, pressed && { opacity: 0.85 }]}>
      <View style={[s.karo, { backgroundColor: KARO_ZEMINLERI[(sira + 1) % KARO_ZEMINLERI.length] }]}>
        <Text style={s.harf}>{seyahat.city_label.trim().charAt(0).toLocaleUpperCase('tr')}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.satirAd} numberOfLines={1}>
          {seyahatAdi(seyahat)}
        </Text>
        <Text style={s.satirAlt} numberOfLines={1}>
          {parcalar.join(' · ')}
        </Text>
      </View>
      <View style={s.ok}>
        <Ikon ad="geri" boyut={20} renk={renk.soluk} kalinlik={2.6} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  ok: { transform: [{ rotate: '180deg' }] },
  karo: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  harf: { fontFamily: yazi.baslik, fontSize: 20, color: renk.ana },
  satirAd: { fontFamily: yazi.baslik, fontSize: 17, color: renk.metin },
  satirAlt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  gecmis: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: '#f4f6fa' },
  tekrar: { height: 34, paddingHorizontal: 10, borderRadius: 10, backgroundColor: renk.zemin, justifyContent: 'center' },
  tekrarMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
});
