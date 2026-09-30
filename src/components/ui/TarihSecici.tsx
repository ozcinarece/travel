import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Buton } from '@/components/ui/Buton';
import { t } from '@/i18n';
import { AYLAR, GUNLER_KISA, ayIzgarasi, ayKaydir, parcala, type Tarih } from '@/lib/takvim';
import { yerelTarih } from '@/lib/zaman';
import { bosluk, minDokunma, renk, yazi } from '@/theme';

export type TarihAraligi = { gidis: Tarih; donus: Tarih } | null;

type Props = {
  acik: boolean;
  deger: TarihAraligi;
  onKapat: () => void;
  onSec: (aralik: TarihAraligi) => void;
};

/**
 * Gidiş–dönüş seçici (PRD 3.2 KK2). Kendi ay ızgaramız: web ve iki platformda aynı görünüm, ek paket yok.
 * İlk dokunuş gidiş, ikinci dokunuş dönüş; dönüş gidişten önceyse gidiş yeniden başlar. Tek gün için aynı güne iki kez.
 */
export function TarihSecici({ acik, deger, onKapat, onSec }: Props) {
  const bugun = yerelTarih(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  const baslangic = parcala(deger?.gidis ?? bugun);
  const [gorunen, setGorunen] = useState({ yil: baslangic.yil, ay: baslangic.ay });
  const [gidis, setGidis] = useState<Tarih | null>(deger?.gidis ?? null);
  const [donus, setDonus] = useState<Tarih | null>(deger?.donus ?? null);

  const dokun = (gun: Tarih) => {
    if (!gidis || donus) {
      setGidis(gun);
      setDonus(null);
    } else if (gun < gidis) {
      setGidis(gun);
    } else {
      setDonus(gun);
    }
  };

  const tamam = () => {
    if (gidis) onSec({ gidis, donus: donus ?? gidis });
    onKapat();
  };

  const hucreler = ayIzgarasi(gorunen.yil, gorunen.ay);
  const araliktaMi = (gun: Tarih) => !!gidis && !!donus && gidis < gun && gun < donus;

  return (
    <Modal visible={acik} transparent animationType="slide" onRequestClose={onKapat}>
      <Pressable style={s.perde} onPress={onKapat} accessibilityLabel={t('genel.vazgec')} />
      <View style={s.sayfa}>
        <Text style={s.baslik}>{!gidis || donus ? t('takvim.baslikGidis') : t('takvim.baslikDonus')}</Text>

        <View style={s.ayBasi}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('takvim.oncekiAy')}
            onPress={() => setGorunen(ayKaydir(gorunen.yil, gorunen.ay, -1))}
            style={s.ok}>
            <Text style={s.okIsaret}>‹</Text>
          </Pressable>
          <Text style={s.ayAdi}>
            {AYLAR[gorunen.ay - 1]} {gorunen.yil}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('takvim.sonrakiAy')}
            onPress={() => setGorunen(ayKaydir(gorunen.yil, gorunen.ay, 1))}
            style={s.ok}>
            <Text style={s.okIsaret}>›</Text>
          </Pressable>
        </View>

        <View style={s.satir}>
          {GUNLER_KISA.map((g) => (
            <Text key={g} style={s.gunAdi}>
              {g}
            </Text>
          ))}
        </View>
        <View style={s.izgara}>
          {hucreler.map((gun, i) =>
            gun ? (
              <Pressable
                key={gun}
                accessibilityRole="button"
                accessibilityLabel={gun}
                accessibilityState={{ selected: gun === gidis || gun === donus }}
                onPress={() => dokun(gun)}
                style={[
                  s.hucre,
                  araliktaMi(gun) && s.hucreArada,
                  (gun === gidis || gun === donus) && s.hucreSecili,
                ]}>
                <Text
                  style={[
                    s.gunSayi,
                    gun === bugun && s.bugun,
                    gun < bugun && s.gecmisGun,
                    (gun === gidis || gun === donus) && s.gunSayiSecili,
                  ]}>
                  {parcala(gun).gun}
                </Text>
              </Pressable>
            ) : (
              <View key={`bos-${i}`} style={s.hucre} />
            ),
          )}
        </View>

        <View style={s.dugmeler}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setGidis(null);
              setDonus(null);
              onSec(null);
              onKapat();
            }}
            hitSlop={10}>
            <Text style={s.temizle}>{t('takvim.temizle')}</Text>
          </Pressable>
          <Buton baslik={t('takvim.tamam')} onPress={tamam} pasif={!gidis} stil={s.tamam} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(15,15,15,0.35)' },
  sayfa: {
    backgroundColor: renk.zemin,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: bosluk.kenar,
    paddingTop: 18,
    paddingBottom: 34,
    gap: 10,
  },
  baslik: { fontFamily: yazi.ekstra, fontSize: 20, letterSpacing: -0.6, color: renk.metin },
  ayBasi: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ok: { width: minDokunma, height: minDokunma, alignItems: 'center', justifyContent: 'center' },
  okIsaret: { fontFamily: yazi.kalin, fontSize: 26, lineHeight: 28, color: renk.metin },
  ayAdi: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  satir: { flexDirection: 'row' },
  gunAdi: { flex: 1, textAlign: 'center', fontFamily: yazi.yari, fontSize: 11, color: renk.soluk },
  izgara: { flexDirection: 'row', flexWrap: 'wrap' },
  hucre: { width: `${100 / 7}%`, height: minDokunma, alignItems: 'center', justifyContent: 'center' },
  hucreArada: { backgroundColor: renk.yuzey },
  hucreSecili: { backgroundColor: renk.metin, borderRadius: 12 },
  gunSayi: { fontFamily: yazi.yari, fontSize: 14, color: renk.metin },
  gunSayiSecili: { color: renk.zemin, fontFamily: yazi.kalin },
  bugun: { color: renk.vurgu, fontFamily: yazi.ekstra },
  gecmisGun: { color: renk.soluk },
  dugmeler: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 },
  temizle: { fontFamily: yazi.kalin, fontSize: 14, color: renk.ikincil, paddingVertical: 12 },
  tamam: { paddingHorizontal: 28 },
});
