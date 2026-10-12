// #97 C (kanvas Home13 ekran 4): "Geziyi seyahatime al" alt sayfası — hedef seyahat çipi (+ Yeni seyahat), üç seçenek
// (Tüm gezi · Günleri seç · Yalnız mekanlar), gün eşleşme çipleri, seçime göre düğme metni.
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { gunHucresi } from '@/components/program/GunKartlari';
import { Buton } from '@/components/ui/Buton';
import { useGunler } from '@/features/gunler/sorgular';
import { aktarmaDugmesi, aktarmaPlani, geziGunuBasligi, varsayilanEslesme, type AktarmaPlani, type AktarmaSecimi } from '@/features/icerik/aktar';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { tarihAraligi } from '@/lib/takvim';
import type { GeziDetay, Gun, SeyahatOzet } from '@/lib/tipler';
import { minDokunma, renk, yazi } from '@/theme';

type Props = {
  acik: boolean;
  gezi: GeziDetay;
  seyahatler: SeyahatOzet[];
  onKapat: () => void;
  onYeniSeyahat: () => void;
  onAl: (seyahatId: string, plan: AktarmaPlani) => Promise<void>;
  hata: string | null;
};

export function SeyahatimeAl({ acik, gezi, seyahatler, onKapat, onYeniSeyahat, onAl, hata }: Props) {
  const [hedefId, setHedefId] = useState<string | null>(seyahatler[0]?.id ?? null);
  const hedef = seyahatler.find((s) => s.id === hedefId) ?? seyahatler[0] ?? null;
  const gunler = useGunler(hedef?.id);
  const [secim, setSecim] = useState<AktarmaSecimi>({ tur: 'tum' });
  const [mesgul, setMesgul] = useState(false);
  const gunListesi = useMemo(() => [...(gunler.data ?? [])].sort((a, b) => a.index - b.index), [gunler.data]);
  const eslesme = secim.tur === 'gunler' ? secim.eslesme : varsayilanEslesme(gezi, gunListesi);
  const plan = useMemo(() => aktarmaPlani(gezi, gunListesi, secim), [gezi, gunListesi, secim]);
  const gunAdi = (g: Gun) => gunHucresi(g, 0).ust;
  const tumHedefler = Object.values(varsayilanEslesme(gezi, gunListesi)).filter((x): x is string => !!x).map((id) => gunListesi.find((g) => g.id === id)).filter((g): g is Gun => !!g).map(gunAdi);

  const al = async () => {
    if (!hedef) return;
    setMesgul(true);
    try {
      await onAl(hedef.id, plan);
    } finally {
      setMesgul(false);
    }
  };

  return (
    <Modal visible={acik} transparent animationType="slide" onRequestClose={onKapat}>
      <View style={s.perde}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onKapat} accessibilityLabel={t('genel.vazgec')} />
        <View style={s.kutu}>
          <View style={s.tutamak} />
          <Text style={s.baslik}>{t('gezi.alBaslik')}</Text>
          <Text style={s.altBaslik}>{`${gezi.sehirler?.ad ?? ''} · ${t('gezi.gunMekan', { gun: gezi.gun_sayisi, mekan: gezi.mekan_sayisi })}`}</Text>
          <ScrollView contentContainerStyle={s.icerik}>
            <Text style={s.bolum}>{t('gezi.hedef')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cipler}>
              {seyahatler.map((sy) => (
                <Pressable key={sy.id} accessibilityRole="button" accessibilityState={{ selected: hedef?.id === sy.id }} onPress={() => setHedefId(sy.id)} style={[s.cip, hedef?.id === sy.id && s.cipSecili]}>
                  <Text style={[s.cipMetin, hedef?.id === sy.id && s.cipMetinSecili]} numberOfLines={1}>
                    {`${seyahatAdi(sy)}${sy.start_date && sy.end_date ? ` · ${tarihAraligi(sy.start_date, sy.end_date)}` : ''}`}
                  </Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" onPress={onYeniSeyahat} style={[s.cip, s.cipYeni]}>
                <Text style={s.cipMetin}>{`+ ${t('gezi.yeniSeyahat')}`}</Text>
              </Pressable>
            </ScrollView>
            {hedef ? (
              <>
                <Secenek secili={secim.tur === 'tum'} baslik={t('gezi.tum')} alt={tumHedefler.length ? t('gezi.tumAlt', { gun: Math.min(gezi.gun_sayisi, tumHedefler.length), mekan: gezi.mekan_sayisi, gunler: tumHedefler.join(', ') }) : t('gezi.tumAltListe', { mekan: gezi.mekan_sayisi })} onPress={() => setSecim({ tur: 'tum' })} />
                <Secenek secili={secim.tur === 'gunler'} baslik={t('gezi.gunleriSec')} alt={t('gezi.gunleriSecAlt')} onPress={() => setSecim({ tur: 'gunler', eslesme: varsayilanEslesme(gezi, gunListesi) })}>
                  {secim.tur === 'gunler'
                    ? gezi.gezi_gunleri.map((g) => (
                        <View key={g.id} style={s.gunSatir}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.gunBaslik}>{geziGunuBasligi(g)}</Text>
                            <Text style={s.gunAlt}>{t('anasayfa.mekanSayisi', { n: g.gezi_duraklari.length })}</Text>
                          </View>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hedefCipler}>
                            {gunListesi.map((hg) => (
                              <Pressable key={hg.id} accessibilityRole="button" accessibilityState={{ selected: eslesme[g.id] === hg.id }} onPress={() => setSecim({ tur: 'gunler', eslesme: { ...eslesme, [g.id]: hg.id } })} style={[s.hedefCip, eslesme[g.id] === hg.id && s.cipSecili]}>
                                <Text style={[s.hedefCipMetin, eslesme[g.id] === hg.id && s.cipMetinSecili]}>{gunAdi(hg)}</Text>
                              </Pressable>
                            ))}
                            <Pressable accessibilityRole="button" accessibilityState={{ selected: !eslesme[g.id] }} onPress={() => setSecim({ tur: 'gunler', eslesme: { ...eslesme, [g.id]: null } })} style={[s.hedefCip, !eslesme[g.id] && s.cipSecili]}>
                              <Text style={[s.hedefCipMetin, !eslesme[g.id] && s.cipMetinSecili]}>{t('gezi.listeye')}</Text>
                            </Pressable>
                          </ScrollView>
                        </View>
                      ))
                    : null}
                </Secenek>
                <Secenek secili={secim.tur === 'mekanlar'} baslik={t('gezi.yalnizMekan')} alt={t('gezi.yalnizMekanAlt', { mekan: gezi.mekan_sayisi })} onPress={() => setSecim({ tur: 'mekanlar' })} />
                <Text style={s.not}>{t('gezi.not')}</Text>
              </>
            ) : (
              <Text style={s.not}>{t('anasayfa.seyahatYok')}</Text>
            )}
            {hata ? <Text style={s.hata}>{hata}</Text> : null}
            {gunler.isPending && hedef ? <ActivityIndicator color={renk.metin} /> : null}
            <Buton baslik={aktarmaDugmesi(plan, gunListesi, secim)} onPress={al} pasif={!hedef || gunler.isPending} yukleniyor={mesgul} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Secenek({ secili, baslik, alt, onPress, children }: { secili: boolean; baslik: string; alt: string; onPress: () => void; children?: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: secili }} onPress={onPress} style={[s.secenek, secili && s.secenekSecili]}>
      <View style={s.secenekUst}>
        <View style={[s.daire, secili && s.daireSecili]}>{secili ? <View style={s.nokta} /> : null}</View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.secenekBaslik}>{baslik}</Text>
          <Text style={s.secenekAlt}>{alt}</Text>
        </View>
      </View>
      {children}
    </Pressable>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(15,15,15,0.35)', justifyContent: 'flex-end' },
  kutu: { maxHeight: '90%', backgroundColor: renk.zemin, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
  tutamak: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: renk.ayrac },
  baslik: { fontFamily: yazi.ekstra, fontSize: 20, letterSpacing: -0.5, color: renk.metin, paddingHorizontal: 20, paddingTop: 12 },
  altBaslik: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingHorizontal: 20, paddingBottom: 6 },
  icerik: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  bolum: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil, marginTop: 6 },
  cipler: { gap: 8 },
  cip: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center', maxWidth: 240 },
  cipYeni: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#c4c4c4', backgroundColor: renk.zemin },
  cipSecili: { backgroundColor: renk.metin },
  cipMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  cipMetinSecili: { color: renk.zemin },
  secenek: { padding: 12, borderRadius: 16, borderWidth: 1, borderColor: renk.ayrac, gap: 10 },
  secenekSecili: { borderColor: renk.metin },
  secenekUst: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: minDokunma },
  daire: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: renk.soluk, alignItems: 'center', justifyContent: 'center' },
  daireSecili: { borderColor: renk.metin },
  nokta: { width: 10, height: 10, borderRadius: 5, backgroundColor: renk.metin },
  secenekBaslik: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  secenekAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  gunSatir: { gap: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: renk.ayrac, paddingVertical: 8 },
  gunBaslik: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  gunAlt: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  hedefCipler: { gap: 6 },
  hedefCip: { height: 30, paddingHorizontal: 10, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  hedefCipMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  not: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 17, color: renk.ikincil },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari },
});
