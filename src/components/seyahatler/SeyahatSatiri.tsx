import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { tarihAraligi } from '@/lib/takvim';
import type { SeyahatOzet } from '@/lib/tipler';
import { minDokunma, renk, yazi } from '@/theme';

type Props = { seyahat: SeyahatOzet; benimId: string; onPress: () => void };

// PRD 3.1 KK2: yaklaşan satırı — baş harf karosu, şehir, "tarih · N kişi · otel seçilmedi / X davet etti".
export function SeyahatSatiri({ seyahat, benimId, onPress }: Props) {
  const sahip = seyahat.members.find((u) => u.role === 'owner');
  const benimki = sahip?.user_id === benimId;
  const parcalar = [
    seyahat.start_date && seyahat.end_date ? tarihAraligi(seyahat.start_date, seyahat.end_date) : t('seyahatler.tarihsiz'),
  ];
  if (seyahat.members.length > 1) parcalar.push(t('seyahatler.kisi', { n: seyahat.members.length }));
  if (benimki && !(seyahat.stays?.[0]?.count ?? (seyahat.hotel_place_id ? 1 : 0))) parcalar.push(t('seyahatler.otelYok'));
  if (!benimki && sahip) parcalar.push(t('seyahatler.davetEden', { ad: sahip.display_name }));

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.satir, pressed && s.basili]}>
      <View style={s.karo}>
        <Text style={s.harf}>{seyahat.city_label.trim().charAt(0).toLocaleUpperCase('tr')}</Text>
      </View>
      <View style={s.metinler}>
        <Text style={s.sehir} numberOfLines={1}>
          {seyahat.city_label}
        </Text>
        <Text style={s.alt} numberOfLines={1}>
          {parcalar.join(' · ')}
        </Text>
      </View>
      <Text style={s.ok}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    minHeight: minDokunma,
    borderTopWidth: 1,
    borderTopColor: renk.ayrac,
  },
  basili: { opacity: 0.7 },
  karo: { width: 48, height: 48, borderRadius: 12, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  harf: { fontFamily: yazi.ekstra, fontSize: 17, color: renk.metin },
  metinler: { flex: 1, gap: 2 },
  sehir: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ok: { fontFamily: yazi.kalin, fontSize: 22, color: '#c4c4c4' },
});
