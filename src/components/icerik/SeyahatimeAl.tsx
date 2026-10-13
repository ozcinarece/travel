// #97 C → #143 KK5–6 (kanvas 19): "Seyahatime al" alt sayfası — HANGİ SEYAHATE? (seyahat · tarih çipleri, + Yeni seyahat),
// HANGİ GÜNLER, HANGİ TARİHE? (her gezi günü için onay kutusu, "6 mekan · 1'i zaten listende", "→ Cum 16 ▾" tarih eşleme),
// mükerrer bilgi kutusu, seçime göre düğme ("5 yeni durağı al · Cum 16") ve "Yalnız mekanları listeme ekle (N yeni)".
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CekilenSayfa, modalKokuStili, SayfaKaydirici } from '@/components/ui/sayfaCekme';
import { gunHucresi } from '@/components/program/GunKartlari';
import { Buton } from '@/components/ui/Buton';
import { Ikon } from '@/components/ui/Ikon';
import { useDuraklar, useGunler } from '@/features/gunler/sorgular';
import {
  aktarmaBilgisi,
  aktarmaOzeti,
  aktarmaPlani,
  aktarmaSecenegi,
  alDugmesi,
  geziGunuBasligi,
  hedefListesi,
  kalinParcalar,
  varsayilanEslesme,
  type AktarmaPlani,
  type AktarmaSecimi,
} from '@/features/icerik/aktar';
import { useMekanlar } from '@/features/mekanlar/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { iyelikEkli } from '@/lib/ek';
import { tarihAraligi } from '@/lib/takvim';
import type { GeziDetay, GeziDuragi, SeyahatOzet } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

type Secenek = 'tum' | 'gunler' | 'mekan';

type Props = {
  gezi: GeziDetay;
  seyahatler: SeyahatOzet[];
  /** Açılışta seçili seyahat (sayfadaki "+ ve ✓" bağlamı). */
  ilkHedefId: string | null;
  /** Durağın çözülmüş place_id'si (mükerrer hesabı). */
  kimlik: (d: GeziDuragi) => string | null;
  onKapat: () => void;
  onYeniSeyahat: () => void;
  onAl: (seyahatId: string, plan: AktarmaPlani, secenek: Secenek) => Promise<void>;
  hata: string | null;
};

export function SeyahatimeAl({ gezi, seyahatler, ilkHedefId, kimlik, onKapat, onYeniSeyahat, onAl, hata }: Props) {
  const [hedefId, setHedefId] = useState<string | null>(ilkHedefId ?? seyahatler[0]?.id ?? null);
  const hedef = seyahatler.find((s) => s.id === hedefId) ?? seyahatler[0] ?? null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onKapat}>
      <GestureHandlerRootView style={modalKokuStili}>
        <View style={s.perde}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onKapat} accessibilityLabel={t('genel.vazgec')} />
          <CekilenSayfa onKapat={onKapat} style={s.kutu} accessibilityViewIsModal>
            <View style={s.tutamak} />
            <View style={{ gap: 4 }}>
              <Text style={s.baslik}>{t('gezi.alBaslik')}</Text>
              <Text style={s.altBaslik}>{`${gezi.baslik} · ${t('gezi.gunMekan', { gun: gezi.gun_sayisi, mekan: gezi.mekan_sayisi })}`}</Text>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={s.bolum}>{t('gezi.hangiSeyahate')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cipler} style={s.ciplerSerit}>
                {seyahatler.map((sy) => {
                  const secili = hedef?.id === sy.id;
                  return (
                    <Pressable key={sy.id} accessibilityRole="button" accessibilityState={{ selected: secili }} onPress={() => setHedefId(sy.id)} style={[s.cip, secili && s.cipSecili]}>
                      <Text style={[s.cipMetin, secili && s.cipMetinSecili]} numberOfLines={1}>
                        {`${seyahatAdi(sy)}${sy.start_date && sy.end_date ? ` · ${tarihAraligi(sy.start_date, sy.end_date)}` : ''}`}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable accessibilityRole="button" onPress={onYeniSeyahat} style={s.cip}>
                  <Text style={s.cipMetin}>{`+ ${t('gezi.yeniSeyahat')}`}</Text>
                </Pressable>
              </ScrollView>
            </View>
            {hedef ? (
              // Seyahat değişince gün seçimi ve eşleşme baştan kurulur.
              <HedefGunleri key={hedef.id} gezi={gezi} seyahatId={hedef.id} kimlik={kimlik} onAl={onAl} hata={hata} />
            ) : (
              <>
                <Text style={s.not}>{t('anasayfa.seyahatYok')}</Text>
                {hata ? <Text style={s.hata}>{hata}</Text> : null}
              </>
            )}
          </CekilenSayfa>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function HedefGunleri({ gezi, seyahatId, kimlik, onAl, hata }: { gezi: GeziDetay; seyahatId: string; kimlik: (d: GeziDuragi) => string | null; onAl: Props['onAl']; hata: string | null }) {
  const gunlerQ = useGunler(seyahatId);
  const duraklarQ = useDuraklar(seyahatId);
  const mekanlarQ = useMekanlar(seyahatId);
  const gunler = useMemo(() => [...(gunlerQ.data ?? [])].sort((a, b) => a.index - b.index), [gunlerQ.data]);
  const [dahil, setDahil] = useState<Record<string, boolean>>({});
  const [elle, setElle] = useState<Record<string, string | null>>({});
  const [acikGun, setAcikGun] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<'gunler' | 'mekan' | null>(null);
  const eslesme = useMemo(() => ({ ...varsayilanEslesme(gezi, gunler), ...elle }), [gezi, gunler, elle]);
  const secim: AktarmaSecimi = useMemo(() => ({ tur: 'gunler', eslesme, dahil }), [eslesme, dahil]);
  const plan = useMemo(() => aktarmaPlani(gezi, gunler, secim), [gezi, gunler, secim]);
  const hedef = useMemo(() => hedefListesi(mekanlarQ.data ?? [], duraklarQ.data ?? []), [mekanlarQ.data, duraklarQ.data]);
  const ozet = useMemo(() => aktarmaOzeti(gezi, plan, kimlik, hedef), [gezi, plan, kimlik, hedef]);
  const dugme = alDugmesi(plan, ozet, gunler);
  const bilgi = aktarmaBilgisi(ozet, gunler);
  const yukleniyor = gunlerQ.isPending || duraklarQ.isPending || mekanlarQ.isPending;
  const gunDahil = (id: string) => dahil[id] !== false;
  const gunAdi = (id: string | null) => {
    const g = id ? gunler.find((x) => x.id === id) : undefined;
    return g ? gunHucresi(g, 0).ust : t('gezi.listeye');
  };

  const al = async (tur: 'gunler' | 'mekan') => {
    setMesgul(tur);
    try {
      if (tur === 'mekan') await onAl(seyahatId, aktarmaPlani(gezi, gunler, { tur: 'mekanlar' }), 'mekan');
      else await onAl(seyahatId, plan, aktarmaSecenegi(gezi, secim));
    } finally {
      setMesgul(null);
    }
  };

  return (
    <>
      <SayfaKaydirici style={s.kaydirma} contentContainerStyle={{ gap: 8 }}>
        <Text style={s.bolum}>{t('gezi.hangiGunler')}</Text>
        {gezi.gezi_gunleri.map((g) => {
          const acik = gunDahil(g.id);
          const satir = ozet.gunSatirlari[g.id];
          return (
            <View key={g.id} style={{ gap: 6 }}>
              <View style={[s.gun, acik && s.gunSecili]}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={geziGunuBasligi(g)}
                  accessibilityState={{ checked: acik }}
                  onPress={() => {
                    setDahil((d) => ({ ...d, [g.id]: !acik }));
                    if (acik && acikGun === g.id) setAcikGun(null);
                  }}
                  style={s.gunSol}>
                  <View style={[s.onay, acik && s.onaySecili]}>{acik ? <Ikon ad="tik" boyut={15} renk={renk.zemin} kalinlik={3} /> : null}</View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.gunBaslik, !acik && { color: renk.ikincil }]} numberOfLines={1}>
                      {geziGunuBasligi(g)}
                    </Text>
                    <Text style={s.gunAlt} numberOfLines={1}>
                      {[t('anasayfa.mekanSayisi', { n: satir?.mekan ?? g.gezi_duraklari.length }), satir?.zatenListede ? t('gezi.zatenListende', { n: iyelikEkli(satir.zatenListede) }) : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('gezi.tarihSec', { gun: geziGunuBasligi(g) })}
                  accessibilityState={{ disabled: !acik, expanded: acikGun === g.id }}
                  disabled={!acik || gunler.length === 0}
                  onPress={() => setAcikGun(acikGun === g.id ? null : g.id)}
                  style={[s.tarih, !acik && s.tarihPasif]}>
                  <Text style={[s.tarihMetin, !acik && s.tarihMetinPasif]}>{`→ ${gunAdi(eslesme[g.id] ?? null)}`}</Text>
                  {acik && gunler.length > 0 ? <Ikon ad={acikGun === g.id ? 'yukari' : 'asagi'} boyut={14} renk={renk.ana} kalinlik={2.4} /> : null}
                </Pressable>
              </View>
              {acik && acikGun === g.id ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hedefCipler}>
                  {[...gunler.map((hg) => hg.id), null].map((id) => {
                    const secili = (eslesme[g.id] ?? null) === id;
                    return (
                      <Pressable
                        key={id ?? 'liste'}
                        accessibilityRole="button"
                        accessibilityState={{ selected: secili }}
                        onPress={() => {
                          setElle((e) => ({ ...e, [g.id]: id }));
                          setAcikGun(null);
                        }}
                        style={[s.hedefCip, secili && s.cipSecili]}>
                        <Text style={[s.hedefCipMetin, secili && s.cipMetinSecili]}>{gunAdi(id)}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          );
        })}
        {bilgi && !yukleniyor ? (
          <View style={s.bilgi}>
            <Text style={s.bilgiMetin}>
              {kalinParcalar(bilgi).map((p, i) => (
                <Text key={i} style={p.kalin ? s.bilgiKalin : undefined}>
                  {p.metin}
                </Text>
              ))}
            </Text>
          </View>
        ) : null}
        {hata ? <Text style={s.hata}>{hata}</Text> : null}
        {yukleniyor ? <ActivityIndicator color={renk.ana} /> : null}
      </SayfaKaydirici>
      <Buton baslik={dugme.metin} tur="vurgu" boy="buyuk" onPress={() => al('gunler')} pasif={dugme.pasif || yukleniyor || mesgul !== null} yukleniyor={mesgul === 'gunler'} />
      <Pressable accessibilityRole="button" disabled={yukleniyor || mesgul !== null || ozet.yalnizMekanYeni === 0} onPress={() => al('mekan')} style={s.link} hitSlop={6}>
        {mesgul === 'mekan' ? (
          <ActivityIndicator color={renk.metin} />
        ) : (
          <Text style={[s.linkMetin, ozet.yalnizMekanYeni === 0 && { color: renk.soluk }]}>{ozet.yalnizMekanYeni === 0 ? t('gezi.hepsiListede') : t('gezi.yalnizMekanLink', { n: ozet.yalnizMekanYeni })}</Text>
        )}
      </Pressable>
    </>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(14,20,48,0.5)', justifyContent: 'flex-end' },
  kutu: { maxHeight: '92%', backgroundColor: renk.zemin, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 34, gap: 16 },
  tutamak: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: renk.ayrac },
  baslik: { fontFamily: yazi.baslik, fontSize: 24, letterSpacing: -0.6, color: renk.metin },
  altBaslik: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil },
  bolum: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.48, color: renk.ikincil },
  ciplerSerit: { marginHorizontal: -20, flexGrow: 0 },
  cipler: { gap: 8, paddingHorizontal: 20 },
  cip: { height: 44, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1.5, borderColor: renk.ayrac, backgroundColor: renk.zemin, justifyContent: 'center', maxWidth: 280 },
  cipSecili: { backgroundColor: renk.ana, borderColor: renk.ana },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  cipMetinSecili: { color: renk.zemin },
  kaydirma: { flexGrow: 0 },
  gun: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1.5, borderColor: renk.ayrac },
  gunSecili: { borderWidth: 2, borderColor: renk.ana, padding: 11.5 },
  gunSol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  onay: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#b4bbd3', alignItems: 'center', justifyContent: 'center' },
  onaySecili: { backgroundColor: renk.ana, borderColor: renk.ana },
  gunBaslik: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  gunAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  tarih: { height: 38, paddingHorizontal: 10, borderRadius: 11, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tarihPasif: { backgroundColor: '#f4f6fa' },
  tarihMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  tarihMetinPasif: { color: '#8a91ad' },
  hedefCipler: { gap: 6, paddingLeft: 50 },
  hedefCip: { height: 34, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1.5, borderColor: renk.ayrac, justifyContent: 'center' },
  hedefCipMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  bilgi: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: renk.yuzey },
  bilgiMetin: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 19, color: '#232b48' },
  bilgiKalin: { fontFamily: yazi.ekstra },
  link: { alignSelf: 'center', padding: 4, minHeight: 28, justifyContent: 'center' },
  linkMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  not: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.ikincil },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari },
});
