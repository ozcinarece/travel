import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { bolgeHesapla, zoomDelta } from '@/components/harita/geo';
import { medyan, secimSuresiKaydet, taniSayaclari, useTani } from '@/components/harita/tani';
import { HaritaEkrani } from '@/components/harita/HaritaEkrani';
import type { HaritaBolgesi, HaritaOdagi, HaritaPini } from '@/components/harita/tipler';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { GoogleAtfi } from '@/components/yerler/GoogleAtfi';
import type { Konaklama } from '@/features/konaklama/plan';
import { useKonaklamalar } from '@/features/konaklama/sorgular';
import { GrupPenceresi } from '@/components/davet/GrupPenceresi';
import { MekanPaneli } from '@/components/mekan/MekanPaneli';
import { useMekanEkle, useMekanGuncelle, useMekanlar, useMekanSil, useUyeler } from '@/features/mekanlar/sorgular';
import { geziyeGit } from '@/features/gezi/gezinti';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { FiltreSayfasi } from '@/components/kesfet/FiltreSayfasi';
import { AlandaAraHapi, CekmeceKartlari, CekmeceSatirlari, CekmeceSeridi, HaritayaDonlu, type CekmeceOgesi } from '@/components/kesfet/OneriCekmecesi';
import { EkCip, HizliCipler } from '@/components/kesfet/HizliCipler';
import type { SayfaHali } from '@/components/harita/AltSayfa';
import { sehirEslestir, useSehirler } from '@/features/icerik/sorgular';
import { kartKamerasi } from '@/features/program/durakKarti';
import { useOnerilenler, type OnerilenMekan } from '@/features/sihirbaz/onerilenler';
import { AZ_ONERI, cekmeceListesi, cekmeceSayisi, gorunurOneriSayisi, type CekmeceCipi } from '@/features/yerler/cekmece';
import { hafifOnbellek, hafifYerler, linkCoz, linkGibiMi, useHafifYerler, useOneriler, useYerFotolari, yeniOturumJetonu, type HafifYer } from '@/features/yerler/api';

import { aktifFiltreSayisi, filtreAktif, filtredenGecer, filtreOzeti, varsayilanMi, type Filtre } from '@/features/yerler/filtre';
import { useOneCikanlar } from '@/features/yerler/oneCikan';
import { useKesfetOnerileri } from '@/features/yerler/kesfetYukleme';
import { alanCipi, alandaAraGorunur, alanIcinde, gorunumAlani, gorunurOneriler, sehirCipleri } from '@/features/yerler/sehirListesi';
import { kesfetDurumunuAl, useKesfetDurumu } from '@/features/yerler/kesfetDurumu';
import { t } from '@/i18n';
import { izBirak } from '@/lib/hataRaporu';
import { kategoriPini } from '@/lib/pinIkonu';
import { varsayilanDakika } from '@/lib/kategori';
import type { Mekan, Seyahat } from '@/lib/tipler';
import { bosluk, renk, yazi, yuzRenkleri } from '@/theme';

// PRD 3.4 Keşfet: HaritaEkrani kabuğu (#17) — üstte şehir hapı + üyeler, arama, çipler; altta öneri kartları; en altta liste çubuğu.
export default function KesfetEkrani() {
  const id = useSeyahatId();
  // #80 KK12: eski `mekan/[placeId]` derin linki buraya `mekan` parametresiyle yönlenir → panel açılır.
  // #142 KK4: Rehber sekmesindeki "Rehberdeki N mekan ›" → `cekmece=rehber` (çekmece tam halde "Rehberden" listesiyle açılır).
  // #181: Gezi sayfasının "Öğle yemeği ekle"si `cip=yemek` (+ her istekte yeni `n`) ile Yemek çipini seçer.
  const { mekan, cekmece, cip, n } = useLocalSearchParams<{ mekan?: string | string[]; cekmece?: string; cip?: string; n?: string }>();
  const seyahat = useSeyahat(id);
  const konaklamalar = useKonaklamalar(id);
  if (!seyahat.data || !konaklamalar.data || !id) return <SeyahatYukleme sorgular={[seyahat, konaklamalar]} kimlikYok={!id} />;
  return <Kesfet key={id} seyahat={seyahat.data} konaklamalar={konaklamalar.data} ilkMekan={Array.isArray(mekan) ? mekan[0] : mekan} cekmeceIstegi={cekmece === 'rehber' ? 'rehber' : null} cipIstegi={cip === 'yemek' ? `yemek:${n ?? ''}` : null} />;
}

const ILK_ZOOM = 13;

function Kesfet({ seyahat, konaklamalar, ilkMekan, cekmeceIstegi, cipIstegi }: { seyahat: Seyahat; konaklamalar: Konaklama[]; ilkMekan?: string; cekmeceIstegi: 'rehber' | null; cipIstegi: string | null }) {
  const mekanlar = useMekanlar(seyahat.id);
  const uyeler = useUyeler(seyahat.id);
  // #137 KK6: Grup penceresi (yüzlere dokununca; Grup sekmesi kalktı).
  const [grupAcik, setGrupAcik] = useState(false);
  const ekle = useMekanEkle(seyahat.id);
  const sil = useMekanSil(seyahat.id);
  const guncelle = useMekanGuncelle(seyahat.id);

  const [sorgu, setSorgu] = useState('');
  const [jeton, setJeton] = useState(yeniOturumJetonu);
  // #69: filtre durumu — hızlı filtreler ve filtre sayfası aynı durumu paylaşır (KK9). #79 KK2: filtre, seçim ve son bölge
  // seyahat belleğinde (kesfetDurumu): ekran yeniden kurulsa da aynı filtreyle süzülür, aynı bölgeden açılır.
  const [filtre, setFiltre] = useKesfetDurumu(seyahat.id, 'filtre');
  const [filtreAcik, setFiltreAcik] = useState(false);
  // #141 KK7: "Listende N · göster" — harita ve çekmece yalnız listeyi gösterir.
  const [yalnizListe, setYalnizListe] = useState(false);
  // #71: tanı şeridi — filtre düğmesine uzun basınca açılır/kapanır (cihazda logcat olmadan sayaçlar).
  const [taniAcik, setTaniAcik] = useState(__DEV__);
  const tani = useTani(taniAcik);
  // #79 KK5: ekranın kuruluş sayısı tanı şeridinde (1'den fazlaysa ekran yeniden mount olmuş demektir).
  useEffect(() => {
    taniSayaclari.kesfetKurulum += 1;
    // #120 KK4: hata kartı için iz — ekran kuruldu (kaçıncı kurulum, bellekteki seçim/bölge).
    const d = kesfetDurumunuAl(seyahat.id);
    izBirak('kesfet', `kuruldu #${taniSayaclari.kesfetKurulum} · seçim ${d.secim?.place_id ? 'var' : 'yok'} · bölge ${d.bolge ? 'bellekte' : 'yok'}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [aramaSonucu, setAramaSonucu] = useState<HafifYer | null>(null);
  const [secim, setSecim] = useKesfetDurumu(seyahat.id, 'secim');
  // #80 KK12: derin linkle gelen mekan panelde açılır (bir kez).
  useEffect(() => {
    if (ilkMekan) setSecim({ place_id: ilkMekan, kaynak: 'oneri' });
  }, [ilkMekan, setSecim]);
  // #80 KK7: listede olmayan mekan için "Kalınacak süre" ayarı oturumda tutulur; listeye eklenince yazılır.
  const [sureAyari, setSureAyari] = useState<Record<string, number>>({});
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [odak, setOdak] = useState<HaritaOdagi | undefined>();
  const odakla = (lat: number, lng: number, zoom: number) => setOdak((o) => ({ konum: { lat, lng }, zoom, sayac: (o?.sayac ?? 0) + 1 }));

  // İlk açılış şehir (ya da otel) merkezi, zoom 13. #56: otel gün bazında (stays); ilk eklenen otel merkez. Öneriler #189 Ek 2:
  // şehir listesinden (aşağıda), görünüme göre süzülür.
  const ilkOtel = konaklamalar[0];
  const ilkMerkez = useMemo(
    () => ({
      lat: ilkOtel?.lat ?? seyahat.lat,
      lng: ilkOtel?.lng ?? seyahat.lng,
    }),
    [ilkOtel?.lat, ilkOtel?.lng, seyahat.lat, seyahat.lng],
  );
  const ilkBolge = useMemo(() => bolgeHesapla(ilkMerkez, zoomDelta(ILK_ZOOM), zoomDelta(ILK_ZOOM)), [ilkMerkez]);
  const [bolge, setBolge] = useKesfetDurumu(seyahat.id, 'bolge');
  // #79 KK1: ekran yeniden kurulduysa harita son görünür bölgeden açılır (kamera aynı kalır); ilk açılışta şehir / otel merkezi.
  const [baslangicBolge] = useState<HaritaBolgesi | null>(() => kesfetDurumunuAl(seyahat.id).bolge);

  // KK2: Autocomplete görünür alan merkezine 15 km yanlı (#28).
  const aramaMerkezi = {
    lat: (bolge ?? ilkBolge).merkez.lat,
    lng: (bolge ?? ilkBolge).merkez.lng,
    yaricapM: 15_000,
  };
  const linkMi = linkGibiMi(sorgu);
  const aramaAcik = !linkMi && sorgu.trim().length >= 2 && !aramaSonucu;
  const oneriler = useOneriler('mekan-oneri', sorgu, jeton, undefined, aramaMerkezi, aramaAcik);
  // #189 Ek 2 KK7: şehir listesi. Merkez içerikteki şehir (sehirler) ya da seyahat merkezi; şehir sorgusu bitmeden istenmez (merkez
  // değişip istek iki kez atılmasın). Çip başına bir istek, Turistik üç alt istek; çip seçmek eksik isteği doğurur. KK8: kaydırmak
  // ve yakınlaştırmak istek atmaz — pinler eldeki listeden görünüme göre süzülür.
  const sehirler = useSehirler();
  const rehberSehir = sehirEslestir(sehirler.data, { ad: seyahat.city_label, lat: seyahat.lat, lng: seyahat.lng });
  const sehirLat = sehirler.isPending ? null : (rehberSehir?.lat ?? seyahat.lat);
  const sehirLng = sehirler.isPending ? null : (rehberSehir?.lng ?? seyahat.lng);
  const sehirMerkezi = useMemo(() => (sehirLat == null || sehirLng == null ? null : { lat: sehirLat, lng: sehirLng }), [sehirLat, sehirLng]);
  const cipler = useMemo(() => sehirCipleri(filtre), [filtre]);
  const yakin = useKesfetOnerileri(seyahat.id, sehirMerkezi, cipler);
  const filtreyiDegistir = (f: Filtre) => setFiltre(f);
  useEffect(() => {
    if (cipIstegi) filtreyiDegistir({ ...filtre, kategoriler: ['yemek'] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cipIstegi]);

  const havuz = useMemo(() => mekanlar.data ?? [], [mekanlar.data]);
  // #30: listedeki pinlerin altında ad etiketi (canlı ad, PRD §7).
  // #172 KK3: listedeki pinlerin etiketinde ve çekmecede ★ puan — Enterprise maske (Keşfet'te puan kalır, KK9).
  const havuzAdlari = useHafifYerler(havuz.map((m) => m.place_id), { puan: true });
  const uyeAdi = (uid: string | null) => uyeler.data?.find((u) => u.user_id === uid)?.display_name ?? '';
  const oneriListesi: HafifYer[] = yakin.yerler;
  const havuzIdleri = useMemo(() => new Set(havuz.map((m) => m.place_id)), [havuz]);
  // #69 §A: öne çıkanlar — şehrin yüklenmiş mekanları arasında en üst %10; liste büyüdükçe en fazla 10 sn'de bir yeniden hesap.
  const oneCikan = useOneCikanlar(oneriListesi);
  // #69 KK5: filtre açıkken eşleşmeyen öneri pinleri gizlenir; listedekiler ve seçili pin her zaman görünür.
  const filtreli = filtreAktif(filtre);
  // #164 KK3: açılış filtresi (Turistik) düğmeyi koyulaştırmaz, özet hapı çıkarmaz (kanvas 9); rozet yine sayıyı gösterir.
  const varsayilan = varsayilanMi(filtre);
  const gecenler = useMemo(() => (filtreli ? oneriListesi.filter((y) => filtredenGecer(y, filtre, oneCikan)) : oneriListesi), [oneriListesi, filtreli, filtre, oneCikan]);
  // #189 Ek 2 KK9: "Bu alanda ara" hapı — şehir dışına kaydırınca ya da şehir içinde görünümde az öneri kalınca; aynı alan için bir
  // kez. Dokununca görünüm için tek istek (az sonuçta bir kez 3 kat yarıçap).
  const alanHapi = !yakin.yukleniyor && alandaAraGorunur({ bolge, sehir: yakin.sehirAlani, arananlar: yakin.arananlar, oneriler: gecenler });
  const alandaAra = () => {
    if (bolge) yakin.alandaAra(bolge, alanCipi(filtre));
  };

  // #80: panel başlığı için eldeki hafif veri (ad, puan, kategori); tam veriyi panel kendisi çeker (places-full).
  const seciliHafif: HafifYer | null = secim
    ? ((aramaSonucu && aramaSonucu.place_id === secim.place_id ? aramaSonucu : null) ??
      oneriListesi.find((y) => y.place_id === secim.place_id) ??
      havuzAdlari.data?.[secim.place_id] ??
      null)
    : null;
  const seciliMekan = secim ? havuz.find((m) => m.place_id === secim.place_id) : undefined;
  const seciliDakika = secim ? (seciliMekan?.default_minutes ?? sureAyari[secim.place_id] ?? varsayilanDakika(seciliHafif?.primary_type)) : 0;
  const sureDegistir = (fark: number) => {
    if (!secim) return;
    const yeni = Math.min(480, Math.max(15, seciliDakika + fark));
    if (yeni === seciliDakika) return;
    if (seciliMekan) guncelle.mutateAsync({ id: seciliMekan.id, default_minutes: yeni }).catch(() => setHata(t('kesfet.ekleHata')));
    else setSureAyari((a) => ({ ...a, [secim.place_id]: yeni }));
  };

  // #53: öneri = beyaz daire, kategori renginde kenar + ikon (primaryType). #66 KK6: en fazla 250 öneri pini çizilir
  // (aşılırsa görünür alan dışındakiler; listede kalırlar). #68 🔴2: liste oturum boyu büyür — tek geçişte Set ile ayıklanır,
  // yalnız girdileri değişince yeniden kurulur.
  // #69 KK5: filtre açıkken yalnız geçenler + seçili pin; gizli sayısı listedekileri ve seçili pini saymaz.
  const seciliOneri = secim && filtreli ? oneriListesi.find((y) => y.place_id === secim.place_id) : undefined;
  const oneriPinleri = useMemo((): HaritaPini[] => {
    const gorulen = new Set(havuzIdleri);
    const adaylar: HafifYer[] = [];
    for (const y of [...(aramaSonucu ? [aramaSonucu] : []), ...gecenler, ...(seciliOneri ? [seciliOneri] : [])]) {
      if (gorulen.has(y.place_id)) continue;
      gorulen.add(y.place_id);
      adaylar.push(y);
    }
    return gorunurOneriler(adaylar, bolge).map((y) => ({
      id: `o:${y.place_id}`,
      konum: { lat: y.lat, lng: y.lng },
      renk: renk.metin,
      ad: y.ad,
      ...kategoriPini(y.primary_type),
      puan: y.puan,
      yorumSayisi: y.puan_sayisi,
      tur: 'oneri' as const,
      oneCikan: oneCikan.has(y.place_id),
    }));
  }, [gecenler, seciliOneri, havuzIdleri, aramaSonucu, bolge, oneCikan]);
  // #75: seçim pin listesinden ayrı (Harita `seciliId`): seçim değişince liste ve çakışma hesabı yeniden kurulmaz.
  const seciliId = secim ? (havuzIdleri.has(secim.place_id) ? `m:${secim.place_id}` : `o:${secim.place_id}`) : null;
  // #75: dokunuş → kart (#80: panel) süresi — panel `secim` ile aynı render'da; commit sonrası ölçülür.
  useEffect(() => {
    if (secim) secimSuresiKaydet('kart');
  }, [secim]);
  const gizliSayi = useMemo(() => {
    if (!filtreli) return 0;
    const gecen = new Set(gecenler.map((y) => y.place_id));
    return oneriListesi.filter((y) => !havuzIdleri.has(y.place_id) && !gecen.has(y.place_id) && y.place_id !== secim?.place_id).length;
  }, [filtreli, oneriListesi, gecenler, havuzIdleri, secim?.place_id]);

  const pinler: HaritaPini[] = [
    ...konaklamalar.map((k) => ({
      id: `otel:${k.id}`,
      konum: { lat: k.lat, lng: k.lng },
      renk: renk.metin,
      tur: 'otel' as const,
    })),
    // #61 §4: listeye eklenen = kategori renginde dolu daire + beyaz kategori ikonu; altında ad (öncelikli), yakınken ★ puan · yorum.
    ...havuz.map((m) => ({
      id: `m:${m.place_id}`,
      konum: { lat: m.lat, lng: m.lng },
      renk: renk.metin,
      ...kategoriPini(m.primary_type),
      ad: havuzAdlari.data?.[m.place_id]?.ad,
      puan: havuzAdlari.data?.[m.place_id]?.puan ?? null,
      yorumSayisi: havuzAdlari.data?.[m.place_id]?.puan_sayisi ?? null,
      tur: 'listede' as const,
      oneCikan: oneCikan.has(m.place_id),
    })),
    ...(yalnizListe ? [] : oneriPinleri),
  ];

  const sec = async (placeId: string, ad: string) => {
    setHata(null);
    setMesgul(true);
    try {
      const [yer] = await hafifYerler([placeId], { oturum: jeton });
      // #172: seçim ad ve puanla gelir (pin etiketi, panel) — ortak önbelleğe yazılır, listeye eklenince yeniden istenmez.
      if (yer) hafifOnbellek.yaz([yer], 'hafif', [placeId]);
      if (!yer) throw new Error('yer yok');
      setAramaSonucu({ ...yer, ad: yer.ad || ad });
      setSecim({ place_id: yer.place_id, kaynak: 'arama' });
      odakla(yer.lat, yer.lng, 16);
      setSorgu(yer.ad || ad);
      setJeton(yeniOturumJetonu());
    } catch {
      setHata(t('kesfet.secimHata'));
    } finally {
      setMesgul(false);
    }
  };

  const linkiCoz = async () => {
    setHata(null);
    setMesgul(true);
    try {
      const { yer, kaynak } = await linkCoz(sorgu.trim(), aramaMerkezi);
      // places.place_id boş olamaz: yalnız koordinat çözüldüyse eklenemez (PR #13 notu).
      if (kaynak === 'koordinat' || !yer.place_id) {
        odakla(yer.lat, yer.lng, 16);
        setHata(t('kesfet.koordinatMekan'));
        return;
      }
      setAramaSonucu(yer);
      setSecim({ place_id: yer.place_id, kaynak: 'arama' });
      odakla(yer.lat, yer.lng, 16);
      setSorgu(yer.ad);
    } catch (e) {
      setHata((e as Error).message === 'desteklenmeyen_link' ? t('kesfet.linkDesteksiz') : t('kesfet.linkHata'));
    } finally {
      setMesgul(false);
    }
  };

  const yaz = (metin: string) => {
    setSorgu(metin);
    if (aramaSonucu) {
      setAramaSonucu(null);
      setSecim(null);
    }
  };

  // #29 KK / #80 KK3: panelden ekle; eklenince pin dolu olur, düğme "Listeden çıkar"a döner. Oturumda ayarlanan süre yazılır.
  const listeyeEkle = async (y: HafifYer) => {
    setHata(null);
    try {
      await ekle.mutateAsync({
        place_id: y.place_id,
        primary_type: y.primary_type,
        lat: y.lat,
        lng: y.lng,
        default_minutes: sureAyari[y.place_id],
      });
    } catch {
      setHata(t('kesfet.ekleHata'));
    }
  };
  const listedenCikar = async (m: Mekan) => {
    setHata(null);
    try {
      await sil.mutateAsync(m.id);
    } catch {
      setHata(t('kesfet.ekleHata'));
    }
  };

  // #29: pine dokunmak seçimdir (ekleme karttan). #32: harita kaymaz.
  const pinBas = (pinId: string) => {
    if (pinId.startsWith('otel:')) return;
    const placeId = pinId.slice(2);
    setSecim({
      place_id: placeId,
      kaynak: pinId.startsWith('m:') ? 'liste' : 'oneri',
    });
  };
  // #80 KK3: Yol tarifi — Google Maps derin linki (yürüyüş).
  const yolTarifi = () => {
    const y = seciliHafif ?? seciliMekan;
    if (!y || !secim) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${y.lat},${y.lng}&destination_place_id=${encodeURIComponent(secim.place_id)}&travelmode=walking`);
  };

  // #98 B: öneri çekmecesi — üç hal; görünür alanda olup listede olmayanlar, puan sırası; harita kayınca yeniden süzülür
  // (yeni istek yok, #71 "Bu bölgeyi tara" kuralı). "+" ile eklenen, bir sonraki bölge/yenilemeye kadar "Listede ✓" kalır.
  const [cekmece, setCekmece] = useState<SayfaHali>('katli');
  const [cekmeceCip, setCekmeceCip] = useState<CekmeceCipi>('bolge');
  const [tutulan, setTutulan] = useState<Set<string>>(() => new Set());
  const [cekmeceMesgul, setCekmeceMesgul] = useState<string | null>(null);
  // #164 KK6: mekan paneli açılınca çekmece yalnız gizlenir — hali (yarım / tam) ve kaydırma konumu korunur; panel kapanınca
  // aynen geri gelir. Çekmece açıkken panel açıldıysa liste bölgesi o anki bölgede donar (satıra dokununca kamera mekana kayar,
  // liste değişmesin); panel kapalıyken harita kaydıkça bölge yeniden izlenir.
  const cekmeceDonuk = !!secim && cekmece !== 'katli';
  const [cekmeceBolgesi, setCekmeceBolgesi] = useState(bolge);
  const [izlenenBolge, setIzlenenBolge] = useState(bolge);
  if (izlenenBolge !== bolge) {
    setIzlenenBolge(bolge);
    if (!cekmeceDonuk) setCekmeceBolgesi(bolge);
  }
  // "Önceki render" deseni (render sırasında koşullu setState): çekmece bölgesi / öneri listesi değişince tutulanlar sıfırlanır.
  const [tutKaynak, setTutKaynak] = useState({ bolge: cekmeceBolgesi, oneriListesi });
  if (tutKaynak.bolge !== cekmeceBolgesi || tutKaynak.oneriListesi !== oneriListesi) {
    setTutKaynak({ bolge: cekmeceBolgesi, oneriListesi });
    if (tutulan.size > 0) setTutulan(new Set());
  }
  // #142 KK4: Rehber sekmesinden gelince çekmece tam + "Rehberden" çipi (parametre her değişişte bir kez).
  const [oncekiIstek, setOncekiIstek] = useState<'rehber' | null>(null);
  if (oncekiIstek !== cekmeceIstegi) {
    setOncekiIstek(cekmeceIstegi);
    if (cekmeceIstegi === 'rehber') {
      setYalnizListe(false);
      setCekmeceCip('rehber');
      setCekmece('tam');
    }
  }
  // #121 KK5: çekmece de hızlı filtreden geçenleri listeler (`gecenler`), pinlerle aynı küme.
  // #165: tam haldeki kategori çipleri artık Keşfet'in hızlı filtre çipleri (aynı filtre); çekmecenin kendi çipi yalnız "Rehberden".
  const bolgeListesi = useMemo(() => cekmeceListesi(gecenler, havuzIdleri, cekmeceBolgesi, tutulan), [gecenler, havuzIdleri, cekmeceBolgesi, tutulan]);
  const cekmeceSayi = cekmeceSayisi(bolgeListesi, havuzIdleri);
  const listeYerleri = useMemo(() => havuz.map((m) => havuzAdlari.data?.[m.place_id]).filter((y): y is HafifYer => !!y), [havuz, havuzAdlari.data]);
  const rehberGorunur = cekmece === 'tam' && cekmeceCip === 'rehber' && !yalnizListe;
  const cekmeceGosterilen = yalnizListe ? listeYerleri : bolgeListesi;
  // Satır / kart fotoğrafları: yalnız ilk 12 öneri için. #172 KK2–KK3: ad ve puan Nearby'den / listeden zaten elde —
  // yalnız fotoğraf, ortak önbellekten (eksik kimlik için Pro foto maskesi). Rehber yerlerinin fotoğrafı kendinde.
  const fotoIdleri = useMemo(() => (rehberGorunur ? [] : cekmeceGosterilen.slice(0, 12).map((y) => y.place_id).sort()), [rehberGorunur, cekmeceGosterilen]);
  const fotolar = useYerFotolari(cekmece !== 'katli' ? fotoIdleri : []);
  // "Rehberden" çipi (tam hal): şehir yayınlı rehberle eşleşiyorsa içerik ekibinin yerleri (#98 KK6 ile aynı kaynak).
  const rehber = useOnerilenler(seyahat, rehberSehir, 'rehber');
  const cekmecedenEkle = async (y: HafifYer) => {
    setCekmeceMesgul(y.place_id);
    await listeyeEkle(y);
    setTutulan((t0) => new Set(t0).add(y.place_id));
    setCekmeceMesgul(null);
  };
  const cekmecedenCikar = async (placeId: string) => {
    const m = havuz.find((x) => x.place_id === placeId);
    if (!m) return;
    setCekmeceMesgul(placeId);
    await listedenCikar(m);
    setCekmeceMesgul(null);
  };
  // #121 KK7: satıra dokunma → panel + kamera o pine kayar (pin iğne olur). Merkez, yarım panelin (ekranın %55'i) üstünde
  // kalacak kadar güneye alınır (Program kartıyla aynı hesap, zoom 16).
  const ekran = useWindowDimensions();
  const cekmecedenAc = (placeId: string) => {
    setSecim({ place_id: placeId, kaynak: 'oneri' });
    const y = oneriListesi.find((x) => x.place_id === placeId);
    if (!y) return;
    const kamera = kartKamerasi({ konum: { lat: y.lat, lng: y.lng }, zoom: 16, ekranYukseklik: ekran.height, kartYukseklik: Math.round(ekran.height * 0.55), altPay: 0 });
    odakla(kamera.konum.lat, kamera.konum.lng, kamera.zoom);
  };
  // #189 KK3: süzgeçten sonra görünür alanda 3'ten az öneri kaldıysa çöp yerine yönlendirme satırı. Tarama sürerken, hata varken,
  // yalnız liste / rehber görünümünde ve kullanıcının kendi koşulu (öne çıkan, puan, yorum) varken çıkmaz.
  const kullaniciKosulu = filtre.oneCikan || filtre.puan > 0 || filtre.yorum > 0;
  const azOneri = !yalnizListe && !rehberGorunur && !yakin.yukleniyor && !yakin.hata && !kullaniciKosulu && !!cekmeceBolgesi && gorunurOneriSayisi(gecenler, cekmeceBolgesi) < AZ_ONERI;
  // #189 Ek 2 KK9: son "Bu alanda ara" genişletildiyse ve görünüm o alandaysa çekmece bunu söyler (az satırının yerine).
  const genisletildi = !yalnizListe && !rehberGorunur && !!yakin.genisAlan && !!cekmeceBolgesi && alanIcinde(gorunumAlani(cekmeceBolgesi), yakin.genisAlan);
  const cekmeceOrtak = {
    havuz: havuzIdleri,
    mesgulId: cekmeceMesgul,
    onEkle: cekmecedenEkle,
    onCikar: cekmecedenCikar,
    onAc: cekmecedenAc,
    azMetni: genisletildi ? t('kesfet.cekmece.genis') : azOneri ? t('kesfet.cekmece.az') : null,
  };
  // #165 KK10: süre mekanın varsayılan kalış süresi (listedeyse kendi süresi — Program'la aynı kaynak); puan ve fotoğraf
  // çekmecenin elindeki veriden (ek Google isteği yok).
  const listeSureleri = useMemo(() => new Map(havuz.map((m) => [m.place_id, m.default_minutes] as const)), [havuz]);
  const fotoHaritasi = fotolar.data;
  const rehberListesi = rehber.liste;
  const cekmeceOgeleri = useMemo((): CekmeceOgesi[] => {
    const sureBul = (placeId: string, tip: string | null) => listeSureleri.get(placeId) ?? sureAyari[placeId] ?? varsayilanDakika(tip);
    if (rehberGorunur)
      return rehberListesi.map((m: OnerilenMekan) => ({
        place_id: m.place_id,
        ad: m.ad,
        primary_type: m.primary_type,
        puan: m.puan,
        foto_uri: m.foto_uri,
        oneCikan: m.neden === 'oneCikan',
        dakika: sureBul(m.place_id, m.primary_type),
        yer: { place_id: m.place_id, ad: m.ad, lat: m.lat, lng: m.lng, primary_type: m.primary_type, tz: null, puan: m.puan, puan_sayisi: m.puan_sayisi, acik: null, ulke_kodu: null },
      }));
    return cekmeceGosterilen.map((y) => ({
      place_id: y.place_id,
      ad: y.ad,
      primary_type: y.primary_type,
      puan: y.puan,
      foto_uri: y.foto_uri ?? fotoHaritasi?.get(y.place_id) ?? null,
      oneCikan: oneCikan.has(y.place_id),
      dakika: sureBul(y.place_id, y.primary_type),
      yer: y,
    }));
  }, [rehberGorunur, rehberListesi, cekmeceGosterilen, listeSureleri, sureAyari, fotoHaritasi, oneCikan]);
  const haritayaDon = () => setCekmece('katli');


  return (
    <HaritaEkrani
      // #141 KK1: sol üstte her zaman "‹ {seyahat adı}"; #181: seyahatin evi Gezi sayfası.
      baslik={seyahatAdi(seyahat)}
      altMenuVar
      geri={() => geziyeGit(seyahat.id)}
      sagUst={
        // #45: Grup'a erişim avatarlardan (seyahat içi alt menü kalktı).
        <Pressable accessibilityRole="button" accessibilityLabel={t('seyahat.grup.baslik')} hitSlop={8} onPress={() => setGrupAcik(true)} style={s.avatarlar}>
          {(uyeler.data ?? []).slice(0, 3).map((u, i) => (
            <View key={u.user_id} style={[s.avatarCerceve, i > 0 && { marginLeft: -8 }]}>
              <Avatar ad={u.display_name} url={u.photo_url} boyut={24} arkaPlan={yuzRenkleri[i % yuzRenkleri.length]} />
            </View>
          ))}
        </Pressable>
      }
      arama={
        <>
          <Text style={s.buyutec}>⌕</Text>
          <TextInput
            accessibilityLabel={t('kesfet.ara')}
            placeholder={t('kesfet.araYer')}
            placeholderTextColor={renk.soluk}
            value={sorgu}
            onChangeText={yaz}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType={linkMi ? 'go' : 'search'}
            onSubmitEditing={linkMi ? linkiCoz : undefined}
            style={s.girdi}
          />
          {mesgul || (aramaAcik && oneriler.isFetching) ? <ActivityIndicator color={renk.ikincil} /> : null}
          {linkMi && !mesgul ? (
            <Pressable accessibilityRole="button" onPress={linkiCoz} hitSlop={10}>
              <Text style={s.linkDugme}>{t('kesfet.linkCoz')}</Text>
            </Pressable>
          ) : null}
        </>
      }
      aramaSag={
        // #69 §C: 46 px filtre düğmesi; aktif filtre varsa siyah + sağ üstte turuncu sayı rozeti.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('kesfet.filtre.ac')}
          onPress={() => setFiltreAcik(true)}
          onLongPress={() => setTaniAcik((a) => !a)}
          style={({ pressed }) => [s.filtreDugme, s.golge, filtreli && !varsayilan && s.filtreDugmeAktif, pressed && { opacity: 0.85 }]}>
          <Ikon ad="filtre" boyut={18} renk={filtreli && !varsayilan ? renk.zemin : renk.metin} kalinlik={2.2} />
          {filtreli ? (
            <View style={s.filtreRozet}>
              <Text style={s.filtreRozetMetin}>{aktifFiltreSayisi(filtre)}</Text>
            </View>
          ) : null}
        </Pressable>
      }
      ustEk={
        aramaAcik ? (
          <View style={[s.sonuclar, s.golge]}>
            {oneriler.isError ? <Text style={s.hataMetin}>{t('kesfet.araHata')}</Text> : null}
            {oneriler.data?.length === 0 ? <Text style={s.bos}>{t('kesfet.sonucYok')}</Text> : null}
            {oneriler.data?.map((o) => (
              <Pressable key={o.place_id} accessibilityRole="button" onPress={() => sec(o.place_id, o.ana)} style={s.sonuc}>
                <Text style={s.sonucAna} numberOfLines={1}>
                  {o.ana}
                </Text>
                <Text style={s.sonucAlt} numberOfLines={1}>
                  {o.ikincil}
                </Text>
              </Pressable>
            ))}
            {oneriler.data && oneriler.data.length > 0 ? <GoogleAtfi /> : null}
          </View>
        ) : (
          <>
            {/* #164 KK3 (kanvas 9): Turistik · Yemek · Kafe · Park · Alışveriş · Tümü; varsayılan Turistik, tek seçim (kategori
                renginde glif). Öne çıkan / puan / yorum ve Müze · İbadet · Manzara alt seçenekleri filtre sayfasında. */}
            <HizliCipler filtre={filtre} onFiltre={filtreyiDegistir} />
            {filtreli && !varsayilan ? (
              // #69 KK5: filtre açıkken "Şehrin öne çıkanları · 9 mekan gizli" hapı (dokunulmaz).
              <View style={s.yukleniyorSatir} pointerEvents="none">
                <View style={[s.filtreOzet, s.golge]}>
                  <Text style={s.filtreOzetMetin}>{filtreOzeti(filtre, gizliSayi)}</Text>
                </View>
              </View>
            ) : null}
            {/* #71: "Bu bölgeyi tara" — son taranandan uzaklaşınca; basılınca düğmenin yerinde yükleme, tur bitince kaybolur.
                #79 KK4: filtre hapı varsa düğme onun ALTINA iner (çakışmaz). */}
            {alanHapi || yakin.alanAraniyor ? <AlandaAraHapi onPress={alandaAra} yukleniyor={yakin.alanAraniyor} /> : null}
          </>
        )
      }
      // #98 B: öneri çekmecesi (alt sayfa); eski alt katman (tanı, hatalar, "Listede N mekan" çubuğu) çekmecenin üstünde yüzer.
      altSayfaGizli={!!secim}
      altSayfa={{
        hal: cekmece,
        onHal: setCekmece,
        // #165: yarım hal alanın ~%57'si (kanvas 9b); tam hal üst katmanı da örter, durum çubuğunun altına kadar çıkar (9c).
        yariOran: 0.57,
        tamGuvenli: true,
        ust: (
          <CekmeceSeridi
            hal={cekmece}
            sayi={cekmeceSayi}
            onHal={setCekmece}
            liste={{ sayi: havuz.length, yalniz: yalnizListe, onPress: () => setYalnizListe((x) => !x) }}
            tam={{
              yerSayisi: rehberGorunur ? rehber.liste.length : cekmeceSayi,
              onFiltre: () => setFiltreAcik(true),
              cipler: (
                <HizliCipler
                  filtre={filtre}
                  onFiltre={filtreyiDegistir}
                  cerceveli
                  secimYok={cekmeceCip === 'rehber'}
                  onSecildi={() => setCekmeceCip('bolge')}
                  ek={rehberSehir ? <EkCip metin={t('sihirbaz.onerilenler.cip.rehber')} secili={cekmeceCip === 'rehber'} onPress={() => setCekmeceCip((c) => (c === 'rehber' ? 'bolge' : 'rehber'))} /> : null}
                />
              ),
            }}
          />
        ),
        govde: (yukseklik) =>
          cekmece === 'katli' ? null : cekmece === 'yari' ? (
            <CekmeceSatirlari liste={cekmeceOgeleri} yukseklik={yukseklik} {...cekmeceOrtak} />
          ) : yalnizListe ? (
            <HaritayaDonlu yukseklik={yukseklik} onHaritayaDon={haritayaDon}>
              <CekmeceSatirlari liste={cekmeceOgeleri} yukseklik={yukseklik} {...cekmeceOrtak} />
            </HaritayaDonlu>
          ) : (
            <CekmeceKartlari liste={cekmeceOgeleri} yukseklik={yukseklik} onHaritayaDon={haritayaDon} {...cekmeceOrtak} />
          ),
        ustunde: (
        <View style={s.alt} pointerEvents="box-none">
          {tani ? (
            <View style={s.tani} pointerEvents="none">
              <Text style={s.taniMetin}>
                {`istek ${tani.istek} · hata ${tani.hata} · bölge ${tani.bolgeOlayi} · yükleniyor ${yakin.yukleniyor ? 'E' : 'H'}\nişaretçi ${tani.gorunen} (png ${tani.png} · ad ${tani.ad} · görünüm ${tani.gorunum}) · render ${tani.render}\ndokunma ${tani.dokunma}${tani.sonDokunma ? ` · son ${tani.sonDokunma.slice(0, 28)}` : ''} · liste ${oneriListesi.length} · gizli ${gizliSayi}\nseçim: iğne ${tani.igneMs.at(-1) ?? '–'} ms · kart ${tani.kartMs.at(-1) ?? '–'} ms · medyan(10) iğne ${medyan(tani.igneMs)} / kart ${medyan(tani.kartMs)} · değişen işaretçi ${tani.sonDegisim}\nkuruluş: keşfet ${tani.kesfetKurulum} · harita hazır ${tani.haritaHazir} · yeniden ${tani.haritaYenidenKurulum}`}
              </Text>
            </View>
          ) : null}
          {hata ? (
            <View style={s.hataKutu}>
              <Text style={s.hataMetin}>{hata}</Text>
            </View>
          ) : null}
          {yakin.hata ? (
            <View style={s.hataKutu}>
              <Text style={s.hataMetin}>{t('kesfet.oneriHata')}</Text>
            </View>
          ) : null}
          {!yakin.hata && !yakin.yukleniyor && oneriListesi.length === 0 && !aramaSonucu ? <Text style={s.bosOneri}>{t('kesfet.bolgeBos')}</Text> : null}

        </View>
        ),
      }}
      // #80: mekan paneli en üst katmanda; harita dolgusu değişmez (kamera yerinde). Pin değişince içerik değişir, panel kalır.
      ustKatman={
        <>
          <FiltreSayfasi acik={filtreAcik} filtre={filtre} onFiltre={filtreyiDegistir} sayi={gecenler.length} onKapat={() => setFiltreAcik(false)} />
          <GrupPenceresi acik={grupAcik} onKapat={() => setGrupAcik(false)} seyahat={seyahat} uyeler={uyeler.data ?? []} mekanlar={havuz} />
          {secim ? (
          <MekanPaneli
            placeId={secim.place_id}
            tz={seyahat.tz}
            hafif={seciliHafif}
            oneCikan={oneCikan.has(secim.place_id)}
            ekleyenAd={seciliMekan ? uyeAdi(seciliMekan.added_by) : undefined}
            dakika={seciliDakika}
            onSure={sureDegistir}
            baglam="kesfet"
            icinde={!!seciliMekan}
            mesgul={ekle.isPending || sil.isPending}
            onCta={() => (seciliMekan ? listedenCikar(seciliMekan) : seciliHafif && listeyeEkle(seciliHafif))}
            onYolTarifi={yolTarifi}
            onKapat={() => setSecim(null)}
          />
          ) : null}
        </>
      }
      harita={{
        merkez: ilkMerkez,
        zoom: ILK_ZOOM,
        pinler,
        odak,
        onPinBas: pinBas,
        onHaritaBas: () => setSecim(null),
        onBolgeDegisti: setBolge,
        seciliId,
        ilkBolge: baslangicBolge,
      }}
    />
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.yuzey },
  ortala: { alignItems: 'center', justifyContent: 'center' },
  golge: {
    shadowColor: renk.metin,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarlar: { flexDirection: 'row' },
  avatarCerceve: { borderWidth: 2, borderColor: renk.zemin, borderRadius: 14 },
  buyutec: { fontSize: 18, color: renk.ikincil },
  girdi: {
    flex: 1,
    fontFamily: yazi.yari,
    fontSize: 14,
    color: renk.metin,
    paddingVertical: 0,
  },
  linkDugme: {
    fontFamily: yazi.kalin,
    fontSize: 12,
    color: renk.vurgu,
    paddingVertical: 8,
  },
  sonuclar: {
    borderRadius: 14,
    backgroundColor: renk.zemin,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  sonuc: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: renk.ayrac,
    gap: 2,
  },
  sonucAna: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  sonucAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  bos: {
    fontFamily: yazi.normal,
    fontSize: 13,
    color: renk.ikincil,
    paddingVertical: 10,
  },
  yukleniyorSatir: { alignItems: 'center', gap: 6 },
  filtreDugme: { width: 46, height: 46, borderRadius: 14, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  filtreDugmeAktif: { backgroundColor: renk.metin },
  filtreRozet: { position: 'absolute', right: -2, top: -2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: renk.vurgu, borderWidth: 1.5, borderColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  filtreRozetMetin: { fontFamily: yazi.ekstra, fontSize: 10, lineHeight: 12, color: renk.zemin },
  filtreOzet: { height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center' },
  filtreOzetMetin: { fontFamily: yazi.kalin, fontSize: 11, color: '#4a4a4a' },
  alt: { gap: 12, paddingBottom: 14 },
  bosOneri: {
    fontFamily: yazi.normal,
    fontSize: 12,
    color: renk.ikincil,
    textAlign: 'center',
    paddingHorizontal: bosluk.kenar,
  },
  tani: { marginHorizontal: bosluk.kenar, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(15,15,15,0.8)' },
  taniMetin: { fontFamily: yazi.kalin, fontSize: 10, lineHeight: 14, color: renk.zemin },
  hataKutu: {
    marginHorizontal: bosluk.kenar,
    padding: 10,
    borderRadius: 12,
    backgroundColor: renk.uyariZemin,
  },
  hataMetin: {
    fontFamily: yazi.yari,
    fontSize: 12,
    color: renk.uyari,
    textAlign: 'center',
  },
});
