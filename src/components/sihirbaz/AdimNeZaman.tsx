// #98 KK3 → #139 (kanvas 5): 2. adım "Ne zaman?" — tek ay kartı (önceki / sonraki ay), iki dokunuş = aralık (gidiş · dönüş
// Gece kare, arası Buz şerit, bugün Mandalina çerçeve); altta Gece özet kartı "16 – 19 Ekim · Cuma – Pazartesi" + "4 gün · 3 gece".
// #581 KK1: ilk dokunuştan sonra üstte "Dönüş günü?" ipucu (satır yeri hep ayrılı; takvim parmağın altında kaymaz).
// #581 KK2: "Tarihim belli değil" seçilince özet kartının yerinde "Kaç gün? − N +" sayacı (#583 "Seyahatime al" sayacıyla
// aynı dil); takvimde bir güne dokunmak tarihli seçime döner. #581 KK3: tarih kilidi kalktı.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { donusSinirDisi, gunFarki, tarihDokun, TARIHSIZ_EN_AZ, TARIHSIZ_EN_COK, type Aralik } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { AYLAR, GUNLER, ayIzgarasi, ayKaydir, haftaGunu, parcala } from '@/lib/takvim';
import { yerelTarih } from '@/lib/zaman';
import { baslikStili, kose, renk, yazi } from '@/theme';

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

type Props = {
  aralik: Aralik;
  onAralik: (a: Aralik) => void;
  /** KK2: tarihsiz seçimde gün sayısı; null → tarihli seçim. */
  tarihsizGun: number | null;
  onTarihsizGun: (n: number) => void;
  /**
   * #574 KK5 (`Kur_v11_Cekmece`): verilirse özet kartı yerine tek satır ("5–6 Aralık · Cumartesi–Pazar · 2 gün", 14/700);
   * null → seçim yok ("Gidiş gününe dokun"). Verilmezse sihirbazdaki özet kartı.
   */
  ozetSatiri?: string | null;
  /** #574: dokunuşun yeni aralığı (verilmezse `tarihDokun(aralik, gun)`); çekmece gösterilenden farklı gerçek seçimle hesaplar. */
  dokun?: (aralik: Aralik, gun: string) => Aralik;
  /** "Dönüş günü?" ipucu (verilmezse yalnız gidiş seçiliyken). */
  donusBekleniyor?: boolean;
  /**
   * #603 KK3: verilirse dönüş beklenirken gidişten itibaren bu kadar günden sonrası seçilemez (geçmiş günler gibi soluk).
   * #649 KK1: "Kaç gün?" sayacının üst sınırı da budur (verilmezse `TARIHSIZ_EN_COK`).
   */
  enCokGun?: number;
  /** #649 KK1: sınırın hesaplandığı gerçek seçim (verilmezse `aralik`); çekmece hesaplanan dönüşü gösterirken gidişi verir. */
  sinirAraligi?: Aralik;
};

export function AdimNeZaman({ aralik, onAralik, tarihsizGun, onTarihsizGun, ozetSatiri, dokun = tarihDokun, donusBekleniyor, enCokGun, sinirAraligi = aralik }: Props) {
  const sayacEnCok = enCokGun ?? TARIHSIZ_EN_COK;
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
      <Text style={s.ipucu} accessibilityLiveRegion="polite">
        {(donusBekleniyor ?? (!!aralik && !aralik.donus)) ? t('sihirbaz.nezaman.donusIpucu') : ''}
      </Text>
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
            const gecmis = gun < bugun || (enCokGun !== undefined && donusSinirDisi(sinirAraligi, gun, enCokGun));
            return (
              <Pressable
                key={gun}
                accessibilityRole="button"
                accessibilityLabel={gun}
                accessibilityState={{ selected: sec, disabled: gecmis }}
                disabled={gecmis}
                onPress={() => onAralik(dokun(aralik, gun))}
                style={[s.hucre, bandi && s.band, basBand && s.bandBas, sonBand && s.bandSon]}>
                <View style={[s.gunKutu, sec && s.gunSecili, gun === bugun && !sec && s.bugun]}>
                  <Text style={[s.gunSayi, gecmis && s.gecmis, bandi && !sec && { color: renk.ana }, sec && s.gunSayiSecili]}>{parcala(gun).gun}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      {tarihsizGun !== null ? (
        <View style={s.sayacKart}>
          <Text style={s.sayacEtiket}>{t('sihirbaz.nezaman.kacGun')}</Text>
          <View style={s.sayac}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('sihirbaz.nezaman.gunAzalt')}
              accessibilityState={{ disabled: tarihsizGun <= TARIHSIZ_EN_AZ }}
              disabled={tarihsizGun <= TARIHSIZ_EN_AZ}
              onPress={() => onTarihsizGun(tarihsizGun - 1)}
              style={[s.sayacDugme, tarihsizGun <= TARIHSIZ_EN_AZ && s.sayacPasif]}
              hitSlop={8}>
              <Text style={s.sayacIsaret}>−</Text>
            </Pressable>
            <Text style={s.sayacDeger}>{t('sihirbaz.nezaman.gunSayisi', { n: tarihsizGun })}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('sihirbaz.nezaman.gunArttir')}
              accessibilityState={{ disabled: tarihsizGun >= sayacEnCok }}
              disabled={tarihsizGun >= sayacEnCok}
              onPress={() => onTarihsizGun(tarihsizGun + 1)}
              style={[s.sayacDugme, tarihsizGun >= sayacEnCok && s.sayacPasif]}
              hitSlop={8}>
              <Text style={s.sayacIsaret}>+</Text>
            </Pressable>
          </View>
        </View>
      ) : ozetSatiri !== undefined ? (
        <Text style={ozetSatiri ? s.ozetSatir : s.not}>{ozetSatiri ?? t('sihirbaz.nezaman.ozetYok')}</Text>
      ) : aralik && son ? (
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
  ozetSatir: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin, paddingTop: 6 },
  // KK1: yeri hep ayrılı (boşken de); ipucu çıkınca takvim kaymaz.
  ipucu: { fontFamily: yazi.kalin, fontSize: 15, lineHeight: 20, minHeight: 20, color: renk.ana, marginBottom: -8 },
  kart: { borderWidth: 1, borderColor: renk.ayrac, borderRadius: kose.kart, paddingTop: 14, paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  ayBasi: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  ok: { width: 40, height: 40, borderRadius: kose.alan, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  ayAdi: { ...baslikStili(17), color: renk.metin },
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
  ozetBaslik: { ...baslikStili(19), color: renk.zemin },
  ozetAlt: { fontFamily: yazi.yari, fontSize: 14, color: renk.anaAcik },
  rozet: { height: 30, paddingHorizontal: 10, borderRadius: kose.rozet, backgroundColor: renk.vurgu, justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  // KK2: #583 "Seyahatime al" gün sayacıyla aynı ölçüler.
  sayacKart: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 18, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sayacEtiket: { ...baslikStili(17), color: renk.metin },
  sayac: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 3, borderRadius: 12, backgroundColor: renk.zemin },
  sayacDugme: { width: 30, height: 30, borderRadius: 9, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  sayacPasif: { opacity: 0.4 },
  sayacIsaret: { fontFamily: yazi.ekstra, fontSize: 18, color: renk.ana, lineHeight: 22 },
  sayacDeger: { minWidth: 56, textAlign: 'center', fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
});
