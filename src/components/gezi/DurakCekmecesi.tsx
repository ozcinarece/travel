// #580 KK1–KK3 (kanvas UX önerileri › `Dalga1_DurakCekmecesi`): Gezi sayfasında "Bugünün planı" satırına dokununca açılan alt
// çekmece. Perde Lacivert %38, üst köşeler 22, tutamaç 40 × 5 #D5DAE5 (altı 14), kenar 16, alt 30 (`AltPencere` `durak`).
// Üstte gün renginde 28 pt numara + ad (18/800) + alt satır (14, #5B6178); tek dolu turuncu "Gezdim" (✓, 52 pt, altı 6);
// altında 56 pt satırlar: 36 pt #F2F4F8 daire içinde 18 pt ikon, başlık 16/700, alt satır 13 #5B6178, aralarında #E4E7EE çizgi.
// "Çıkar" metni ve ikonu #B42318.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TuruncuDugme } from '@/components/gezi/SeyahatV7';
import { AltPencere } from '@/components/ui/AltPencere';
import { Ikon, type IkonAdi } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { anaV5, durakCekmecesi, gunUstuMetin, renk, yazi } from '@/theme';

export type CekmeceDuragi = {
  numara: number | null;
  ad: string;
  /** "Şimdi · 14:10 · 45 dk" ya da "14:10 · 45 dk". */
  alt: string;
  /** Gün rengi. */
  renk: string;
};

type Props = {
  acik: boolean;
  onKapat: () => void;
  durak: CekmeceDuragi | null;
  gezdim: { metin: string; geriAl: boolean };
  yolAlt: string | null;
  yarinAlt: string;
  /** KK3: son gün — "Yarına taşı" pasif. */
  yarinPasif: boolean;
  /** #243: bağlantı yokken değişiklik düğmeleri pasif (Yol tarifi açık). */
  pasif?: boolean;
  onGezdim: () => void;
  onYolTarifi: () => void;
  onAtla: () => void;
  onYarina: () => void;
  onCikar: () => void;
};

export function DurakCekmecesi(p: Props) {
  const d = p.durak;
  return (
    <AltPencere acik={p.acik} onKapat={p.onKapat} kapatEtiketi={t('durakCekmecesi.kapat')} gorunus="durak">
      {d ? (
        <>
          <View style={s.ust}>
            <View style={[s.no, { backgroundColor: d.renk }]}>
              <Text style={[s.noMetin, { color: gunUstuMetin(d.renk) }]}>{d.numara ?? ''}</Text>
            </View>
            <View style={s.ustMetin}>
              <Text style={s.ad} numberOfLines={2} accessibilityRole="header">
                {d.ad}
              </Text>
              <Text style={s.alt}>{d.alt}</Text>
            </View>
          </View>
          <View style={s.gezdim}>
            <TuruncuDugme metin={p.gezdim.metin} ikon={p.gezdim.geriAl ? undefined : 'tik'} onPress={p.onGezdim} pasif={p.pasif} />
          </View>
          <Satir ikon="yolTarifiV7" baslik={t('durakCekmecesi.yolTarifi')} alt={p.yolAlt} onPress={p.onYolTarifi} />
          <Satir ikon="atlaD1" baslik={t('durakCekmecesi.atla')} onPress={p.onAtla} pasif={p.pasif} />
          <Satir ikon="yarinaD1" baslik={t('durakCekmecesi.yarinaTasi')} alt={p.yarinAlt} onPress={p.onYarina} pasif={p.yarinPasif || p.pasif} />
          <Satir ikon="copD1" baslik={t('durakCekmecesi.cikar')} onPress={p.onCikar} pasif={p.pasif} tehlike son />
        </>
      ) : null}
    </AltPencere>
  );
}

function Satir({ ikon, baslik, alt, onPress, pasif, tehlike, son }: { ikon: IkonAdi; baslik: string; alt?: string | null; onPress: () => void; pasif?: boolean; tehlike?: boolean; son?: boolean }) {
  const ton = tehlike ? durakCekmecesi.cikar : renk.metin;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={alt ? `${baslik}, ${alt}` : baslik}
      accessibilityState={{ disabled: !!pasif }}
      disabled={pasif}
      onPress={onPress}
      style={({ pressed }) => [s.satir, !son && s.cizgi, pasif && s.pasif, pressed && { opacity: 0.7 }]}>
      <View style={s.daire}>
        <Ikon ad={ikon} boyut={18} renk={ton} kalinlik={2.2} />
      </View>
      <View style={s.satirMetin}>
        <Text style={[s.satirBaslik, { color: ton }]}>{baslik}</Text>
        {alt ? <Text style={s.satirAlt}>{alt}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  ust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
  },
  no: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMetin: { fontFamily: yazi.ekstra, fontSize: 13 },
  ustMetin: { flex: 1, gap: 2 },
  ad: { fontFamily: yazi.ekstra, fontSize: 18, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  gezdim: { marginBottom: 6 },
  satir: {
    minHeight: 56,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cizgi: { borderBottomWidth: 1, borderBottomColor: anaV5.cizgi },
  pasif: { opacity: 0.4 },
  daire: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: durakCekmecesi.ikonZemin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  satirMetin: { flex: 1, gap: 1 },
  satirBaslik: { fontFamily: yazi.kalin, fontSize: 16 },
  satirAlt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
});
