// #578 KK4: kendi profilinde "+ Ekle" il seçicisi. Kanvasta çizimi yok (tasarım bekliyor): mevcut alt pencere (`AltPencere`)
// ve arama kutusu (`MetinAlani`) ile kuruldu. 81 il alfabetik; seçili ilde ✓, dokununca eklenir ya da çıkarılır.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AltPencere } from '@/components/ui/AltPencere';
import { MetinAlani } from '@/components/ui/MetinAlani';
import { ILLER } from '@/features/profil/profilV12';
import { t } from '@/i18n';
import { baslikStili, minDokunma, olcek, renk, yazi } from '@/theme';

const sade = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i');

const ALFABETIK = [...ILLER].sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));

type Props = { acik: boolean; onKapat: () => void; secili: number[]; onDegistir: (plaka: number, ekle: boolean) => void };

export function IlSecici({ acik, onKapat, secili, onDegistir }: Props) {
  const [arama, setArama] = useState('');
  const secim = useMemo(() => new Set(secili), [secili]);
  const liste = useMemo(() => {
    const a = sade(arama.trim());
    return a ? ALFABETIK.filter((i) => sade(i.ad).includes(a)) : ALFABETIK;
  }, [arama]);
  const kapat = () => {
    setArama('');
    onKapat();
  };
  return (
    <AltPencere acik={acik} onKapat={kapat} kapatEtiketi={t('genel.vazgec')} kaydirilir>
      <Text accessibilityRole="header" style={s.baslik}>
        {t('profilV12.ilSecici.baslik')}
      </Text>
      <MetinAlani etiket={t('profilV12.ilSecici.ara')} value={arama} onChangeText={setArama} autoCorrect={false} />
      <View>
        {liste.map((il) => {
          const var_ = secim.has(il.plaka);
          return (
            <Pressable
              key={il.plaka}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: var_ }}
              onPress={() => onDegistir(il.plaka, !var_)}
              style={({ pressed }) => [s.satir, pressed && { opacity: 0.7 }]}
              testID={`il-sec-${il.plaka}`}>
              <Text style={s.ad}>{il.ad}</Text>
              {var_ ? <Text style={s.tik}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </AltPencere>
  );
}

const s = StyleSheet.create({
  baslik: { ...baslikStili(olcek.bolum), color: renk.metin },
  satir: { flexDirection: 'row', alignItems: 'center', minHeight: minDokunma, borderBottomWidth: 1, borderBottomColor: renk.ayrac },
  ad: { flex: 1, fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  tik: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.ana },
});
