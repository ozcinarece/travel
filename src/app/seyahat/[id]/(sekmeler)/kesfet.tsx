import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

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
import { GeriAlBandi } from '@/components/listem/GeriAlBandi';
import { GuneEkleSayfasi } from '@/components/listem/GuneEkleSayfasi';
import { MekanPaneli } from '@/components/mekan/MekanPaneli';
import { type BekleyenSilme, useGeriAlinabilirSil } from '@/features/mekanlar/geriAlinabilirSil';
import { geciciMi, useMekanEkle, useMekanGuncelle, useMekanlar, useUyeler, type EklemeKaynagi } from '@/features/mekanlar/sorgular';
import { listedekiMekan, useGunEklemesiniGeriAl, type GunEklemesi } from '@/features/gezi/bugunEkle';
import { bugunDurumu } from '@/features/listem/listem';
import { useGunProgrami } from '@/features/program/useProgram';
import { useProgramVerisi } from '@/features/program/useProgramVerisi';
import { geziyeGit } from '@/features/gezi/gezinti';
import { useDuragaAta, useDuraklar, useGunler } from '@/features/gunler/sorgular';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { FiltreSayfasi } from '@/components/kesfet/FiltreSayfasi';
import { AlandaAraHapi, CekmeceKartlari, CekmeceSatirlari, CekmeceSeridi, HaritayaDonlu, type CekmeceOgesi } from '@/components/kesfet/OneriCekmecesi';
import { EkCip, HizliCipler } from '@/components/kesfet/HizliCipler';
import type { SayfaHali } from '@/components/harita/AltSayfa';
import { sehirEslestir, useSehirler } from '@/features/icerik/sorgular';
import { kartKamerasi } from '@/features/program/durakKarti';
import { useOnerilenler, type OnerilenMekan } from '@/features/sihirbaz/onerilenler';
import { AZ_ONERI, cekmeceListesi, cekmeceSayisi, gorunurOneriSayisi, type CekmeceCipi } from '@/features/yerler/cekmece';
import { listedekiBenzerler } from '@/features/yerler/benzerYer';
import { aramaSecimi, linkCoz, linkGibiMi, useHafifYerler, useOneriler, useYerFotolari, yeniOturumJetonu, placesHatasi, type HafifYer } from '@/features/yerler/api';

import { aktifFiltreSayisi, filtreAktif, filtredenGecer, filtreOzeti, varsayilanMi, type Filtre } from '@/features/yerler/filtre';
import { useOneCikanlar } from '@/features/yerler/oneCikan';
import { useKesfetOnerileri } from '@/features/yerler/kesfetYukleme';
import { baglamGunSecenekleri, bugununGunSirasi, etkinGunSirasi, GUN_BILDIRIMI_MS, gunEklendiMetni, gunEkleEtiketi, gunHapiMetni } from '@/features/yerler/gunBaglami';
import { alanCipi, alandaAraGorunur, alanIcinde, gorunumAlani, gorunurOneriler, sehirCipleri } from '@/features/yerler/sehirListesi';
import { kesfetDurumunuAl, useKesfetDurumu } from '@/features/yerler/kesfetDurumu';
import { useGeciciGorunur } from '@/features/yerler/geciciHata';
import { t } from '@/i18n';
import { bulunmaEkli } from '@/lib/ek';
import { agHatasi, useCevrimdisi } from '@/lib/baglanti';
import { izBirak } from '@/lib/hataRaporu';
import { kategoriPini } from '@/lib/pinIkonu';
import { varsayilanDakika } from '@/lib/kategori';
import type { Durak, Gun, Mekan, Seyahat } from '@/lib/tipler';
import { bosluk, gunRengi, gunUstuMetin, renk, yazi, yuzRenkleri } from '@/theme';
import { haritaMerkezi, konumVar, YEDEK_ZOOM, yedekMerkezMi, yolTarifiHedefi } from '@/lib/konum';
import { useSeyahatMerkezi } from '@/features/seyahatler/merkez';

// PRD 3.4 Keşfet: HaritaEkrani kabuğu (#17) — üstte şehir hapı + üyeler, arama, çipler; altta öneri kartları; en altta liste çubuğu.
export default function KesfetEkrani() {
  const id = useSeyahatId();
  // #80 KK12: eski `mekan/[placeId]` derin linki buraya `mekan` parametresiyle yönlenir → panel açılır.
  // #142 KK4: Rehber sekmesindeki "Rehberdeki N mekan ›" → `cekmece=rehber` (çekmece tam halde "Rehberden" listesiyle açılır).
  // #181: Gezi sayfasının "Öğle yemeği ekle"si `cip=yemek` (+ her istekte yeni `n`) ile Yemek çipini seçer.
  // #532 KK4: Gezi'nin "Tümü ›" ve Plan'daki günün içi `gun` (gün sırası) taşır; + o güne ekler.
  const { mekan, cekmece, cip, gun, n } = useLocalSearchParams<{ mekan?: string | string[]; cekmece?: string; cip?: string; gun?: string; n?: string }>();
  const seyahat = useSeyahat(id);
  const konaklamalar = useKonaklamalar(id);
  if (!seyahat.data || !konaklamalar.data || !id) return <SeyahatYukleme sorgular={[seyahat, konaklamalar]} kimlikYok={!id} />;
  return <Kesfet key={id} seyahat={seyahat.data} konaklamalar={konaklamalar.data} ilkMekan={Array.isArray(mekan) ? mekan[0] : mekan} cekmeceIstegi={cekmece === 'rehber' ? 'rehber' : null} cipIstegi={cip === 'yemek' ? `yemek:${n ?? ''}` : null} gunIstegi={gun ? `${gun}:${n ?? ''}` : null} />;
}

const ILK_ZOOM = 13;
const DAKIKA_MS = 60_000;
const BOS_GUNLER: Gun[] = [];
const BOS_DURAKLAR: Durak[] = [];
const BOS_MEKANLAR: Mekan[] = [];

function Kesfet({
  seyahat,
  konaklamalar,
  ilkMekan,
  cekmeceIstegi,
  cipIstegi,
  gunIstegi,
}: {
  seyahat: Seyahat;
  konaklamalar: Konaklama[];
  ilkMekan?: string;
  cekmeceIstegi: 'rehber' | null;
  cipIstegi: string | null;
  /** #532 KK4: "{gün sırası}:{istek no}"; her yeni istekte gün bağlamı yeniden kurulur. */
  gunIstegi: string | null;
}) {
  const mekanlar = useMekanlar(seyahat.id);
  // #532 KK4 (kanvas `YerEkle_Gunle`): gün bağlamı — "{n}. güne ekliyorsun ✕" hapı; + listeye ekler ve o günün sonuna koyar.
  const gunler = useGunler(seyahat.id);
  const duraklar = useDuraklar(seyahat.id);
  const ata = useDuragaAta(seyahat.id);
  const [gunBaglamiIndex, setGunBaglamiIndex] = useState<number | null>(null);
  const [oncekiGunIstegi, setOncekiGunIstegi] = useState<string | null>(null);
  if (oncekiGunIstegi !== gunIstegi) {
    setOncekiGunIstegi(gunIstegi);
    const no = gunIstegi ? Number(gunIstegi.split(':')[0]) : NaN;
    setGunBaglamiIndex(Number.isInteger(no) && no > 0 ? no : null);
  }
  // #536 inceleme 4: gün bağlamı yapışkan olmasın. Sekmeden çıkınca (blur) temizlenir; sekme çubuğundan geri gelen kişi
  // + ile yeri sessizce eski güne eklemez. Aynı istek tekrar uygulanmaz (`oncekiGunIstegi` değişmez), yeni istek yeni no taşır.
  // #579 KK1: gezi günlerinde (seyahat saat dilimiyle, `trips.tz`) açıkça seçilmiş gün yoksa bugün seçili gelir. Blur'da seçim
  // temizlenir; sekmeye dönünce yine bugün. "Şimdi" sekme her açıldığında alınır (sekme arka planda kurulu kalır, #79: dakikalık
  // saat haritalı ekranı boşuna yeniden çizmesin).
  const [an, setAn] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setAn(new Date());
      return () => setGunBaglamiIndex(null);
    }, []),
  );
  const bugunSirasi = bugununGunSirasi(seyahat, an);
  const etkinIndex = etkinGunSirasi(gunBaglamiIndex, bugunSirasi);
  const gunBaglami = etkinIndex !== null ? (gunler.data?.find((g) => g.index === etkinIndex) ?? null) : null;
  // #579 KK2: "Değiştir" → Hangi güne? çekmecesi.
  const [gunSecimiAcik, setGunSecimiAcik] = useState(false);
  // #599 KK4 (+ #609 eki): sekme açıkken gün değişirse hap yeni günü gösterir; Değiştir çekmecesi açıkken bugünün alt satırı
  // ("akşam boş") da dakikasında güncellenir. Dakikada bir bakılır ama ekran yalnız gün değişince ya da çekmece açıkken yeniden
  // çizilir (#79: haritalı ekran boşuna çizilmesin). Açıkça seçilmiş gün (Değiştir, Plan) olduğu gibi kalır (`etkinGunSirasi`).
  const seyahatRef = useRef(seyahat);
  const gunSecimiAcikRef = useRef(gunSecimiAcik);
  useEffect(() => {
    seyahatRef.current = seyahat;
    gunSecimiAcikRef.current = gunSecimiAcik;
  });
  useEffect(() => {
    const z = setInterval(() => {
      const simdi = new Date();
      setAn((o) => (gunSecimiAcikRef.current || bugununGunSirasi(seyahatRef.current, o) !== bugununGunSirasi(seyahatRef.current, simdi) ? simdi : o));
    }, DAKIKA_MS);
    return () => clearInterval(z);
  }, []);
  const gunSecenekleri = useMemo(() => (gunSecimiAcik ? baglamGunSecenekleri(gunler.data ?? [], duraklar.data ?? []) : []), [gunSecimiAcik, gunler.data, duraklar.data]);
  // #579 inceleme 5 (#553 KK3): çekmecede bugünün alt satırı "N durak gezildi · akşam boş" — Plan'la aynı canlı program; yalnız
  // çekmece açıkken, ağ isteği yok (önbellekteki yürüyüş ya da kestirim).
  const cekmeceGunu = gunSecimiAcik && bugunSirasi !== null ? gunler.data?.find((g) => g.index === bugunSirasi) : undefined;
  const programVerisi = useProgramVerisi({
    seyahat,
    gunler: gunler.data ?? BOS_GUNLER,
    duraklar: duraklar.data ?? BOS_DURAKLAR,
    mekanlar: mekanlar.data ?? BOS_MEKANLAR,
    seciliGun: cekmeceGunu,
    konaklamalar,
    ag: false,
  });
  const bugunProg = useGunProgrami({ seyahat, gun: cekmeceGunu, duraklar: duraklar.data ?? BOS_DURAKLAR, mekanlar: mekanlar.data ?? BOS_MEKANLAR, yuruyus: programVerisi.yuruyus, an, uclar: programVerisi.seciliUclar });
  const bugunCekmece = useMemo(() => (bugunProg?.bugun ? bugunDurumu(bugunProg.canli, bugunProg.simdiDk) : null), [bugunProg]);
  // #621 KK3: bildirim sayaçlı (`GeriAlBandi`'nin `olay`ı gibi): aynı metin 2,8 sn içinde yeniden gelirse de yeniden duyurulur
  // ve süre baştan başlar.
  const [gunBildirimi, setGunBildirimiDurum] = useState<{ metin: string; sayac: number } | null>(null);
  const gunBildirimiSayaci = useRef(0);
  const setGunBildirimi = useCallback((metin: string | null) => {
    if (metin) gunBildirimiSayaci.current += 1;
    setGunBildirimiDurum(metin ? { metin, sayac: gunBildirimiSayaci.current } : null);
  }, []);
  const gunBildirimiMetni = gunBildirimi?.metin ?? null;
  const gunBildirimiOlayi = gunBildirimi?.sayac ?? 0;
  useEffect(() => {
    if (!gunBildirimiMetni) return;
    // #599 KK5: iOS'ta canlı bölge yok; kısa bildirim VoiceOver'a duyurulur (Android `accessibilityLiveRegion` ile okur).
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(gunBildirimiMetni);
    const z = setTimeout(() => setGunBildirimiDurum(null), 2800);
    return () => clearTimeout(z);
  }, [gunBildirimiMetni, gunBildirimiOlayi]);
  // #579 KK3: gezi günlerinde eklenince 4 sn Gece bildirim + "Geri al" (eklenen yer listeden ve günden geri çıkar).
  const [eklendiBildirimi, setEklendiBildirimi] = useState<{ metin: string; ad: string; ekleme: GunEklemesi; sayac: number } | null>(null);
  useEffect(() => {
    if (!eklendiBildirimi) return;
    const z = setTimeout(() => setEklendiBildirimi(null), GUN_BILDIRIMI_MS);
    return () => clearTimeout(z);
  }, [eklendiBildirimi]);
  const eklemeyiGeriAlMut = useGunEklemesiniGeriAl(seyahat.id);
  const queryClient = useQueryClient();
  const uyeler = useUyeler(seyahat.id);
  // #137 KK6: Grup penceresi (yüzlere dokununca; Grup sekmesi kalktı).
  const [grupAcik, setGrupAcik] = useState(false);
  // #317 KK3: iyimser ekleme — satır ve pin hemen tik alır, hata olursa geri döner.
  const ekle = useMekanEkle(seyahat.id, { iyimser: true });
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
  // #317 KK2: arama sonucu (pini) seyahat belleğinde: ekran yeniden kurulunca pin geri gelir.
  const [aramaSonucu, setAramaSonucu] = useKesfetDurumu(seyahat.id, 'aramaSonucu');
  const [secim, setSecim] = useKesfetDurumu(seyahat.id, 'secim');
  // #80 KK12: derin linkle gelen mekan panelde açılır (bir kez).
  useEffect(() => {
    if (ilkMekan) setSecim({ place_id: ilkMekan, kaynak: 'oneri' });
  }, [ilkMekan, setSecim]);
  // #80 KK7: listede olmayan mekan için "Kalınacak süre" ayarı oturumda tutulur; listeye eklenince yazılır.
  const [sureAyari, setSureAyari] = useState<Record<string, number>>({});
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  // #317 KK1: bağlantı yoksa (#243) hata katmanında "Bağlantı yok".
  const cevrimdisi = useCevrimdisi();
  const [odak, setOdak] = useState<HaritaOdagi | undefined>();
  const odakla = (lat: number, lng: number, zoom: number) => setOdak((o) => ({ konum: { lat, lng }, zoom, sayac: (o?.sayac ?? 0) + 1 }));

  // İlk açılış şehir (ya da otel) merkezi, zoom 13. #56: otel gün bazında (stays); ilk eklenen otel merkez. Öneriler #189 Ek 2:
  // şehir listesinden (aşağıda), görünüme göre süzülür.
  // #318: koordinatı boşalmış otel / seyahat atlanır; hiçbiri yoksa ilk konumlu mekan, o da yoksa yedek merkez.
  const ilkOtel = konaklamalar.find(konumVar);
  const ilkKonumluMekan = mekanlar.data?.find(konumVar);
  // #318 inceleme 4: seyahat merkezi boşsa şehir kimliğinden anlık konum (saklanmaz); yedek merkezde ülke ölçeği.
  const seyahatMerkezi = useSeyahatMerkezi(seyahat);
  const ilkMerkez = useMemo(
    () => haritaMerkezi(ilkOtel, seyahatMerkezi, ilkKonumluMekan),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ilkOtel?.lat, ilkOtel?.lng, seyahatMerkezi?.lat, seyahatMerkezi?.lng, ilkKonumluMekan?.lat, ilkKonumluMekan?.lng],
  );
  const ilkZoom = yedekMerkezMi(ilkMerkez) ? YEDEK_ZOOM : ILK_ZOOM;
  const ilkBolge = useMemo(() => bolgeHesapla(ilkMerkez, zoomDelta(ilkZoom), zoomDelta(ilkZoom)), [ilkMerkez, ilkZoom]);
  const [bolge, setBolge] = useKesfetDurumu(seyahat.id, 'bolge');
  // #79 KK1: ekran yeniden kurulduysa harita son görünür bölgeden açılır (kamera aynı kalır); ilk açılışta şehir / otel merkezi.
  const [baslangicBolge] = useState<HaritaBolgesi | null>(() => kesfetDurumunuAl(seyahat.id).bolge);
  // Harita ilk merkezle kurulur; canlı şehir konumu harita kurulduktan sonra gelirse kamera oraya kayar (bir kez).
  // #318 inceleme 4: kurulumda konum zaten hazırsa ya da kaydedilmiş görünüm varsa kamera kaymaz (#79 KK1 ezilmesin).
  const merkezBekleniyor = useRef(seyahatMerkezi == null && !baslangicBolge);
  useEffect(() => {
    if (!merkezBekleniyor.current || konumVar(seyahat) || !seyahatMerkezi || ilkOtel || ilkKonumluMekan) return;
    merkezBekleniyor.current = false;
    odakla(seyahatMerkezi.lat, seyahatMerkezi.lng, ILK_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seyahatMerkezi?.lat, seyahatMerkezi?.lng]);

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
  const rehberSehir = sehirEslestir(sehirler.data, { ad: seyahat.city_label, lat: seyahatMerkezi?.lat ?? null, lng: seyahatMerkezi?.lng ?? null });
  const sehirLat = sehirler.isPending ? null : (rehberSehir?.lat ?? seyahatMerkezi?.lat ?? null);
  const sehirLng = sehirler.isPending ? null : (rehberSehir?.lng ?? seyahatMerkezi?.lng ?? null);
  const sehirMerkezi = useMemo(() => (sehirLat == null || sehirLng == null ? null : { lat: sehirLat, lng: sehirLng }), [sehirLat, sehirLng]);
  const cipler = useMemo(() => sehirCipleri(filtre), [filtre]);
  const yakin = useKesfetOnerileri(seyahat.id, sehirMerkezi, cipler);
  const sehirAdi = rehberSehir?.ad ?? seyahat.city_label;
  const filtreyiDegistir = (f: Filtre) => setFiltre(f);
  useEffect(() => {
    if (cipIstegi) filtreyiDegistir({ ...filtre, kategoriler: ['yemek'] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cipIstegi]);

  // #387: ✓ ile çıkarılan mekan 5 sn "Geri al" bandında bekler; o sürede listede sayılmaz (pin öneriye döner).
  const geriAlinabilir = useGeriAlinabilirSil(seyahat.id, () => setHata(t('listem.hata')));
  const cikanId = geriAlinabilir.bekleyen?.mekanId;
  const tumHavuz = useMemo(() => mekanlar.data ?? [], [mekanlar.data]);
  const havuz = useMemo(() => (cikanId ? tumHavuz.filter((m) => m.id !== cikanId) : tumHavuz), [tumHavuz, cikanId]);
  // #30: listedeki pinlerin altında ad etiketi (canlı ad, PRD §7).
  // #172 KK3: listedeki pinlerin etiketinde ve çekmecede ★ puan — Enterprise maske (Keşfet'te puan kalır, KK9). Bekleyen
  // çıkarma istek kümesini değiştirmesin diye tüm liste (#387).
  const havuzAdlari = useHafifYerler(tumHavuz.map((m) => m.place_id), { puan: true });
  const uyeAdi = (uid: string | null) => uyeler.data?.find((u) => u.user_id === uid)?.display_name ?? '';
  const oneriListesi: HafifYer[] = yakin.yerler;
  const havuzIdleri = useMemo(() => new Set(havuz.map((m) => m.place_id)), [havuz]);
  // #200 KK8: kimliği farklı ama listedeki mekana 60 m'den yakın ve adı benzer öneri de listede sayılır (gösterilmez). Ad eldeki
  // hafif veriden; ek Google isteği yok.
  const listedeSayilan = useMemo(() => {
    const benzer = listedekiBenzerler(oneriListesi, havuz.filter(konumVar).map((m) => ({ place_id: m.place_id, lat: m.lat, lng: m.lng, ad: havuzAdlari.data?.[m.place_id]?.ad })));
    return benzer.size > 0 ? new Set([...havuzIdleri, ...benzer]) : havuzIdleri;
  }, [oneriListesi, havuz, havuzAdlari.data, havuzIdleri]);
  // #69 §A: öne çıkanlar — şehrin yüklenmiş mekanları arasında en üst %10; liste büyüdükçe en fazla 10 sn'de bir yeniden hesap.
  const oneCikan = useOneCikanlar(oneriListesi);
  // #69 KK5: filtre açıkken eşleşmeyen öneri pinleri gizlenir; listedekiler ve seçili pin her zaman görünür.
  const filtreli = filtreAktif(filtre);
  // #164 KK3: açılış filtresi (Turistik) düğmeyi koyulaştırmaz, özet hapı çıkarmaz (kanvas 9); rozet yine sayıyı gösterir.
  const varsayilan = varsayilanMi(filtre);
  const gecenler = useMemo(() => (filtreli ? oneriListesi.filter((y) => filtredenGecer(y, filtre, oneCikan)) : oneriListesi), [oneriListesi, filtreli, filtre, oneCikan]);
  // #189 Ek 2 KK9: "Bu alanda ara" hapı — şehir dışına kaydırınca ya da şehir içinde görünümde az öneri kalınca; aynı alan için bir
  // kez. Dokununca görünüm için tek istek (az sonuçta bir kez 3 kat yarıçap).
  // #317 KK2: aranan alan çipiyle kaydedilir; çip değişince hap aynı alanda yeniden çıkar.
  const alanHapi = !yakin.yukleniyor && alandaAraGorunur({ bolge, sehir: yakin.sehirAlani, arananlar: yakin.arananlar, oneriler: gecenler, cip: alanCipi(filtre) });
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
    const gorulen = new Set(listedeSayilan);
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
  }, [gecenler, seciliOneri, listedeSayilan, aramaSonucu, bolge, oneCikan]);
  // #75: seçim pin listesinden ayrı (Harita `seciliId`): seçim değişince liste ve çakışma hesabı yeniden kurulmaz.
  const seciliId = secim ? (havuzIdleri.has(secim.place_id) ? `m:${secim.place_id}` : `o:${secim.place_id}`) : null;
  // #75: dokunuş → kart (#80: panel) süresi — panel `secim` ile aynı render'da; commit sonrası ölçülür.
  useEffect(() => {
    if (secim) secimSuresiKaydet('kart');
  }, [secim]);
  const gizliSayi = useMemo(() => {
    if (!filtreli) return 0;
    const gecen = new Set(gecenler.map((y) => y.place_id));
    return oneriListesi.filter((y) => !listedeSayilan.has(y.place_id) && !gecen.has(y.place_id) && y.place_id !== secim?.place_id).length;
  }, [filtreli, oneriListesi, gecenler, listedeSayilan, secim?.place_id]);

  const pinler: HaritaPini[] = [
    // #318: koordinatı boşalmış otel ve mekan haritada pin olmaz.
    ...konaklamalar.filter(konumVar).map((k) => ({
      id: `otel:${k.id}`,
      konum: { lat: k.lat, lng: k.lng },
      renk: renk.metin,
      tur: 'otel' as const,
    })),
    // #61 §4: listeye eklenen = kategori renginde dolu daire + beyaz kategori ikonu; altında ad (öncelikli), yakınken ★ puan · yorum.
    ...havuz.filter(konumVar).map((m) => ({
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

  // #121 KK7 / #317 KK2: seçilen yerin pini panelin (ekranın %55'i) altında kalmasın — merkez panelin üstünde kalacak kadar
  // güneye alınır (Program kartıyla aynı hesap, zoom 16).
  const ekran = useWindowDimensions();
  const paneleOdakla = (lat: number, lng: number) => {
    const kamera = kartKamerasi({ konum: { lat, lng }, zoom: 16, ekranYukseklik: ekran.height, kartYukseklik: Math.round(ekran.height * 0.55), altPay: 0 });
    odakla(kamera.konum.lat, kamera.konum.lng, kamera.zoom);
  };

  const sec = async (placeId: string, ad: string) => {
    setHata(null);
    setMesgul(true);
    try {
      // #316 KK2: oturumu panelin places-full isteği kapatır; cevap panele ve ortak önbelleğe yazılır (ikinci Details yok).
      const yer = await aramaSecimi(queryClient, placeId, jeton, seyahat.tz);
      setAramaSonucu({ ...yer, ad: yer.ad || ad });
      setSecim({ place_id: yer.place_id, kaynak: 'arama' });
      paneleOdakla(yer.lat, yer.lng);
      setSorgu(yer.ad || ad);
      setJeton(yeniOturumJetonu());
    } catch (e) {
      setHata(placesHatasi(e, t('kesfet.secimHata')));
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
      paneleOdakla(yer.lat, yer.lng);
      setSorgu(yer.ad);
    } catch (e) {
      setHata((e as Error).message === 'desteklenmeyen_link' ? t('kesfet.linkDesteksiz') : placesHatasi(e, t('kesfet.linkHata')));
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
  // #317 KK3: iyimser (kanca listeye hemen yazar, hatada geri alır); KK4: `kaynak` `yer_eklendi` olayına yazılır.
  // #579 inceleme 4 · 6: hedef gün ekleme anında bulunur — "bugün" yeniden hesaplanır (sekme gece yarısını geçerek açık kalmış
  // olabilir; Değiştir ya da Plan ile açıkça seçilen gün olduğu gibi kalır), günler ya da duraklar henüz yüklenmediyse beklenir
  // (yer sessizce yalnız listeye düşmesin; gelmezlerse hata).
  const hedefGunuBul = async (nesil: number) => {
    // #599 değişiklik 1: "+"ya dokunulduğu andaki çıkarma bandı (ilk `await`ten önce, eşzamanlı okunur).
    const bant = geriAlinabilir.simdikiBant();
    const simdi = new Date();
    const bugunNo = bugununGunSirasi(seyahat, simdi);
    if (bugunNo !== bugunSirasi) setAn(simdi);
    const hedefNo = etkinGunSirasi(gunBaglamiIndex, bugunNo);
    const gunListesi = hedefNo !== null && !gunler.data ? (await gunler.refetch()).data : gunler.data;
    const durakListesi = hedefNo !== null && !duraklar.data ? (await duraklar.refetch()).data : duraklar.data;
    if (hedefNo !== null && (!gunListesi || !durakListesi)) throw new Error('gunler_yok');
    const hedef = hedefNo !== null ? (gunListesi?.find((g) => g.index === hedefNo) ?? null) : null;
    return { bugunNo, hedefNo, hedef, durakListesi: durakListesi ?? [], nesil, bant };
  };
  // #621 KK6: ekleme sürerken seyahat değişirse eski eklemenin bildirimi yeni seyahatte açılmaz. `Kesfet` `key={id}` ile
  // çizildiği için seyahat değişince bu örnek kaldırılır; biten eski ekleme bildirim ve bant yan etkisi (`kisaBildirim`,
  // `cikarmaBandiniKapat`) çalıştırmaz.
  const ekranAcik = useRef(true);
  useEffect(() => {
    ekranAcik.current = true;
    return () => {
      ekranAcik.current = false;
    };
  }, []);
  // #599 KK2: "+"ya dokunulduğu anda açık olan "Geri al" bandı, ekleme bildirimi açılırken kapanır (bekleyen çıkarma
  // kesinleşir); aynı anda iki bant yok. #599 değişiklik 1: bant ekleme sürerken (dokunmadan sonra) açıldıysa kalır ve ekleme
  // bildirimi gösterilmez — kullanıcı bir şey yapmadan çıkarma kesinleşmez. Bu durumda eklemenin "Geri al"ı da gösterilmez
  // (yer ✓ ile işaretli kalır). Bildirim gösterilebilirse true.
  const cikarmaBandiniKapat = (dokunmadaki: BekleyenSilme | null) => {
    const simdiki = geriAlinabilir.simdikiBant();
    if (simdiki && simdiki !== dokunmadaki) return false;
    if (simdiki) geriAlinabilir.kapat();
    return true;
  };
  const kisaBildirim = (metin: string, dokunmadaki: BekleyenSilme | null) => {
    if (!cikarmaBandiniKapat(dokunmadaki)) return;
    setEklendiBildirimi(null);
    setGunBildirimi(metin);
  };
  // #599 KK6: art arda iki "+" aynı güne aynı `order_key`'i almasın. Atamalar sıraya girer; önceki atama sürerken gelen atama
  // onun bitmesini bekler. Önceki atama sürüyorsa ya da gün okunduktan (`hedefGunuBul`) sonra bir atama bittiyse günün durakları
  // yeniden okunur (sıra anahtarı yeni son durağın ardından).
  const atamaKuyrugu = useRef<Promise<unknown>>(Promise.resolve());
  const bekleyenAtama = useRef(0);
  // Biten atamaların sayısı: gün listesinin hangi atamadan sonra okunduğu (`hedefGunuBul`'a verilir).
  const biten = useRef(0);
  // #621 KK2: bu ekranda her güne son verilen `order_key`. `onSettled`'daki durak yenilemesi düşerse eldeki liste eski kalır;
  // sonraki atama yine bu anahtarın ardından gelir (aynı anahtar iki durağa verilmez).
  const sonVerilen = useRef(new Map<string, string>());
  // #532 KK4 · #579 KK3: listedeki gerçek satır günün sonuna durak olur; gezi günlerinde bildirim "{ad} bugüne eklendi · Geri al"
  // (Geri al yalnız bu durağı siler; mekan satırını yalnız bu eylem eklediyse).
  const guneAta = (kayit: Mekan, ad: string, h: Awaited<ReturnType<typeof hedefGunuBul>> & { hedef: Gun }, yeniMekan: boolean) => {
    const hedef = h.hedef;
    const sirada = bekleyenAtama.current > 0 || biten.current !== h.nesil;
    bekleyenAtama.current += 1;
    const is = atamaKuyrugu.current
      .catch(() => undefined)
      .then(async () => {
        const gunDuraklari = sirada ? ((await duraklar.refetch()).data ?? h.durakListesi) : h.durakListesi;
        const sonuc = await ata.mutateAsync({
          mekan: kayit,
          gunId: hedef.id,
          mevcut: undefined,
          gunDuraklari: gunDuraklari.filter((d) => d.day_id === hedef.id),
          sonrasi: sonVerilen.current.get(hedef.id),
        });
        sonVerilen.current.set(hedef.id, sonuc.order_key);
        return sonuc;
      })
      .finally(() => {
        bekleyenAtama.current -= 1;
        biten.current += 1;
      });
    atamaKuyrugu.current = is;
    return is.then(({ order_key }) => {
      // #621 KK6: ekran (bu seyahat) kapandıysa bildirim yok.
      if (!ekranAcik.current) return;
      if (h.bugunNo === null) return kisaBildirim(t('kesfet.guneEklendi', { ad, n: hedef.index }), h.bant);
      if (!cikarmaBandiniKapat(h.bant)) return;
      setGunBildirimi(null);
      setEklendiBildirimi((o) => ({
        metin: gunEklendiMetni(ad, hedef, h.bugunNo),
        ad,
        ekleme: { mekanId: kayit.id, gunId: hedef.id, orderKey: order_key, yeniMekan },
        sayac: (o?.sayac ?? 0) + 1,
      }));
    });
  };
  const listeyeEkle = async (y: HafifYer, kaynak: EklemeKaynagi) => {
    setHata(null);
    // #387: bant açıkken aynı mekan yeniden eklenirse çıkarma geri alınır (silinmemişti).
    if (geriAlinabilir.bekleyen?.placeId === y.place_id) return geriAlinabilir.geriAl();
    // #598 değişiklik 2: liste eklemesi bittiyse sonraki hata "Güne eklenemedi. Tekrar dene." — yer listede ✓ kalır, ✓ atamayı
    // tekrar dener (`listedekiniGuneAta`).
    let listede = false;
    try {
      const h = await hedefGunuBul(biten.current);
      const eklenen = await ekle.mutateAsync({
        place_id: y.place_id,
        primary_type: y.primary_type,
        lat: y.lat,
        lng: y.lng,
        default_minutes: sureAyari[y.place_id],
        kaynak,
      });
      listede = true;
      // #532 KK4: gün bağlamı varsa yer o günün sonuna da eklenir (listedeki gerçek satırla).
      // #579 KK3: gezi günlerinde de (bugün ya da "Değiştir"le seçilen gün) sonuna.
      if (h.hedef) await guneAta(await listedekiMekan(seyahat.id, y.place_id), y.ad, { ...h, hedef: h.hedef }, eklenen.yeni);
      // #599 KK5: bugünün sırası var ama o gün `days`'te yok (hap görünmez): yer yalnız listeye girer, bunu söyleyen bildirim.
      else if (h.hedefNo !== null && ekranAcik.current) kisaBildirim(t('kesfet.listeneEklendi', { ad: y.ad }), h.bant);
    } catch (e) {
      setHata(listede ? t('kesfet.guneEklenemedi') : agHatasi(e) ? t('geziSayfasi.cevrimdisi.baglantiYok') : t('kesfet.ekleHata'));
    }
  };
  // #598 değişiklik 1–2: gün bağlamında listede olan ama seçili günde olmayan yer — ✓ ve panel düğmesi listeden çıkarmaz, yeri
  // seçili günün sonuna atar (yeni `ekle` yok). Bildirim KK3'teki gibi; Geri al yalnız bu durağı siler (yer zaten listedeydi).
  // Yer zaten seçili gündeyse bir şey yapmaz.
  const [atanan, setAtanan] = useState<string | null>(null);
  const seciliGunde = (m: Mekan) => !!gunBaglami && (duraklar.data ?? []).some((d) => d.day_id === gunBaglami.id && d.place_ref === m.id);
  const listedekiniGuneAta = async (m: Mekan, ad: string) => {
    if (geciciMi(m) || atanan) return;
    setHata(null);
    setAtanan(m.place_id);
    try {
      const h = await hedefGunuBul(biten.current);
      const hedef = h.hedef;
      if (!hedef || h.durakListesi.some((d) => d.day_id === hedef.id && d.place_ref === m.id)) return;
      await guneAta(m, ad, { ...h, hedef }, false);
    } catch {
      setHata(t('kesfet.guneEklenemedi'));
    } finally {
      setAtanan(null);
    }
  };
  const mekanAdi = (placeId: string) => havuzAdlari.data?.[placeId]?.ad ?? oneriListesi.find((y) => y.place_id === placeId)?.ad ?? (seciliHafif?.place_id === placeId ? seciliHafif.ad : '');
  // #579 KK3 · inceleme 1: "Geri al" — yalnız bu eklemenin durağı silinir; mekan satırı yalnız bu ekleme oluşturduysa.
  const eklemeyiGeriAl = () => {
    const b = eklendiBildirimi;
    if (!b) return;
    setEklendiBildirimi(null);
    // #599 KK1: geri alma hatası kendi metniyle (ekleme hatası değil).
    eklemeyiGeriAlMut.mutate(b.ekleme, { onError: () => setHata(t('kesfet.geriAlinamadi')) });
  };
  // #387 KK1: hemen silinmez; 5 sn "Geri al" bandı, silme bant kapanınca (hata olursa katmanda `listem.hata`).
  const listedenCikar = async (m: Mekan) => {
    // #317 KK3: iyimser satır henüz sunucuda değil; ekleme bitmeden çıkarılamaz.
    if (geciciMi(m)) return;
    setHata(null);
    // #599 KK2: aynı anda iki bant yok — kısa bildirim ve (gizlenecek) ekleme bandı kapanır.
    setGunBildirimi(null);
    setEklendiBildirimi(null);
    geriAlinabilir.cikar(m, havuzAdlari.data?.[m.place_id]?.ad ?? seciliHafif?.ad ?? '');
  };

  // #29: pine dokunmak seçimdir (ekleme karttan). #32: harita kaymaz.
  const pinBas = (pinId: string) => {
    if (pinId.startsWith('otel:')) return;
    const placeId = pinId.slice(2);
    setSecim({
      place_id: placeId,
      kaynak: pinId.startsWith('m:') ? 'liste' : 'pin',
    });
  };
  // #80 KK3: Yol tarifi — Google Maps derin linki (yürüyüş).
  const yolTarifi = () => {
    const y = seciliHafif ?? seciliMekan;
    if (!y || !secim) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${yolTarifiHedefi(y, seciliHafif?.ad ?? '')}&destination_place_id=${encodeURIComponent(secim.place_id)}&travelmode=walking`);
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
  const bolgeListesi = useMemo(() => cekmeceListesi(gecenler, listedeSayilan, cekmeceBolgesi, tutulan), [gecenler, listedeSayilan, cekmeceBolgesi, tutulan]);
  const cekmeceSayi = cekmeceSayisi(bolgeListesi, listedeSayilan);
  const listeYerleri = useMemo(() => havuz.map((m) => havuzAdlari.data?.[m.place_id]).filter((y): y is HafifYer => !!y), [havuz, havuzAdlari.data]);
  const rehberGorunur = cekmece === 'tam' && cekmeceCip === 'rehber' && !yalnizListe;
  const cekmeceGosterilen = yalnizListe ? listeYerleri : bolgeListesi;
  // Satır / kart fotoğrafları: yalnız ilk 12 öneri için. #172 KK2–KK3: ad ve puan Nearby'den / listeden zaten elde —
  // yalnız fotoğraf, ortak önbellekten (eksik kimlik için Pro foto maskesi). Rehber yerlerinin fotoğrafı kendinde.
  const fotoIdleri = useMemo(() => (rehberGorunur ? [] : cekmeceGosterilen.slice(0, 12).map((y) => y.place_id).sort()), [rehberGorunur, cekmeceGosterilen]);
  const fotolar = useYerFotolari(cekmece !== 'katli' ? fotoIdleri : []);
  // "Rehberden" çipi (tam hal): şehir yayınlı rehberle eşleşiyorsa içerik ekibinin yerleri (#98 KK6 ile aynı kaynak).
  const rehber = useOnerilenler(seyahat, rehberSehir, 'rehber');
  // #317 KK3: iyimser — satır beklemeden tik alır (meşgul hali yok); hata olursa tik geri gider, hata katmanda görünür.
  const cekmecedenEkle = async (y: HafifYer) => {
    setTutulan((t0) => new Set(t0).add(y.place_id));
    await listeyeEkle(y, rehberGorunur ? 'rehber' : 'oneri');
  };
  const cekmecedenCikar = async (placeId: string) => {
    const m = havuz.find((x) => x.place_id === placeId);
    if (!m) return;
    // #598 değişiklik 1: gün bağlamında ✓ listeden çıkarmaz — seçili günde değilse güne atar, gündeyse bir şey yapmaz.
    if (gunBaglami) {
      if (seciliGunde(m)) return;
      setCekmeceMesgul(placeId);
      await listedekiniGuneAta(m, mekanAdi(placeId));
      setCekmeceMesgul(null);
      return;
    }
    setCekmeceMesgul(placeId);
    await listedenCikar(m);
    setCekmeceMesgul(null);
  };
  // #121 KK7: satıra dokunma → panel + kamera o pine kayar (pin iğne olur; panelin altında kalmaz).
  const cekmecedenAc = (placeId: string) => {
    setSecim({ place_id: placeId, kaynak: rehberGorunur ? 'rehber' : 'oneri' });
    const y = oneriListesi.find((x) => x.place_id === placeId);
    if (!y) return;
    paneleOdakla(y.lat, y.lng);
  };
  // #189 KK3: süzgeçten sonra görünür alanda 3'ten az öneri kaldıysa çöp yerine yönlendirme satırı. Tarama sürerken, hata varken,
  // yalnız liste / rehber görünümünde ve kullanıcının kendi koşulu (öne çıkan, puan, yorum) varken çıkmaz.
  const kullaniciKosulu = filtre.oneCikan || filtre.puan > 0 || filtre.yorum > 0;
  const azOneri = !yalnizListe && !rehberGorunur && !yakin.yukleniyor && !yakin.hata && !kullaniciKosulu && !!cekmeceBolgesi && gorunurOneriSayisi(gecenler, cekmeceBolgesi) < AZ_ONERI;
  // #189 Ek 2 KK9: son "Bu alanda ara" genişletildiyse ve görünüm o alandaysa çekmece bunu söyler (az satırının yerine).
  const genisletildi = !yalnizListe && !rehberGorunur && !!yakin.genisAlan && !!cekmeceBolgesi && alanIcinde(gorunumAlani(cekmeceBolgesi), yakin.genisAlan);
  // #191: çekmece başlığı şehir listesinin şehrini söyler ("Eskişehir'de öne çıkanlar") — şehir dışında hapın neden çıktığı anlaşılır.
  // Görünüm "Bu alanda ara" ile aranmış bir alandaysa liste o alanındır: başlık eski haliyle ("Bu bölgede önerilen").
  const aranmisAlanda = !!cekmeceBolgesi && yakin.arananlar.some((a) => alanIcinde(gorunumAlani(cekmeceBolgesi), a));
  const sehirBasligi = aranmisAlanda ? null : bulunmaEkli(sehirAdi);
  const cekmeceOrtak = {
    havuz: havuzIdleri,
    mesgulId: cekmeceMesgul,
    onEkle: cekmecedenEkle,
    onCikar: cekmecedenCikar,
    onAc: cekmecedenAc,
    azMetni: genisletildi ? t('kesfet.cekmece.genis') : azOneri ? t('kesfet.cekmece.az') : null,
    // #579 KK3: gün bağlamında "+" "Bugüne ekle" / "Cuma'ya ekle" diye okunur.
    ekleEtiketi: gunBaglami ? gunEkleEtiketi(gunBaglami, bugunSirasi) : null,
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
  const seciliGuneAtanir = !!seciliMekan && !!gunBaglami && !seciliGunde(seciliMekan);
  // #317 KK1: bağlantı yokken tek uyarı; değilse son işlem hatası ve öneri hatası (429 dahil).
  // #317 inceleme 1: ekleme ve öneri hatası (429 dahil) 5 sn sonra ya da panel kapanınca kalkar; "Bağlantı yok" bağlantı dönünce.
  const [eklemeHatasiGorunur, eklemeHatasiniKapat] = useGeciciGorunur(!!hata, hata);
  const [oneriHatasiGorunur, oneriHatasiniKapat] = useGeciciGorunur(yakin.hata, yakin.sinir ? 'sinir' : 'hata');
  const oncekiSecim = useRef(secim);
  useEffect(() => {
    if (oncekiSecim.current && !secim) {
      eklemeHatasiniKapat();
      oneriHatasiniKapat();
    }
    oncekiSecim.current = secim;
  }, [secim, eklemeHatasiniKapat, oneriHatasiniKapat]);
  const hataMetinleri = cevrimdisi
    ? [t('geziSayfasi.cevrimdisi.baglantiYok')]
    : [eklemeHatasiGorunur ? hata : null, oneriHatasiGorunur ? (yakin.sinir ? t('yerler.gunlukSinir') : t('kesfet.oneriHata')) : null].filter(
        (m, i, a): m is string => !!m && a.indexOf(m) === i,
      );
  // #317 inceleme 2–3: arama sonuçları açıkken hata katmanı sonuçları örtmez; bütün hata kutuları (seçim hatası, 429,
  // "Bağlantı yok") sonuç listesinin altına iner. Kutular iki konumdan birinde hep çizildiği için 5 sn'lik süre, kutu
  // görünürken işler.
  const hataKutulari = hataMetinleri.map((m) => <HataKutusu key={m} metin={m} />);
  // #317 inceleme 3 (not): iOS duyurusu yalnız ilk görünüşte; kutu bir konumdan ötekine geçince (key/yeniden kurulum)
  // tekrar edilmez. Android'de accessibilityLiveRegion zaten okur.
  const hataAnahtari = hataMetinleri.join('\n');
  const duyurulanlar = useRef<string[]>([]);
  useEffect(() => {
    const simdiki = hataAnahtari ? hataAnahtari.split('\n') : [];
    if (Platform.OS === 'ios') for (const m of simdiki) if (!duyurulanlar.current.includes(m)) AccessibilityInfo.announceForAccessibility(m);
    duyurulanlar.current = simdiki;
  }, [hataAnahtari]);


  return (
    <HaritaEkrani
      // #274 KK2 (kanvas 29e): sol üstte ekran başlığı "Yer ekle" (geri oku yok; seyahatin evi alt menüdeki Gezi).
      baslik={t('kesfet.ekranBasligi')}
      baslikHapi
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
          <>
          <View style={[s.sonuclar, s.golge]}>
            {oneriler.isError ? <Text style={s.hataMetin}>{placesHatasi(oneriler.error, t('kesfet.araHata'))}</Text> : null}
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
          {hataKutulari.length > 0 ? <View testID="sonuc-alti-hata" style={s.sonucAltiHata}>{hataKutulari}</View> : null}
          </>
        ) : (
          <>
            {/* #164 KK3 (kanvas 9): Turistik · Yemek · Kafe · Park · Alışveriş · Tümü; varsayılan Turistik, tek seçim (kategori
                renginde glif). Öne çıkan / puan / yorum ve Müze · İbadet · Manzara alt seçenekleri filtre sayfasında. */}
            {/* #579 KK2 (kanvas `Dalga1_BuguneEkle`) hap aşağıda, çiplerin altında; gezi günü dışında #532 hapı. */}
            {gunBaglami && bugunSirasi === null ? (
              <View style={[s.gunHapi, s.golge, { backgroundColor: gunRengi(gunBaglami.index) }]}>
                <Text style={[s.gunHapiMetin, { color: gunUstuMetin(gunRengi(gunBaglami.index)) }]}>{t('kesfet.guneEkliyorsun', { n: gunBaglami.index })}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t('kesfet.gunSeciminiKaldir')} hitSlop={10} onPress={() => setGunBaglamiIndex(null)} style={s.gunHapiKapat}>
                  <Ikon ad="kapat" boyut={12} renk={gunUstuMetin(gunRengi(gunBaglami.index))} kalinlik={2.6} />
                </Pressable>
              </View>
            ) : null}
            <HizliCipler filtre={filtre} onFiltre={filtreyiDegistir} />
            {gunBaglami && bugunSirasi !== null ? (
              <View testID="gun-hapi" style={s.beyazHap}>
                <View style={[s.hapNokta, { backgroundColor: gunRengi(gunBaglami.index) }]} />
                <Text style={s.beyazHapMetin} numberOfLines={1}>
                  {gunHapiMetni(gunBaglami)}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t('kesfet.gunDegistirEtiket')} onPress={() => {
                    setAn(new Date());
                    setGunSecimiAcik(true);
                  }} style={({ pressed }) => [s.degistir, pressed && { opacity: 0.7 }]}>
                  <Text style={s.degistirMetin}>{t('kesfet.gunDegistir')}</Text>
                </Pressable>
              </View>
            ) : null}
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
            sehir={sehirBasligi}
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
            mesgul={!!seciliMekan && (geciciMi(seciliMekan) || atanan === seciliMekan.place_id)}
            onCta={() =>
              seciliMekan
                ? seciliGuneAtanir
                  ? listedekiniGuneAta(seciliMekan, mekanAdi(seciliMekan.place_id))
                  : listedenCikar(seciliMekan)
                : seciliHafif && listeyeEkle(seciliHafif, secimKaynagi(secim.kaynak))
            }
            // #579 inceleme 2: gün bağlamında düğme "Bugüne ekle" / "Cuma'ya ekle" der. #598 değişiklik 1: listedeki ama seçili günde
            // olmayan yerde de; yer seçili gündeyse "Listeden çıkar" kalır.
            ctaMetni={gunBaglami && (!seciliMekan || seciliGuneAtanir) ? gunEkleEtiketi(gunBaglami, bugunSirasi) : null}
            onYolTarifi={yolTarifi}
            onKapat={() => setSecim(null)}
          />
          ) : null}
          {gunBildirimi ? (
            <View style={s.gunBildirim} pointerEvents="none" accessibilityLiveRegion="polite">
              <Text style={s.gunBildirimMetin}>{gunBildirimi.metin}</Text>
            </View>
          ) : null}
          {geriAlinabilir.bekleyen ? (
            <GeriAlBandi metin={geriAlinabilir.bekleyen.metin} olay={geriAlinabilir.bekleyen} onGeriAl={geriAlinabilir.geriAl} alt={16} />
          ) : eklendiBildirimi ? (
            // #579 inceleme 7 (kanvas `Dalga1_BuguneEkle`): sekme çubuğunun 12 pt üstünde.
            <GeriAlBandi metin={eklendiBildirimi.metin} kesilen={eklendiBildirimi.ad} olay={eklendiBildirimi.sayac} onGeriAl={eklemeyiGeriAl} alt={12} yazili />
          ) : null}
          <GuneEkleSayfasi
            acik={gunSecimiAcik}
            ad={null}
            secenekler={gunSecenekleri}
            mesgul={false}
            baglamGunId={gunBaglami?.id ?? null}
            bugunIndex={bugunSirasi}
            bugun={bugunCekmece}
            kalsin={false}
            onSec={(o) => {
              setGunBaglamiIndex(o.gun.index);
              setGunSecimiAcik(false);
            }}
            onKapat={() => setGunSecimiAcik(false)}
          />
        </>
      }
      // #317 KK1: hatalar (ekleme, öneri, 429) ve "Bağlantı yok" çekmecenin ve panelin her halinde görünür.
      hata={hataMetinleri.length > 0 && !aramaAcik ? hataKutulari : null}
      harita={{
        merkez: ilkMerkez,
        zoom: ilkZoom,
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

/** #317 KK1: bugünkü hata kutusu (uyarı zemini); ekran okuyucuya duyurulur (iOS duyurusu ekranda, ilk görünüşte). */
function HataKutusu({ metin }: { metin: string }) {
  return (
    <View style={s.hataKutu} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={s.hataMetin}>{metin}</Text>
    </View>
  );
}

/** #317 KK4: panel seçiminin kaynağı → `yer_eklendi` kaynağı (listedeki pin zaten eklidir; öneri sayılır). */
function secimKaynagi(k: 'oneri' | 'arama' | 'liste' | 'pin' | 'rehber'): EklemeKaynagi {
  return k === 'liste' ? 'oneri' : k;
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.yuzey },
  // #532 KK4, kanvas `YerEkle_Gunle`: gün renginde 34 pt hap, 13 pt kalın metin, 24 pt ✕ dairesi.
  gunHapi: { alignSelf: 'flex-start', height: 34, paddingLeft: 14, paddingRight: 8, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  gunHapiMetin: { fontFamily: yazi.ekstra, fontSize: 13 },
  gunHapiKapat: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  // #579 KK2 (kanvas `Dalga1_BuguneEkle`): beyaz hap, en az 44 pt, köşe 22, sol 14 / sağ 6, gün renginde 8 pt nokta, 14/700 metin,
  // 44 pt "Değiştir" (14/800 Gece). Çiplerin altında 10 pt.
  beyazHap: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 44, borderRadius: 22, backgroundColor: renk.zemin, paddingLeft: 14, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, shadowColor: renk.metin, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3 },
  hapNokta: { width: 8, height: 8, borderRadius: 4 },
  beyazHapMetin: { flexShrink: 1, fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  degistir: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' },
  degistirMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  gunBildirim: { position: 'absolute', left: 12, right: 12, bottom: 16, minHeight: 56, paddingHorizontal: 16, borderRadius: 16, backgroundColor: renk.metin, justifyContent: 'center' },
  gunBildirimMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.zemin },
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
  sonucAltiHata: { marginTop: 10 },
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
