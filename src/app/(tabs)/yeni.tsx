import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, StyleSheet, Text, View } from 'react-native';

import { KimlerleSatiri } from '@/components/geziKur/BunuSecCekmecesi';
import { GeziKurEkrani, type KendiRotaGirisi } from '@/components/geziKur/GeziKurEkrani';
import { MekanPaneli } from '@/components/mekan/MekanPaneli';
import { AdimIlOnerileri } from '@/components/sihirbaz/AdimIlOnerileri';
import { AdimKabugu } from '@/components/sihirbaz/AdimKabugu';
import { AdimNereye } from '@/components/sihirbaz/AdimNereye';
import { AdimNeZaman } from '@/components/sihirbaz/AdimNeZaman';
import { AdimOnerilenler } from '@/components/sihirbaz/AdimOnerilenler';
import { PlanCubugu } from '@/components/sihirbaz/PlanCubugu';
import { SehirDegisimSayfasi } from '@/components/sihirbaz/SehirDegisimSayfasi';
import { Buton } from '@/components/ui/Buton';
import { useDavetGonder } from '@/features/davet/uygulamaIci';
import { useKimlerle } from '@/features/geziKur/kimlerle';
import { useDuraklar, useGunler } from '@/features/gunler/sorgular';
import { ilSlugu, useIlYerleri } from '@/features/icerik/ilOnerileri';
import { icerikPlaceId, olayYaz, sehirEslestir, useSehirler, useYerlerIle } from '@/features/icerik/sorgular';
import { useYerleriEkle } from '@/features/icerik/yerEkle';
import { useMekanEkle, useMekanGuncelle, useMekanlar, useMekanSil } from '@/features/mekanlar/sorgular';
import { useProfil, useProfilGuncelle } from '@/features/profil/sorgular';
import { useSeyahat, useSeyahatAdiKaydet, useSeyahatOlustur } from '@/features/seyahatler/sorgular';
import { seyahatiKopyala, useIcerikSehirSecimi, useTekrarKaynagi, yeniGirisNo } from '@/features/sihirbaz/girisler';
import type { OnerilenMekan } from '@/features/sihirbaz/onerilenler';
import { gunDolulugu, secimOzeti } from '@/features/sihirbaz/planKur';
import { planiHesapla, usePlaniUygula } from '@/features/sihirbaz/planUygula';
import { oncekiAdim, seyahatAdiOner, sonrakiAdim, type Adim, type Aralik } from '@/features/sihirbaz/sihirbaz';
import { gunSayisiSinirla, sehirDegisti, tarihDegisti, tarihSecimi, tarihsizGunleriKur, TARIHSIZ_VARSAYILAN, useTaslakSehri, useTaslakTarihi } from '@/features/sihirbaz/taslak';
import type { HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import type { SehirSecimi } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

/** Ekranın giriş parametreleri. */
type YeniGirisi = {
  tekrar?: string;
  sehir?: string;
  yerler?: string;
  n?: string;
  metin?: string;
  /** #578 Profil v12: ilin plakası (bilgi; şehir `sehir` ya da `metin` ile gelir). */
  il?: string;
  /** #578 Profil v12 → #574 KK-ek1: yol arkadaşı olarak seçili gelecek kişi. */
  arkadas?: string;
  /** #574: "Kendi rotanı kur" sihirbazı şehir dolu, 2. adımdan açar. */
  adim?: string;
};

/**
 * #574 Gezi oluşturma v11 (KK1): "Yeni gezi oluştur" (ana sayfa), Gezilerim'deki "+" ve ana sayfa aramasından şehirle gelen
 * giriş "Nasıl bir gezi?" ekranını açar (`GeziKurEkrani`; şehir kutusu dolu, `arkadas` yol arkadaşı seçili). Eski sihirbazın
 * girişi kalmadı: "Kendi rotanı kur" onu rehberli şehir seçiliyse şehir dolu, 2. adımdan; değilse yazılan metin Nereye'de aranmış
 * açar; 1. adımda geri bu ekrana döner. Ana sayfa metin araması (`metin`) da bu ekranı kutu dolu açar. Sihirbaza doğrudan giden
 * girişler: `tekrar` (Tekrar kur), `sehir` + `yerler` (Kaydettiklerim) ve Profil'in rehberli olmayan ili (`metin` + `il`, KK-ek2:
 * Nereye'de aranmış; `arkadas` sihirbazda da yol arkadaşı seçili gelir, KK-ek1).
 */
export default function YeniEkrani() {
  const giris = useLocalSearchParams<YeniGirisi>();
  const anahtar = [giris.tekrar, giris.sehir, giris.yerler, giris.metin, giris.il, giris.arkadas, giris.n].map((x) => x ?? '').join('|');
  const [uygulanan, setUygulanan] = useState(anahtar);
  const [kendi, setKendi] = useState<YeniGirisi | null>(null);
  // Yeni parametreyle gelindiyse (sekme açık kalır) "Kendi rotanı kur"dan açılan sihirbaz kapanır.
  if (uygulanan !== anahtar) {
    setUygulanan(anahtar);
    setKendi(null);
  }
  // KK-ek2: Profil'den rehberli olmayan il (`metin` + `il`) Nereye'de aranmış gelir; ana sayfa metin araması (`il` yok) KK1 gereği
  // "Nasıl bir gezi?"yi kutu dolu açar.
  if (giris.tekrar || giris.yerler || (giris.metin && giris.il)) return <Sihirbaz giris={giris} />;
  const kendiRota = (g: KendiRotaGirisi, arkadas?: string) => {
    const ek = arkadas ? { arkadas } : {};
    setKendi(g === null ? ek : 'sehirId' in g ? { sehir: g.sehirId, adim: 'nezaman', n: yeniGirisNo(), ...ek } : { metin: g.metin, n: yeniGirisNo(), ...ek });
  };
  // Sihirbaz açıkken "Nasıl bir gezi?" gizli ama kurulu kalır: 1. adımdan geri dönünce yazılan şehir ve süzgeçler yerinde.
  return (
    <>
      <View style={{ flex: 1, display: kendi ? 'none' : 'flex' }}>
        <GeziKurEkrani key={anahtar} sehirId={giris.sehir} ilkMetin={giris.metin} arkadas={giris.arkadas} onKendiRota={kendiRota} />
      </View>
      {kendi ? <Sihirbaz giris={kendi} onCik={() => setKendi(null)} /> : null}
    </>
  );
}

/**
 * #98 → #139 (kanvas 4 · 5 · 7 · 8): seyahat kurma sihirbazı — 3 adım: Nereye → Ne zaman → Neleri görmek istersin, sonra
 * "Planı kur" (seçilenler yakınlığa göre günlere dağıtılır) ve Program'da "Planın hazır". Otel Program'a, davet Plan hazır'a
 * taşındı. Şehir + ad + tarih yerelde tutulur; 2. adımdan çıkınca (Devam) seyahat taslak olarak oluşturulur.
 * #581 KK3: şehir ve tarih kilitli değil; geri dönüp değiştirince Devam aynı taslağı günceller (`taslak.ts`). KK2: "Tarihim
 * belli değil" → "Kaç gün?" sayacı (varsayılan 2). KK4: Android geri tuşu bir önceki adıma döner. KK5: 3. adımda veri hatası
 * → "Tekrar dene". Hedef: 3 dakikada saatlik rota (olay `plan_kuruldu`).
 * #144 girişleri: `tekrar` (geçmiş seyahat → aynı şehir ve ad, 2. adımdan; seyahat oluşunca plan kopyalanır, Program açılır),
 * `sehir` + `yerler` (Kaydettiklerim → rehberli şehir seçili; seyahat oluşunca kaydedilen yerler listeye).
 */
export function Sihirbaz({ giris, onCik }: { giris: YeniGirisi; /** #574: 1. adımda geri "Nasıl bir gezi?"ye döner. */ onCik?: () => void }) {
  const [adim, setAdim] = useState<Adim>('nereye');
  const [sehir, setSehir] = useState<SehirSecimi | null>(null);
  const [ad, setAd] = useState<string | null>(null);
  const [aralik, setAralik] = useState<Aralik>(null);
  // #581 KK2: "Tarihim belli değil" seçildiyse gün sayısı (null → tarihli).
  const [tarihsizGun, setTarihsizGun] = useState<number | null>(null);
  // #581 KK3b: şehir değişimi onayı bekleyen yer sayısı.
  const [sehirOnayi, setSehirOnayi] = useState<number | null>(null);
  // #581: seyahat kurulurken (oluştur + gün sayısı) Devam pasif kalır; çift dokunuş ikinci seyahat açmasın.
  const [kuruluyor, setKuruluyor] = useState(false);
  const kuruluyorRef = useRef(false);
  const [tripId, setTripId] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!tripId) baslangicAni.current = Date.now();
    }, [tripId]),
  );
  const [hata, setHata] = useState<string | null>(null);
  // #574 KK6 · KK-ek1: "Kimlerle?" — çekmeceyle aynı yol: son gezilen arkadaşlar (en çok 3), Profil'den (`arkadas`) ya da
  // "Nasıl bir gezi?"den gelen kişi seçili; seyahat oluşunca seçilenlere #573 uygulama içi daveti gider.
  const kimlerle = useKimlerle(giris.arkadas);
  const davetGonder = useDavetGonder();
  // KK8: sihirbaz başlangıcı → plan yazılana kadar süre (ölçüm: < 3 dk). Seyahat henüz kurulmadıysa ekran her odağa
  // geldiğinde sıfırlanır (sekmeden çıkıp dönünce süre uzun ölçülmesin).
  const baslangicAni = useRef(0);

  const sehirler = useSehirler();
  // #144: dışarıdan giriş parametreleri bir kez uygulanır (sekme ekranı açık kalır; aynı parametreyle tekrar uygulanmaz).
  const tekrarKaynagi = useTekrarKaynagi(giris.tekrar);
  const girisSehri = useIcerikSehirSecimi(giris.tekrar ? undefined : sehirler.data?.find((k) => k.id === giris.sehir));
  const girisYerIdleri = useMemo(() => (giris.tekrar ? [] : (giris.yerler?.split(',').filter(Boolean) ?? [])), [giris.tekrar, giris.yerler]);
  const girisYerleri = useYerlerIle(girisYerIdleri);
  const yerleriEkle = useYerleriEkle();
  // `n`: her dokunuşta yeni (aynı seyahat için ikinci "Tekrar kur" da uygulanır).
  // #361 KK5: ana aramadan "“{metin}” için seyahat kur" → sihirbaz Nereye adımında arama kutusu o metinle dolu açılır.
  const girisAnahtari = giris.tekrar
    ? `tekrar:${giris.tekrar}:${giris.n ?? ''}`
    : giris.sehir
      ? `sehir:${giris.sehir}:${giris.yerler ?? ''}:${giris.adim ?? ''}:${giris.n ?? ''}`
      : giris.metin
        ? `metin:${giris.metin}:${giris.n ?? ''}`
        : null;
  const [ilkSorgu, setIlkSorgu] = useState<{ metin: string; anahtar: string } | null>(null);
  const [uygulananGiris, setUygulananGiris] = useState<string | null>(null);
  /** Uygulanan giriş: kopyalanacak seyahat ya da listeye eklenecek kaydedilen yerler (yalnız şehir değişmediyse). */
  const [girisPlani, setGirisPlani] = useState<{ tur: 'tekrar'; kaynak: string; sehirId: string } | { tur: 'yerler'; sehirId: string } | null>(null);
  const olustur = useSeyahatOlustur();
  const adKaydet = useSeyahatAdiKaydet(tripId ?? '');
  const seyahat = useSeyahat(tripId ?? undefined);
  const gunler = useGunler(tripId ?? undefined);
  const duraklar = useDuraklar(tripId ?? undefined);
  const mekanlar = useMekanlar(tripId ?? undefined);
  const planUygula = usePlaniUygula(tripId ?? '');
  // #121 KK3: 5. adımda karta dokunma → mekan paneli (#80); "Listeye ekle / Listeden çıkar" panelden de olur.
  const [panel, setPanel] = useState<OnerilenMekan | null>(null);
  const [tutulan, setTutulan] = useState<Set<string>>(() => new Set());
  const [sureAyari, setSureAyari] = useState<Record<string, number>>({});
  const ekle = useMekanEkle(tripId ?? '');
  const sil = useMekanSil(tripId ?? '');
  const guncelle = useMekanGuncelle(tripId ?? '');

  // 0.3 yönlendirme ekranı kalktı (#98): ilk açılış sihirbaza gelir, damga burada yazılır (bir daha yönlendirilmez).
  const profil = useProfil();
  const profilGuncelle = useProfilGuncelle();
  useEffect(() => {
    if (profil.data && !profil.data.onboarding_done_at && !profilGuncelle.isPending) {
      profilGuncelle.mutate({ onboarding_done_at: new Date().toISOString() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil.data?.onboarding_done_at]);

  if (girisAnahtari && girisAnahtari !== uygulananGiris) {
    const hazir = giris.tekrar ? tekrarKaynagi.data : giris.sehir ? girisSehri.data : giris.metin;
    if (hazir) {
      setUygulananGiris(girisAnahtari);
      setTripId(null);
      setAralik(null);
      setTarihsizGun(null);
      setHata(null);
      setTutulan(new Set());
      kimlerle.sifirla(giris.arkadas);
      if (tekrarKaynagi.data && giris.tekrar) {
        setSehir(tekrarKaynagi.data.sehir);
        setAd(tekrarKaynagi.data.ad);
        setGirisPlani({ tur: 'tekrar', kaynak: tekrarKaynagi.data.id, sehirId: tekrarKaynagi.data.sehir.place_id });
        setAdim('nezaman');
      } else if (giris.sehir && girisSehri.data) {
        setSehir(girisSehri.data);
        setAd(null);
        setGirisPlani({ tur: 'yerler', sehirId: girisSehri.data.place_id });
        // #574 KK1: "Kendi rotanı kur" şehir dolu, 2. adımdan açar.
        setAdim(giris.adim === 'nezaman' ? 'nezaman' : 'nereye');
      } else if (giris.metin) {
        setSehir(null);
        setAd(null);
        setGirisPlani(null);
        setIlkSorgu({ metin: giris.metin, anahtar: girisAnahtari });
        setAdim('nereye');
      }
    }
  }

  const onerilenAd = seyahatAdiOner(sehir ? [sehir.ad] : []);
  const rehberSehir = sehirEslestir(sehirler.data, sehir);
  // #401 KK5: ilin yayında listesi varsa 3. adım ondan dolar (seyahat açılınca önceden istenir; 2. adımda hazır olur).
  const ilYerleri = useIlYerleri(tripId ? ilSlugu(rehberSehir, sehir?.ad ?? seyahat.data?.city_label) : null);
  const taslakSehri = useTaslakSehri();
  const taslakTarihi = useTaslakTarihi();
  // Taslağın kayıtlı şehri (KK3b: Vazgeç'te şehir buna döner).
  const kayitliSehir: SehirSecimi | null =
    seyahat.data?.city_place_id && seyahat.data.lat != null && seyahat.data.lng != null
      ? {
          place_id: seyahat.data.city_place_id,
          ad: seyahat.data.city_label,
          ikincil: '',
          lat: seyahat.data.lat,
          lng: seyahat.data.lng,
          tz: seyahat.data.tz,
          country_code: seyahat.data.country_code,
        }
      : null;

  const kayitSuruyor = kuruluyor || taslakTarihi.isPending || taslakSehri.isPending || adKaydet.isPending || planUygula.isPending;

  // #581 KK4: Android geri tuşu sihirbazda bir önceki adıma döner (1. adımda sistem davranışı).
  useFocusEffect(
    useCallback(() => {
      const abonelik = BackHandler.addEventListener('hardwareBackPress', () => {
        if (sehirOnayi !== null) {
          // Vazgeç ile aynı: şehir taslağın kayıtlı şehrine döner.
          setSehirOnayi(null);
          if (kayitliSehir) setSehir(kayitliSehir);
          return true;
        }
        // Kayıt sürerken geri yutulur: iş bitince kapanıştaki ileri() kişiyi yine öne atardı.
        if (kayitSuruyor) return true;
        if (panel) {
          setPanel(null);
          return true;
        }
        const o = oncekiAdim(adim);
        if (!o) {
          if (!onCik) return false;
          onCik();
          return true;
        }
        setHata(null);
        setAdim(o);
        return true;
      });
      return () => abonelik.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adim, panel, sehirOnayi, kayitSuruyor, seyahat.data, onCik]),
  );

  const geri = () => {
    if (kayitSuruyor) return;
    setHata(null);
    const o = oncekiAdim(adim);
    if (o) setAdim(o);
    else if (onCik) onCik();
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };
  const ileri = () => {
    setHata(null);
    const n = sonrakiAdim(adim);
    if (n) setAdim(n);
  };

  // #581 KK3a–KK3b: taslağın şehri değişti → (yer seçildiyse onaydan sonra) aynı taslak güncellenir, yerler listeden çıkar.
  const sehriKaydet = async () => {
    if (!sehir || !tripId) return;
    setSehirOnayi(null);
    setHata(null);
    try {
      await taslakSehri.mutateAsync({ seyahatId: tripId, sehir, ad: ad ?? onerilenAd, yerleriCikar: true });
      setTutulan(new Set());
      setPanel(null);
      ileri();
    } catch {
      setHata(t('sihirbaz.nereye.sehirHata'));
    }
  };
  const sehirVazgec = () => {
    setSehirOnayi(null);
    if (kayitliSehir) setSehir(kayitliSehir);
  };

  // 1 → 2: ad değiştiyse ve seyahat varsa kaydet.
  const nereyeDevam = async () => {
    if (!sehir) return;
    if (tripId) {
      // Taslağın bilgileri gelmeden şehir değişikliği karşılaştırılamaz; sessizce atlanmasın.
      if (!seyahat.data || !mekanlar.data) {
        setHata(t('sihirbaz.nereye.veriBekleniyor'));
        if (seyahat.isError) void seyahat.refetch();
        if (mekanlar.isError) void mekanlar.refetch();
        return;
      }
      if (sehirDegisti(kayitliSehir, sehir)) {
        // Liste boşsa onay sorulmaz; silme yine koşulsuz (yarışta gelen eski şehir yeri kalmasın).
        if (mekanlar.data.length > 0) setSehirOnayi(mekanlar.data.length);
        else await sehriKaydet();
        return;
      }
    }
    if (tripId && seyahat.data && (ad ?? onerilenAd) !== (seyahat.data.name ?? onerilenAd)) {
      try {
        await adKaydet.mutateAsync(ad ?? onerilenAd);
      } catch {
        setHata(t('sihirbaz.nezaman.hata'));
        return;
      }
    }
    ileri();
  };
  // #144 Tekrar kur: aynı plan yeni tarihe kopyalanır, Program açılır. Düşerse hata yukarı gider; taslak ve giriş korunur.
  const tekrarKopyala = async (kaynak: string, id: string) => {
    const n = await seyahatiKopyala(kaynak, id);
    setGirisPlani(null);
    olayYaz('sihirbaz_bitti', id, { tekrar: kaynak, durak: n });
    router.replace({ pathname: '/seyahat/[id]/(sekmeler)/program', params: { id } });
    // Sekme açık kalır: bir sonraki "+" baştan başlasın.
    setAdim('nereye');
    setSehir(null);
    setAd(null);
    setAralik(null);
    setTarihsizGun(null);
    setTripId(null);
  };
  // 2 → 3: seyahat oluşturulur (tarihli ya da tarihsiz N gün). #581 KK3a: taslak varsa yenisi açılmaz, tarihi güncellenir.
  const seyahatiKur = async () => {
    const secim = tarihSecimi(aralik, tarihsizGun);
    if (!sehir || !secim || kuruluyorRef.current) return;
    setHata(null);
    if (tripId) {
      if (!seyahat.data || !gunler.data) {
        setHata(t('sihirbaz.nereye.veriBekleniyor'));
        if (seyahat.isError) void seyahat.refetch();
        if (gunler.isError) void gunler.refetch();
        return;
      }
      // Kilit dalın başında: aynı karede ikinci Devam tarihi ya da kopyayı iki kez çalıştırmasın.
      kuruluyorRef.current = true;
      setKuruluyor(true);
      try {
        const mevcut = { start_date: seyahat.data.start_date, end_date: seyahat.data.end_date, gunSayisi: gunler.data.length };
        if (tarihDegisti(mevcut, secim)) {
          try {
            await taslakTarihi.mutateAsync({ seyahatId: tripId, secim });
          } catch {
            setHata(t('sihirbaz.nezaman.tarihHata'));
            return;
          }
        }
        // #581: "Tekrar kur"da kopya düştüyse yeniden deneme kopyayı tekrar çalıştırır (boş taslakla 3. adıma düşülmez).
        if (girisPlani?.tur === 'tekrar' && girisPlani.sehirId === sehir.place_id) {
          try {
            await tekrarKopyala(girisPlani.kaynak, tripId);
          } catch {
            setHata(t('sihirbaz.nezaman.hata'));
          }
          return;
        }
      } finally {
        kuruluyorRef.current = false;
        setKuruluyor(false);
      }
      return ileri();
    }
    kuruluyorRef.current = true;
    setKuruluyor(true);
    try {
      const id = await olustur.mutateAsync({
        sehir,
        name: ad ?? onerilenAd,
        start_date: secim.tur === 'tarihli' ? secim.gidis : null,
        end_date: secim.tur === 'tarihli' ? secim.donus : null,
      });
      // Seyahat oluştu: sonraki adımlardan biri düşse de yeniden deneme aynı taslağı günceller (kopya seyahat açılmaz).
      setTripId(id);
      // KK6: seçilenlere uygulama içi davet; düşerse seyahat yine kurulur, genel hata söylenir (sihirbaz sürer).
      const davetliler = kimlerle.secilenler.map((k) => k.id);
      if (davetliler.length > 0) davetGonder.mutateAsync({ tripId: id, kisiler: davetliler }).catch(() => Alert.alert(t('genel.hataBaslik'), t('genel.hataMetin')));
      // KK2: tetikleyici tarihsiz seyahate 1 gün açar; sayaçtaki gün sayısına tamamlanır.
      if (secim.tur === 'tarihsiz' && secim.gun > 1) await tarihsizGunleriKur(id, secim.gun);
      // #144 Tekrar kur: aynı plan yeni tarihe; plan hazır olduğundan öneriler atlanır, Program açılır.
      if (girisPlani?.tur === 'tekrar' && girisPlani.sehirId === sehir.place_id) {
        await tekrarKopyala(girisPlani.kaynak, id);
        return;
      }
      // #144 Bu şehre seyahat kur: kaydedilen yerler listeye (3. adımda listede görünür).
      if (girisPlani?.tur === 'yerler' && girisPlani.sehirId === sehir.place_id && girisYerleri.data?.length) {
        const satirlar = await Promise.all(
          girisYerleri.data.map(async (y) => ({ yerId: y.id, place_id: await icerikPlaceId(y, y.sehirler?.ad ?? sehir.ad), primary_type: y.kategori, lat: y.lat, lng: y.lng })),
        );
        await yerleriEkle.mutateAsync({ seyahatId: id, yerler: satirlar }).catch(() => undefined);
        setTutulan(new Set(satirlar.map((x) => x.place_id).filter((x): x is string => !!x)));
      }
      setGirisPlani(null);
      setAdim('onerilenler');
    } catch {
      setHata(t('sihirbaz.nezaman.hata'));
    } finally {
      kuruluyorRef.current = false;
      setKuruluyor(false);
    }
  };
  // Mekan seçmeden geçiş: Keşfet (sihirbaz bitti, plan yok).
  const haritayaGec = () => {
    if (!tripId) return;
    olayYaz('sihirbaz_bitti', tripId, { mekan: 0 });
    router.replace({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: { id: tripId } });
  };
  // KK5: Planı kur → yakınlığa göre günlere dağıt (yalnız kuş uçuşu tahmini, ek istek yok) → Program "Planın hazır".
  const planiKur = async () => {
    if (!tripId || !mekanlar.data || !gunler.data || !duraklar.data) return;
    setHata(null);
    try {
      const plan = await planUygula.mutateAsync({ mekanlar: mekanlar.data, gunler: gunler.data, duraklar: duraklar.data });
      const atanan = plan.gunler.reduce((t0, g) => t0 + g.mekanlar.length, 0);
      const doluGun = plan.gunler.filter((g) => g.mekanlar.length > 0).length;
      olayYaz('sihirbaz_bitti', tripId, { mekan: mekanlar.data.length });
      olayYaz('plan_kuruldu', tripId, { mekan: atanan, gun: doluGun, atanmamis: plan.atanmamis.length, bolge: plan.bolgeSayisi, sure_sn: Math.round((Date.now() - baslangicAni.current) / 1000) });
      router.replace({ pathname: '/seyahat/[id]/(sekmeler)/program', params: { id: tripId, planKuruldu: '1', atanmamis: String(plan.atanmamis.length) } });
    } catch {
      setHata(t('sihirbaz.onerilenler.planHata'));
    }
  };

  // #445 KK2: K, "Planı kur"un kullandığı aynı hesapla (planiKur ile aynı girdi); her render'da değil, veri değişince.
  const sigmayanSayisi = useMemo(
    () => (gunler.data && duraklar.data ? planiHesapla({ mekanlar: mekanlar.data ?? [], gunler: gunler.data, duraklar: duraklar.data }).atanmamis.length : 0),
    [mekanlar.data, gunler.data, duraklar.data],
  );

  // Seyahat kurulduktan sonra (geri dönülse de) davet gitmiş olur: satır yalnız seyahat kurulmadan görünür.
  const kimlerSatiri = !tripId && kimlerle.kisiler.length > 0 ? <KimlerleSatiri kimlerle={kimlerle} /> : undefined;

  if (adim === 'nereye') {
    return (
      <>
        <AdimKabugu adim={adim} baslik={t('sihirbaz.nereye.baslik')} onGeri={geri} geriPasif={kayitSuruyor} hata={hata} altIcerik={kimlerSatiri} devam={{ onPress: nereyeDevam, pasif: !sehir, yukleniyor: adKaydet.isPending || taslakSehri.isPending }}>
          <AdimNereye key={ilkSorgu?.anahtar} ilkSorgu={ilkSorgu?.metin} sehir={sehir} onSehir={setSehir} ad={ad} onerilenAd={onerilenAd} onAd={setAd} sehirler={sehirler.data} />
        </AdimKabugu>
        <SehirDegisimSayfasi yerSayisi={sehirOnayi} sehir={sehir?.ad ?? ''} onDevam={sehriKaydet} onVazgec={sehirVazgec} />
      </>
    );
  }
  if (adim === 'nezaman') {
    return (
      <AdimKabugu
        adim={adim}
        baslik={t('sihirbaz.nezaman.baslik')}
        alt={seyahat.data ? (seyahat.data.name ?? seyahat.data.city_label) : (ad ?? onerilenAd)}
        onGeri={geri} geriPasif={kayitSuruyor}
        hata={hata}
        altIcerik={kimlerSatiri}
        devam={{ onPress: seyahatiKur, pasif: !aralik && tarihsizGun === null, yukleniyor: kuruluyor || taslakTarihi.isPending }}
        atla={
          tarihsizGun === null
            ? {
                baslik: t('sihirbaz.nezaman.atla'),
                onPress: () => {
                  setAralik(null);
                  setTarihsizGun(TARIHSIZ_VARSAYILAN);
                },
              }
            : undefined
        }>
        <AdimNeZaman
          aralik={aralik}
          onAralik={(a) => {
            setTarihsizGun(null);
            setAralik(a);
          }}
          tarihsizGun={tarihsizGun}
          onTarihsizGun={(n) => setTarihsizGun(gunSayisiSinirla(n))}
        />
      </AdimKabugu>
    );
  }
  // 3: seyahat, günler ve duraklar yüklenene kadar bekleme. #581 KK5: biri hata verirse sonsuz çark yerine "Tekrar dene".
  if (!seyahat.data || !gunler.data || !duraklar.data) {
    const veriHatasi = (!seyahat.data && seyahat.isError) || (!gunler.data && gunler.isError) || (!duraklar.data && duraklar.isError);
    const tekrarDene = () => {
      if (seyahat.isError) void seyahat.refetch();
      if (gunler.isError) void gunler.refetch();
      if (duraklar.isError) void duraklar.refetch();
    };
    return (
      <AdimKabugu adim={adim} baslik="" onGeri={geri} geriPasif={kayitSuruyor}>
        {veriHatasi ? (
          <View style={s.hataKutu}>
            <Text style={s.hata}>{t('sihirbaz.onerilenler.veriHata')}</Text>
            <Buton baslik={t('sihirbaz.onerilenler.tekrarDene')} onPress={tekrarDene} yukleniyor={seyahat.isFetching || gunler.isFetching || duraklar.isFetching} />
          </View>
        ) : (
          <ActivityIndicator color={renk.ana} style={{ marginTop: 40 }} />
        )}
      </AdimKabugu>
    );
  }
  const havuz = mekanlar.data ?? [];
  const tut = (placeId: string) => setTutulan((t0) => new Set(t0).add(placeId));
  const panelMekan = panel ? havuz.find((m) => m.place_id === panel.place_id) : undefined;
  const panelHafif: HafifYer | null = panel
    ? { place_id: panel.place_id, ad: panel.ad, lat: panel.lat, lng: panel.lng, primary_type: panel.primary_type, tz: null, puan: panel.puan, puan_sayisi: panel.puan_sayisi, acik: null, ulke_kodu: null, foto_uri: panel.foto_uri }
    : null;
  const panelDakika = panel ? (panelMekan?.default_minutes ?? sureAyari[panel.place_id] ?? panel.dakika) : 0;
  const sureDegistir = (fark: number) => {
    if (!panel) return;
    const yeni = Math.min(480, Math.max(15, panelDakika + fark));
    if (yeni === panelDakika) return;
    if (panelMekan) guncelle.mutateAsync({ id: panelMekan.id, default_minutes: yeni }).catch(() => setHata(t('sihirbaz.onerilenler.ekleHata')));
    else setSureAyari((a) => ({ ...a, [panel.place_id]: yeni }));
  };
  const paneldenCta = async () => {
    if (!panel) return;
    setHata(null);
    try {
      if (panelMekan) await sil.mutateAsync(panelMekan.id);
      else {
        await ekle.mutateAsync({ place_id: panel.place_id, primary_type: panel.primary_type, lat: panel.lat, lng: panel.lng, default_minutes: panelDakika });
        tut(panel.place_id);
      }
    } catch {
      setHata(t('sihirbaz.onerilenler.ekleHata'));
    }
  };
  const yolTarifi = () => {
    if (!panel) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${panel.lat},${panel.lng}&destination_place_id=${encodeURIComponent(panel.place_id)}&travelmode=walking`);
  };
  // #401: liste yoksa ya da alınamadıysa bugünkü akış (#400); istek sürerken Google'a gidilmez.
  const ilListesi = ilYerleri.data && ilYerleri.data.length > 0 ? ilYerleri.data : null;
  const ilBekliyor = ilYerleri.isLoading;
  const secim = havuz.map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, dakika: m.default_minutes }));
  return (
    <View style={{ flex: 1 }}>
      <AdimKabugu
        adim={adim}
        baslik={t('sihirbaz.onerilenler.baslik')}
        alt={ilListesi ? t('sihirbaz.onerilenler.altIl', { il: sehir?.ad ?? seyahat.data.city_label }) : t('sihirbaz.onerilenler.alt')}
        onGeri={geri} geriPasif={kayitSuruyor}
        hata={hata}
        kaydirmasiz
        altIcerik={
          <PlanCubugu
            ozet={secimOzeti(secim)}
            doluluk={
              ilListesi && gunler.data.length > 0
                ? {
                    gun: gunler.data.length,
                    ...gunDolulugu(secim, gunler.data.length),
                    sigmayan: sigmayanSayisi,
                  }
                : undefined
            }
            onPlaniKur={planiKur}
            onHaritayaGec={haritayaGec}
            yukleniyor={planUygula.isPending}
          />
        }>
        {ilBekliyor ? (
          <ActivityIndicator color={renk.ana} style={{ marginTop: 40 }} accessibilityLabel={t('ilOneri.listeYukleniyor')} />
        ) : ilListesi ? (
          <AdimIlOnerileri seyahat={seyahat.data} yerler={ilListesi} havuz={havuz} onTut={tut} onHata={setHata} onAc={setPanel} />
        ) : (
          <AdimOnerilenler seyahat={seyahat.data} rehberSehir={rehberSehir} havuz={havuz} tutulan={tutulan} onTut={tut} onHata={setHata} onAc={setPanel} />
        )}
      </AdimKabugu>
      {panel ? (
        <MekanPaneli
          placeId={panel.place_id}
          tz={seyahat.data.tz}
          hafif={panelHafif}
          oneCikan={panel.neden === 'oneCikan'}
          dakika={panelDakika}
          onSure={sureDegistir}
          baglam="kesfet"
          icinde={!!panelMekan}
          mesgul={ekle.isPending || sil.isPending}
          onCta={paneldenCta}
          onYolTarifi={yolTarifi}
          onKapat={() => setPanel(null)}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  hataKutu: { gap: 16, paddingTop: 20 },
  hata: { fontFamily: yazi.yari, fontSize: 14, lineHeight: 20, textAlign: 'center', color: renk.uyari },
});
