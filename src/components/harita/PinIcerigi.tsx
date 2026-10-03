import { StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { yorumKisa } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import { renk, yazi } from '@/theme';

import { etiketYuksekligi, kisaAd, pinCapi } from './geo';
import type { HaritaPini } from './tipler';

/**
 * Pin görünümleri (#30, 3 Ekim mockup): küçük daire + ALTINDA kısa ad etiketi (+ ★ puan · yorum satırı, `detay`).
 * durak = gün renginde dolu daire + sıra numarası · listede = siyah daire + tik · oneri / bos = beyaz daire, siyah kenar,
 * kategori ikonu · seçili = büyük daire · otel = siyah kare + ev · aday (3.3) = beyaz hap "★ puan · ad" ·
 * etiket (#33) = küçük beyaz hap (rota bacağı süresi). `etiketGizli` çakışma kuralıyla gelir (geo.gizliEtiketler).
 */
export function PinIcerigi({ pin, etiketGizli, detay = false }: { pin: HaritaPini; etiketGizli?: boolean; detay?: boolean }) {
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
  if (pin.tur === 'etiket') {
    return (
      <View style={[s.bacakHap, etiketGizli && s.gorunmez]} collapsable={false}>
        <Text style={s.bacakMetin} numberOfLines={1}>
          {pin.etiket}
        </Text>
      </View>
    );
  }
  if (pin.tur === 'otel') {
    return (
      <View style={[s.otel, { backgroundColor: pin.renk }]} collapsable={false}>
        <Ikon ad="ev" boyut={20} renk={renk.zemin} kalinlik={2.2} />
      </View>
    );
  }
  const cap = pinCapi(pin);
  const daire = { width: cap, height: cap, borderRadius: cap / 2 };
  const ikonBoyut = Math.round(cap * 0.62);
  const puan = puanMetni(pin.puan);
  const yorum = yorumKisa(pin.yorumSayisi);
  return (
    <View style={s.sutun} collapsable={false}>
      {pin.tur === 'oneri' || pin.tur === 'bos' ? (
        <View style={[s.daire, daire, s.beyaz]} collapsable={false}>
          <Ikon ad={pin.ikon ?? 'pin'} boyut={ikonBoyut} renk={renk.metin} kalinlik={2.2} />
        </View>
      ) : pin.tur === 'listede' ? (
        <View style={[s.daire, daire, { backgroundColor: pin.renk }]} collapsable={false}>
          <Ikon ad="tik" boyut={ikonBoyut} renk={renk.zemin} kalinlik={2.4} />
        </View>
      ) : (
        <View style={[s.daire, daire, { backgroundColor: pin.renk }]} collapsable={false}>
          <Text style={s.daireMetin}>{pin.etiket ?? ''}</Text>
        </View>
      )}
      <View style={[s.etiketKutu, { height: etiketYuksekligi(detay) }]}>
        {pin.ad && !etiketGizli ? (
          <View style={s.etiketZemin}>
            <Text style={s.etiket} numberOfLines={1}>
              {kisaAd(pin.ad)}
            </Text>
            {detay && puan ? (
              <Text style={s.detay} numberOfLines={1}>
                <Text style={{ color: renk.vurgu }}>★</Text> {puan}
                {yorum ? ` · ${yorum}` : ''}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sutun: { alignItems: 'center', width: 140 },
  daire: { borderWidth: 2, borderColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  beyaz: { backgroundColor: renk.zemin, borderColor: renk.metin, borderWidth: 1.5 },
  daireMetin: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.zemin },
  // Etiket yüksekliği sabit (16 / detaylı 30) ki çapa hesabı (geo.pinCapasi) gizli/görünür fark etmesin.
  etiketKutu: { marginTop: 2, justifyContent: 'center', alignItems: 'center' },
  etiketZemin: { paddingHorizontal: 5, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center' },
  etiket: { fontFamily: yazi.kalin, fontSize: 11, lineHeight: 14, color: renk.metin },
  detay: { fontFamily: yazi.yari, fontSize: 10, lineHeight: 13, color: renk.ikincil },
  hap: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 8, paddingRight: 10, borderRadius: 999, backgroundColor: renk.zemin, maxWidth: 200 },
  hapSecili: { backgroundColor: renk.metin },
  hapMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  yildiz: { fontFamily: yazi.kalin, fontSize: 11, color: renk.vurgu },
  otel: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bacakHap: { height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: renk.ayrac },
  bacakMetin: { fontFamily: yazi.kalin, fontSize: 11, lineHeight: 14, color: renk.metin },
  gorunmez: { opacity: 0 },
});
