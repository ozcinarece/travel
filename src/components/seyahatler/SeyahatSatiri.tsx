// #144 (kanvas 20): Seyahatler kartları — yaklaşan ilk seyahat Gece kapak kartı (geri sayım çipi, ad, "tarih · N mekan · N kişi",
// somut durum çipleri), diğer yaklaşanlar çerçeveli satır (tarihsizse TASLAK), geçmiş soluk satır ("N mekan gezildi" + Tekrar kur).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { durumCipleri, geriSayim, kisiMetni, type DurumCipi, type SeyahatDurumu } from '@/features/seyahatler/durum';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { ayYil, tarihAraligi } from '@/lib/takvim';
import type { SeyahatOzet } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

/** #174 KK1: `onUzunBas` — kartın eylem menüsü (sahip: Seyahati sil · üye: Seyahatten ayrıl). */
type Ortak = { seyahat: SeyahatOzet; durum: SeyahatDurumu | undefined; onPress: () => void; onUzunBas?: () => void };

const KARO_ZEMINLERI = ['#ffe2cc', '#dce6ff', '#d7f0e6', '#e6e0fa', '#ffd9bf'];

const tarihMetni = (sy: SeyahatOzet) => (sy.start_date && sy.end_date ? tarihAraligi(sy.start_date, sy.end_date) : t('seyahatler.tarihBelliDegil'));
const altMetin = (sy: SeyahatOzet) => [tarihMetni(sy), t('seyahatler.mekan', { n: sy.places[0]?.count ?? 0 }), kisiMetni(sy.members.length)].join(' · ');

function Cipler({ cipler, koyu, onCip }: { cipler: DurumCipi[]; koyu?: boolean; onCip: (c: DurumCipi) => void }) {
  if (cipler.length === 0) return null;
  return (
    <View style={s.cipler}>
      {cipler.map((c) => (
        <Pressable key={c.anahtar} accessibilityRole={c.uyari ? 'button' : 'text'} disabled={!c.uyari} onPress={() => onCip(c)} hitSlop={4} style={[s.cip, c.uyari ? s.cipUyari : koyu ? s.cipKoyu : s.cipAcik]}>
          <Text style={[s.cipMetin, c.uyari ? { color: renk.metin } : koyu ? { color: renk.zemin } : { color: renk.ana }]}>{c.metin}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Yaklaşan (ya da şu an süren) ilk tarihli seyahat. */
export function KapakKarti({ seyahat, durum, onPress, onUzunBas, onCip, siradaki }: Ortak & { onCip: (c: DurumCipi) => void; siradaki?: string | null }) {
  const sayim = geriSayim(seyahat);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} onLongPress={onUzunBas} style={({ pressed }) => [s.kapak, pressed && { opacity: 0.92 }]}>
      <Svg width={180} height={120} viewBox="0 0 180 120" style={s.kapakSusu} pointerEvents="none">
        <Path d="M10 100 Q90 10 170 70" stroke={renk.vurgu} strokeOpacity={0.35} strokeWidth={6} strokeDasharray="10 8" fill="none" />
      </Svg>
      {sayim ? <Text style={s.sayim}>{sayim}</Text> : null}
      <View>
        <Text style={s.kapakAd} numberOfLines={1}>
          {seyahatAdi(seyahat)}
        </Text>
        <Text style={s.kapakAlt} numberOfLines={1}>
          {altMetin(seyahat)}
        </Text>
        {siradaki ? (
          <Text style={s.kapakSiradaki} numberOfLines={1}>
            {siradaki}
          </Text>
        ) : null}
      </View>
      <Cipler cipler={durumCipleri(seyahat, durum)} koyu onCip={onCip} />
    </Pressable>
  );
}

export function SeyahatSatiri({ seyahat, durum, onPress, onUzunBas, onCip, sira }: Ortak & { onCip: (c: DurumCipi) => void; sira: number }) {
  const taslak = !seyahat.start_date;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} onLongPress={onUzunBas} style={({ pressed }) => [s.satir, pressed && { opacity: 0.85 }]}>
      <View style={s.satirUst}>
        <View style={[s.karo, { backgroundColor: KARO_ZEMINLERI[sira % KARO_ZEMINLERI.length] }]}>
          <Text style={s.harf}>{seyahat.city_label.trim().charAt(0).toLocaleUpperCase('tr')}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.satirAd} numberOfLines={1}>
            {seyahatAdi(seyahat)}
          </Text>
          <Text style={s.satirAlt} numberOfLines={1}>
            {altMetin(seyahat)}
          </Text>
        </View>
        {taslak ? <Text style={s.taslak}>{t('seyahatler.taslak')}</Text> : null}
      </View>
      <Cipler cipler={durumCipleri(seyahat, durum)} onCip={onCip} />
    </Pressable>
  );
}

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

const s = StyleSheet.create({
  kapak: { borderRadius: 22, backgroundColor: renk.ana, padding: 18, gap: 10, overflow: 'hidden' },
  kapakSusu: { position: 'absolute', right: -20, top: -10 },
  sayim: { alignSelf: 'flex-start', height: 24, lineHeight: 24, paddingHorizontal: 9, borderRadius: 8, overflow: 'hidden', backgroundColor: renk.vurgu, color: renk.metin, fontFamily: yazi.ekstra, fontSize: 11 },
  kapakAd: { fontFamily: yazi.baslik, fontSize: 22, letterSpacing: -0.4, color: renk.zemin },
  kapakAlt: { fontFamily: yazi.normal, fontSize: 14, color: '#c9d2f2' },
  kapakSiradaki: { fontFamily: yazi.yari, fontSize: 13, color: renk.zemin, paddingTop: 4 },
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cip: { height: 28, paddingHorizontal: 10, borderRadius: 9, justifyContent: 'center' },
  cipKoyu: { backgroundColor: 'rgba(255,255,255,0.14)' },
  cipAcik: { backgroundColor: renk.yuzey },
  cipUyari: { backgroundColor: renk.vurgu },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 12 },
  satir: { padding: 12, borderRadius: 20, borderWidth: 1.5, borderColor: renk.ayrac, gap: 10 },
  satirUst: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  karo: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  harf: { fontFamily: yazi.baslik, fontSize: 20, color: renk.ana },
  satirAd: { fontFamily: yazi.baslik, fontSize: 17, color: renk.metin },
  satirAlt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  taslak: { height: 24, lineHeight: 24, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden', backgroundColor: renk.yuzey, color: renk.ana, fontFamily: yazi.ekstra, fontSize: 11 },
  gecmis: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: '#f4f6fa' },
  tekrar: { height: 34, paddingHorizontal: 10, borderRadius: 10, backgroundColor: renk.zemin, justifyContent: 'center' },
  tekrarMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
});
