import { StyleSheet, Text, View } from 'react-native';

import { ty } from '@/features/yonetim/metin';
import { yonelme, type SehirAlanlari } from '@/features/yonetim/sehir';
import { yazi } from '@/theme';

import { yRenk } from '../tema';
import { AltGolge, GorselYaDaGradyan } from './Gradyan';

type Sehir = { id: string; ad: string; kapak_url: string | null; gezi: number };

/**
 * Kanvas Sehir19 sağ sütun "NEREDE GÖRÜNÜR" (300 px, #f6f6f4): sihirbaz Popüler şehirler karoları (130 × 88, bu şehir +
 * listedeki bir sonraki), şehir rehberi kapağı (268 × 150, "ŞEHİR REHBERİ" + ad), ana sayfa şehir seçkisi (268 × 110,
 * "ŞEHİR" çipi, "…’e git"). Rolü boşsa gradyan.
 */
export function NeredeGorunur({ id, taslak, gezi, komsu }: { id: string; taslak: SehirAlanlari; gezi: number; komsu: Sehir | undefined }) {
  const karolar: Sehir[] = [{ id, ad: taslak.ad, kapak_url: taslak.kapak_url, gezi }, ...(komsu ? [komsu] : [])];
  return (
    <View style={s.kap}>
      <Text style={s.etiket}>{ty('sehir.nerede.baslik')}</Text>
      <Text style={s.alt}>{ty('sehir.nerede.karo')}</Text>
      <View style={s.karolar}>
        {karolar.map((k) => (
          <GorselYaDaGradyan key={k.id} uri={k.kapak_url} anahtar={`${k.id}karo`} style={s.karo}>
            <AltGolge id={`gk${k.id.slice(0, 8)}`} />
            <View style={s.karoMetin}>
              <Text style={s.karoAd}>{k.ad}</Text>
              <Text style={s.karoAlt}>{ty('sehir.nerede.gezi', { n: k.gezi })}</Text>
            </View>
          </GorselYaDaGradyan>
        ))}
      </View>
      <Text style={s.alt}>{ty('sehir.nerede.rehber')}</Text>
      <GorselYaDaGradyan uri={taslak.genis_kapak_url} anahtar={`${id}genis`} style={s.rehber}>
        <AltGolge id="grehber" koyuluk={0.6} />
        <View style={s.rehberMetin}>
          <Text style={s.rehberUst}>{ty('sehir.nerede.rehberUst')}</Text>
          <Text style={s.rehberAd}>{taslak.ad}</Text>
        </View>
      </GorselYaDaGradyan>
      <Text style={s.alt}>{ty('sehir.nerede.anaSayfa')}</Text>
      <GorselYaDaGradyan uri={taslak.genis_kapak_url} anahtar={`${id}genis`} style={s.secki}>
        <AltGolge id="gsecki" />
        <View style={s.cip}>
          <Text style={s.cipMetin}>{ty('sehir.nerede.cip')}</Text>
        </View>
        <Text style={s.seckiMetin}>{ty('sehir.nerede.git', { ad: yonelme(taslak.ad) })}</Text>
      </GorselYaDaGradyan>
    </View>
  );
}

const golge = { textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } };

const s = StyleSheet.create({
  kap: { width: 300, flexShrink: 0, paddingVertical: 14, paddingHorizontal: 16, gap: 12, backgroundColor: yRenk.yuzey },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  alt: { fontFamily: yazi.kalin, fontSize: 11, color: yRenk.ikincil },
  karolar: { flexDirection: 'row', gap: 8 },
  karo: { width: 130, height: 88, borderRadius: 12 },
  karoMetin: { position: 'absolute', left: 10, bottom: 8 },
  karoAd: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.zemin, ...golge },
  karoAlt: { fontFamily: yazi.yari, fontSize: 10, color: yRenk.zemin },
  rehber: { width: 268, height: 150, borderRadius: 12 },
  rehberMetin: { position: 'absolute', left: 14, bottom: 12 },
  rehberUst: { fontFamily: yazi.ekstra, fontSize: 9, letterSpacing: 0.72, color: 'rgba(255,255,255,0.9)' },
  rehberAd: { fontFamily: yazi.ekstra, fontSize: 20, letterSpacing: -0.6, color: yRenk.zemin },
  secki: { width: 268, height: 110, borderRadius: 12 },
  cip: { position: 'absolute', left: 12, top: 12, height: 24, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(15,15,15,0.75)', justifyContent: 'center' },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 10.5, color: yRenk.zemin },
  seckiMetin: { position: 'absolute', left: 14, bottom: 10, fontFamily: yazi.ekstra, fontSize: 15, color: yRenk.zemin, ...golge },
});
