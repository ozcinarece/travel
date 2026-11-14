// #97 C → #143 KK5–6 → #193 (kanvas 19 · 19b · 19c): "Seyahatime al" alt sayfası — HANGİ SEYAHATE? (seyahat çipleri,
// + Yeni seyahat), altında iki sekme: "Planı al" (HANGİ GÜNLER, HANGİ TARİHE? — her gezi günü için onay kutusu ve tarih eşleme;
// seyahatten fazla gün varsayılan seçilmez, seçilirse sona eklenir "Paz 18 +") ve "Yalnız mekanlar" (günlere göre gruplu,
// kutucukla seçim; listede olan "Listende"). "Yeni seyahat" sihirbaza gitmez: aynı sayfada şehir (gezinin, kilitli), kaç gün,
// ne zaman; seyahat ve plan tek işlemde açılır.
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { FotoKutusu } from '@/components/gezi/GeziParcalari';
import { gunHucresi } from '@/components/program/GunKartlari';
import { Buton } from '@/components/ui/Buton';
import { Ikon } from '@/components/ui/Ikon';
import { CekilenSayfa, modalKokuStili, SayfaKaydirici } from '@/components/ui/sayfaCekme';
import { useDuraklar, useGunler } from '@/features/gunler/sorgular';
import {
  aktarmaBilgisi,
  aktarmaOzeti,
  aktarmaPlani,
  aktarmaSecenegi,
  alDugmesi,
  eklenecekGunler,
  eksikGunBilgisi,
  eksikGunler,
  geziGunuBasligi,
  hedefEslesmesi,
  hedefListesi,
  kalinParcalar,
  sanalGun,
  sanalGunMu,
  sanalSira,
  sanalSiraOnizleme,
  varsayilanDahil,
  type AktarmaPlani,
  type AktarmaSecimi,
} from '@/features/icerik/aktar';
import {
  EN_AZ_GUN,
  EN_COK_GUN,
  grupHepsiSecili,
  gunSiniri,
  mekanGruplari,
  mekanSecimPlani,
  secilebilirler,
  varsayilanMekanSecimi,
  yeniSeyahatBilgisi,
  yeniSeyahatPlani,
  type MekanGrubu,
} from '@/features/icerik/seyahateAl';
import { useSehirler } from '@/features/icerik/sorgular';
import { useMekanlar } from '@/features/mekanlar/sorgular';
import { useIcerikSehirSecimi } from '@/features/sihirbaz/girisler';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { iyelikEkli } from '@/lib/ek';
import { kategoriEtiketi, sureMetni } from '@/lib/kategori';
import { AYLAR, GUNLER_KISA, haftaGunu, kisaTarih, parcala, tarihAraligi, tarihEkle } from '@/lib/takvim';
import type { GeziDetay, GeziDuragi, SehirSecimi, SeyahatOzet } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';
import { gunRengi, gunUstuMetin, renk, yazi } from '@/theme';

export type AlSecenegi = 'tum' | 'gunler' | 'mekan';
export type YeniSeyahatIstegi = {
  sehir: SehirSecimi;
  gunSayisi: number;
  /** null → "Tarih sonra". */
  baslangic: string | null;
  secim: { tur: 'plan' } | { tur: 'mekan'; duraklar: GeziDuragi[] };
};

type Sekme = 'plan' | 'mekan';
/** Yeni seyahat formu (sekme değişince korunur). */
type Form = { gunSayisi: number; baslangic: string | null; tarihsiz: boolean };

type Props = {
  gezi: GeziDetay;
  seyahatler: SeyahatOzet[];
  /** Açılışta seçili seyahat (sayfadaki "+ ve ✓" bağlamı). */
  ilkHedefId: string | null;
  /** Durağın çözülmüş place_id'si (mükerrer hesabı). */
  kimlik: (d: GeziDuragi) => string | null;
  /** KK11: satır fotoğrafı yalnız elde olandan (kendi verimiz; sayfa zaten yüklediyse) — yeni istek yok. */
  foto?: (d: GeziDuragi) => string | null;
  onKapat: () => void;
  /** Mevcut seyahate; `ekGunler`: sona eklenecek sanal günler (KK5). */
  onAl: (seyahatId: string, plan: AktarmaPlani, secenek: AlSecenegi, ekGunler?: string[]) => Promise<void>;
  onYeni: (istek: YeniSeyahatIstegi) => Promise<void>;
  hata: string | null;
};

const YENI = 'yeni';

export function SeyahatimeAl({ gezi, seyahatler, ilkHedefId, kimlik, foto, onKapat, onAl, onYeni, hata }: Props) {
  const [hedefId, setHedefId] = useState<string>(ilkHedefId ?? seyahatler[0]?.id ?? YENI);
  const hedef = hedefId === YENI ? null : (seyahatler.find((s) => s.id === hedefId) ?? seyahatler[0] ?? null);
  const [sekme, setSekme] = useState<Sekme>('plan');
  const [form, setForm] = useState<Form>(() => ({ gunSayisi: gunSiniri(gezi.gezi_gunleri.length || gezi.gun_sayisi || 1), baslangic: null, tarihsiz: false }));
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
                <Pressable accessibilityRole="button" accessibilityState={{ selected: !hedef }} onPress={() => setHedefId(YENI)} style={[s.cip, s.cipYeni, !hedef && s.cipSecili]}>
                  <Ikon ad="arti" boyut={14} renk={!hedef ? renk.zemin : renk.ana} kalinlik={3} />
                  <Text style={[s.cipMetin, !hedef && s.cipMetinSecili]}>{t('gezi.yeniSeyahat')}</Text>
                </Pressable>
              </ScrollView>
            </View>
            {/* KK1: seyahat seçicinin altında iki sekme. */}
            <View style={s.sekmeler} accessibilityRole="tablist">
              {(['plan', 'mekan'] as const).map((k) => {
                const secili = sekme === k;
                return (
                  <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: secili }} onPress={() => setSekme(k)} style={[s.sekme, secili && s.sekmeSecili]}>
                    <Text style={[s.sekmeMetin, secili && s.sekmeMetinSecili]}>{k === 'plan' ? t('gezi.planiAl') : t('gezi.yalnizMekanlar')}</Text>
                  </Pressable>
                );
              })}
            </View>
            {!hedef ? (
              <YeniSeyahat gezi={gezi} sekme={sekme} form={form} setForm={setForm} kimlik={kimlik} foto={foto} onYeni={onYeni} hata={hata} />
            ) : sekme === 'plan' ? (
              // Seyahat değişince gün seçimi ve eşleşme baştan kurulur.
              <HedefGunleri key={hedef.id} gezi={gezi} seyahatId={hedef.id} kimlik={kimlik} onAl={onAl} hata={hata} />
            ) : (
              <HedefMekanlari key={hedef.id} gezi={gezi} seyahatId={hedef.id} kimlik={kimlik} foto={foto} onAl={onAl} hata={hata} />
            )}
          </CekilenSayfa>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ---------------------------------------------------------------- 19 · Planı al (mevcut seyahat)

function HedefGunleri({ gezi, seyahatId, kimlik, onAl, hata }: { gezi: GeziDetay; seyahatId: string; kimlik: (d: GeziDuragi) => string | null; onAl: Props['onAl']; hata: string | null }) {
  const gunlerQ = useGunler(seyahatId);
  const duraklarQ = useDuraklar(seyahatId);
  const mekanlarQ = useMekanlar(seyahatId);
  const gunler = useMemo(() => [...(gunlerQ.data ?? [])].sort((a, b) => a.index - b.index), [gunlerQ.data]);
  const [dahilElle, setDahil] = useState<Record<string, boolean>>({});
  const [elle, setElle] = useState<Record<string, string | null>>({});
  const [acikGun, setAcikGun] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  // KK5: seyahatten fazla gezi günleri sona eklenecek güne eşlenir ama varsayılan seçilmez.
  const eksik = useMemo(() => eksikGunler(gezi, gunler), [gezi, gunler]);
  const dahil = useMemo(() => ({ ...varsayilanDahil(gezi, gunler), ...dahilElle }), [gezi, gunler, dahilElle]);
  const eslesme = useMemo(() => ({ ...hedefEslesmesi(gezi, gunler), ...elle }), [gezi, gunler, elle]);
  const secim: AktarmaSecimi = useMemo(() => ({ tur: 'gunler', eslesme, dahil }), [eslesme, dahil]);
  const plan = useMemo(() => aktarmaPlani(gezi, gunler, secim), [gezi, gunler, secim]);
  const sira = useMemo(() => sanalSira(gezi, eslesme, dahil), [gezi, eslesme, dahil]);
  const tumGunler = useMemo(() => [...gunler, ...[...sira].map(([id, n]) => sanalGun(gunler, id, n))], [gunler, sira]);
  const hedef = useMemo(() => hedefListesi(mekanlarQ.data ?? [], duraklarQ.data ?? []), [mekanlarQ.data, duraklarQ.data]);
  const ozet = useMemo(() => aktarmaOzeti(gezi, plan, kimlik, hedef), [gezi, plan, kimlik, hedef]);
  const dugme = alDugmesi(plan, ozet, tumGunler);
  const bilgi = [eksikGunBilgisi(gezi, gunler, eslesme, dahil), aktarmaBilgisi(ozet, tumGunler)].filter(Boolean).join(' ') || null;
  const yukleniyor = gunlerQ.isPending || duraklarQ.isPending || mekanlarQ.isPending;
  const gunDahil = (id: string) => dahil[id] !== false;
  const gunAdi = (id: string | null) => {
    if (sanalGunMu(id)) return `${gunHucresi(sanalGun(gunler, id, sanalSiraOnizleme(sira, id)), 0).ust} +`;
    const g = id ? gunler.find((x) => x.id === id) : undefined;
    return g ? gunHucresi(g, 0).ust : t('gezi.listeye');
  };

  const al = async () => {
    setMesgul(true);
    try {
      await onAl(seyahatId, plan, aktarmaSecenegi(gezi, secim), eklenecekGunler(plan, sira));
    } finally {
      setMesgul(false);
    }
  };

  return (
    <>
      <SayfaKaydirici style={s.kaydirma} contentContainerStyle={{ gap: 8 }}>
        <Text style={s.bolum}>{t('gezi.hangiGunler')}</Text>
        {yukleniyor ? (
          <ActivityIndicator color={renk.ana} />
        ) : (
          gezi.gezi_gunleri.map((g) => {
            const acik = gunDahil(g.id);
            const satir = ozet.gunSatirlari[g.id];
            const hedefId = eslesme[g.id] ?? null;
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
                    disabled={!acik}
                    onPress={() => setAcikGun(acikGun === g.id ? null : g.id)}
                    style={[s.tarih, !acik && s.tarihPasif]}>
                    <Text style={[s.tarihMetin, !acik && s.tarihMetinPasif]}>{`→ ${gunAdi(hedefId)}`}</Text>
                    <Ikon ad={acikGun === g.id ? 'yukari' : 'asagi'} boyut={14} renk={acik ? renk.ana : '#8a91ad'} kalinlik={2.4} />
                  </Pressable>
                </View>
                {acik && acikGun === g.id ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hedefCipler}>
                    {[...gunler.map((hg) => hg.id), ...(eksik[g.id] ? [eksik[g.id]] : []), null].map((id) => {
                      const secili = hedefId === id;
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
          })
        )}
        {bilgi && !yukleniyor ? <BilgiKutusu metin={bilgi} /> : null}
        {hata ? <Text style={s.hata}>{hata}</Text> : null}
      </SayfaKaydirici>
      <Buton baslik={dugme.metin} tur="vurgu" boy="buyuk" onPress={() => void al()} pasif={dugme.pasif || yukleniyor || mesgul} yukleniyor={mesgul} />
    </>
  );
}

// ---------------------------------------------------------------- 19c · Yalnız mekanlar (mevcut seyahat)

function HedefMekanlari({ gezi, seyahatId, kimlik, foto, onAl, hata }: { gezi: GeziDetay; seyahatId: string; kimlik: (d: GeziDuragi) => string | null; foto?: Props['foto']; onAl: Props['onAl']; hata: string | null }) {
  const mekanlarQ = useMekanlar(seyahatId);
  const listede = useMemo(() => new Set((mekanlarQ.data ?? []).map((m) => m.place_id)), [mekanlarQ.data]);
  const gruplar = useMemo(() => mekanGruplari(gezi, kimlik, listede), [gezi, kimlik, listede]);
  const [elle, setSecili] = useState<Set<string> | null>(null);
  const secili = useMemo(() => elle ?? varsayilanMekanSecimi(gruplar), [elle, gruplar]);
  const [mesgul, setMesgul] = useState(false);
  const n = secilebilirler(gruplar).filter((x) => secili.has(x.durak.id)).length;
  const hepsiListede = !mekanlarQ.isPending && secilebilirler(gruplar).length === 0;
  const al = async () => {
    setMesgul(true);
    try {
      await onAl(seyahatId, mekanSecimPlani(gruplar, secili), 'mekan');
    } finally {
      setMesgul(false);
    }
  };
  return (
    <>
      <SayfaKaydirici style={s.kaydirma} contentContainerStyle={{ gap: 12 }}>
        {mekanlarQ.isPending ? <ActivityIndicator color={renk.ana} /> : <MekanListesi gruplar={gruplar} secili={secili} setSecili={setSecili} foto={foto} />}
        <Text style={s.not}>{t('gezi.mekanNotu')}</Text>
        {hata ? <Text style={s.hata}>{hata}</Text> : null}
      </SayfaKaydirici>
      <Buton
        baslik={hepsiListede ? t('gezi.hepsiListede') : n > 0 ? t('gezi.mekanlariEkle', { n }) : t('gezi.mekanSecin')}
        tur="vurgu"
        boy="buyuk"
        onPress={() => void al()}
        pasif={n === 0 || mekanlarQ.isPending || mesgul}
        yukleniyor={mesgul}
      />
    </>
  );
}

/** KK8: günlere göre gruplu seçim listesi — üstte "N / M" ve "Tümünü seç", grupta "Hepsini seç / kaldır". */
function MekanListesi({ gruplar, secili, setSecili, foto }: { gruplar: MekanGrubu[]; secili: Set<string>; setSecili: (s: Set<string>) => void; foto?: Props['foto'] }) {
  const tum = secilebilirler(gruplar);
  const seciliSayi = tum.filter((x) => secili.has(x.durak.id)).length;
  const tumuSecili = tum.length > 0 && seciliSayi === tum.length;
  const degistir = (ids: string[], ekle: boolean) => {
    const yeni = new Set(secili);
    for (const id of ids) {
      if (ekle) yeni.add(id);
      else yeni.delete(id);
    }
    setSecili(yeni);
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={s.listeUst}>
        <Text style={s.bolum}>{t('gezi.listeneEklenecekler', { n: seciliSayi, m: tum.length })}</Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: tumuSecili, disabled: tum.length === 0 }}
          disabled={tum.length === 0}
          onPress={() =>
            degistir(
              tum.map((x) => x.durak.id),
              !tumuSecili,
            )
          }
          style={s.tumu}
          hitSlop={8}>
          <View style={[s.onayKucuk, tumuSecili && s.onaySecili]}>{tumuSecili ? <Ikon ad="tik" boyut={12} renk={renk.zemin} kalinlik={3} /> : null}</View>
          <Text style={s.tumuMetin}>{t('gezi.tumunuSec')}</Text>
        </Pressable>
      </View>
      {gruplar.map((grup) => {
        const rengi = gunRengi(grup.gun.sira);
        const hepsi = grupHepsiSecili(grup, secili);
        const secilebilen = grup.satirlar.filter((x) => !x.listede).map((x) => x.durak.id);
        return (
          <View key={grup.gun.id} style={{ gap: 2 }}>
            <View style={s.grupUst}>
              <View style={[s.gunNo, { backgroundColor: rengi }]}>
                <Text style={[s.gunNoMetin, { color: gunUstuMetin(rengi) }]}>{grup.gun.sira}</Text>
              </View>
              <Text style={s.grupBaslik} numberOfLines={1}>
                {geziGunuBasligi(grup.gun)}
              </Text>
              {secilebilen.length > 0 ? (
                <Pressable accessibilityRole="button" onPress={() => degistir(secilebilen, !hepsi)} hitSlop={8} style={{ marginLeft: 'auto' }}>
                  <Text style={s.grupEylem}>{hepsi ? t('gezi.hepsiniKaldir') : t('gezi.hepsiniSec')}</Text>
                </Pressable>
              ) : null}
            </View>
            {grup.satirlar.map(({ durak, listede }) => {
              const acik = secili.has(durak.id);
              const alt = [kategoriEtiketi(durak.kategori), durak.sure_dk ? sureMetni(durak.sure_dk) : null].filter(Boolean).join(' · ');
              return (
                <Pressable
                  key={durak.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={durak.ad}
                  accessibilityState={{ checked: listede || acik, disabled: listede }}
                  disabled={listede}
                  onPress={() => degistir([durak.id], !acik)}
                  style={s.mekan}>
                  <FotoKutusu uri={foto?.(durak) ?? null} tip={durak.kategori} boyut={40} kose={11} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.mekanAd, listede && { color: renk.ikincil }]} numberOfLines={1}>
                      {durak.ad}
                    </Text>
                    <Text style={s.gunAlt} numberOfLines={1}>
                      {alt}
                    </Text>
                  </View>
                  {listede ? (
                    <View style={s.listende}>
                      <Text style={s.listendeMetin}>{t('gezi.listende')}</Text>
                    </View>
                  ) : (
                    <View style={[s.onayOrta, acik && s.onaySecili]}>{acik ? <Ikon ad="tik" boyut={14} renk={renk.zemin} kalinlik={3} /> : null}</View>
                  )}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- 19b · Yeni seyahat (akışın içinde)

function YeniSeyahat({
  gezi,
  sekme,
  form,
  setForm,
  kimlik,
  foto,
  onYeni,
  hata,
}: {
  gezi: GeziDetay;
  sekme: Sekme;
  form: Form;
  setForm: (f: Form) => void;
  kimlik: (d: GeziDuragi) => string | null;
  foto?: Props['foto'];
  onYeni: Props['onYeni'];
  hata: string | null;
}) {
  // Gezinin şehri, kilitli: Google kimliği ve saat dilimi sihirbazın "Bu şehre seyahat kur"uyla aynı yoldan (oturumda bir kez).
  const sehirler = useSehirler();
  const sehirKaydi = sehirler.data?.find((k) => k.id === gezi.sehir_id);
  const sehir = useIcerikSehirSecimi(sehirKaydi);
  const sehirHatasi = sehir.isError || (!!sehirler.data && !sehirKaydi);
  const sehirAdi = gezi.sehirler?.ad ?? sehir.data?.ad ?? '';
  const baslangic = form.tarihsiz ? null : form.baslangic;
  const { ozet } = useMemo(() => yeniSeyahatPlani(gezi, form.gunSayisi, baslangic), [gezi, form.gunSayisi, baslangic]);
  const gruplar = useMemo(() => mekanGruplari(gezi, kimlik, new Set()), [gezi, kimlik]);
  const [elle, setSecili] = useState<Set<string> | null>(null);
  const secili = useMemo(() => elle ?? varsayilanMekanSecimi(gruplar), [elle, gruplar]);
  const n = secilebilirler(gruplar).filter((x) => secili.has(x.durak.id)).length;
  const [mesgul, setMesgul] = useState(false);
  const tarihHazir = form.tarihsiz || !!form.baslangic;
  const bilgi = yeniSeyahatBilgisi(gezi.baslik, ozet, sekme === 'mekan' ? n : undefined);
  const ac = async () => {
    if (!sehir.data) return;
    setMesgul(true);
    try {
      await onYeni({ sehir: sehir.data, gunSayisi: form.gunSayisi, baslangic, secim: sekme === 'plan' ? { tur: 'plan' } : { tur: 'mekan', duraklar: mekanSecimPlani(gruplar, secili).duraklar } });
    } finally {
      setMesgul(false);
    }
  };
  return (
    <>
      <SayfaKaydirici style={s.kaydirma} contentContainerStyle={{ gap: 12 }}>
        <YeniSeyahatFormu sehirAdi={sehirAdi} form={form} setForm={setForm} />
        {sekme === 'mekan' ? <MekanListesi gruplar={gruplar} secili={secili} setSecili={setSecili} foto={foto} /> : null}
        <BilgiKutusu metin={bilgi} />
        {sehirHatasi ? (
          <View style={s.sehirHata}>
            <Text style={[s.hata, { flex: 1 }]}>{t('gezi.yeniSehirHata')}</Text>
            {sehir.isError ? (
              <Pressable accessibilityRole="button" onPress={() => void sehir.refetch()} hitSlop={8}>
                <Text style={s.grupEylem}>{t('gezi.yeniSehirTekrar')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {hata ? <Text style={s.hata}>{hata}</Text> : null}
      </SayfaKaydirici>
      <Buton
        baslik={sekme === 'plan' ? t('gezi.yeniAcPlan') : n > 0 ? t('gezi.yeniAcMekan', { n }) : t('gezi.mekanSecin')}
        tur="vurgu"
        boy="buyuk"
        onPress={() => void ac()}
        pasif={!sehir.data || !tarihHazir || (sekme === 'mekan' && n === 0) || mesgul}
        yukleniyor={mesgul}
      />
      <Text style={s.dipnot}>{sekme === 'plan' ? t('gezi.yeniDipnotPlan') : t('gezi.yeniDipnotMekan')}</Text>
    </>
  );
}

/** Tarih şeridi: bugünden itibaren bu kadar gün. */
const SERIT_GUN = 120;

function YeniSeyahatFormu({ sehirAdi, form, setForm }: { sehirAdi: string; form: Form; setForm: (f: Form) => void }) {
  const bugun = useMemo(() => yerelTarih(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  const gunler = useMemo(() => Array.from({ length: SERIT_GUN }, (_, i) => tarihEkle(bugun, i)), [bugun]);
  const son = form.baslangic ? tarihEkle(form.baslangic, form.gunSayisi - 1) : null;
  const ay = AYLAR[parcala(form.baslangic ?? bugun).ay - 1];
  const gunSayisi = (n: number) => setForm({ ...form, gunSayisi: gunSiniri(n) });
  return (
    <View style={s.form}>
      <View style={s.formSatir}>
        <Text style={s.formEtiket}>{t('gezi.yeniSehir')}</Text>
        <View style={s.sehirHap} accessibilityLabel={`${t('gezi.yeniSehir')}: ${sehirAdi}`}>
          <Ikon ad="pin" boyut={14} renk={renk.ana} kalinlik={2.3} />
          <Text style={s.sehirMetin}>{sehirAdi}</Text>
        </View>
      </View>
      <View style={s.formSatir}>
        <Text style={s.formEtiket}>{t('gezi.yeniKacGun')}</Text>
        <View style={s.sayac}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('gezi.yeniGunAzalt')} disabled={form.gunSayisi <= EN_AZ_GUN} onPress={() => gunSayisi(form.gunSayisi - 1)} style={[s.sayacDugme, form.gunSayisi <= EN_AZ_GUN && s.sayacPasif]} hitSlop={6}>
            <Text style={s.sayacIsaret}>−</Text>
          </Pressable>
          <Text style={s.sayacDeger}>{t('gezi.yeniGunSayisi', { n: form.gunSayisi })}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('gezi.yeniGunArttir')} disabled={form.gunSayisi >= EN_COK_GUN} onPress={() => gunSayisi(form.gunSayisi + 1)} style={[s.sayacDugme, form.gunSayisi >= EN_COK_GUN && s.sayacPasif]} hitSlop={6}>
            <Text style={s.sayacIsaret}>+</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <View style={s.formSatir}>
          <Text style={s.formEtiket}>{t('gezi.yeniNeZaman', { ay })}</Text>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.tarihsiz }} onPress={() => setForm({ ...form, tarihsiz: !form.tarihsiz })} hitSlop={8} style={[s.tarihSonra, form.tarihsiz && s.tarihSonraSecili]}>
            <Text style={[s.grupEylem, form.tarihsiz && { color: renk.zemin }]}>{t('gezi.yeniTarihSonra')}</Text>
          </Pressable>
        </View>
        {/* Başlangıç gününe dokununca gün sayısı kadar gün seçilir. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.serit} style={[s.seritKap, form.tarihsiz && s.seritPasif]}>
          {gunler.map((g) => {
            const secili = !form.tarihsiz && !!form.baslangic && !!son && g >= form.baslangic && g <= son;
            return (
              <Pressable key={g} accessibilityRole="button" accessibilityLabel={kisaTarih(g)} accessibilityState={{ selected: secili }} onPress={() => setForm({ ...form, baslangic: g, tarihsiz: false })} style={[s.seritGun, secili && s.seritGunSecili]}>
                <Text style={[s.seritGunAdi, secili && { color: renk.anaAcik }]}>{GUNLER_KISA[haftaGunu(g)]}</Text>
                <Text style={[s.seritGunNo, secili && { color: renk.zemin }]}>{parcala(g).gun}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={s.not}>{form.tarihsiz ? t('gezi.yeniTarihsizIpucu') : t('gezi.yeniTarihIpucu', { n: form.gunSayisi })}</Text>
      </View>
    </View>
  );
}

function BilgiKutusu({ metin }: { metin: string }) {
  return (
    <View style={s.bilgi}>
      <Text style={s.bilgiMetin}>
        {kalinParcalar(metin).map((p, i) => (
          <Text key={i} style={p.kalin ? s.bilgiKalin : undefined}>
            {p.metin}
          </Text>
        ))}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(14,20,48,0.5)', justifyContent: 'flex-end' },
  kutu: { maxHeight: '92%', backgroundColor: renk.zemin, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 30, gap: 16 },
  tutamak: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: renk.ayrac },
  baslik: { fontFamily: yazi.baslik, fontSize: 24, letterSpacing: -0.6, color: renk.metin },
  altBaslik: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil },
  bolum: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.48, color: renk.ikincil },
  ciplerSerit: { marginHorizontal: -20, flexGrow: 0 },
  cipler: { gap: 8, paddingHorizontal: 20 },
  cip: { height: 44, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1.5, borderColor: renk.ayrac, backgroundColor: renk.zemin, justifyContent: 'center', maxWidth: 280 },
  cipYeni: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cipSecili: { backgroundColor: renk.ana, borderColor: renk.ana },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  cipMetinSecili: { color: renk.zemin },
  sekmeler: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: renk.yuzey },
  sekme: { flex: 1, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sekmeSecili: { backgroundColor: renk.zemin, shadowColor: renk.metin, shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  sekmeMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ikincil },
  sekmeMetinSecili: { color: renk.metin },
  kaydirma: { flexGrow: 0 },
  gun: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1.5, borderColor: renk.ayrac },
  gunSecili: { borderWidth: 2, borderColor: renk.ana, padding: 11.5 },
  gunSol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  onay: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#b4bbd3', alignItems: 'center', justifyContent: 'center' },
  onayOrta: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#b4bbd3', alignItems: 'center', justifyContent: 'center' },
  onayKucuk: { width: 20, height: 20, borderRadius: 7, borderWidth: 2, borderColor: '#b4bbd3', alignItems: 'center', justifyContent: 'center' },
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
  listeUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tumu: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 },
  tumuMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  grupUst: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  gunNo: { width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  gunNoMetin: { fontFamily: yazi.ekstra, fontSize: 11 },
  grupBaslik: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin, flexShrink: 1 },
  grupEylem: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
  mekan: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, minHeight: 52 },
  mekanAd: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  listende: { height: 26, paddingHorizontal: 8, borderRadius: 8, backgroundColor: renk.basariZemin, justifyContent: 'center' },
  listendeMetin: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.basariMetin },
  form: { padding: 14, borderRadius: 18, backgroundColor: renk.haritaZemin, gap: 14 },
  formSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  formEtiket: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ikincil },
  sehirHap: { height: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: renk.zemin, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sehirMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  sayac: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 3, borderRadius: 12, backgroundColor: renk.zemin },
  sayacDugme: { width: 30, height: 30, borderRadius: 9, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  sayacPasif: { opacity: 0.4 },
  sayacIsaret: { fontFamily: yazi.ekstra, fontSize: 18, color: renk.ana, lineHeight: 22 },
  sayacDeger: { minWidth: 54, textAlign: 'center', fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  tarihSonra: { height: 28, paddingHorizontal: 8, borderRadius: 9, justifyContent: 'center' },
  tarihSonraSecili: { backgroundColor: renk.ana },
  seritKap: { marginHorizontal: -14, flexGrow: 0 },
  seritPasif: { opacity: 0.45 },
  serit: { gap: 6, paddingHorizontal: 14 },
  seritGun: { width: 46, height: 58, borderRadius: 13, borderWidth: 1.5, borderColor: renk.ayrac, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center', gap: 2 },
  seritGunSecili: { backgroundColor: renk.ana, borderColor: renk.ana },
  seritGunAdi: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.ikincil },
  seritGunNo: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin },
  sehirHata: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bilgi: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: renk.yuzey },
  bilgiMetin: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 19, color: '#232b48' },
  bilgiKalin: { fontFamily: yazi.ekstra },
  dipnot: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil, textAlign: 'center', marginTop: -6 },
  not: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 17, color: renk.ikincil },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari },
});
