import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { t } from '@/i18n';
import { tarihAraligi } from '@/lib/takvim';
import type { SeyahatOzet } from '@/lib/tipler';
import { gunSayisi, kacinciGun } from '@/lib/zaman';
import { minDokunma, renk, yazi } from '@/theme';

type Props = { seyahat: SeyahatOzet; onAc: () => void };

const KOYU_AVATAR = ['#ff5a1f', '#4c6ef5', '#8a8a8a'];

// PRD 3.1 KK1: aktif seyahat kartı — şehir, gün ilerlemesi, sıradaki durak, play → 3.7.
// "Sıradaki" 3.7 (Sprint 2) gelene kadar iskelettir; program yokken metin bunu söyler.
export function AktifKart({ seyahat, onAc }: Props) {
  const toplam = gunSayisi(seyahat.start_date, seyahat.end_date);
  const gun = kacinciGun(seyahat) ?? 1;
  const uyeler = seyahat.members.slice(0, 3);

  return (
    <View style={s.kart} accessibilityLabel={`${seyahat.city_label}, ${t('seyahatler.aktif.gun', { n: gun })}`}>
      <View style={s.ustSatir}>
        <View style={s.durum}>
          <View style={s.nokta} />
          <Text style={s.durumMetin}>{t('seyahatler.aktif.durum')}</Text>
        </View>
        <View style={s.avatarlar}>
          {uyeler.map((u, i) => (
            <View key={u.user_id} style={[s.avatarCerceve, i > 0 && { marginLeft: -8 }]}>
              <Avatar ad={u.display_name} boyut={22} arkaPlan={KOYU_AVATAR[i % KOYU_AVATAR.length]} />
            </View>
          ))}
        </View>
      </View>

      <View>
        <Text style={s.sehir}>{seyahat.city_label}</Text>
        <Text style={s.tarih}>
          {seyahat.start_date && seyahat.end_date ? tarihAraligi(seyahat.start_date, seyahat.end_date) : ''} ·{' '}
          {t('seyahatler.aktif.gun', { n: gun })}
        </Text>
      </View>

      <View style={s.cubuklar} accessibilityLabel={`${gun}/${toplam}`}>
        {Array.from({ length: toplam }, (_, i) => (
          <View key={i} style={[s.cubuk, i < gun && s.cubukDolu]} />
        ))}
      </View>

      <View style={s.altSatir}>
        <View>
          <Text style={s.siradakiEtiket}>{t('seyahatler.aktif.siradaki')}</Text>
          <Text style={s.siradaki}>{t('seyahatler.aktif.programYok')}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('seyahatler.aktif.ac')} onPress={onAc} style={s.oynat}>
          <Text style={s.oynatIsaret}>▶</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kart: { padding: 20, borderRadius: 24, backgroundColor: renk.metin, gap: 12 },
  ustSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  durum: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nokta: { width: 8, height: 8, borderRadius: 4, backgroundColor: renk.vurgu },
  durumMetin: { fontFamily: yazi.yari, fontSize: 12, color: renk.vurgu },
  avatarlar: { flexDirection: 'row' },
  avatarCerceve: { borderWidth: 2, borderColor: renk.metin, borderRadius: 13 },
  sehir: { fontFamily: yazi.ekstra, fontSize: 40, letterSpacing: -1.6, lineHeight: 42, color: renk.zemin },
  tarih: { fontFamily: yazi.normal, fontSize: 14, color: '#a3a3a3', paddingTop: 2 },
  cubuklar: { flexDirection: 'row', gap: 5 },
  cubuk: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#3a3a3a' },
  cubukDolu: { backgroundColor: renk.zemin },
  altSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  siradakiEtiket: { fontFamily: yazi.normal, fontSize: 11, color: '#a3a3a3' },
  siradaki: { fontFamily: yazi.kalin, fontSize: 15, color: renk.zemin },
  oynat: {
    width: 46,
    height: 46,
    minWidth: minDokunma,
    borderRadius: 23,
    backgroundColor: renk.zemin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oynatIsaret: { fontSize: 16, color: renk.metin, marginLeft: 3 },
});
