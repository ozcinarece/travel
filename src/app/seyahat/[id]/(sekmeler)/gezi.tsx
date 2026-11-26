import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams, useNavigationContainerRef } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GrupPenceresi } from '@/components/davet/GrupPenceresi';
import { PaylasimCekmecesi } from '@/components/paylasim/PaylasimCekmecesi';
import { KatilimSayfasi } from '@/components/davet/KatilimSayfasi';
import { ProfilOnayi } from '@/components/davet/ProfilOnayi';
import { CevrimdisiSeridi } from '@/components/gezi/CevrimdisiSeridi';
import { GeziMenusu } from '@/components/gezi/GeziMenusu';
import { HarcamaFormu } from '@/components/harcama/HarcamaFormu';
import { HatirlatmaSatiri } from '@/components/harcama/HatirlatmaSatiri';
import { SecimMenusu } from '@/components/program/SecimMenusu';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { useDavetPaylas } from '@/features/davet/paylas';
import { useBilinenMekanlar } from '@/features/gezi/bilinenMekanlar';
import { useBugunEkle } from '@/features/gezi/bugunEkle';
import { baslikAltSatiri, bosGunOnerileri, gunSatiri, kisiAdlari, simdiEtiketi, varanlarMetni } from '@/features/gezi/seyahatV7';
import { ustHaritaVerisi, type UstHaritaHali } from '@/features/gezi/ustHarita';
import { programCizgileri } from '@/features/program/haritaVerisi';
import {
  Baslik,
  BolumBasligi,
  BugunBosV7,
  BugununPlaniV7,
  GunlerV7,
  KisilerSatiri,
  ListemSatiriV7,
  SiradakiAdimV7,
  SimdiV7,
  SohbetIpucu,
  UstHarita,
  type GunSatiriV7,
  type KisiYuzu,
  type PlanSatiriV7,
} from '@/components/gezi/SeyahatV7';
import { geziModu, grupDurumlari, gunKartlari, gunTarihi, mekanAdi } from '@/features/gezi/geziOzeti';
import { kesfeteDon } from '@/lib/acilis';
import { siradakiAdim, type SiradakiAdim } from '@/features/gezi/siradakiAdim';
import { useDuragaAta, useDuraklar, useGunler } from '@/features/gunler/sorgular';
import { harcamaOzeti, hatirlatmaVakti } from '@/features/harcama/hesap';
import { kisiler as kisiKaynagi } from '@/features/harcama/metin';
import { useHarcamalar, useIbanlar, useOdesmeler } from '@/features/harcama/sorgular';
import { sehirEslestir, useSehirler, useSehirYerleri } from '@/features/icerik/sorgular';
import { OTEL_SERIT_ONEKI } from '@/features/konaklama/otelSeridi';
import type { Konaklama } from '@/features/konaklama/plan';
import { useKonaklamalar } from '@/features/konaklama/sorgular';
import { useKonum, yakinDurakId } from '@/features/konum/useKonum';
import { useMekanlar, useUyeler } from '@/features/mekanlar/sorgular';
import { kartListesi, odakKarti, sonrakiKart, type DurakKarti } from '@/features/program/durakKarti';
import { useDurakGuncelle } from '@/features/program/sorgular';
import { gunDuraklari, saatKisa, useGunProgrami, useSimdi } from '@/features/program/useProgram';
import { useProgramVerisi } from '@/features/program/useProgramVerisi';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { usePlaniUygula } from '@/features/sihirbaz/planUygula';
import { useMesajlar, useOkunmamis, useOylamalar } from '@/features/sohbet/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import type { HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import { useCevrimdisi } from '@/lib/baglanti';
import { mesafeMetni } from '@/lib/mesafe';
import { useOturum } from '@/lib/oturum';
import type { Durak, Gun, Mekan, Seyahat } from '@/lib/tipler';
import { kacinciGun, saatEkli, yerelTarih } from '@/lib/zaman';
import { kategoriEtiketi, sureMetni } from '@/lib/kategori';
import { dakikaSaat, kestirimTaksiSn, kestirimYuruyusSn } from '@/schedule/tempo';
import { gunRengi, renk, yazi } from '@/theme';
import { konumu, yolTarifiHedefi } from '@/lib/konum';

/**
 * #308 v7 (kanvas UX önerileri › `Sayfa_v7_Seyahat_PlanModu` · `_GeziModu` · `_TekBos`): üstte 260 pt harita, başlık, kişiler
 * (davet görünür), grupta sohbet ipucu; plan modunda Sıradaki adım + Günler + Listem, gezi modunda Şimdi + Yol tarifi + bugünün
 * planı, boş günde rehberden yakın 3 yer. Harcama, Sohbet ve Bugün kartları kalktı (sekmelerde var).
 * #181 (kanvas 23 · 23b · 27): seyahatin ana sayfası (açılış sekmesi). Plan modunda kapak + Sıradaki adım + Plan özeti + Listem +
 * Rehberden öneriler + Rehber; gezi modunda (tarihler içinde) Sıradaki adım yerine bugünün durak kartı ve Grup kartı. KK13:
 * açılışta Google'a istek gitmez — adlar ve öneriler DB'den (ya da oturum önbelleğinden), gün saatleri eldeki yürüyüşlerden.
 */

export default function GeziEkrani() {
  const id = useSeyahatId();
  // #181 KK14: davetle gelen kullanıcı doğrudan buraya iner ("Katıldın ✓" alt sayfası bir kez).
  const { katildin } = useLocalSearchParams<{ katildin?: string }>();
  const seyahat = useSeyahat(id);
  const gunler = useGunler(id);
  const duraklar = useDuraklar(id);
  const mekanlar = useMekanlar(id);
  const konaklamalar = useKonaklamalar(id);
  // #243: bağlantı yokken konaklamalar cihazda tutulmaz (stays.label, #250); sayfa onlarsız açılır.
  const cevrimdisi = useCevrimdisi();
  const konaklamaVerisi = konaklamalar.data ?? (cevrimdisi ? BOS_KONAKLAMA : undefined);
  if (!id || !seyahat.data || !gunler.data || !duraklar.data || !mekanlar.data || !konaklamaVerisi) {
    return <SeyahatYukleme sorgular={[seyahat, gunler, duraklar, mekanlar, konaklamalar]} kimlikYok={!id} />;
  }
  // #243 KK3: son başarılı güncelleme — planın üç sorgusundan en yenisi (cihazdaki önbellekten geri yüklenen zaman dahil).
  const guncellendi = Math.max(seyahat.dataUpdatedAt, gunler.dataUpdatedAt, duraklar.dataUpdatedAt);
  return (
    <GeziSayfasi
      key={id}
      seyahat={seyahat.data}
      gunler={gunler.data}
      duraklar={duraklar.data}
      mekanlar={mekanlar.data}
      konaklamalar={konaklamaVerisi}
      katildin={katildin === '1'}
      cevrimdisi={cevrimdisi}
      guncellendi={guncellendi}
    />
  );
}

const BOS_KONAKLAMA: Konaklama[] = [];

type SayfaProps = {
  seyahat: Seyahat;
  gunler: Gun[];
  duraklar: Durak[];
  mekanlar: Mekan[];
  konaklamalar: Konaklama[];
  katildin: boolean;
  /** #243: bağlantı yok — şerit görünür, düzenleme düğmeleri pasif, Google içeriği gösterilmez. */
  cevrimdisi: boolean;
  /** Planın son başarılı güncellemesi (ms). */
  guncellendi: number;
};

function GeziSayfasi({ seyahat, gunler, duraklar, mekanlar, konaklamalar, katildin, cevrimdisi, guncellendi }: SayfaProps) {
  const { session, hesapli } = useOturum();
  const benId = session?.user.id ?? null;
  const uyeler = useUyeler(seyahat.id);
  const durakGuncelle = useDurakGuncelle(seyahat.id);
  const ata = useDuragaAta(seyahat.id);
  const planUygula = usePlaniUygula(seyahat.id);
  const [bildirim, setBildirim] = useState<string | null>(null);
  const davet = useDavetPaylas(seyahat, (sonuc) => {
    if (sonuc === 'kopyalandi') setBildirim(t('davet.linkKopyalandi'));
  });
  useEffect(() => {
    if (!bildirim) return;
    const z = setTimeout(() => setBildirim(null), 2800);
    return () => clearTimeout(z);
  }, [bildirim]);
  const [grupAcik, setGrupAcik] = useState(false);
  const [menuAcik, setMenuAcik] = useState(false);
  const [paylasimAcik, setPaylasimAcik] = useState(false);
  const [karsilamaAcik, setKarsilamaAcik] = useState(katildin);
  const [durakMenu, setDurakMenu] = useState<DurakKarti | null>(null);
  const [gunSecDurak, setGunSecDurak] = useState<DurakKarti | null>(null);
  const [eklenenler, setEklenenler] = useState<Set<string>>(() => new Set());
  const [otelErtelendi, setOtelErtelendi] = useState(false);
  const [harcamaFormu, setHarcamaFormu] = useState(false);
  // Sekme odaktayken: otel şeridi kararı (Plan'da "Şimdi değil" denmiş olabilir) yeniden okunur; konum yalnız odaktayken izlenir
  // (Plan'la birlikte iki izleyici çalışmasın).
  const [odakta, setOdakta] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setOdakta(true);
      AsyncStorage.getItem(OTEL_SERIT_ONEKI + seyahat.id)
        .then((v) => setOtelErtelendi(v === '1'))
        .catch(() => undefined);
      return () => setOdakta(false);
    }, [seyahat.id]),
  );

  const an = useSimdi(true);
  const kokGezinme = useNavigationContainerRef();
  const mod = geziModu(seyahat, an);
  const bugunIndex = kacinciGun(seyahat, an);
  const bugunGun = mod === 'gezi' ? gunler.find((g) => g.index === bugunIndex) : undefined;
  // KK13: ag=false — yürüyüş matrisi ve rota bacakları istenmez; Plan açıldıysa önbellektekiler, yoksa kuş uçuşu kestirimi.
  const verisi = useProgramVerisi({ seyahat, gunler, duraklar, mekanlar, seciliGun: bugunGun, konaklamalar, ag: false });
  // #243 KK5: çevrimdışıyken ad yalnız bizim içeriğimizden (yoksa kategori), fotoğraf yerine kategori ikonu.
  const bilinen = useBilinenMekanlar(useMemo(() => mekanlar.map((m) => m.place_id), [mekanlar]), cevrimdisi);
  const mekanIle = useMemo(() => new Map(mekanlar.map((m) => [m.id, m])), [mekanlar]);
  const adiYaDaKategori = (mekanId: string) => {
    const m = mekanIle.get(mekanId);
    return m ? mekanAdi(m, bilinen.ad) : '';
  };

  // Şehrin içeriği (bizim veri): rehber, öne çıkan yerler, önerilen gezi.
  const sehirler = useSehirler();
  const sehir = sehirEslestir(sehirler.data, { ad: seyahat.city_label, lat: seyahat.lat, lng: seyahat.lng });
  const sehirYerleri = useSehirYerleri(sehir?.id);

  const uyeListesi = useMemo(() => uyeler.data ?? [], [uyeler.data]);

  // #183 KK8 · KK9 · KK7: harcama özeti (bizim veritabanımız).
  const harcamalar = useHarcamalar(seyahat.id);
  const odesmeler = useOdesmeler(seyahat.id);
  const kisiler = useMemo(() => kisiKaynagi(uyeListesi), [uyeListesi]);
  const hOzet = useMemo(
    () => harcamaOzeti({ harcamalar: harcamalar.data ?? [], odesmeler: odesmeler.data ?? [], benId, bugun: yerelTarih(an, seyahat.tz), gununTarihi: (iso) => yerelTarih(new Date(iso), seyahat.tz) }),
    [harcamalar.data, odesmeler.data, benId, an, seyahat.tz],
  );
  const ibanlar = useIbanlar(hOzet.benimNet < 0 ? hOzet.karsilar.map((x) => x.id) : []);
  const bakiyeler = () => router.push({ pathname: '/seyahat/[id]/bakiyeler', params: { id: seyahat.id } });

  // #184 KK10: sohbet özeti — açık oylama (en yenisi) varsa o, yoksa son mesaj.
  const mesajlar = useMesajlar(seyahat.id);
  const oylamalar = useOylamalar(seyahat.id);
  const okunmamis = useOkunmamis(seyahat.id);
  // #248: kart yalnız açık oylamayı gösterir; adlar da yalnız onun için istenir (kapanmış oylamalar için Google isteği yok).
  const oylamaListesi = useMemo(() => oylamalar.data ?? [], [oylamalar.data]);
  const acikOylama = oylamaListesi.find((o) => !o.kapanis_at || Date.parse(o.kapanis_at) > an.getTime()) ?? null;
  const oylamaMesaji = acikOylama ? (mesajlar.data ?? []).find((m) => m.oylama_id === acikOylama.id && !m.silindi_at) : undefined;
  const sonMesaj = (mesajlar.data ?? []).find((m) => !m.silindi_at) ?? null;
  const sohbeteGit = () => router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/sohbet', params: { id: seyahat.id } });
  const adim = siradakiAdim({
    mod,
    gunler,
    duraklar,
    mekanlar,
    otelVar: konaklamalar.length > 0,
    otelErtelendi,
    uyeSayisi: uyeListesi.length || 1,
    bugun: yerelTarih(an, seyahat.tz),
    baslangic: seyahat.start_date,
    ilkGunCikis: saatKisa([...gunler].sort((a, b) => a.index - b.index)[0]?.start_time, saatKisa(seyahat.day_start, '09:00')),
    acikTransfer: harcamalar.data && odesmeler.data ? hOzet.transferler.length : 0,
    // #308: v7'de Plan özetinin otel satırı yok; otel adımı Sıradaki adımda görünür.
  });
  // Uye listesi gelmeden "Davet et" gösterilmez (tek kişi sanılmasın).
  const gorunenAdim = adim?.tur === 'davet' && !uyeler.data ? null : adim;

  const kartlar = useMemo(() => gunKartlari({ gunler, duraklar, mekanlar, tempolar: verisi.tempolar, ad: bilinen.ad }), [gunler, duraklar, mekanlar, verisi.tempolar, bilinen.ad]);

  // ---------------------------------------------------------------- gezi modu: bugünün kartı ve grup
  const { konum } = useKonum(mod === 'gezi' && odakta);
  const bugunDuraklari = useMemo(() => (bugunGun ? gunDuraklari(bugunGun, duraklar) : []), [bugunGun, duraklar]);
  const buradaId = useMemo(
    () => (konum ? yakinDurakId(konum, bugunDuraklari.filter((d) => !d.skipped && !d.completed_at).map((d) => ({ id: d.id, konum: konumu(mekanIle.get(d.place_ref)) }))) : null),
    [konum, bugunDuraklari, mekanIle],
  );
  const prog = useGunProgrami({ seyahat, gun: bugunGun, duraklar, mekanlar, yuruyus: verisi.yuruyus, an, buradaId: konum ? buradaId : undefined, uclar: verisi.seciliUclar });
  const bugunKartlari = useMemo(() => {
    // Ad kaynağı: DB ya da oturum önbelleği; bilinmiyorsa kartta kategori.
    const adlar: Record<string, HafifYer> = {};
    for (const m of mekanlar) {
      const ad = bilinen.ad(m);
      // Kart yalnız adı okur; koordinatı boşalmış mekanın adı da gösterilir (#318).
      if (ad) adlar[m.place_id] = { place_id: m.place_id, ad, lat: m.lat ?? NaN, lng: m.lng ?? NaN, primary_type: m.primary_type, tz: null, puan: null, puan_sayisi: null, acik: null, ulke_kodu: null };
    }
    return kartListesi({ gunDurak: bugunDuraklari, mekanIle, adlar, satirlar: prog?.canli.satirlar ?? [] }).map((k) => (k.ad === '…' ? { ...k, ad: k.kategori } : k));
  }, [mekanlar, bilinen, bugunDuraklari, mekanIle, prog]);
  const odak = odakKarti(bugunKartlari, true);
  const sonraki = odak ? sonrakiKart(bugunKartlari, odak.durakId) : null;
  const grup = useMemo(() => grupDurumlari(uyeListesi, benId, duraklar, an), [uyeListesi, benId, duraklar, an]);

  // ---------------------------------------------------------------- gezinti
  // Her istekte yeni `n`; önceki isteğin anahtarları (otel, gün, plan hazır, çip) açıkça boşaltılır (parametre birleşmesin).
  const BOS_ISTEK = { program: { gun: '', otel: '', planKuruldu: '', atanmamis: '', harita: '' }, kesfet: { cip: '', cekmece: '' } };
  const sekme = (ad: 'program' | 'kesfet', params: Record<string, string> = {}) =>
    router.navigate({ pathname: `/seyahat/[id]/(sekmeler)/${ad}`, params: { id: seyahat.id, ...BOS_ISTEK[ad], ...params, n: String(Date.now()) } });
  const plan = (params: Record<string, string> = {}) => sekme('program', params);
  const listemiAc = (segment?: 'atanmamis') => router.push({ pathname: '/seyahat/[id]/listem', params: { id: seyahat.id, ...(segment ? { segment } : {}) } });

  const planiKur = async () => {
    // Çift dokunma: dağıtım sürerken ikinci istek yok.
    if (planUygula.isPending) return;
    try {
      const sonuc = await planUygula.mutateAsync({ mekanlar, gunler, duraklar });
      plan({ planKuruldu: '1', atanmamis: String(sonuc.atanmamis.length) });
    } catch {
      setBildirim(t('geziSayfasi.kaydedilemedi'));
    }
  };
  const adimEylemi = (a: SiradakiAdim) => {
    if (a.tur === 'planKur') return a.mekanSayisi > 0 ? planiKur() : sekme('kesfet');
    if (a.tur === 'dagit') return listemiAc('atanmamis');
    if (a.tur === 'otel') return plan({ otel: '1' });
    if (a.tur === 'davet') return davet.paylas();
    if (a.tur === 'yemek') return sekme('kesfet', { cip: 'yemek' });
    if (a.tur === 'harcamaKapat') return bakiyeler();
    return plan({ gun: '1' });
  };
  const adimMetni = (a: SiradakiAdim): { baslik: string; alt: string | null; dugme: string } => {
    if (a.tur === 'planKur')
      return a.mekanSayisi > 0
        ? { baslik: t('geziSayfasi.adim.planKur'), alt: t('geziSayfasi.adim.planKurAlt', { n: a.mekanSayisi }), dugme: t('geziSayfasi.adim.planKurDugme') }
        : { baslik: t('geziSayfasi.adim.planKur'), alt: t('geziSayfasi.adim.planKurBosAlt'), dugme: t('geziSayfasi.adim.planKurDugme') };
    if (a.tur === 'dagit') {
      const adlar = a.mekanIdleri
        .map((mid) => mekanIle.get(mid))
        .map((m) => (m ? bilinen.ad(m) : null))
        .filter((x): x is string => !!x)
        .slice(0, 2);
      const alt = [adlar.join(', '), a.otelYok ? t('geziSayfasi.adim.otelDe') : ''].filter(Boolean).join(' · ');
      return { baslik: t('geziSayfasi.adim.dagit', { n: a.mekanIdleri.length }), alt: alt || null, dugme: t('geziSayfasi.adim.dagitDugme') };
    }
    if (a.tur === 'otel') return { baslik: t('geziSayfasi.otelYok'), alt: t('geziSayfasi.adim.otelAlt'), dugme: t('geziSayfasi.adim.otelDugme') };
    if (a.tur === 'davet') return { baslik: t('geziSayfasi.adim.davet'), alt: t('geziSayfasi.adim.davetAlt'), dugme: t('geziSayfasi.adim.davetDugme') };
    if (a.tur === 'yemek') return { baslik: t('geziSayfasi.adim.yemek', { gun: gunTarihi(a.gun) }), alt: t('geziSayfasi.adim.yemekAlt'), dugme: t('geziSayfasi.adim.yemekDugme') };
    if (a.tur === 'harcamaKapat') return { baslik: t('geziSayfasi.adim.harcamaKapat'), alt: t('geziSayfasi.adim.harcamaKapatAlt', { n: a.transfer }), dugme: t('geziSayfasi.adim.harcamaKapatDugme') };
    return {
      baslik: t('geziSayfasi.adim.yarin'),
      alt: a.ilkMekanId ? t('geziSayfasi.adim.yarinAlt', { ad: adiYaDaKategori(a.ilkMekanId), saat: a.cikis }) : t('geziSayfasi.adim.yarinCikis', { saat: a.cikis }),
      dugme: t('geziSayfasi.adim.yarinDugme'),
    };
  };

  const yolTarifi = (k: DurakKarti) => {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${yolTarifiHedefi(k.konum, k.ad)}&destination_place_id=${encodeURIComponent(k.placeId)}&travelmode=${k.gelis?.mod === 'taksi' ? 'driving' : 'walking'}`,
    );
  };
  const durakTasi = (k: DurakKarti, hedef: Gun) => {
    const mekan = mekanIle.get(k.mekanId);
    const mevcut = duraklar.find((d) => d.id === k.durakId);
    if (!mekan || !mevcut) return;
    ata.mutate({ mekan, gunId: hedef.id, mevcut, gunDuraklari: duraklar.filter((d) => d.day_id === hedef.id) }, { onError: () => setBildirim(t('geziSayfasi.kaydedilemedi')) });
  };

  const benUye = uyeListesi.find((u) => u.user_id === benId);
  const metin = gorunenAdim ? adimMetni(gorunenAdim) : null;

  // ---------------------------------------------------------------- #308 v7: hal, üst harita, başlık, kişiler, sohbet ipucu
  const bugunAktif = useMemo(() => bugunDuraklari.filter((d) => !d.skipped), [bugunDuraklari]);
  const hal: UstHaritaHali = mod !== 'gezi' ? 'plan' : bugunAktif.length === 0 ? 'bos' : 'gezi';
  const merkezNokta = konum ?? verisi.otel ?? konumu(seyahat);
  const bosOneriler = useMemo(
    () => (hal === 'bos' ? bosGunOnerileri(sehirYerleri.data ?? [], mekanlar, merkezNokta) : []),
    [hal, sehirYerleri.data, mekanlar, merkezNokta],
  );
  const bugunCizgileri = useMemo(
    () =>
      hal === 'gezi' && bugunGun
        ? programCizgileri({ gunler, tempolar: verisi.tempolar, seciliGunId: bugunGun.id, seciliNoktalar: verisi.seciliNoktalar, rotalar: verisi.rotalar, bacak: verisi.bacak, gecilenBacak: 0 })
        : [],
    [hal, bugunGun, gunler, verisi.tempolar, verisi.seciliNoktalar, verisi.rotalar, verisi.bacak],
  );
  const ustHarita = useMemo(
    () =>
      ustHaritaVerisi({
        hal,
        gunler,
        duraklar,
        mekanlar,
        bugunGunId: bugunGun?.id ?? null,
        konum,
        otel: verisi.otel,
        oneriler: bosOneriler.map((y) => ({ id: y.place_id, konum: { lat: y.lat, lng: y.lng } })),
        bugunCizgileri,
      }),
    [hal, gunler, duraklar, mekanlar, bugunGun, konum, verisi.otel, bosOneriler, bugunCizgileri],
  );
  const haritaMerkezi = ustHarita.pinler[0]?.konum ?? konumu(seyahat) ?? { lat: 39.0, lng: 35.0 };
  const gezilen = bugunAktif.filter((d) => !!d.completed_at).length;
  const altSatir = baslikAltSatiri({ seyahat, mod, an, bugunIndex: mod === 'gezi' ? bugunIndex : null, bugunTarih: bugunGun?.date ?? null, gezilen, toplam: bugunAktif.length });

  // KK3: gezi modunda bugünün en son varılan durağına varmış kişiler (grup konum verisi; yeni veri yok).
  const varis = (() => {
    if (mod !== 'gezi') return null;
    const sira = new Map(bugunAktif.map((d, i) => [d.place_ref, i]));
    const varanlar = new Map<string, string>();
    for (const g of grup) if (g.varis && sira.has(g.varis.mekanId)) varanlar.set(g.uye.user_id, g.varis.mekanId);
    const benimDurak = buradaId ? bugunAktif.find((d) => d.id === buradaId) : undefined;
    if (benId && benimDurak) varanlar.set(benId, benimDurak.place_ref);
    if (varanlar.size === 0) return null;
    const son = [...varanlar.values()].sort((x, y) => (sira.get(y) ?? 0) - (sira.get(x) ?? 0))[0];
    const kimler = new Set([...varanlar].filter(([, m]) => m === son).map(([u]) => u));
    return { mekanId: son, kimler };
  })();
  const kisiYuzleri: KisiYuzu[] = (() => {
    const sirali = [...uyeListesi].sort((x, y) => Number(y.user_id === benId) - Number(x.user_id === benId));
    const liste = sirali.length > 0 ? sirali : benUye ? [benUye] : [];
    return liste.map((u) => ({ id: u.user_id, ad: u.display_name, foto: u.photo_url ?? null, vardi: !!varis?.kimler.has(u.user_id) }));
  })();
  const varanMetni = varis
    ? varanlarMetni({ varanlar: uyeListesi.filter((u) => varis.kimler.has(u.user_id)), benId, yerAdi: adiYaDaKategori(varis.mekanId) || null })
    : null;
  const kisilerSag = varanMetni ?? kisiAdlari(uyeListesi, benId);

  // KK4: sohbet ipucu yalnız grupta; açık oylama ya da okunmamış son mesaj, ikisi de yoksa satır yok.
  const adBul = (uid: string | null) => uyeListesi.find((u) => u.user_id === uid)?.display_name ?? null;
  const ipucu =
    uyeListesi.length > 1
      ? acikOylama && oylamaMesaji
        ? { kim: adBul(acikOylama.olusturan), metin: t('seyahatV7.oylamaActi', { soru: acikOylama.soru }) }
        : (okunmamis.data ?? 0) > 0 && sonMesaj
          ? { kim: adBul(sonMesaj.user_id), metin: sonMesaj.metin.trim() || t('seyahatV7.yeniMesaj') }
          : null
      : null;

  // KK5 gövdeleri.
  const gunSatirlari: GunSatiriV7[] = kartlar.map((k) => ({ id: String(k.gun.index), renk: k.renk, ...gunSatiri(k) }));
  const atananlar = useMemo(() => new Set(duraklar.map((d) => d.place_ref)), [duraklar]);
  const gunsuz = mekanlar.filter((m) => !atananlar.has(m.id)).length;
  const simdiAlt = (() => {
    if (!odak) return null;
    const parca: string[] = [];
    if (odak.varisDk !== null) parca.push(t('seyahatV7.oradaOl', { saat: saatEkli(dakikaSaat(odak.varisDk), 'bulunma') }));
    if (sonraki) parca.push(t('seyahatV7.sonra', { saat: sonraki.varisDk !== null ? dakikaSaat(sonraki.varisDk) : '', ad: sonraki.ad }).replace('  ', ' '));
    return parca.length > 0 ? parca.join(' · ') : null;
  })();
  const simdiDk = (() => {
    if (!konum || !odak?.konum) return odak?.gelis?.dk ?? null;
    const sn = odak.gelis?.mod === 'taksi' ? kestirimTaksiSn(konum, odak.konum) : kestirimYuruyusSn(konum, odak.konum);
    return Math.max(1, Math.ceil(sn / 60));
  })();
  const planSatirlari: PlanSatiriV7[] = bugunKartlari
    .filter((k) => k.numara !== null)
    .map((k) => ({
      id: k.durakId,
      ad: k.ad,
      gezildi: k.tamamlandi,
      sira: k.numara,
      renk: gunRengi(bugunGun?.index ?? 1),
      alt: k.tamamlandi
        ? k.varisDk !== null
          ? t('seyahatV7.gezildi', { saat: dakikaSaat(k.varisDk) })
          : t('seyahatV7.gezildiSaatsiz')
        : [k.varisDk !== null ? dakikaSaat(k.varisDk) : null, sureMetni(k.dakika)].filter(Boolean).join(' · '),
    }));
  const bugunEkle = useBugunEkle(seyahat.id);
  const bugunaEkle = (placeId: string) => {
    const yer = bosOneriler.find((y) => y.place_id === placeId);
    if (!yer || !bugunGun) return;
    setEklenenler((e) => new Set(e).add(placeId));
    bugunEkle.mutate(
      { yer, gunId: bugunGun.id, gunDuraklari: bugunDuraklari },
      {
        onError: () => {
          setEklenenler((e) => {
            const y = new Set(e);
            y.delete(placeId);
            return y;
          });
          setBildirim(t('geziSayfasi.kaydedilemedi'));
        },
      },
    );
  };

  return (
    <View style={s.ekran}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <UstHarita
          merkez={haritaMerkezi}
          pinler={ustHarita.pinler}
          cizgiler={ustHarita.cizgiler}
          onHarita={() => plan(hal === 'plan' ? { harita: '1' } : { gun: String(bugunGun?.index ?? 1), harita: '1' })}
          onGeri={() => kesfeteDon(kokGezinme.getRootState() as Parameters<typeof kesfeteDon>[0])}
          onPaylas={hesapli ? () => setPaylasimAcik(true) : undefined}
          onMenu={() => setMenuAcik(true)}
        />
        {cevrimdisi ? (
          <View style={s.serit}>
            <CevrimdisiSeridi guncellendi={guncellendi} tz={seyahat.tz} an={an} />
          </View>
        ) : null}
        <Baslik ad={seyahatAdi(seyahat)} alt={altSatir} />
        <KisilerSatiri kisiler={kisiYuzleri} sag={kisilerSag} sagYesil={!!varanMetni} onCagir={davet.paylas} onYuzler={() => setGrupAcik(true)} pasif={cevrimdisi} />
        {ipucu ? <SohbetIpucu kim={ipucu.kim} metin={ipucu.metin} onPress={sohbeteGit} /> : null}
        {hatirlatmaVakti(seyahat, an) && mod !== 'plan' ? (
          <View style={s.serit}>
            <HatirlatmaSatiri ozet={hOzet} k={kisiler} ibanlar={ibanlar.data} onBakiyeler={bakiyeler} />
          </View>
        ) : null}

        {hal === 'gezi' ? (
          <>
            {odak && odak.durum === 'siradaki' ? <SimdiV7 etiket={simdiEtiketi(simdiDk, odak.gelis?.mod === 'taksi')} ad={odak.ad} alt={simdiAlt} onYolTarifi={() => yolTarifi(odak)} /> : null}
            <View style={s.bolum}>
              <BolumBasligi baslik={t('seyahatV7.bugununPlani')} baglanti={t('seyahatV7.planiAc')} onBaglanti={() => plan({ gun: String(bugunGun?.index ?? 1) })} />
              <BugununPlaniV7 satirlar={planSatirlari} />
            </View>
          </>
        ) : hal === 'bos' ? (
          <View style={s.bolum}>
            <BolumBasligi baslik={t('seyahatV7.bugunBos')} baglanti={sehir ? t('seyahatV7.rehber') : undefined} onBaglanti={() => router.push({ pathname: '/seyahat/[id]/rehber', params: { id: seyahat.id } })} />
            <BugunBosV7
              yerler={bosOneriler.map((y) => ({ id: y.place_id, ad: y.ad, foto: null, alt: [kategoriEtiketi(y.kategori), y.mesafeM !== null ? mesafeMetni(Math.round(y.mesafeM / 10) * 10) : null].filter(Boolean).join(' · ') }))}
              eklenenler={eklenenler}
              onEkle={bugunaEkle}
              pasif={cevrimdisi}
            />
          </View>
        ) : (
          <>
            {gorunenAdim && metin ? (
              <SiradakiAdimV7 baslik={metin.baslik} dugme={metin.dugme} mesgul={gorunenAdim.tur === 'planKur' && planUygula.isPending} onPress={() => void adimEylemi(gorunenAdim)} pasif={cevrimdisi} />
            ) : null}
            <View style={s.bolum}>
              <BolumBasligi baslik={t('seyahatV7.gunler')} baglanti={t('seyahatV7.planiAc')} onBaglanti={() => plan()} />
              <GunlerV7 satirlar={gunSatirlari} onGun={(gun) => plan({ gun })} />
              <ListemSatiriV7 alt={gunsuz > 0 ? t('seyahatV7.listemGunsuz', { n: gunsuz }) : null} onPress={() => listemiAc()} />
            </View>
          </>
        )}
      </ScrollView>

      {bildirim ? (
        <View style={s.bildirim} pointerEvents="none">
          <Text style={s.bildirimMetin}>{bildirim}</Text>
        </View>
      ) : null}

      <GeziMenusu
        acik={menuAcik}
        onKapat={() => setMenuAcik(false)}
        seyahat={seyahat}
        gunler={gunler}
        duraklar={duraklar}
        sahip={benUye?.role === 'owner'}
        uyeSayisi={uyeListesi.length}
        onHata={setBildirim}
        onPaylas={hesapli ? () => setPaylasimAcik(true) : undefined}
      />
      {hesapli ? (
        <PaylasimCekmecesi
          acik={paylasimAcik}
          onKapat={() => setPaylasimAcik(false)}
          seyahat={seyahat}
          benimAdim={benUye?.display_name ?? null}
          gunSayisi={gunler.length}
          durakSayisi={duraklar.length}
          kisiSayisi={uyeListesi.length || 1}
          onArkadasEkle={() => setGrupAcik(true)}
          cevrimdisi={cevrimdisi}
        />
      ) : null}
      <SecimMenusu
        acik={!!durakMenu}
        baslik={durakMenu?.ad}
        onKapat={() => setDurakMenu(null)}
        secenekler={
          durakMenu
            ? [
                { etiket: t('geziSayfasi.atla'), onPress: () => durakGuncelle.mutate({ id: durakMenu.durakId, skipped: true }, { onError: () => setBildirim(t('geziSayfasi.kaydedilemedi')) }) },
                { etiket: t('geziSayfasi.baskaGune'), onPress: () => setGunSecDurak(durakMenu), pasif: gunler.length < 2 },
              ]
            : []
        }
      />
      <SecimMenusu
        acik={!!gunSecDurak}
        baslik={t('geziSayfasi.hangiGune')}
        onKapat={() => setGunSecDurak(null)}
        secenekler={
          gunSecDurak
            ? gunler
                .filter((g) => g.id !== bugunGun?.id)
                .sort((a, b) => a.index - b.index)
                .map((g) => ({ etiket: `${t('geziSayfasi.gunNo', { n: g.index })} · ${gunTarihi(g)}`, onPress: () => durakTasi(gunSecDurak, g) }))
            : []
        }
      />
      <GrupPenceresi acik={grupAcik} onKapat={() => setGrupAcik(false)} seyahat={seyahat} uyeler={uyeListesi} mekanlar={mekanlar} />
      <ProfilOnayi acik={davet.onayAcik} onKapat={davet.onayKapat} onGonder={davet.onayla} />
      <KatilimSayfasi
        acik={karsilamaAcik && !!uyeler.data}
        seyahat={seyahat}
        uyeler={uyeListesi}
        gunSayisi={gunler.length}
        mekanSayisi={mekanlar.length}
        onProgram={() => {
          setKarsilamaAcik(false);
          plan();
        }}
        onMekanEkle={() => {
          setKarsilamaAcik(false);
          sekme('kesfet');
        }}
      />
      <HarcamaFormu acik={harcamaFormu} onKapat={() => setHarcamaFormu(false)} seyahat={seyahat} uyeler={uyeListesi} onBildirim={setBildirim} />
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  serit: { paddingTop: 12, paddingHorizontal: 16 },
  bolum: { paddingHorizontal: 16 },
  bildirim: { position: 'absolute', left: 20, right: 20, bottom: 16, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: renk.metin },
  bildirimMetin: { fontFamily: yazi.yari, fontSize: 14, color: renk.zemin, textAlign: 'center' },
});
