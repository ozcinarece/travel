// #98 KK3 → #139 (kanvas 5): 2. adım "Ne zaman?" — tek ay kartı (önceki / sonraki ay), iki dokunuş = aralık (gidiş · dönüş
// Gece kare, arası Buz şerit, bugün Mandalina çerçeve); altta Gece özet kartı "16 – 19 Ekim · Cuma – Pazartesi" + "4 gün · 3 gece".
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { gunFarki, tarihDokun, type Aralik } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { AYLAR, GUNLER, ayIzgarasi, ayKaydir, haftaGunu, parcala } from '@/lib/takvim';
import { yerelTarih } from '@/lib/zaman';
import { kose, renk, yazi } from '@/theme';

const GUN_KISA = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

/** "16 – 19 Ekim" (aynı ay) · "30 Ekim – 2 Kasım" · tek gün "16 Ekim". */
function aralikBasligi(a: NonNullable<Aralik>): string {
  const g = parcala(a.gidis);
  const son = a.donus ?? a.gidis;
  const d = parcala(son);
  if (son === a.gidis) return `${g.gun} ${AYLAR[g.ay - 1]}`;
  if (g.ay === d.ay && g.yil === d.yil) return `${g.gun} – ${d.gun} ${AYLAR[g.ay - 1]}`;
  return `${g.gun} ${AYLAR[g.ay - 1]} – ${d.gun} ${AYLAR[d.ay - 1]}`;
}

export function AdimNeZaman({ aralik, onAralik, kilitli }: { aralik: Aralik; onAralik: (a: Aralik) => void; kilitli: boolean }) {
  const bugun = yerelTarih(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  const ilk = parcala(aralik?.gidis ?? bugun);
  const [ay, setAy] = useState({ yil: ilk.yil, ay: ilk.ay });
  const secili = (g: string) => !!aralik && (g === aralik.gidis || g === aralik.donus);
  const arada = (g: string) => !!aralik?.donus && aralik.gidis <= g && g <= aralik.donus;
  const son = aralik ? (aralik.donus ?? aralik.gidis) : null;
  const gunSayisi = aralik && son ? gunFarki(aralik.gidis, son) + 1 : 0;
  const hucreler = ayIzgarasi(ay.yil, ay.ay);
  return (
    <View style={s.kap}>
      {kilitli ? <Text style={s.not}>{t('sihirbaz.nezaman.kilitli')}</Text> : null}
      <View style={s.kart}>
        <View style={s.ayBasi}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('sihirbaz.nezaman.oncekiAy')} onPress={() => setAy(ayKaydir(ay.yil, ay.ay, -1))} style={s.ok}>
            <Ikon ad="geri" boyut={16} renk={renk.ana} kalinlik={2.8} />
          </Pressable>
          <Text style={s.ayAdi}>
            {AYLAR[ay.ay - 1]} {ay.yil}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('sihirbaz.nezaman.sonrakiAy')} onPress={() => setAy(ayKaydir(ay.yil, ay.ay, 1))} style={s.ok}>
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <Ikon ad="geri" boyut={16} renk={renk.ana} kalinlik={2.8} />
            </View>
          </Pressable>
        </View>
        <View style={s.satir}>
          {GUN_KISA.map((g) => (
            <Text key={g} style={s.gunAdi}>
              {g}
            </Text>
          ))}
        </View>
        <View style={s.izgara}>
          {hucreler.map((gun, i) => {
            if (!gun) return <View key={`bos-${i}`} style={s.hucre} />;
            const sec = secili(gun);
            const bandi = arada(gun);
            const basBand = bandi && gun === aralik!.gidis;
            const sonBand = bandi && gun === aralik!.donus;
            const gecmis = gun < bugun;
            return (
              <Pressable
                key={gun}
                accessibilityRole="button"
                accessibilityLabel={gun}
                accessibilityState={{ selected: sec, disabled: kilitli || gecmis }}
                disabled={kilitli || gecmis}
                onPress={() => onAralik(tarihDokun(aralik, gun))}
                style={[s.hucre, bandi && s.band, basBand && s.bandBas, sonBand && s.bandSon]}>
                <View style={[s.gunKutu, sec && s.gunSecili, gun === bugun && !sec && s.bugun]}>
                  <Text style={[s.gunSayi, gecmis && s.gecmis, bandi && !sec && { color: renk.ana }, sec && s.gunSayiSecili]}>{parcala(gun).gun}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      {aralik && son ? (
        <View style={s.ozet}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.ozetBaslik}>{aralikBasligi(aralik)}</Text>
            <Text style={s.ozetAlt}>{son === aralik.gidis ? GUNLER[haftaGunu(aralik.gidis)] : `${GUNLER[haftaGunu(aralik.gidis)]} – ${GUNLER[haftaGunu(son)]}`}</Text>
          </View>
          <View style={s.rozet}>
            <Text style={s.rozetMetin}>{gunSayisi === 1 ? t('sihirbaz.nezaman.tekGun') : t('sihirbaz.nezaman.gunGece', { gun: gunSayisi, gece: gunSayisi - 1 })}</Text>
          </View>
        </View>
      ) : (
        <Text style={s.not}>{t('sihirbaz.nezaman.ozetYok')}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 16 },
  not: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  kart: { borderWidth: 1, borderColor: renk.ayrac, borderRadius: kose.kart, paddingTop: 14, paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  ayBasi: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  ok: { width: 40, height: 40, borderRadius: kose.alan, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  ayAdi: { fontFamily: yazi.baslik, fontSize: 17, color: renk.metin },
  satir: { flexDirection: 'row' },
  gunAdi: { flex: 1, textAlign: 'center', fontFamily: yazi.ekstra, fontSize: 12, color: renk.ikincil },
  izgara: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 },
  hucre: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  band: { backgroundColor: renk.yuzey },
  bandBas: { borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  bandSon: { borderTopRightRadius: 14, borderBottomRightRadius: 14 },
  gunKutu: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  gunSecili: { backgroundColor: renk.ana },
  bugun: { width: 36, height: 36, borderRadius: kose.alan, borderWidth: 2, borderColor: renk.vurgu },
  gunSayi: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  gunSayiSecili: { color: renk.zemin },
  gecmis: { color: '#b4bbd3' },
  ozet: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: renk.ana, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ozetBaslik: { fontFamily: yazi.baslik, fontSize: 19, color: renk.zemin },
  ozetAlt: { fontFamily: yazi.yari, fontSize: 14, color: renk.anaAcik },
  rozet: { height: 30, paddingHorizontal: 10, borderRadius: kose.rozet, backgroundColor: renk.vurgu, justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
});
