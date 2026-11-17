// #276 2b · KK4 (kanvas 29c, 1. kart): gezi bitti, açık borç var → "Harcamaları kapat". Ürün cevabı (17 Kas) 4: "Hatırlat" yok,
// yalnız tam genişlikte "Bakiyeler" (44). Kişi kişi tutarlar mevcut bakiye hesabından (`harcamaOzeti`).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import type { AcikBorc } from '@/features/anasayfa/serit';
import { paraMetni } from '@/features/harcama/hesap';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

type Props = { sehir: string; borc: AcikBorc; onBakiyeler: () => void };

/** Yüzlerde en çok bu kadar kişi (kanvas 29c: iki üst üste kare). */
const EN_COK_YUZ = 3;

export function HarcamaKapatKarti({ sehir, borc, onBakiyeler }: Props) {
  // Kanvas yalnız "Sana borçlular" halini çiziyor: tutar sütunu ve kişi satırı bana borçlu olanlar varken görünür.
  const alacakli = borc.benimNet > 0 && borc.karsilar.length > 0;
  const yuzler = borc.karsilar.slice(0, EN_COK_YUZ);
  return (
    <View style={s.kart}>
      <View style={s.ust}>
        <View style={s.basliklar}>
          <Text style={s.etiket}>{t('serit.bittiEtiket', { sehir: sehir.toLocaleUpperCase('tr') })}</Text>
          <Text accessibilityRole="header" style={s.baslik}>
            {t('serit.harcamaKapat')}
          </Text>
        </View>
        {alacakli ? (
          <View style={s.tutarKap}>
            <Text style={s.etiket}>{t('serit.sanaBorclular')}</Text>
            <Text style={s.tutar}>{paraMetni(borc.benimNet, 'TRY', true)}</Text>
          </View>
        ) : null}
      </View>
      {alacakli ? (
        <View style={s.kisiSatir}>
          <View style={s.yuzler}>
            {yuzler.map((k, i) => (
              <View key={k.id} style={[s.yuz, i > 0 && s.yuzUst]}>
                <Avatar ad={borc.kisiler.ad(k.id)} url={borc.kisiler.foto(k.id)} boyut={28} arkaPlan={i === 0 ? renk.ana : renk.anaAcik} />
              </View>
            ))}
          </View>
          <Text style={s.kisiMetin}>
            {borc.karsilar.map((k, i) => (
              <Text key={k.id}>
                {i > 0 ? ' · ' : ''}
                <Text style={s.kalin}>{borc.kisiler.ad(k.id)}</Text> {paraMetni(k.tutar)}
              </Text>
            ))}{' '}
            <Text style={s.soluk}>{t('serit.odenmedi')}</Text>
          </Text>
        </View>
      ) : null}
      <Pressable accessibilityRole="button" onPress={onBakiyeler} style={({ pressed }) => [s.dugme, pressed && s.basili]}>
        <Text style={s.dugmeMetin}>{t('serit.bakiyeler')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  kart: { marginHorizontal: 20, padding: 14, borderRadius: 20, borderWidth: 1.5, borderColor: renk.ayrac, gap: 10 },
  ust: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  basliklar: { flex: 1, gap: 2 },
  etiket: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.48, color: renk.ikincil },
  baslik: { fontFamily: yazi.baslik, fontSize: 18, letterSpacing: -0.36, color: renk.metin },
  tutarKap: { alignItems: 'flex-end', flexShrink: 0 },
  tutar: { fontFamily: yazi.baslik, fontSize: 20, letterSpacing: -0.4, color: renk.basariMetin },
  kisiSatir: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  yuzler: { flexDirection: 'row', flexShrink: 0 },
  // 32'lik kare = 28'lik yüz + 2 px beyaz kenar; sonrakiler 8 px üst üste.
  yuz: { borderWidth: 2, borderColor: renk.zemin, borderRadius: 10 },
  yuzUst: { marginLeft: -8 },
  kisiMetin: { flex: 1, fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.metin },
  kalin: { fontFamily: yazi.ekstra },
  soluk: { color: renk.ikincil },
  dugme: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: renk.ana, alignItems: 'center', justifyContent: 'center' },
  dugmeMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.zemin },
  basili: { opacity: 0.85 },
});
