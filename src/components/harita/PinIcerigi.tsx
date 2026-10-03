import { StyleSheet, Text, View } from 'react-native';

import { puanMetni } from '@/lib/puan';
import { renk, yazi } from '@/theme';

import { kisaAd, pinCapi } from './geo';
import type { HaritaPini } from './tipler';

/**
 * Pin görünümleri (#30 tek kural): küçük daire + ALTINDA kısa ad etiketi.
 * durak = dolu daire (gün rengi) + numara · bos = içi boş siyah kenar "?" · oneri = içi boş küçük daire ·
 * seçili = büyük daire. otel = siyah kare ev; aday (3.3) = beyaz hap "★ puan · ad".
 * `etiketGizli` çakışma kuralıyla gelir (geo.gizliEtiketler).
 */
export function PinIcerigi({ pin, etiketGizli }: { pin: HaritaPini; etiketGizli?: boolean }) {
  if (pin.tur === 'aday') {
    const puan = puanMetni(pin.puan);
    return (
      <View style={[s.hap, pin.secili && s.hapSecili]} collapsable={false}>
        {puan ? <Text style={[s.yildiz, pin.secili && { color: renk.zemin }]}>★ {puan} ·</Text> : null}
        <Text style={[s.hapMetin, pin.secili && { color: renk.zemin }]} numberOfLines={1}>
          {pin.etiket}
        </Text>
      </View>
    );
  }
  if (pin.tur === 'otel') {
    return (
      <View style={[s.otel, { backgroundColor: pin.renk }]} collapsable={false}>
        <Text style={s.otelMetin}>⌂</Text>
      </View>
    );
  }
  const cap = pinCapi(pin);
  const daire = { width: cap, height: cap, borderRadius: cap / 2 };
  return (
    <View style={s.sutun} collapsable={false}>
      {pin.tur === 'oneri' ? (
        <View style={[s.daire, daire, s.bos, { borderColor: pin.renk }]} collapsable={false} />
      ) : pin.tur === 'bos' ? (
        <View style={[s.daire, daire, s.bos, { borderColor: renk.metin }]} collapsable={false}>
          <Text style={[s.daireMetin, { color: renk.metin }]}>?</Text>
        </View>
      ) : (
        <View style={[s.daire, daire, { backgroundColor: pin.renk }]} collapsable={false}>
          <Text style={s.daireMetin}>{pin.etiket ?? ''}</Text>
        </View>
      )}
      <View style={s.etiketKutu}>
        {pin.ad && !etiketGizli ? (
          <Text style={s.etiket} numberOfLines={1}>
            {kisaAd(pin.ad)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sutun: { alignItems: 'center', width: 140 },
  daire: { borderWidth: 2, borderColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  bos: { backgroundColor: renk.zemin },
  daireMetin: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.zemin },
  // Etiket yüksekliği sabit (16) ki çapa hesabı (geo.pinCapasi) gizli/görünür fark etmesin.
  etiketKutu: { height: 16, marginTop: 2, justifyContent: 'center' },
  etiket: { fontFamily: yazi.kalin, fontSize: 11, lineHeight: 14, color: renk.metin, paddingHorizontal: 5, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.85)' },
  hap: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 8, paddingRight: 10, borderRadius: 999, backgroundColor: renk.zemin, maxWidth: 200 },
  hapSecili: { backgroundColor: renk.metin },
  hapMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  yildiz: { fontFamily: yazi.kalin, fontSize: 11, color: renk.vurgu },
  otel: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  otelMetin: { fontSize: 18, lineHeight: 20, color: renk.zemin },
});
