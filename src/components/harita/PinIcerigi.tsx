import { StyleSheet, Text, View } from 'react-native';

import { puanMetni } from '@/lib/puan';
import { renk, yazi } from '@/theme';

import type { HaritaPini } from './tipler';

/**
 * Özel pin görünümleri (kanvas): durak = numaralı siyah daire, öneri = beyaz hap "+ ad",
 * otel = siyah kare ev, aday = beyaz hap "★ puan · ad" (seçiliyse siyah), bos = beyaz daire "?".
 */
export function PinIcerigi({ pin }: { pin: HaritaPini }) {
  if (pin.tur === 'oneri') {
    return (
      <View style={s.hap}>
        <View style={s.hapArti}>
          <Text style={s.hapArtiMetin}>+</Text>
        </View>
        <Text style={s.hapMetin} numberOfLines={1}>
          {pin.etiket}
        </Text>
      </View>
    );
  }
  if (pin.tur === 'aday') {
    const puan = puanMetni(pin.puan);
    return (
      <View style={[s.hap, s.adayHap, pin.secili && s.adaySecili]}>
        {puan ? (
          <Text style={[s.yildiz, pin.secili && { color: renk.zemin }]}>
            ★ <Text style={[s.hapMetin, pin.secili && { color: renk.zemin }]}>{puan} ·</Text>
          </Text>
        ) : null}
        <Text style={[s.hapMetin, pin.secili && { color: renk.zemin }]} numberOfLines={1}>
          {pin.etiket}
        </Text>
      </View>
    );
  }
  if (pin.tur === 'bos') {
    return (
      <View style={[s.durak, s.bos]}>
        <Text style={[s.durakMetin, { color: renk.metin }]}>?</Text>
      </View>
    );
  }
  if (pin.tur === 'otel') {
    return (
      <View style={[s.otel, { backgroundColor: pin.renk }]}>
        <Text style={s.otelMetin}>⌂</Text>
      </View>
    );
  }
  return (
    <View style={[s.durak, { backgroundColor: pin.renk }]}>
      <Text style={s.durakMetin}>{pin.etiket ?? ''}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  durak: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  bos: { backgroundColor: renk.zemin, borderColor: renk.metin },
  durakMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.zemin },
  hap: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingLeft: 5, paddingRight: 10, borderRadius: 999, backgroundColor: renk.zemin, maxWidth: 180 },
  hapArti: { width: 22, height: 22, borderRadius: 11, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  hapArtiMetin: { fontFamily: yazi.kalin, fontSize: 14, lineHeight: 16, color: renk.zemin },
  hapMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  adayHap: { height: 30, paddingLeft: 8, gap: 4, maxWidth: 200 },
  adaySecili: { backgroundColor: renk.metin },
  yildiz: { fontFamily: yazi.kalin, fontSize: 11, color: renk.vurgu },
  otel: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  otelMetin: { fontSize: 18, lineHeight: 20, color: renk.zemin },
});
