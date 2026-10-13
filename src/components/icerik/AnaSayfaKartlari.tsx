// #138 (kanvas 3 · 3b): ana sayfanın iki Gece kartı — yaklaşan seyahat ve "İlk seyahatini kur". Süs rotası SVG (kesik Mandalina).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { Rozet } from '@/components/ui/Rozet';
import { t } from '@/i18n';
import { kose, renk, yazi } from '@/theme';

const YUZ = [renk.vurgu, renk.zemin, renk.anaAcik];

export function YaklasanKart(p: { rozet: string; ad: string; alt: string; uyeler: { user_id: string; display_name: string }[]; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={p.onPress} style={({ pressed }) => [s.kart, pressed && { opacity: 0.95 }]}>
      <Svg width={210} height={130} viewBox="0 0 210 130" style={s.sus} pointerEvents="none">
        <Path d="M14 110 C70 40 110 100 150 56 S196 20 200 18" stroke={renk.vurgu} strokeWidth={6} fill="none" strokeDasharray="12 8" />
        <Circle cx={200} cy={18} r={9} fill={renk.vurgu} />
      </Svg>
      <Rozet metin={p.rozet} tur="vurgu" />
      <View style={{ gap: 4 }}>
        <Text style={s.ad} numberOfLines={1}>
          {p.ad}
        </Text>
        <Text style={s.alt} numberOfLines={1}>
          {p.alt}
        </Text>
      </View>
      <View style={s.altSatir}>
        <View style={s.yuzler}>
          {p.uyeler.slice(0, 3).map((u, i) => (
            <View key={u.user_id} style={[s.yuzCerceve, i > 0 && { marginLeft: -8 }]}>
              <Avatar ad={u.display_name} boyut={30} arkaPlan={YUZ[i % YUZ.length]} />
            </View>
          ))}
        </View>
        <View style={s.dugme}>
          <Text style={s.dugmeMetin}>{t('anasayfa.programaGit')}</Text>
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Ikon ad="geri" boyut={16} renk={renk.ana} kalinlik={2.6} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function IlkSeyahatKarti({ baslik, onPress }: { baslik: string; onPress: () => void }) {
  return (
    <View style={[s.kart, s.ilkKart]}>
      <View style={s.ilkHarita} pointerEvents="none">
        <Svg width="100%" height={168} viewBox="0 0 350 168" preserveAspectRatio="xMidYMid slice">
          <Path d="M-10 120 Q90 80 180 112 T360 96" stroke="#1e3680" strokeWidth={20} fill="none" />
          <Path d="M70 -10 Q100 80 70 180" stroke="#1e3680" strokeWidth={14} fill="none" />
          <Path d="M44 130 C100 60 160 140 220 80 S300 40 312 36" stroke={renk.vurgu} strokeWidth={5} fill="none" strokeDasharray="11 7" />
        </Svg>
        <View style={[s.pin, { left: 30, top: 116, backgroundColor: '#2c64f5' }]}>
          <Text style={s.pinMetin}>1</Text>
        </View>
        <View style={[s.pin, { left: 202, top: 62, backgroundColor: '#f5a524' }]}>
          <Text style={[s.pinMetin, { color: renk.metin }]}>2</Text>
        </View>
      </View>
      <View style={s.ilkGovde}>
        <Text style={s.ad}>{baslik}</Text>
        <Text style={s.ilkMetin}>{t('anasayfa.ilkAlt')}</Text>
        <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.basla, pressed && { opacity: 0.85 }]}>
          <Text style={s.baslaMetin}>{t('anasayfa.ilkDugme')}</Text>
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Ikon ad="geri" boyut={16} renk={renk.metin} kalinlik={2.8} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kart: { borderRadius: kose.kart, backgroundColor: renk.ana, padding: 20, gap: 14, overflow: 'hidden' },
  sus: { position: 'absolute', right: -8, top: 0 },
  ad: { fontFamily: yazi.baslik, fontSize: 26, lineHeight: 28, letterSpacing: -0.8, color: renk.zemin },
  alt: { fontFamily: yazi.yari, fontSize: 15, color: renk.anaAcik },
  altSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yuzler: { flexDirection: 'row' },
  yuzCerceve: { borderWidth: 2, borderColor: renk.ana, borderRadius: 12 },
  dugme: { height: 46, paddingHorizontal: 18, borderRadius: kose.dugme, backgroundColor: renk.zemin, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dugmeMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.ana },
  ilkKart: { padding: 0, gap: 0, borderRadius: 26 },
  ilkHarita: { height: 168 },
  pin: { position: 'absolute', width: 30, height: 30, borderRadius: 9, borderWidth: 3, borderColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  pinMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.zemin },
  ilkGovde: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, gap: 10 },
  ilkMetin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22, color: renk.anaAcik },
  basla: { marginTop: 4, height: 52, borderRadius: kose.dugme, backgroundColor: renk.vurgu, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  baslaMetin: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin },
});
