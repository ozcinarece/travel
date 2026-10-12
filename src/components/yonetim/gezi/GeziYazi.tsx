import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { blokEkle, gorselSatiri, mdArac, mekanBaglantisi, satirIciEkle, type MdArac, type Secim } from '@/features/yonetim/gezi';
import { ty } from '@/features/yonetim/metin';
import type { HafifYer, Merkez } from '@/features/yerler/api';
import { yazi } from '@/theme';

import { dosyaSec } from '../surukle';
import { yRenk } from '../tema';
import { MekanArama } from './MekanArama';

type Props = {
  metin: string;
  /** İşlev verilirse en güncel metne uygulanır (fotoğraf yüklemesi sürerken yazılanlar korunur). */
  onDegis: (metin: string | ((onceki: string) => string)) => void;
  merkez: Merkez | undefined;
  /** Görsel: Storage'a yükler, kovadaki yolu döner. */
  fotoYukle: (dosya: File) => Promise<string>;
  onHata: (mesaj: string) => void;
};

const ARACLAR: MdArac[] = ['kalin', 'italik', 'h2', 'alinti', 'liste'];

/**
 * KK3 (kanvas "YAZI · markdown"): araç çubuğu B · I · H2 · alıntı · liste · Foto · Mekan; tek aralıklı yazı alanı.
 * Foto → Storage'a yükler, `![](foto:<yol>)`; Mekan → Google araması, `[ad](mekan:<place_id>)` (seçili metin ad olur).
 */
export function GeziYazi({ metin, onDegis, merkez, fotoYukle, onHata }: Props) {
  const [secim, setSecim] = useState<Secim>({ start: metin.length, end: metin.length });
  const [mekanAcik, setMekanAcik] = useState(false);

  const uygula = (sonuc: { metin: string; secim: Secim }) => {
    onDegis(sonuc.metin);
    setSecim(sonuc.secim);
  };
  const foto = () =>
    dosyaSec(false, async ([dosya]) => {
      if (!dosya) return;
      try {
        const yol = await fotoYukle(dosya);
        onDegis((onceki) => {
          const konum = Math.min(secim.start, onceki.length);
          return blokEkle(onceki, { start: konum, end: konum }, gorselSatiri('', yol)).metin;
        });
      } catch (e) {
        onHata((e as Error).message);
      }
    });
  const mekan = (yer: HafifYer) => {
    uygula(satirIciEkle(metin, secim, (secili) => mekanBaglantisi(secili.trim() || yer.ad, yer.place_id)));
    setMekanAcik(false);
  };

  return (
    <View style={s.kap}>
      <View style={s.ust}>
        <Text style={s.etiket}>{ty('gezi.alan.yazi')}</Text>
        <View style={s.arac}>
          {ARACLAR.map((a) => (
            <Pressable key={a} accessibilityRole="button" accessibilityLabel={ty(`gezi.aracEtiket.${a}`)} onPress={() => uygula(mdArac(metin, secim, a))} hitSlop={4}>
              <Text style={[s.aracMetin, a === 'italik' && s.italik]}>{ty(`gezi.arac.${a}`)}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel={ty('gezi.aracEtiket.foto')} onPress={foto} hitSlop={4}>
            <Text style={s.aracMetin}>{ty('gezi.arac.foto')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={ty('gezi.aracEtiket.mekan')} accessibilityState={{ expanded: mekanAcik }} onPress={() => setMekanAcik((a) => !a)} hitSlop={4}>
            <Text style={s.aracMetin}>{ty('gezi.arac.mekan')}</Text>
          </Pressable>
        </View>
      </View>
      {mekanAcik ? <MekanArama merkez={merkez} onSec={mekan} /> : null}
      <TextInput
        multiline
        value={metin}
        onChangeText={onDegis}
        selection={secim}
        onSelectionChange={(e) => setSecim(e.nativeEvent.selection)}
        accessibilityLabel={ty('gezi.alan.yazi')}
        style={s.alan}
        textAlignVertical="top"
      />
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 5, flex: 1 },
  ust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  arac: { flexDirection: 'row', gap: 6 },
  aracMetin: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  italik: { fontStyle: 'italic' },
  alan: {
    flex: 1,
    minHeight: 420,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: yRenk.cerceve,
    fontFamily: Platform.select({ web: 'ui-monospace, Menlo, monospace', default: 'monospace' }),
    fontSize: 12.5,
    lineHeight: 19,
    color: '#2a2a2a',
  },
});
