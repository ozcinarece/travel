// #98 KK3 · 2. adım "Ne zaman?": takvimde iki dokunuş = aralık; üstte özet "16 – 19 Ekim · 4 gün · 3 gece". Tarihsiz
// seyahat kurulabilir ("Tarihim belli değil"). Aylar alt alta (bugünden 6 ay).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tarihDokun, tarihOzeti, type Aralik } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { AYLAR, GUNLER_KISA, ayIzgarasi, ayKaydir, parcala } from '@/lib/takvim';
import { yerelTarih } from '@/lib/zaman';
import { minDokunma, renk, yazi } from '@/theme';

const AY_SAYISI = 6;

export function AdimNeZaman({ aralik, onAralik, kilitli }: { aralik: Aralik; onAralik: (a: Aralik) => void; kilitli: boolean }) {
  const bugun = yerelTarih(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  const ilk = parcala(aralik?.gidis ?? bugun);
  const aylar = Array.from({ length: AY_SAYISI }, (_, i) => ayKaydir(ilk.yil, ilk.ay, i));
  const secili = (g: string) => !!aralik && (g === aralik.gidis || g === aralik.donus);
  const arada = (g: string) => !!aralik?.donus && aralik.gidis < g && g < aralik.donus;
  const ozet = tarihOzeti(aralik);
  return (
    <View style={s.kap}>
      <View style={s.ozetKutu}>
        <Text style={[s.ozet, !ozet && { color: renk.soluk }]}>{ozet || t('sihirbaz.nezaman.ozetYok')}</Text>
      </View>
      {kilitli ? <Text style={s.not}>{t('sihirbaz.nezaman.kilitli')}</Text> : null}
      {aylar.map(({ yil, ay }) => (
        <View key={`${yil}-${ay}`} style={s.ay}>
          <Text style={s.ayAdi}>
            {AYLAR[ay - 1]} {yil}
          </Text>
          <View style={s.satir}>
            {GUNLER_KISA.map((g) => (
              <Text key={g} style={s.gunAdi}>
                {g.slice(0, 2)}
              </Text>
            ))}
          </View>
          <View style={s.izgara}>
            {ayIzgarasi(yil, ay).map((gun, i) =>
              gun ? (
                <Pressable
                  key={gun}
                  accessibilityRole="button"
                  accessibilityLabel={gun}
                  accessibilityState={{ selected: secili(gun), disabled: kilitli }}
                  disabled={kilitli}
                  onPress={() => onAralik(tarihDokun(aralik, gun))}
                  style={[s.hucre, arada(gun) && s.hucreArada, secili(gun) && s.hucreSecili]}>
                  <Text style={[s.gunSayi, gun === bugun && s.bugun, gun < bugun && s.gecmis, secili(gun) && s.gunSayiSecili]}>{parcala(gun).gun}</Text>
                </Pressable>
              ) : (
                <View key={`bos-${i}`} style={s.hucre} />
              ),
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 14 },
  ozetKutu: { alignSelf: 'flex-start', paddingHorizontal: 14, height: 36, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  ozet: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  not: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ay: { gap: 4 },
  ayAdi: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin, paddingBottom: 4 },
  satir: { flexDirection: 'row' },
  gunAdi: { flex: 1, textAlign: 'center', fontFamily: yazi.yari, fontSize: 11, color: renk.soluk },
  izgara: { flexDirection: 'row', flexWrap: 'wrap' },
  hucre: { width: `${100 / 7}%`, height: minDokunma, alignItems: 'center', justifyContent: 'center' },
  hucreArada: { backgroundColor: renk.yuzey },
  hucreSecili: { backgroundColor: renk.metin, borderRadius: 12 },
  gunSayi: { fontFamily: yazi.yari, fontSize: 14, color: renk.metin },
  gunSayiSecili: { color: renk.zemin, fontFamily: yazi.kalin },
  bugun: { color: renk.vurgu, fontFamily: yazi.ekstra },
  gecmis: { color: renk.soluk },
});
