// #200 KK3–KK5 (kanvas 28 · Sığmayan mekanlar): "Günlere dağıt" yazmadan önce — "N mekan günlere sığmıyor", "NASIL
// SIĞDIRALIM?" altında uygulanabilen seçenekler (Süreleri kısalt · Günleri uzat · Listede kalsın), seçili seçeneğin gün gün
// önizlemesi, "N mekanı dağıt" ve "Süreleri sonra Plan'da tek tek değiştirebilirsin." Hesap saf (features/listem/sigmayanlar).
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Buton } from '@/components/ui/Buton';
import { CekilenSayfa, modalKokuStili, SayfaKaydirici } from '@/components/ui/sayfaCekme';
import { kalinParcalar } from '@/features/icerik/aktar';
import { ortakPencere, type DagitimHesabi, type DagitimSecenegi, type SecenekTuru } from '@/features/listem/sigmayanlar';
import { t } from '@/i18n';
import { GUNLER_KISA, haftaGunu, parcala } from '@/lib/takvim';
import type { Gun } from '@/lib/tipler';
import { dakikaSaat } from '@/schedule/tempo';
import { gunRengi, gunUstuMetin, renk, yazi } from '@/theme';

type Props = {
  hesap: DagitimHesabi;
  gunler: Gun[];
  /** Mekanın görünen adı (bilinmiyorsa null — "ve N mekan daha"ya katılır). */
  mekanAdi: (mekanId: string) => string | null;
  mesgul: boolean;
  onDagit: (s: DagitimSecenegi) => void;
  onKapat: () => void;
};

/** "Pzt 19" (tarihsiz gün: "1. gün"). */
export function gunEtiketi(g: Pick<Gun, 'date' | 'index'>): string {
  return g.date ? `${GUNLER_KISA[haftaGunu(g.date)]} ${parcala(g.date).gun}` : t('listem.sigmayan.gunNo', { n: g.index });
}

function Kalin({ metin, stil }: { metin: string; stil: object }) {
  return (
    <Text style={stil}>
      {kalinParcalar(metin).map((p, i) => (
        <Text key={i} style={p.kalin ? s.kalin : undefined}>
          {p.metin}
        </Text>
      ))}
    </Text>
  );
}

export function SigmayanlarSayfasi({ hesap, gunler, mekanAdi, mesgul, onDagit, onKapat }: Props) {
  const [secili, setSecili] = useState<SecenekTuru>(hesap.varsayilan);
  const secenek = hesap.secenekler.find((x) => x.tur === secili) ?? hesap.taban;
  const gunIle = new Map(gunler.map((g) => [g.id, g]));
  const etiket = (gunId: string, index: number) => {
    const g = gunIle.get(gunId);
    return g ? gunEtiketi(g) : t('listem.sigmayan.gunNo', { n: index });
  };
  const toplam = hesap.taban.dagitilan + hesap.taban.kalan.length;
  const pencere = ortakPencere(hesap.pencereler);
  const kismi = (x: DagitimSecenegi) => t('listem.sigmayan.kismi', { n: x.dagitilan - hesap.taban.dagitilan, k: x.kalan.length });

  const aciklama = (x: DagitimSecenegi): string => {
    if (x.tur === 'kisalt') return t('listem.sigmayan.kisaltAciklama', { once: x.ortalama?.once ?? 0, sonra: x.ortalama?.sonra ?? 0 });
    if (x.tur === 'uzat') {
      const b = x.bitisler ?? [];
      const ayni = b.every((y) => y.eski === b[0]?.eski && y.yeni === b[0]?.yeni);
      if (b.length > 0 && ayni) {
        const adlar = b.map((y) => etiket(y.gunId, y.index).split(' ')[0]);
        const gunlerMetni = adlar.length <= 1 ? adlar.join('') : `${adlar.slice(0, -1).join(', ')}${t('listem.sigmayan.ve')}${adlar[adlar.length - 1]}`;
        return t('listem.sigmayan.uzatTek', { gunler: gunlerMetni, eski: dakikaSaat(b[0].eski), yeni: dakikaSaat(b[0].yeni) });
      }
      return t('listem.sigmayan.uzatCok', { liste: b.map((y) => t('listem.sigmayan.uzatGun', { gun: etiket(y.gunId, y.index), eski: dakikaSaat(y.eski), yeni: dakikaSaat(y.yeni) })).join(', ') });
    }
    const adlar = x.kalan.map((m) => mekanAdi(m.id)).filter((a): a is string => !!a);
    if (adlar.length === 0) return t('listem.sigmayan.listeAciklamaAdsiz', { n: x.dagitilan, k: x.kalan.length });
    const ilk = adlar.slice(0, 2);
    const kalan = x.kalan.length - ilk.length;
    const metin = kalan > 0 ? t('listem.sigmayan.veDaha', { adlar: ilk.join(', '), n: kalan }) : ilk.length === 2 ? ilk.join(t('listem.sigmayan.ve')) : ilk.join('');
    return t('listem.sigmayan.listeAciklama', { n: x.dagitilan, adlar: metin });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onKapat}>
      <GestureHandlerRootView style={modalKokuStili}>
        <View style={s.perde}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onKapat} accessibilityLabel={t('genel.vazgec')} />
          <CekilenSayfa onKapat={onKapat} style={s.kutu} accessibilityViewIsModal>
            <View style={s.tutamak} />
            <SayfaKaydirici contentContainerStyle={{ gap: 14 }}>
              <View style={{ gap: 4 }}>
                <Text style={s.baslik}>{t('listem.sigmayan.baslik', { n: hesap.taban.kalan.length })}</Text>
                <Text style={s.alt}>{pencere ? t('listem.sigmayan.altPencere', { mekan: toplam, gun: gunler.length, pencere }) : t('listem.sigmayan.alt', { mekan: toplam, gun: gunler.length })}</Text>
              </View>
              <Text style={s.soru}>{t('listem.sigmayan.soru')}</Text>
              <View style={{ gap: 8 }} accessibilityRole="radiogroup">
                {hesap.secenekler.map((x) => {
                  const sec = x.tur === secili;
                  return (
                    <Pressable key={x.tur} accessibilityRole="radio" accessibilityState={{ checked: sec }} onPress={() => setSecili(x.tur)} style={[s.secenek, sec && s.secenekSecili]}>
                      <View style={[s.radyo, sec && s.radyoSecili]} />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={[s.secenekBaslik, sec && s.secenekBaslikSecili]}>{t(`listem.sigmayan.${x.tur}`)}</Text>
                        <Kalin metin={aciklama(x)} stil={s.aciklama} />
                        {x.tur !== 'liste' ? (
                          <View style={s.cipler}>
                            {x.hepsi ? <Text style={[s.cip, s.cipYesil]}>{t('listem.sigmayan.hepsiSigar')}</Text> : <Text style={s.cip}>{kismi(x)}</Text>}
                            {x.tur === 'kisalt' && x.yemekVar ? <Text style={s.cip}>{t('listem.sigmayan.yemekAyni')}</Text> : null}
                          </View>
                        ) : null}
                        {sec && x.tur !== 'liste' ? (
                          <View style={s.onizleme}>
                            {x.onizleme.map((o) => (
                              <View key={o.gunId} style={s.onizlemeSatir}>
                                <View style={[s.gunNo, { backgroundColor: gunRengi(o.index) }]}>
                                  <Text style={[s.gunNoMetin, { color: gunUstuMetin(gunRengi(o.index)) }]}>{o.index}</Text>
                                </View>
                                <Text style={s.gunAd}>{etiket(o.gunId, o.index)}</Text>
                                <Text style={s.gunMekan}>{t('listem.sigmayan.mekan', { n: o.mekan })}</Text>
                                <Text style={s.gunSaat}>{`${dakikaSaat(o.bas)}–${dakikaSaat(o.bit)}`}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Buton baslik={t('listem.sigmayan.dugme', { n: secenek.dagitilan })} tur="vurgu" boy="buyuk" yukleniyor={mesgul} onPress={() => onDagit(secenek)} />
              <Text style={s.not}>{t('listem.sigmayan.not')}</Text>
            </SayfaKaydirici>
          </CekilenSayfa>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// Kanvas 28: beyaz sayfa (üst köşe 30), tutamak 44×5; başlık Archivo 24; seçenek kartı köşe 18, seçili 2 px Gece çerçeve; radyo 22.
const s = StyleSheet.create({
  perde: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(14,20,48,0.5)' },
  kutu: { maxHeight: '92%', backgroundColor: renk.zemin, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 30, gap: 14 },
  tutamak: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: renk.ayrac },
  baslik: { fontFamily: yazi.baslik, fontSize: 24, letterSpacing: -0.6, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil },
  soru: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.5, color: renk.ikincil },
  secenek: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, borderColor: renk.ayrac },
  secenekSecili: { borderWidth: 2, borderColor: renk.ana },
  radyo: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#b4bbd3', backgroundColor: renk.zemin },
  radyoSecili: { borderWidth: 7, borderColor: renk.ana },
  secenekBaslik: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.ikincil },
  secenekBaslikSecili: { color: renk.metin },
  aciklama: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.ikincil },
  kalin: { fontFamily: yazi.ekstra, color: renk.metin },
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  cip: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.ikincil, backgroundColor: renk.yuzey, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' },
  cipYesil: { color: renk.basariMetin, backgroundColor: renk.basariZemin },
  onizleme: { marginTop: 6, padding: 10, borderRadius: 12, backgroundColor: '#f1f3f8', gap: 6 },
  onizlemeSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gunNo: { width: 18, height: 18, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  gunNoMetin: { fontFamily: yazi.ekstra, fontSize: 11 },
  gunAd: { width: 52, fontFamily: yazi.ekstra, fontSize: 12, color: renk.metin },
  gunMekan: { flex: 1, fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  gunSaat: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.basariMetin },
  not: { marginTop: -4, fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil, textAlign: 'center' },
});
