// #181 KK4 (kanvas 23 · 23b): Gezi sayfasının kapağı — Gece zemin, sağ üstte kesik Mandalina yol süsü. Seyahatler'e dön, paylaş
// (davet linki), ⋯ menü; başlık, tarih satırı, kişi yığını (dokununca Seyahattekiler) ve durum çipi.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import type { Uye } from '@/lib/tipler';
import { renk, yazi, yuzRenkleri } from '@/theme';

const BEYAZ_14 = 'rgba(255,255,255,0.14)';

type Props = {
  baslik: string;
  tarih: string;
  uyeler: Uye[];
  cip: { tur: 'kalan' | 'bugun'; metin: string } | null;
  onSeyahatler: () => void;
  onPaylas: () => void;
  onMenu: () => void;
  onGrup: () => void;
};

export function GeziKapagi({ baslik, tarih, uyeler, cip, onSeyahatler, onPaylas, onMenu, onGrup }: Props) {
  const ust = useSafeAreaInsets().top;
  return (
    <View style={[s.kapak, { paddingTop: ust + 8 }]}>
      <Svg width={220} height={140} viewBox="0 0 220 140" style={s.sus} pointerEvents="none">
        <Path d="M10 120 Q80 20 130 70 T214 24" stroke={renk.vurgu} strokeWidth={5} fill="none" strokeDasharray="11 7" />
        <Circle cx={214} cy={24} r={6} fill={renk.vurgu} />
      </Svg>
      <View style={s.ustSatir}>
        <Pressable accessibilityRole="button" onPress={onSeyahatler} hitSlop={6} style={({ pressed }) => [s.geri, pressed && { opacity: 0.8 }]}>
          <Ikon ad="geri" boyut={20} renk={renk.zemin} kalinlik={2.6} />
          <Text style={s.geriMetin}>{t('geziSayfasi.seyahatler')}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('geziSayfasi.paylas')} onPress={onPaylas} hitSlop={4} style={({ pressed }) => [s.kare, pressed && { opacity: 0.8 }]}>
            <Ikon ad="paylas" boyut={18} renk={renk.zemin} kalinlik={2.3} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('geziSayfasi.menu')} onPress={onMenu} hitSlop={4} style={({ pressed }) => [s.kare, pressed && { opacity: 0.8 }]}>
            <Ikon ad="daha" boyut={18} renk={renk.zemin} kalinlik={2.3} />
          </Pressable>
        </View>
      </View>
      <View style={s.baslikAlani}>
        <Text accessibilityRole="header" style={s.baslik} numberOfLines={2}>
          {baslik}
        </Text>
        <Text style={s.tarih}>{tarih}</Text>
      </View>
      <View style={s.altSatir}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('geziSayfasi.seyahattekiler')} onPress={onGrup} hitSlop={6} style={s.kisiler}>
          <View style={{ flexDirection: 'row' }}>
            {uyeler.slice(0, 4).map((u, i) => (
              <View key={u.user_id} style={[s.yuz, i > 0 && { marginLeft: -8 }]}>
                <Avatar ad={u.display_name} url={u.photo_url} boyut={28} arkaPlan={yuzRenkleri[i % yuzRenkleri.length]} />
              </View>
            ))}
          </View>
          <Text style={s.kisiMetin}>{t('geziSayfasi.kisi', { n: uyeler.length })}</Text>
        </Pressable>
        {cip ? (
          <View style={[s.cip, cip.tur === 'bugun' && { backgroundColor: renk.basari }]}>
            <Text style={[s.cipMetin, cip.tur === 'bugun' && { color: renk.zemin }]}>{cip.metin}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kapak: { backgroundColor: renk.ana, paddingHorizontal: 20, paddingBottom: 18, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  sus: { position: 'absolute', right: -10, top: 30, opacity: 0.9 },
  ustSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  geri: { height: 40, paddingLeft: 8, paddingRight: 14, borderRadius: 999, backgroundColor: BEYAZ_14, flexDirection: 'row', alignItems: 'center', gap: 4 },
  geriMetin: { fontFamily: yazi.baslik, fontSize: 15, color: renk.zemin },
  kare: { width: 40, height: 40, borderRadius: 12, backgroundColor: BEYAZ_14, alignItems: 'center', justifyContent: 'center' },
  baslikAlani: { marginTop: 22, gap: 6 },
  baslik: { fontFamily: yazi.baslik, fontSize: 34, lineHeight: 36, letterSpacing: -1, color: renk.zemin },
  tarih: { fontFamily: yazi.yari, fontSize: 14, color: renk.anaAcik },
  altSatir: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kisiler: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  yuz: { borderWidth: 2, borderColor: renk.zemin, borderRadius: 10 },
  kisiMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.zemin },
  cip: { height: 26, paddingHorizontal: 10, borderRadius: 8, backgroundColor: renk.vurgu, justifyContent: 'center' },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.metin },
});
