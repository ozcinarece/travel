// #97 C → #143 KK5–6 → #193 → #408 KK6 (UX önerileri kanvası `Sayfa_v5_SeyahatimeAl`): "Seyahatime al" çekmecesi — başlık,
// seyahat satırı (ad · tarih, altında "Ayşe ve Mert de görecek"; dokununca seyahat seçici açılır), gezinin gün satırları onay
// daireleriyle (varsayılan eşleme sırayla: "Cuma 16'ya · 7 durak"; seyahatte olmayan gün "Seyahate pazar 18'i ekler", varsayılan
// seçilmez), "1'i zaten listende" ve tek turuncu "N durağı al". "Planı al / Yalnız mekanlar" seçicisi, tarih eşleme çipleri ve
// açıklama paragrafı kalktı; tek durak sayfadaki satırın "+"sıyla eklenir. "Yeni seyahat" sihirbaza gitmez (#193): aynı sayfada
// şehir (gezinin, kilitli), kaç gün, ne zaman; seyahat ve plan tek işlemde açılır.
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import { HedefSeridi } from '@/components/icerik/HedefSeridi';
import { Buton } from '@/components/ui/Buton';
import { EklemeDurumSatiri } from '@/components/ui/EklemeDurumSatiri';
import { Ikon } from '@/components/ui/Ikon';
import { CekilenSayfa, modalKokuStili, SayfaKaydirici } from '@/components/ui/sayfaCekme';
import { cevrimdisiDurumu, type EklemeDurumu } from '@/features/ekleme/eklemeDurumu';
import { useDuraklar, useGunler } from '@/features/gunler/sorgular';
import {
  aktarmaOzeti,
  aktarmaPlani,
  aktarmaSecenegi,
  eklenecekGunler,
  geziGunuBasligi,
  hedefEslesmesi,
  hedefListesi,
  sanalGun,
  sanalGunMu,
  sanalSira,
  sanalSiraOnizleme,
  varsayilanDahil,
  type AktarmaPlani,
  type AktarmaSecimi,
} from '@/features/icerik/aktar';
import { EN_AZ_GUN, EN_COK_GUN, gunSiniri } from '@/features/icerik/seyahateAl';
import { durakAlDugmesi, eklenecekGunMetni, goreceklerSatiri, hedefGunMetni, zatenListendeSayisi } from '@/features/icerik/seyahatimeAlV5';
import { useSehirler } from '@/features/icerik/sorgular';
import { baslangicHedefi } from '@/features/icerik/yerEkle';
import { useMekanlar } from '@/features/mekanlar/sorgular';
import { useIcerikSehirSecimi } from '@/features/sihirbaz/girisler';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { useCevrimdisi } from '@/lib/baglanti';
import { iyelikEkli } from '@/lib/ek';
import { useOturum } from '@/lib/oturum';
import { AYLAR, AYLAR_KISA, GUNLER_KISA, haftaGunu, kisaTarih, parcala, tarihEkle } from '@/lib/takvim';
import type { GeziDetay, GeziDuragi, SehirSecimi, SeyahatOzet } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';
import { anaV5, baslikStili, hazirGeziV6, renk, yazi } from '@/theme';

export type AlSecenegi = 'tum' | 'gunler' | 'mekan';
export type YeniSeyahatIstegi = {
  sehir: SehirSecimi;
  gunSayisi: number;
  /** null → "Tarih sonra". */
  baslangic: string | null;
  secim: { tur: 'plan' } | { tur: 'mekan'; duraklar: GeziDuragi[] };
};

/** Yeni seyahat formu (seyahat seçici açılıp kapanınca korunur). */
type Form = { gunSayisi: number; baslangic: string | null; tarihsiz: boolean };

type Props = {
  gezi: GeziDetay;
  seyahatler: SeyahatOzet[];
  /** Açılışta seçili seyahat (sayfadaki "+ ve ✓" bağlamı). */
  ilkHedefId: string | null;
  /** Durağın çözülmüş place_id'si (mükerrer hesabı). */
  kimlik: (d: GeziDuragi) => string | null;
  /** #193 KK11: satır fotoğrafı yalnız elde olandan — yeni istek yok. #408'den beri çekmecede satır fotoğrafı yok. */
  foto?: (d: GeziDuragi) => string | null;
  onKapat: () => void;
  /** Mevcut seyahate; `ekGunler`: sona eklenecek sanal günler (KK5). */
  onAl: (seyahatId: string, plan: AktarmaPlani, secenek: AlSecenegi, ekGunler?: string[]) => Promise<void>;
  onYeni: (istek: YeniSeyahatIstegi) => Promise<void>;
  hata: EklemeDurumu | null;
  /** #587 inceleme: seyahat listesi daha gelmediyse hedef ve içerik yükleniyor halinde; boş listeden "Yeni seyahat"e düşülmez. */
  yukleniyor?: boolean;
};

const YENI = 'yeni';

export function SeyahatimeAl({ gezi, seyahatler, ilkHedefId, kimlik, onKapat, onAl, onYeni, hata, yukleniyor = false }: Props) {
  // #583 KK1: hedef verilmediyse (aynı şehirde seyahat yok) "Yeni seyahat" seçili gelir; ilk seyahate düşülmez.
  // #587 inceleme: kullanıcı bir çipe dokunana kadar hedef her çizimde listeden hesaplanır; liste geç gelirse verilen hedef
  // seçili olur (açılışta boş listeden kalıcı "Yeni seyahat" yok). Dokunulduysa seçim korunur.
  const [secilen, setHedefId] = useState<string | null>(null);
  const hedefId = secilen ?? baslangicHedefi(seyahatler, ilkHedefId) ?? YENI;
  const hedef = hedefId === YENI ? null : (seyahatler.find((s) => s.id === hedefId) ?? null);
  const [seciciAcik, setSeciciAcik] = useState(false);
  const [form, setForm] = useState<Form>(() => ({ gunSayisi: gunSiniri(gezi.gezi_gunleri.length || gezi.gun_sayisi || 1), baslangic: null, tarihsiz: false }));
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onKapat}>
      <GestureHandlerRootView style={modalKokuStili}>
        <View style={s.perde}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onKapat} accessibilityLabel={t('genel.vazgec')} />
          <CekilenSayfa onKapat={onKapat} style={s.kutu} accessibilityViewIsModal>
            <View style={s.tutamak} />
            <Text style={s.baslik} accessibilityRole="header">
              {t('gezi.alBaslik')}
            </Text>
            {yukleniyor ? (
              <View style={s.yukleniyor} accessibilityRole="progressbar" accessibilityLabel={t('seyahatlerim.yukleniyor')} accessibilityState={{ busy: true }}>
                <ActivityIndicator color={renk.ana} />
              </View>
            ) : (
              <>
                {/* #277 KK4: kullanıcının seyahati yoksa seyahat satırı yok; yalnız yeni seyahatin tarihi sorulur. */}
                {seyahatler.length > 0 ? (
                  <>
                    <SeyahatSatiri hedef={hedef} acik={seciciAcik} onPress={() => setSeciciAcik((a) => !a)} />
                    {seciciAcik ? (
                      <HedefSeridi
                        seyahatler={seyahatler}
                        hedefId={hedef?.id ?? null}
                        sehirAdi={gezi.sehirler?.ad}
                        onSec={(id) => {
                          setHedefId(id ?? YENI);
                          setSeciciAcik(false);
                        }}
                      />
                    ) : null}
                  </>
                ) : null}
                {!hedef ? (
                  <YeniSeyahat gezi={gezi} form={form} setForm={setForm} onYeni={onYeni} hata={hata} />
                ) : (
                  // Seyahat değişince gün seçimi ve eşleşme baştan kurulur.
                  <HedefGunleri key={hedef.id} gezi={gezi} seyahatId={hedef.id} kimlik={kimlik} onAl={onAl} hata={hata} />
                )}
              </>
            )}
          </CekilenSayfa>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Seyahat satırı (kanvas): satır zemini, ad · tarih (16/700), altında yüzler ve "Ayşe ve Mert de görecek" (13), sağda ›. */
function SeyahatSatiri({ hedef, acik, onPress }: { hedef: SeyahatOzet | null; acik: boolean; onPress: () => void }) {
  const { session } = useOturum();
  const gorecek = hedef ? goreceklerSatiri(hedef.members ?? [], session?.user.id ?? null) : null;
  const ad = hedef ? [seyahatAdi(hedef), hedef.start_date && hedef.end_date ? kisaAralik(hedef.start_date, hedef.end_date) : null].filter(Boolean).join(' · ') : t('gezi.yeniSeyahat');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[ad, gorecek?.metin].filter(Boolean).join(', ')}
      accessibilityHint={t('gezi.v6.seyahatDegistir')}
      accessibilityState={{ expanded: acik }}
      onPress={onPress}
      style={({ pressed }) => [s.seyahat, pressed && { opacity: 0.85 }]}>
      <View style={s.seyahatMetin}>
        <Text style={s.seyahatAd} numberOfLines={1}>
          {ad}
        </Text>
        {gorecek ? (
          <View style={s.gorecek}>
            {gorecek.yuzler.length > 0 ? (
              <View style={s.yuzler}>
                {gorecek.yuzler.map((h, i) => (
                  <View key={i} style={[s.yuz, { backgroundColor: i === 0 ? renk.ana : hazirGeziV6.yuzIkinci }, i > 0 && { marginLeft: -6 }]}>
                    <Text style={s.yuzHarf}>{h}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={s.gorecekMetin} numberOfLines={1}>
              {gorecek.metin}
            </Text>
          </View>
        ) : null}
      </View>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={anaV5.ok} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <Path d={acik ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} />
      </Svg>
    </Pressable>
  );
}

/** "16–17 Eki" · "30 Eki – 2 Kas" (kanvas, kısa ay). */
function kisaAralik(bas: string, bit: string): string {
  const b = parcala(bas);
  const e = parcala(bit);
  if (bas === bit) return `${b.gun} ${AYLAR_KISA[b.ay - 1]}`;
  if (b.ay === e.ay && b.yil === e.yil) return `${b.gun}–${e.gun} ${AYLAR_KISA[b.ay - 1]}`;
  return `${b.gun} ${AYLAR_KISA[b.ay - 1]} – ${e.gun} ${AYLAR_KISA[e.ay - 1]}`;
}

// ---------------------------------------------------------------- Planı al (mevcut seyahat)

/**
 * #388 inceleme: görünen satır; hata yokken çevrimdışıysa pasif düğmenin nedeni. "Tekrar dene" satıra `yeniden` ile verilen
 * bu bileşenin `al()` / `ac()`'ını çağırır (bekleme göstergesi + düğme kilidi atlanmasın, iki seyahat açılmasın).
 */
function gorunenDurum(hata: EklemeDurumu | null, cevrimdisi: boolean): EklemeDurumu | null {
  return hata ?? (cevrimdisi ? cevrimdisiDurumu() : null);
}

function HedefGunleri({ gezi, seyahatId, kimlik, onAl, hata }: { gezi: GeziDetay; seyahatId: string; kimlik: (d: GeziDuragi) => string | null; onAl: Props['onAl']; hata: EklemeDurumu | null }) {
  // #388 KK5 (kanvas 23c): bağlantı yokken ekleme düğmesi pasif.
  const cevrimdisi = useCevrimdisi();
  const gunlerQ = useGunler(seyahatId);
  const duraklarQ = useDuraklar(seyahatId);
  const mekanlarQ = useMekanlar(seyahatId);
  const gunler = useMemo(() => [...(gunlerQ.data ?? [])].sort((a, b) => a.index - b.index), [gunlerQ.data]);
  const [dahilElle, setDahil] = useState<Record<string, boolean>>({});
  const [mesgul, setMesgul] = useState(false);
  // KK6: eşleme sırayla (seçici yok); seyahatten fazla gezi günleri sona eklenecek güne eşlenir ama varsayılan seçilmez (#193 KK5).
  const dahil = useMemo(() => ({ ...varsayilanDahil(gezi, gunler), ...dahilElle }), [gezi, gunler, dahilElle]);
  const eslesme = useMemo(() => hedefEslesmesi(gezi, gunler), [gezi, gunler]);
  const secim: AktarmaSecimi = useMemo(() => ({ tur: 'gunler', eslesme, dahil }), [eslesme, dahil]);
  const plan = useMemo(() => aktarmaPlani(gezi, gunler, secim), [gezi, gunler, secim]);
  const sira = useMemo(() => sanalSira(gezi, eslesme, dahil), [gezi, eslesme, dahil]);
  const hedef = useMemo(() => hedefListesi(mekanlarQ.data ?? [], duraklarQ.data ?? []), [mekanlarQ.data, duraklarQ.data]);
  const ozet = useMemo(() => aktarmaOzeti(gezi, plan, kimlik, hedef), [gezi, plan, kimlik, hedef]);
  const dugme = durakAlDugmesi(plan, ozet);
  const zatenListende = zatenListendeSayisi(gezi, ozet, dahil);
  const yukleniyor = gunlerQ.isPending || duraklarQ.isPending || mekanlarQ.isPending;
  const gunDahil = (id: string) => dahil[id] !== false;
  const altSatir = (geziGunId: string, durak: number) => {
    const id = eslesme[geziGunId] ?? null;
    if (sanalGunMu(id)) return eklenecekGunMetni(sanalGun(gunler, id, sanalSiraOnizleme(sira, id)));
    const g = id ? gunler.find((x) => x.id === id) : undefined;
    return g ? hedefGunMetni(g, durak) : t('gezi.v6.gunDurak', { n: durak });
  };

  const kilit = useRef(false);
  const al = async () => {
    if (kilit.current) return;
    kilit.current = true;
    setMesgul(true);
    try {
      await onAl(seyahatId, plan, aktarmaSecenegi(gezi, secim), eklenecekGunler(plan, sira));
    } finally {
      kilit.current = false;
      setMesgul(false);
    }
  };
  const durum = gorunenDurum(hata, cevrimdisi);

  return (
    <>
      <SayfaKaydirici style={s.kaydirma} contentContainerStyle={{ gap: 14 }}>
        {yukleniyor ? (
          <ActivityIndicator color={renk.ana} />
        ) : (
          <View>
            {gezi.gezi_gunleri.map((g) => {
              const acik = gunDahil(g.id);
              return (
                <Pressable key={g.id} accessibilityRole="checkbox" accessibilityLabel={geziGunuBasligi(g)} accessibilityState={{ checked: acik }} onPress={() => setDahil((d) => ({ ...d, [g.id]: !acik }))} style={s.gun}>
                  <View style={[s.onay, acik && s.onaySecili]}>{acik ? <Ikon ad="tik" boyut={14} renk={renk.zemin} kalinlik={3} /> : null}</View>
                  <View style={s.gunMetin}>
                    <Text style={s.gunBaslik} numberOfLines={1}>
                      {geziGunuBasligi(g)}
                    </Text>
                    <Text style={s.gunAlt} numberOfLines={1}>
                      {altSatir(g.id, g.gezi_duraklari.length)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {!yukleniyor && zatenListende > 0 ? <Text style={s.listende}>{t('gezi.zatenListende', { n: iyelikEkli(zatenListende) })}</Text> : null}
        {durum ? <EklemeDurumSatiri durum={durum} yeniden={() => void al()} /> : null}
      </SayfaKaydirici>
      <Buton baslik={dugme.metin} tur="vurgu" stil={s.alDugmesi} onPress={() => void al()} pasif={dugme.pasif || yukleniyor || mesgul || cevrimdisi} yukleniyor={mesgul} ipucu={cevrimdisi ? t('ekleme.baglantiYokIpucu') : undefined} />
    </>
  );
}

// ---------------------------------------------------------------- 19b · Yeni seyahat (akışın içinde)

function YeniSeyahat({ gezi, form, setForm, onYeni, hata }: { gezi: GeziDetay; form: Form; setForm: (f: Form) => void; onYeni: Props['onYeni']; hata: EklemeDurumu | null }) {
  // #388 KK5 (kanvas 23c): bağlantı yokken ekleme düğmesi pasif.
  const cevrimdisi = useCevrimdisi();
  // Gezinin şehri, kilitli: Google kimliği ve saat dilimi sihirbazın "Bu şehre seyahat kur"uyla aynı yoldan (oturumda bir kez).
  const sehirler = useSehirler();
  const sehirKaydi = sehirler.data?.find((k) => k.id === gezi.sehir_id);
  const sehir = useIcerikSehirSecimi(sehirKaydi);
  const sehirHatasi = sehir.isError || (!!sehirler.data && !sehirKaydi);
  const sehirAdi = gezi.sehirler?.ad ?? sehir.data?.ad ?? '';
  const baslangic = form.tarihsiz ? null : form.baslangic;
  const [mesgul, setMesgul] = useState(false);
  const tarihHazir = form.tarihsiz || !!form.baslangic;
  const kilit = useRef(false);
  const ac = async () => {
    if (!sehir.data || kilit.current) return;
    kilit.current = true;
    setMesgul(true);
    try {
      await onYeni({ sehir: sehir.data, gunSayisi: form.gunSayisi, baslangic, secim: { tur: 'plan' } });
    } finally {
      kilit.current = false;
      setMesgul(false);
    }
  };
  const durum = gorunenDurum(hata, cevrimdisi);
  return (
    <>
      <SayfaKaydirici style={s.kaydirma} contentContainerStyle={{ gap: 12 }}>
        <YeniSeyahatFormu sehirAdi={sehirAdi} form={form} setForm={setForm} />
        {sehirHatasi ? (
          <View style={s.sehirHata}>
            <Text style={[s.hata, { flex: 1 }]}>{t('gezi.yeniSehirHata')}</Text>
            {sehir.isError ? (
              <Pressable accessibilityRole="button" onPress={() => void sehir.refetch()} hitSlop={8}>
                <Text style={s.eylem}>{t('gezi.yeniSehirTekrar')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {durum ? <EklemeDurumSatiri durum={durum} yeniden={() => void ac()} /> : null}
      </SayfaKaydirici>
      <Buton
        baslik={t('gezi.yeniAcPlan')}
        tur="vurgu"
        stil={s.alDugmesi}
        onPress={() => void ac()}
        pasif={!sehir.data || !tarihHazir || mesgul || cevrimdisi}
        yukleniyor={mesgul}
        ipucu={cevrimdisi ? t('ekleme.baglantiYokIpucu') : undefined}
      />
      <Text style={s.dipnot}>{t('gezi.yeniDipnotPlan')}</Text>
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
            <Text style={[s.eylem, form.tarihsiz && { color: renk.zemin }]}>{t('gezi.yeniTarihSonra')}</Text>
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

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(14,20,48,0.35)', justifyContent: 'flex-end' },
  // Kanvas: köşe 24, iç boşluk 10 · 20 · 30, aralar 14.
  kutu: { maxHeight: '92%', backgroundColor: renk.zemin, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingHorizontal: 20, paddingBottom: 30, gap: 14 },
  tutamak: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: anaV5.cizgi },
  baslik: { ...baslikStili(24), letterSpacing: -0.24, color: renk.metin },
  yukleniyor: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  seyahat: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: anaV5.satirZemin, minHeight: 44 },
  seyahatMetin: { flex: 1, minWidth: 0, gap: 2 },
  seyahatAd: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  gorecek: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gorecekMetin: { flexShrink: 1, fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  yuzler: { flexDirection: 'row' },
  yuz: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  yuzHarf: { fontFamily: yazi.ekstra, fontSize: 14, lineHeight: 18, color: renk.zemin },
  kaydirma: { flexGrow: 0 },
  gun: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: anaV5.cizgi, minHeight: 44 },
  onay: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: anaV5.inceKenar, alignItems: 'center', justifyContent: 'center' },
  onaySecili: { backgroundColor: renk.metin, borderColor: renk.metin },
  gunMetin: { flex: 1, minWidth: 0, gap: 1 },
  gunBaslik: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  gunAlt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  listende: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  // Kanvas: tam genişlik, 52 px, tam yuvarlak.
  alDugmesi: { height: 52, borderRadius: 26 },
  eylem: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
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
  dipnot: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil, textAlign: 'center', marginTop: -6 },
  not: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 17, color: renk.ikincil },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari },
});
