import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, LayoutAnimation, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { GrupPenceresi } from '@/components/davet/GrupPenceresi';
import { KatilimSayfasi } from '@/components/davet/KatilimSayfasi';
import { ProfilOnayi } from '@/components/davet/ProfilOnayi';
import { kutuRengi } from '@/components/gezi/GeziParcalari';
import { HaritaEkrani } from '@/components/harita/HaritaEkrani';
import type { HaritaOdagi, HaritaSigdirma } from '@/components/harita/tipler';
import { BacakSecici, BacakSegmenti, SECICI_GENISLIK } from '@/components/program/BacakSecici';
import { DurakKartlari } from '@/components/program/DurakKartlari';
import { GunKartlari, gunEtiketKisa, gunEtiketUzun, gunHucresi } from '@/components/program/GunKartlari';
import { GunOteliSayfasi } from '@/components/program/GunOteliSayfasi';
import { OtelSayfasi, OtelSeridi } from '@/components/program/OtelSayfasi';
import { OtelUcSatiri } from '@/components/program/OtelUcSatiri';
import { PlanHazirSayfasi, type PlanGunOzeti } from '@/components/program/PlanHazirSayfasi';
import { HarcamaFormu } from '@/components/harcama/HarcamaFormu';
import { GuneEkleSayfasi } from '@/components/listem/GuneEkleSayfasi';
import { MekanPaneli } from '@/components/mekan/MekanPaneli';
import { HaritaSeridi } from '@/components/plan/HaritaSeridi';
import { PlanListesi, type PlanSatirGorunumu } from '@/components/plan/PlanListesi';
import { PuanSayfasi } from '@/components/program/PuanSayfasi';
import { SecimMenusu, type SecimSecenegi } from '@/components/program/SecimMenusu';
import { SiralaListesi, type SiralaSatiri } from '@/components/program/SiralaListesi';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import type { Konaklama } from '@/features/konaklama/plan';
import { useDavetPaylas } from '@/features/davet/paylas';
import { OTEL_SERIT_ONEKI } from '@/features/konaklama/otelSeridi';
import { useGunOteliKaydet, useKonaklamalar, useTumGunlereOtel } from '@/features/konaklama/sorgular';
import { useDuragaAta, useDuraklar, useDurakKaldir, useGunEkle, useGunler, useGunSil } from '@/features/gunler/sorgular';
import { sehirEslestir, useSehirler, useSehirYerleri } from '@/features/icerik/sorgular';
import { useYereEkle } from '@/features/icerik/yerEkle';
import { useKonum, yakinDurakId } from '@/features/konum/useKonum';
import { gunSecenekleri as listemGunSecenekleri, type GunSecenegi } from '@/features/listem/listem';
import { useOylar } from '@/features/listem/sorgular';
import { useMekanGuncelle, useMekanlar, useMekanSil, useUyeler } from '@/features/mekanlar/sorgular';
import { aksamOnerisi, kmMetni, planSatirlari, YEMEK_RENGI, yurumeMetresi } from '@/features/plan/planListesi';
import { bacakSecimi, hapCifti, hapPinId, seciciBasligi, seciciSecenekleri } from '@/features/program/bacakSecimi';
import { kartKamerasi, kartListesi, odakKarti, type DurakKarti } from '@/features/program/durakKarti';
import { gunHapiVerisi, pinDokunusu } from '@/features/program/gunHapi';
import { programCizgileri, programPinleri } from '@/features/program/haritaVerisi';
import { bacakAnahtari, useBacakModlari, useBacakModuKaydet, useDurakGuncelle, useGunGuncelle, useSiraYaz, varislariTemizle, type MatrisNoktasi } from '@/features/program/sorgular';
import { gunDuraklari, saatKisa, useGunProgrami, useSimdi } from '@/features/program/useProgram';
import { useProgramVerisi } from '@/features/program/useProgramVerisi';
import { useBilinenMekanlar } from '@/features/gezi/bilinenMekanlar';
import { gunEtiketi, gunKartlari } from '@/features/gezi/geziOzeti';
import { geziyeGit } from '@/features/gezi/gezinti';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { usePuanKaydet, usePuanlar } from '@/features/puanlar/sorgular';
import { hafifOnbellek, useHafifYerler, useOnizleme } from '@/features/yerler/api';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni } from '@/lib/kategori';
import { mesafeMetni } from '@/lib/mesafe';
import { izBirak } from '@/lib/hataRaporu';
import { onayIste } from '@/lib/onay';
import { useOturum } from '@/lib/oturum';
import { AYLAR, GUNLER, haftaGunu, parcala, tarihEkle } from '@/lib/takvim';
import type { Durak, Gun, Mekan, Seyahat } from '@/lib/tipler';
import { kacinciGun, saatEkli, yerelAn, yerelSaatDk, yerelTarih } from '@/lib/zaman';
import { cizgiOrtasi, polylineCoz } from '@/lib/polyline';
import { gecikme } from '@/schedule/kaydir';
import { enUcuzEklemeIndeksi, yuruyusDk } from '@/schedule/program';
import { arasindaAnahtar } from '@/schedule/sira';
import { varsayilanSira } from '@/schedule/siralama';
import { bacakModu, dakikaSaat, kestirimTaksiSn, kestirimYuruyusSn, saatDakika, type BacakSecimi } from '@/schedule/tempo';
import { gunRengi, gunUstuMetin, kose, minDokunma, renk, yazi, yuzRenkleri } from '@/theme';

// PRD 3.3 KK3: 20 dk yürüyüş ≈ 1,5 km.
const YURUME_YARICAPI_M = 1500;
/** #140 KK2: sürükleme kaydı sonrası başlıkta "Kaydedildi ✓" bu kadar kalır. */
const KAYDEDILDI_MS = 4000;
/** #140 KK10: bu kadar ve üstü gecikmede "Saatleri kaydır" önerilir. */
const GERIDEYIZ_ESIGI_DK = 10;

/** #45 §3: alt panel üç hal. */
type PanelHali = 'katli' | 'yari' | 'tam';

/**
 * #42 Program v0.5 — tek ekran: harita + alt panel. Panel katlıyken tek satır özet (seyahat gününde canlı ilerleme);
 * yukarı çekilince çizelge (3.7) aynı panelde açılır. Pine dokununca panel "pin paneli"ne döner (gün atama, süre, detay).
 * #43: "Vardık" → "Tamamlandı" + otomatik tamamlanma; konumla sessiz varış kaydı.
 */
export default function ProgramEkrani() {
  const id = useSeyahatId();
  const { gun: gunParam, eklenenGun, eklenenDurak, eklenenMekan, atlanan, katildin, planKuruldu, atanmamis, otel: otelParam, n: istekNo, harita: haritaParam } = useLocalSearchParams<{
    /** #182: "1" → harita görünümü (Gezi sayfasının "Haritada gör"ü). */
    harita?: string;
    /** #181: Gezi sayfasından her istekte yeni; sekme zaten açıksa gün / otel / plan hazır isteği yeniden uygulanır. */
    n?: string;
    gun?: string;
    /** #193 KK4: gezi yeni seyahat olarak açıldı ("3 gün, 14 durak eklendi"). */
    eklenenGun?: string;
    eklenenDurak?: string;
    eklenenMekan?: string;
    atlanan?: string;
    katildin?: string;
    planKuruldu?: string;
    atanmamis?: string;
    otel?: string;
  }>();
  // #118 KK4: "Geziyi seyahatime al" sonrası bildirim ("3 durak eklendi · 11 mekan listende"; atlanan varsa eki).
  const [gezidenBildirim, setGezidenBildirim] = useState<string | null>(() => {
    const d = Number(eklenenDurak ?? 0);
    const m = Number(eklenenMekan ?? 0);
    if (!eklenenDurak && !eklenenMekan) return null;
    const ana = eklenenGun ? t('program.gezidenYeni', { gun: Number(eklenenGun), durak: d }) : d > 0 ? t('program.gezidenEklendi', { durak: d, mekan: m }) : t('program.gezidenEklendiListe', { mekan: m });
    const a = Number(atlanan ?? 0);
    return a > 0 ? `${ana} · ${t('gezi.cozumYok', { n: a })}` : ana;
  });
  useEffect(() => {
    if (!gezidenBildirim) return;
    const z = setTimeout(() => setGezidenBildirim(null), 4500);
    return () => clearTimeout(z);
  }, [gezidenBildirim]);
  const seyahat = useSeyahat(id);
  const gunler = useGunler(id);
  const duraklar = useDuraklar(id);
  const mekanlar = useMekanlar(id);
  const konaklamalar = useKonaklamalar(id);
  if (!id || !seyahat.data || !gunler.data || !duraklar.data || !mekanlar.data || !konaklamalar.data) {
    return <SeyahatYukleme sorgular={[seyahat, gunler, duraklar, mekanlar, konaklamalar]} kimlikYok={!id} />;
  }
  return (
    <>
      <ProgramSekmesi
        key={id}
        seyahat={seyahat.data}
        gunler={gunler.data}
        duraklar={duraklar.data}
        mekanlar={mekanlar.data}
        konaklamalar={konaklamalar.data}
        gunParam={gunParam}
        katildin={katildin === '1'}
        planKuruldu={planKuruldu === '1'}
        atanmamis={Number(atanmamis ?? 0)}
        otelAcik={otelParam === '1'}
        istekNo={istekNo}
        haritaAcik={haritaParam === '1'}
      />
      {gezidenBildirim ? (
        <View style={s.gezidenBildirim} pointerEvents="none">
          <Text style={s.gezidenBildirimMetin}>{gezidenBildirim}</Text>
        </View>
      ) : null}
    </>
  );
}

/** "Pazartesi 12 Ekim" / "1. gün". */
function gunBasligi(gun: Gun): string {
  if (!gun.date) return t('program.altTarihsiz');
  const { ay, gun: g } = parcala(gun.date);
  return `${GUNLER[haftaGunu(gun.date)]} ${g} ${AYLAR[ay - 1]}`;
}

function ProgramSekmesi({
  seyahat,
  gunler,
  duraklar,
  mekanlar,
  konaklamalar,
  gunParam,
  katildin,
  planKuruldu,
  atanmamis = 0,
  otelAcik,
  istekNo,
  haritaAcik,
}: {
  seyahat: Seyahat;
  gunler: Gun[];
  duraklar: Durak[];
  mekanlar: Mekan[];
  konaklamalar: Konaklama[];
  gunParam?: string;
  /** #137 KK1: davetle katılım sonrası "Katıldın ✓" alt sayfası. */
  katildin?: boolean;
  /** #139 KK6: sihirbazın "Planı kur"u sonrası "Plan hazır" alt sayfası; güne sığmayan mekan sayısı. */
  planKuruldu?: boolean;
  atanmamis?: number;
  /** #144: Seyahatler'deki "Otel yok" çipi "Nerede kalıyorsun?" sayfasıyla açar. */
  otelAcik?: boolean;
  istekNo?: string;
  haritaAcik?: boolean;
}) {
  const { session } = useOturum();
  const ekran = useWindowDimensions();
  const uyeler = useUyeler(seyahat.id);
  // #137 KK6: Grup penceresi (yüzlere dokununca); KK1 karşılama sayfası (bir kez, kapatınca kalkar).
  const [grupAcik, setGrupAcik] = useState(false);
  const [karsilamaAcik, setKarsilamaAcik] = useState(!!katildin);
  // #139 KK6–7: Plan hazır sayfası (bir kez); otel şeridi ("Şimdi değil" cihazda hatırlanır) ve "Nerede kalıyorsun?" sayfası.
  const [planHazirAcik, setPlanHazirAcik] = useState(!!planKuruldu);
  const davet = useDavetPaylas(seyahat);
  const [otelSeritGizli, setOtelSeritGizli] = useState<boolean | null>(null);
  const [nereKaliyorAcik, setNereKaliyorAcik] = useState(!!otelAcik);
  const tumGunlereOtel = useTumGunlereOtel(seyahat.id);
  useEffect(() => {
    AsyncStorage.getItem(OTEL_SERIT_ONEKI + seyahat.id)
      .then((v) => setOtelSeritGizli(v === '1'))
      .catch(() => setOtelSeritGizli(false));
  }, [seyahat.id]);
  const otelSeridiniGizle = () => {
    setOtelSeritGizli(true);
    AsyncStorage.setItem(OTEL_SERIT_ONEKI + seyahat.id, '1').catch(() => {});
  };
  const durakGuncelle = useDurakGuncelle(seyahat.id);
  const durakKaldir = useDurakKaldir(seyahat.id);
  const siraYaz = useSiraYaz(seyahat.id);
  const gunGuncelle = useGunGuncelle(seyahat.id);
  const gunEkle = useGunEkle(seyahat.id);
  const gunSil = useGunSil(seyahat.id);
  const ata = useDuragaAta(seyahat.id);
  const mekanGuncelle = useMekanGuncelle(seyahat.id);
  const mekanSil = useMekanSil(seyahat.id);

  const bugunIndex = kacinciGun(seyahat);
  // #120 KK4: hata kartı için iz — ekran kuruldu (gün, durak, mekan sayısı).
  useEffect(() => {
    izBirak('program', `kuruldu · gün ${gunler.length} · durak ${duraklar.length} · mekan ${mekanlar.length}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [seciliGunId, setSeciliGunId] = useState<string | null>(null);
  // #182 KK1: Plan sekmesi "liste önce"; harita (kanvas 10 · 12) "Haritayı aç" ya da "Sırayı düzenle" ile tam ekran açılır.
  // KK7: listede Google'a istek yok — yürüyüş / rota yalnız önbellekten, adlar DB'den ya da oturum önbelleğinden.
  const [gorunum, setGorunum] = useState<'liste' | 'harita'>(haritaAcik ? 'harita' : 'liste');
  // Harita Gezi'den ("Haritada gör") açıldıysa geri Gezi'ye döner, listeye değil.
  const [haritaGezidenAcildi, setHaritaGezidenAcildi] = useState(!!haritaAcik);
  const harita = gorunum === 'harita';
  // #181: sekme açıkken Gezi sayfasından gelen istek (gün kartı, "Otel seç", "Planı kur"); "önceki render" deseni — ilk
  // kurulumda useState başlangıçları zaten uygular.
  const [oncekiIstek, setOncekiIstek] = useState(istekNo);
  if (istekNo !== oncekiIstek) {
    setOncekiIstek(istekNo);
    const hedef = gunler.find((g) => String(g.index) === gunParam);
    if (hedef) setSeciliGunId(hedef.id);
    if (otelAcik) setNereKaliyorAcik(true);
    if (planKuruldu) setPlanHazirAcik(true);
    setGorunum(haritaAcik ? 'harita' : 'liste');
    setHaritaGezidenAcildi(!!haritaAcik);
  }
  const gun = gunler.find((g) => g.id === seciliGunId) ?? gunler.find((g) => String(g.index) === gunParam) ?? gunler.find((g) => g.index === bugunIndex) ?? gunler[0];
  const [panel, setPanel] = useState<PanelHali>('katli');
  const [puanDurakId, setPuanDurakId] = useState<string | null>(null);
  const [listeMenuAcik, setListeMenuAcik] = useState(false);
  // #56 §2: günün oteli alt sayfası.
  const [otelSayfasi, setOtelSayfasi] = useState(false);
  const gunOteliKaydet = useGunOteliKaydet(seyahat.id);
  const [seciliMekanId, setSeciliMekanId] = useState<string | null>(null);
  // #91 B: diğer gün noktasına dokunuldu → üstünde gün hapı (mekan kimliği); haritaya / başka pine dokununca kapanır.
  const [gunHapiMekanId, setGunHapiMekanId] = useState<string | null>(null);
  // #99: açık durak kartı (seçili günün durağı) + kamera odağı; son zoom bölge olayından (kart kamerası aynı ölçekte kalır).
  const [kartDurakId, setKartDurakId] = useState<string | null>(null);
  const [odak, setOdak] = useState<HaritaOdagi | undefined>(undefined);
  const sonZoom = useRef(15);
  const [menuDurak, setMenuDurak] = useState<Durak | null>(null);
  const [gunSecDurak, setGunSecDurak] = useState<Durak | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  // #55 §A5–6: başlık + gün seçici yüksekliği (harita sığdırma ve hap gizleme payı).
  const [ustYukseklik, setUstYukseklik] = useState(0);
  // #55 §C10: planlama aşamasında uzun basılan durak / mekan (Başka güne al · Günden çıkar · Listeden sil).
  const [uzunBasilan, setUzunBasilan] = useState<Mekan | null>(null);
  // #183 KK4: durak menüsünden "Harcama ekle" — form o durağa bağlı açılır.
  const [harcamaDuragi, setHarcamaDuragi] = useState<string | null>(null);
  // #140 KK2: sürükleme arka planda kaydedilince başlıkta "Kaydedildi ✓" (birkaç saniye).
  const [kaydedildi, setKaydedildi] = useState(0);
  useEffect(() => {
    if (!kaydedildi) return;
    const z = setTimeout(() => setKaydedildi(0), KAYDEDILDI_MS);
    return () => clearTimeout(z);
  }, [kaydedildi]);
  // #140: başlangıç saati seçimi (listede başlangıç satırının saatine dokununca).
  const [baslangicMenu, setBaslangicMenu] = useState(false);
  const qc = useQueryClient();

  // #101: bacak ulaşım türü — çift bazlı elle seçimler; açık seçici (harita hapı ya da panel satırı) ve o bacağın noktaları
  // (araba yolu yalnız seçici açıkken istenir, KK4).
  const modlar = useBacakModlari(seyahat.id);
  const bacakKaydet = useBacakModuKaydet(seyahat.id);
  const [acikBacak, setAcikBacak] = useState<{ from: MatrisNoktasi; to: MatrisNoktasi; kaynak: 'harita' | 'panel' } | null>(null);
  const verisi = useProgramVerisi({ seyahat, gunler, duraklar, mekanlar, seciliGun: gun, konaklamalar, modlar: modlar.data, aracBacagi: acikBacak, ag: harita });
  // #56: seçili günün başlangıç (otel) ve bitiş noktası.
  const { otel, seciliUclar } = verisi;
  const bitisOtel = seciliUclar.bitis ? { lat: seciliUclar.bitis.lat, lng: seciliUclar.bitis.lng } : null;
  const mekanIle = useMemo(() => new Map(mekanlar.map((m) => [m.id, m])), [mekanlar]);
  const durakIle = useMemo(() => new Map(duraklar.map((d) => [d.place_ref, d])), [duraklar]);
  const gunDurak = useMemo(() => (gun ? gunDuraklari(gun, duraklar) : []), [gun, duraklar]);
  const gunMekanlari = useMemo(() => gunDurak.map((d) => mekanIle.get(d.place_ref)).filter((m): m is Mekan => !!m), [gunDurak, mekanIle]);

  // Adlar canlı (PRD §7); günün durakları için saatler (KK5). Tek sorgu: saatli, tüm mekanlar.
  // #172: kartta ve pinde ★ puan (KK3); saatli maske Enterprise olduğu için puan ek maliyet getirmez.
  const yerler = useHafifYerler(
    harita ? mekanlar.map((m) => m.place_id) : [],
    { puan: true, saatler: true },
  );
  // #182 KK7: listede ad kaynağı (istek yok): harita açıldıysa places-light cevabı, değilse DB / oturum önbelleği, yoksa kategori.
  const bilinen = useBilinenMekanlar(useMemo(() => mekanlar.map((m) => m.place_id), [mekanlar]));
  const adGoster = (m: Mekan) => yerler.data?.[m.place_id]?.ad ?? bilinen.ad(m) ?? kategoriEtiketi(m.primary_type);
  const adi = (durakId: string) => {
    const d = duraklar.find((x) => x.id === durakId);
    const m = d ? mekanIle.get(d.place_ref) : undefined;
    return m ? adGoster(m) : '…';
  };
  // #139 KK6: Plan hazır özetleri — Program'ın kendi tempo hesabından (gün sırası, ilk durağın adı, yol dakikası).
  const planOzeti = useMemo(() => {
    const ozetler: PlanGunOzeti[] = [];
    const bosGunler: Gun[] = [];
    for (const g of [...gunler].sort((a, b) => a.index - b.index)) {
      const tp = verisi.tempolar.get(g.id);
      if (!tp || tp.durakSayisi === 0) {
        bosGunler.push(g);
        continue;
      }
      const ilk = tp.sira[0] ? mekanIle.get(tp.sira[0]) : undefined;
      ozetler.push({
        gun: g,
        durakSayisi: tp.durakSayisi,
        bas: tp.baslangic,
        bit: tp.bitis,
        yolDk: Math.round(tp.yuruyusDk + tp.taksiDk),
        araba: tp.taksiDk > 0,
        ilkAd: ilk ? adGoster(ilk) : '…',
      });
    }
    return { ozetler, bosGunler };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gunler, verisi.tempolar, mekanIle, yerler.data, bilinen]);
  const otelSeridi = konaklamalar.length === 0 && otelSeritGizli === false && gunler.length > 0;
  const uyeAdi = (uid: string | null) => {
    if (!uid) return '';
    if (uid === session?.user.id) return t('seyahatler.sen');
    return uyeler.data?.find((u) => u.user_id === uid)?.display_name ?? '';
  };

  // #42 KK7 / #43 KK4: yalnız seyahat gününde konum (ön plan izni).
  const bugun = !!gun && gun.index === bugunIndex;
  const an = useSimdi(true);
  const { konum, izin } = useKonum(bugun);
  const buradaId = useMemo(
    () => (konum ? yakinDurakId(konum, gunDurak.filter((d) => !d.skipped && !d.completed_at).map((d) => ({ id: d.id, konum: mekanIle.get(d.place_ref) ?? { lat: 0, lng: 0 } }))) : null),
    [konum, gunDurak, mekanIle],
  );
  const prog = useGunProgrami({ seyahat, gun, duraklar, mekanlar, yuruyus: verisi.yuruyus, an, buradaId: konum ? buradaId : undefined, uclar: seciliUclar, saatler: yerler.data });

  // T7: elle sıralanmamış günde §5.1 sırası gerçek yürüyüşle hesaplanır ve farklıysa yazılır (herkes aynı sırayı görür).
  const sonYazilan = useRef('');
  useEffect(() => {
    // #182: listede matris istenmez — kuş uçuşu kestirimiyle sıra yazılmasın (harita açılınca gerçek yürüyüşle yazılır).
    if (!harita || !gun || gun.order_manual || verisi.matrisYukleniyor || gunMekanlari.length < 2) return;
    const aktifler = gunDurak.filter((d) => !d.skipped);
    const noktalar = aktifler.map((d) => mekanIle.get(d.place_ref)).filter((m): m is Mekan => !!m);
    if (noktalar.length !== aktifler.length) return;
    // #56: -1 günün başlangıç oteli, -2 (taşınma günü) bitiş oteli.
    const { baslangic: bas, bitis: bit } = seciliUclar;
    const key = (i: number) => (i === -2 ? bit!.key : i < 0 ? bas!.key : noktalar[i].place_id);
    const konumu = (i: number) => (i === -2 ? bit! : i < 0 ? bas! : { lat: noktalar[i].lat, lng: noktalar[i].lng });
    const mesafe = (a: number, b: number) => verisi.yuruyus(key(a), key(b))?.sn ?? kestirimYuruyusSn(konumu(a), konumu(b));
    const sira = varsayilanSira(noktalar.length, mesafe, !!bas, !bit ? 'yok' : bas && bas.key === bit.key ? 'ayni' : 'ayri');
    const hedef = sira.map((i) => aktifler[i].id);
    const mevcut = aktifler.map((d) => d.id);
    const imza = `${gun.id}:${hedef.join(',')}`;
    if (hedef.join(',') === mevcut.join(',') || sonYazilan.current === imza) return;
    sonYazilan.current = imza;
    let onceki: string | undefined;
    const guncellemeler = [...hedef, ...gunDurak.filter((d) => d.skipped).map((d) => d.id)].map((id) => {
      const k = arasindaAnahtar(onceki, undefined);
      onceki = k;
      return { id, order_key: k };
    });
    siraYaz.mutateAsync(guncellemeler).catch(() => setHata(t('program.hata')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [harita, gun?.id, gun?.order_manual, verisi.matrisYukleniyor, gunDurak.map((d) => `${d.id}:${d.skipped}`).join(','), seciliUclar.baslangic?.key, seciliUclar.bitis?.key]);

  // #43 KK8: otomatik tamamlanma yazımı — planlanan bitişle, bir kez.
  const otomatikYazilan = useRef(new Set<string>());
  useEffect(() => {
    if (!prog || !prog.bugun || !gun?.date) return;
    for (const s of prog.canli.satirlar) {
      const d = gunDurak.find((x) => x.id === s.durak.id);
      if (!s.otomatik || !d || d.completed_at || otomatikYazilan.current.has(d.id)) continue;
      otomatikYazilan.current.add(d.id);
      durakGuncelle.mutateAsync({ id: d.id, completed_at: yerelAn(gun.date, s.ayrilisDk, seyahat.tz).toISOString(), completed_by: null, auto_completed: true }).catch(() => otomatikYazilan.current.delete(d.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prog?.canli, gun?.date]);

  // #140 KK9: bitmiş seyahatte (bitiş + 1 gün) gruba yazılmış varışlar silinir — zamanlayıcının yedeği, açılışta bir kez.
  useEffect(() => {
    if (!seyahat.end_date || tarihEkle(seyahat.end_date, 1) >= yerelTarih(new Date(), seyahat.tz)) return;
    if (!duraklar.some((d) => d.arrived_at)) return;
    varislariTemizle(seyahat.id).then((n) => {
      if (n > 0) qc.invalidateQueries({ queryKey: ['duraklar', seyahat.id] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seyahat.id]);

  // #43 KK4 → #140 KK9: konum durağın 100 m içine girince varış yazılır — grup görür ("vardı"), koordinat yazılmaz. Yalnız
  // sıradaki durağa: yolda yakınından geçilen ileri duraklara varış yazılmaz.
  const varisYazilan = useRef(new Set<string>());
  const siradakiId = prog?.canli.satirlar.find((x) => x.durum === 'siradaki' || x.durum === 'buradasin')?.durak.id ?? null;
  useEffect(() => {
    if (!buradaId || buradaId !== siradakiId) return;
    const d = gunDurak.find((x) => x.id === buradaId);
    if (!d || d.arrived_at || varisYazilan.current.has(d.id)) return;
    varisYazilan.current.add(d.id);
    durakGuncelle.mutateAsync({ id: d.id, arrived_at: new Date().toISOString(), arrived_by: session?.user.id ?? null }).catch(() => varisYazilan.current.delete(d.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buradaId, siradakiId]);

  // Seçili mekan (#80 mekan paneli). Mekan silinmişse panel kendiliğinden kapanır (türetilmiş).
  const seciliMekan = seciliMekanId ? mekanIle.get(seciliMekanId) : undefined;
  const puanlar = usePuanlar(seyahat.id);
  const puanKaydet = usePuanKaydet(seyahat.id);
  const puanim = (mekanId: string) => puanlar.data?.find((x) => x.place_ref === mekanId && x.user_id === session?.user.id) ?? null;

  // ---------------------------------------------------------------- eylemler
  const guvenli = async (is: () => Promise<unknown>) => {
    setHata(null);
    try {
      await is();
    } catch {
      setHata(t('program.hata'));
    }
  };
  const tamamla = (d: Durak, geriAl = false) =>
    guvenli(() =>
      durakGuncelle.mutateAsync(
        geriAl
          ? { id: d.id, completed_at: null, completed_by: null, auto_completed: false }
          : { id: d.id, completed_at: new Date().toISOString(), completed_by: session?.user.id ?? null, auto_completed: false },
      ),
    );
  const yolTarifi = (d: Durak, mod: 'yuruyus' | 'taksi' = 'yuruyus') => {
    const m = mekanIle.get(d.place_ref);
    if (!m) return;
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}&destination_place_id=${encodeURIComponent(m.place_id)}&travelmode=${mod === 'taksi' ? 'driving' : 'walking'}`,
    );
  };
  const guneAta = (mekan: Mekan, hedef: Gun) => {
    const mevcut = durakIle.get(mekan.id);
    if (mevcut && mevcut.day_id === hedef.id) return;
    const hedefDuraklar = duraklar.filter((d) => d.day_id === hedef.id).sort((a, b) => (a.order_key < b.order_key ? -1 : 1));
    // T7: elle sıralanmış günde en ucuz noktaya (o günün başlangıç/bitiş oteliyle, #56); otomatik günde sıra 3.7 akışında.
    const hu = verisi.gunUclari.get(hedef.id);
    const ekleIndeksi = hedef.order_manual
      ? enUcuzEklemeIndeksi(
          hedefDuraklar.filter((d) => !d.skipped).map((d) => mekanIle.get(d.place_ref)).filter((m): m is Mekan => !!m).map((m) => ({ key: m.place_id, konum: { lat: m.lat, lng: m.lng } })),
          { key: mekan.place_id, konum: { lat: mekan.lat, lng: mekan.lng } },
          hu?.baslangic ? { lat: hu.baslangic.lat, lng: hu.baslangic.lng } : null,
          verisi.yuruyus,
          { otelKey: hu?.baslangic?.key, bitis: hu?.bitis ? { key: hu.bitis.key, konum: { lat: hu.bitis.lat, lng: hu.bitis.lng } } : null },
        )
      : undefined;
    return guvenli(() => ata.mutateAsync({ mekan, gunId: hedef.id, mevcut, gunDuraklari: hedefDuraklar, ekleIndeksi }));
  };
  const baskaGuneAl = (d: Durak, hedef: Gun) => {
    const m = mekanIle.get(d.place_ref);
    if (m) return guneAta(m, hedef);
  };
  const atla = (d: Durak) => guvenli(() => durakGuncelle.mutateAsync({ id: d.id, skipped: !d.skipped }));
  const gundenCikar = async (d: Durak) => {
    const onay = await onayIste(t('program.menuCikar'), t('program.menuCikarMetin'), t('program.menuCikar'), t('genel.vazgec'));
    if (onay) guvenli(() => durakKaldir.mutateAsync(d.id));
  };
  const tasi = async (from: number, to: number) => {
    if (!gun || from === to) return;
    const liste = gunDurak.slice();
    const [eleman] = liste.splice(from, 1);
    liste.splice(to, 0, eleman);
    const order_key = arasindaAnahtar(liste[to - 1]?.order_key, liste[to + 1]?.order_key);
    // #53 §5 / #140 KK2: bırakınca numaralar, rota, saatler cihazda anında yeniden hesaplanır, satırlar animasyonla yer
    // değiştirir (iyimser önbellek); kayıt arka planda — Kaydet yok, başarıda başlıkta "Kaydedildi ✓".
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setKaydedildi(0);
    qc.setQueryData<Durak[]>(['duraklar', seyahat.id], (eski) => eski?.map((d) => (d.id === eleman.id ? { ...d, order_key } : d)));
    if (!gun.order_manual) qc.setQueryData<Gun[]>(['gunler', seyahat.id], (eski) => eski?.map((g) => (g.id === gun.id ? { ...g, order_manual: true } : g)));
    guvenli(async () => {
      await durakGuncelle.mutateAsync({ id: eleman.id, order_key });
      if (!gun.order_manual) await gunGuncelle.mutateAsync({ id: gun.id, order_manual: true });
      setKaydedildi(Date.now());
    });
  };
  const enKisaRotayaDiz = () => {
    if (!gun) return;
    sonYazilan.current = '';
    guvenli(() => gunGuncelle.mutateAsync({ id: gun.id, order_manual: false }));
  };
  const baslangicDegistir = (fark: number) => {
    if (!gun) return;
    const simdi = saatDakika(saatKisa(gun.start_time, saatKisa(seyahat.day_start, '09:00')));
    const yeni = Math.min(23 * 60, Math.max(5 * 60, simdi + fark));
    guvenli(() => gunGuncelle.mutateAsync({ id: gun.id, start_time: `${dakikaSaat(yeni)}:00` }));
  };
  const sureDegistir = (d: Durak, fark: number) => {
    const yeni = Math.min(480, Math.max(15, d.minutes + fark));
    if (yeni !== d.minutes) guvenli(() => durakGuncelle.mutateAsync({ id: d.id, minutes: yeni }));
  };
  const mekanSuresi = (m: Mekan, fark: number) => {
    const d = durakIle.get(m.id);
    if (d) return sureDegistir(d, fark);
    const yeni = Math.min(480, Math.max(15, m.default_minutes + fark));
    if (yeni !== m.default_minutes) guvenli(() => mekanGuncelle.mutateAsync({ id: m.id, default_minutes: yeni }));
  };
  const gunuSil = (g: Gun) => {
    if (gunler.length <= 1) {
      Alert.alert(t('gunler.sonGun'));
      return;
    }
    const n = duraklar.filter((d) => d.day_id === g.id).length;
    Alert.alert(t('gunler.gunSilBaslik', { gun: gunBasligi(g) }), n > 0 ? t('gunler.gunSilMetin', { n }) : t('gunler.gunSilMetinBos'), [
      { text: t('genel.vazgec'), style: 'cancel' },
      {
        text: t('gunler.gunuSil'),
        style: 'destructive',
        onPress: () => {
          if (seciliGunId === g.id) setSeciliGunId(null);
          guvenli(() => gunSil.mutateAsync({ gun: g, gunler, startDate: seyahat.start_date }));
        },
      },
    ]);
  };

  // #140 KK10 "Gerideyiz": yalnız konum açıkken. Buradaysan gerçek varış (arrived_at), yoldaysan şu an + kalan yol (kuş uçuşu
  // kestirimi, seçilen mod). "Saatleri kaydır": önceki durağın ayrılışı (ilk durakta günün başlangıcı) geri çekilir.
  const geriKalma = useMemo(() => {
    if (!prog?.bugun || prog.simdiDk === null || !konum) return null;
    const hedef = prog.canli.satirlar.find((x) => x.durum === 'siradaki' || x.durum === 'buradasin');
    if (!hedef) return null;
    const d = gunDurak.find((x) => x.id === hedef.durak.id);
    const varisDk = d?.arrived_at ? yerelSaatDk(new Date(d.arrived_at), seyahat.tz) : null;
    const kalanSn = hedef.yuruyus?.mod === 'taksi' ? kestirimTaksiSn(konum, hedef.durak.konum) : kestirimYuruyusSn(konum, hedef.durak.konum);
    const g = gecikme(prog.canli, { simdiDk: prog.simdiDk, buradaId: buradaId ?? null, varisDk, kalanDk: kalanSn / 60 });
    return g ? { ...g, burada: hedef.durum === 'buradasin' } : null;
  }, [prog, konum, gunDurak, buradaId, seyahat.tz]);
  const saatleriKaydir = () => {
    if (!geriKalma || !gun) return;
    const yeni = Math.round(geriKalma.yeniAyrilisDk);
    if (geriKalma.oncekiId && gun.date) {
      const id = geriKalma.oncekiId;
      guvenli(() => durakGuncelle.mutateAsync({ id, completed_at: yerelAn(gun.date!, yeni, seyahat.tz).toISOString(), completed_by: session?.user.id ?? null, auto_completed: false }));
    } else {
      guvenli(() => gunGuncelle.mutateAsync({ id: gun.id, start_time: `${dakikaSaat(Math.max(0, yeni))}:00` }));
    }
  };

  // #120 KK2: "Başka güne al" menüde hedef günleri doğrudan listeler ("Başka güne al → Cmt 17"); durağın kendi günü dışarıda.
  const guneAlSecenekleri = (d: Durak): SecimSecenegi[] =>
    gunler.filter((g) => g.id !== d.day_id).map((g) => ({ etiket: t('program.baskaGuneAlHedef', { gun: gunHucresi(g, 0).ust }), onPress: () => baskaGuneAl(d, g) }));
  // Uzun bas menüsü: Başka güne al → gün / Atla / Günden çıkar (+ Tamamlamayı geri al, #43 KK3).
  const menuSecenekleri: SecimSecenegi[] = menuDurak
    ? [
        ...(menuDurak.completed_at ? [{ etiket: t('program.tamamlamayiGeriAl'), onPress: () => tamamla(menuDurak, true) }] : []),
        ...guneAlSecenekleri(menuDurak),
        { etiket: menuDurak.skipped ? t('program.menuAtlama') : t('program.menuAtla'), onPress: () => atla(menuDurak) },
        { etiket: t('harcama.duraktanEkle'), onPress: () => setHarcamaDuragi(menuDurak.id) },
        { etiket: t('program.menuCikar'), onPress: () => gundenCikar(menuDurak), tehlike: true },
      ]
    : [];
  const gunSecenekleri: SecimSecenegi[] =
    gunSecDurak && gun
      ? gunler.filter((g) => g.id !== gun.id).map((g) => ({ etiket: `${t('program.guneAl', { n: g.index })} · ${gunBasligi(g)}`, onPress: () => baskaGuneAl(gunSecDurak, g) }))
      : [];

  // #55 §C10: planlama aşamasında (Bitti'ye basılmamış) durağa ya da pine uzun bas → Başka güne al · Günden çıkar ·
  // Listeden sil. Tamamlanmış durakta eski menü (Tamamlamayı geri al vb.).
  const uzunBas = (mekanId: string) => {
    const m = mekanIle.get(mekanId);
    if (!m) return;
    const d = durakIle.get(mekanId);
    if (d?.completed_at) {
      setMenuDurak(d);
      return;
    }
    setUzunBasilan(m);
  };
  const listedenSil = async (m: Mekan) => {
    const onay = await onayIste(t('program.listedenSil'), t('program.listedenSilMetin', { ad: yerler.data?.[m.place_id]?.ad ?? '…' }), t('program.listedenSil'), t('genel.vazgec'));
    if (!onay) return;
    if (seciliMekanId === m.id) setSeciliMekanId(null);
    guvenli(() => mekanSil.mutateAsync(m.id));
  };
  const uzunDurak = uzunBasilan ? durakIle.get(uzunBasilan.id) : undefined;
  const uzunBasMenusu: SecimSecenegi[] = uzunBasilan
    ? [
        ...(uzunDurak
          ? [
              ...guneAlSecenekleri(uzunDurak),
              { etiket: t('harcama.duraktanEkle'), onPress: () => setHarcamaDuragi(uzunDurak.id) },
              { etiket: t('program.menuCikar'), onPress: () => gundenCikar(uzunDurak) },
            ]
          : []),
        { etiket: t('program.listedenSil'), onPress: () => listedenSil(uzunBasilan), tehlike: true },
      ]
    : [];

  // #80 KK12: detay sayfası kalktı — liste satırı / menü "Detay" mekan panelini açar.
  const paneliAc = (mekanId: string) => {
    if (mekanIle.has(mekanId)) {
      setSeciliMekanId(mekanId);
    }
  };


  // ---------------------------------------------------------------- harita
  const satirlar = useMemo(() => prog?.canli.satirlar ?? [], [prog]);
  const tamamlananMekanIds = useMemo(() => {
    const s = new Set<string>();
    if (!prog?.bugun) return s;
    for (const x of satirlar) if (x.durum === 'gecildi') s.add(gunDurak.find((d) => d.id === x.durak.id)?.place_ref ?? '');
    return s;
  }, [prog?.bugun, satirlar, gunDurak]);
  // Geçilen bacak sayısı: baştan ardışık tamamlanan (atlanmamış) durak sayısı.
  let gecilenBacak = 0;
  if (prog?.bugun) for (const x of satirlar.filter((y) => y.durum !== 'atlandi')) if (x.durum === 'gecildi') gecilenBacak++; else break;
  // #99 KK1: seçili günün durak kartları (otel yok); açık kart durak silinince/taşınınca kendiliğinden kapanır (türetilmiş).
  const kartlar = useMemo(() => kartListesi({ gunDurak, mekanIle, adlar: yerler.data, satirlar }), [gunDurak, mekanIle, yerler.data, satirlar]);
  const acikKart = kartDurakId ? kartlar.find((k) => k.durakId === kartDurakId) : undefined;
  const kartAc = (durakId: string) => {
    const k = kartlar.find((x) => x.durakId === durakId);
    if (!k) return;
    setSeciliMekanId(null);
    setKartDurakId(durakId);
    // KK2: kamera pine yumuşak kayar; pin kartın üstünde kalır (merkez güneye kaydırılır).
    setOdak((o) => ({ ...kartKamerasi({ konum: k.konum, zoom: sonZoom.current, ekranYukseklik: ekran.height }), sayac: (o?.sayac ?? 0) + 1 }));
  };
  const kartKapat = () => setKartDurakId(null);
  const kartDuragi = (k: DurakKarti) => gunDurak.find((d) => d.id === k.durakId);
  // Kart açıkken pin iğne (#67) — mekan paneli seçimiyle aynı yol.
  const pinler = programPinleri({ gunUclari: verisi.gunUclari, mekanlar, duraklar, gunler, tempolar: verisi.tempolar, adlar: yerler.data, seciliGunId: gun?.id, seciliMekanId: seciliMekanId ?? acikKart?.mekanId ?? null, tamamlananMekanIds, konum });
  // #91 A: yalnız seçili günün rotası (diğer günler için hiçbir çizgi üretilmez).
  const cizgiler = programCizgileri({ gunler, tempolar: verisi.tempolar, seciliGunId: gun?.id, seciliNoktalar: verisi.seciliNoktalar, rotalar: verisi.rotalar, bacak: verisi.bacak, gecilenBacak });
  // #91 B: açık gün hapı — durak başka günde değilse (taşındı, silindi, gün değişti) kendiliğinden kapanır.
  const hapMekan = gunHapiMekanId ? mekanIle.get(gunHapiMekanId) : undefined;
  const gunHapi = gunHapiVerisi({
    mekanId: gunHapiMekanId,
    durak: gunHapiMekanId ? durakIle.get(gunHapiMekanId) : undefined,
    konum: hapMekan ? { lat: hapMekan.lat, lng: hapMekan.lng } : undefined,
    gunler,
    seciliGunId: gun?.id,
    hafif: hapMekan ? yerler.data?.[hapMekan.place_id] : undefined,
    dugme: t('program.guneGit'),
  });
  // KK2: "Güne git" — o günün sekmesine geç (rotası çizilir), dokunulan durak seçili pin (iğne) olur.
  const guneGit = (gunId: string, mekanId: string) => {
    setGunHapiMekanId(null);
    setSeciliGunId(gunId);
    setSeciliMekanId(mekanId);
  };

  // #55 §A5: gün seçilince ve panel hal değiştirince harita otel + günün duraklarını sığdırır; kenar boşluğu üstte
  // başlık + gün seçici, altta panel (harita dolgusu zaten panel yüksekliği kadar).
  const sigdirImza = gun && panel !== 'tam' ? `${gun.id}:${panel}:${ustYukseklik}:${gunMekanlari.map((m) => m.id).join(',')}` : '';
  const sigdirma = useMemo((): HaritaSigdirma | undefined => {
    if (!sigdirImza) return undefined;
    const noktalar = [...(otel ? [otel] : []), ...gunMekanlari.map((m) => ({ lat: m.lat, lng: m.lng })), ...(bitisOtel ? [bitisOtel] : [])];
    return noktalar.length ? { noktalar, ust: ustYukseklik + 16, alt: 24 } : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigdirImza]);

  // ---------------------------------------------------------------- üst
  const siradaki = satirlar.find((x) => x.durum === 'siradaki' || x.durum === 'buradasin');
  const puanlanmamis = satirlar.filter((x) => {
    if (x.durum !== 'gecildi') return false;
    const ref = gunDurak.find((d) => d.id === x.durak.id)?.place_ref;
    return !!ref && !puanim(ref);
  });
  // #140 KK5 (kanvas 10 · 12): sağ üstte plan modunda günün saat aralığı ("09:45 – 13:00", dokununca liste), gezi modunda
  // "● Bugün · N. gün"; yanında grup yüzleri (#137 Grup penceresi).
  const tempo = gun ? verisi.tempolar.get(gun.id) : undefined;
  const gunAraligi = gun && prog && tempo && tempo.durakSayisi > 0 ? `${dakikaSaat(prog.canli.baslangicDk)} – ${dakikaSaat(prog.canli.bitisDk)}` : null;
  const sagUst = (
    <View style={s.sagUst}>
      {prog?.bugun ? (
        <View style={[s.bugunCip, s.golge]}>
          <View style={s.bugunNokta} />
          <Text style={s.bugunMetin}>{t('program.bugunChip', { n: gun?.index ?? 1 })}</Text>
        </View>
      ) : gunAraligi ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('program.paneliAc')} onPress={() => setPanel('yari')} style={[s.saatCip, s.golge]}>
          <Text style={s.saatCipMetin}>{gunAraligi}</Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={t('seyahat.grup.baslik')} onPress={() => setGrupAcik(true)} style={[s.avatarlar, s.golge]}>
        {(uyeler.data ?? []).slice(0, 3).map((u, i) => (
          <View key={u.user_id} style={[s.avatarCerceve, i > 0 && { marginLeft: -8 }]}>
            <Avatar ad={u.display_name} url={u.photo_url} boyut={26} arkaPlan={yuzRenkleri[i % yuzRenkleri.length]} />
          </View>
        ))}
      </Pressable>
    </View>
  );

  // ---------------------------------------------------------------- panel
  const bittiMi = !!prog?.bugun && prog.simdiDk !== null && prog.canli.toplam > 0 && !siradaki;
  // #53 §5: katlı panelin üst kenarında yeşil ilerleme çizgisi (tamamlanan/toplam; seyahat günü dışında boş).
  const ilerleme = prog?.bugun && prog.canli.toplam > 0 ? prog.canli.tamamlanan / prog.canli.toplam : 0;
  // #53 §5 → #140 (kanvas 11): liste satırları — saat · numara · ad + "Kategori · süre · 10:51'e kadar"; aralarda bacak hapı,
  // açılışı bekleyen durakta sebepli boşluk çipi.
  let numara = 0;
  // #101 KK3: her satır için önceki noktanın anahtarı (başlangıç oteli → … ); atlanan durak zinciri bozmaz.
  const oncekiAnahtarlar: (string | null)[] = [];
  {
    let onceki: string | null = seciliUclar.baslangic?.key ?? null;
    for (const x of satirlar) {
      oncekiAnahtarlar.push(onceki);
      const d = gunDurak.find((dd) => dd.id === x.durak.id);
      const m = d ? mekanIle.get(d.place_ref) : undefined;
      if (x.durum !== 'atlandi' && m) onceki = m.place_id;
    }
  }
  const siralaSatirlari: SiralaSatiri[] = satirlar.map((x, i) => {
    const d = gunDurak.find((dd) => dd.id === x.durak.id);
    const m = d ? mekanIle.get(d.place_ref) : undefined;
    const atlandi = x.durum === 'atlandi';
    if (!atlandi) numara++;
    // Bacak kimliği = çift (önceki nokta → bu durak); geçilen bacakta seçici açılmaz (KK5).
    const oncekiKey = oncekiAnahtarlar[i];
    const bacakId = !atlandi && m && oncekiKey && !(prog?.bugun && x.durum === 'gecildi') ? bacakAnahtari(oncekiKey, m.place_id) : undefined;
    const kategori = kategoriEtiketi(yerler.data?.[m?.place_id ?? '']?.primary_type ?? m?.primary_type ?? null);
    const y = x.yuruyus;
    // #140 KK2: yeni çiftin süresi henüz yoksa hapta "hesaplanıyor…" (saatler o arada kuş uçuşu kestirimiyle akar).
    const hesaplaniyor = !!y && y.kestirim && (y.mod === 'taksi' ? verisi.matrisYukleniyor || verisi.rotaYukleniyor : verisi.matrisYukleniyor);
    return {
      id: x.durak.id,
      ad: (m && yerler.data?.[m.place_id]?.ad) || '…',
      saat: atlandi ? null : dakikaSaat(x.varisDk),
      alt: atlandi ? t('program.atlandi') : t('program.liste.satirAlt', { kategori, sure: sureMetni(d?.minutes ?? 0), saat: saatEkli(dakikaSaat(x.ayrilisDk), 'yonelme') }),
      numara: atlandi ? null : numara,
      tamam: prog?.bugun ? x.durum === 'gecildi' : false,
      vurgu: !!prog?.bugun && (x.durum === 'siradaki' || x.durum === 'buradasin'),
      atlandi,
      bacak: y
        ? { metin: hesaplaniyor ? t('program.liste.hesaplaniyor') : `${y.kestirim ? '~' : ''}${yuruyusDk(y)} dk · ${mesafeMetni(y.m)}`, ikon: y.mod === 'taksi' ? 'araba' : 'yurume', id: bacakId }
        : undefined,
      bosluk: x.bosluk ? t('program.liste.bosluk', { dk: x.bosluk.dk, saat: saatEkli(x.bosluk.saat, 'bulunma') }) : null,
    };
  });
  // #101: açık bacağın seçenekleri (yürüme matris/rota, araba rota `drive_seconds` — yoksa yükleniyor/kestirim) ve başlığı.
  const noktaIle = useMemo(() => new Map(verisi.seciliNoktalar.map((n) => [n.key, n])), [verisi.seciliNoktalar]);
  const bacakAc = (from: string, to: string, kaynak: 'harita' | 'panel') => {
    const a = noktaIle.get(from);
    const b = noktaIle.get(to);
    if (!a || !b) return;
    setAcikBacak((o) => (o && o.from.key === from && o.to.key === to && o.kaynak === kaynak ? null : { from: a, to: b, kaynak }));
  };
  const bacakKapat = () => setAcikBacak(null);
  const acikCift = acikBacak ? bacakAnahtari(acikBacak.from.key, acikBacak.to.key) : null;
  const acikSecenekler = acikBacak
    ? (() => {
        const a = { lat: acikBacak.from.lat, lng: acikBacak.from.lng };
        const b = { lat: acikBacak.to.lat, lng: acikBacak.to.lng };
        const c = verisi.yuruyus(acikBacak.from.key, acikBacak.to.key);
        return seciciSecenekleri({ yurumeSn: c?.sn ?? null, arabaSn: verisi.rotalar[acikCift!]?.drive_seconds ?? null, arabaKestirimSn: kestirimTaksiSn(a, b), arabaYukleniyor: verisi.aracYukleniyor, etkin: bacakModu(a, b, verisi.bacak(a, b)).mod });
      })()
    : [];
  const bacakAdi = (key: string): { no: number | 'O'; ad: string } => {
    if (key.startsWith('stay:')) return { no: 'O', ad: (key === seciliUclar.baslangic?.key ? seciliUclar.baslangic.konaklama.label : seciliUclar.bitis?.konaklama.label) ?? t('program.bacak.otel') };
    const satir = siralaSatirlari.find((x) => mekanIle.get(gunDurak.find((d) => d.id === x.id)?.place_ref ?? '')?.place_id === key);
    return { no: satir?.numara ?? 0, ad: satir?.ad ?? '…' };
  };
  const bacakSec = (mod: BacakSecimi) => {
    if (!acikBacak) return;
    const mevcut = bacakSecimi(modlar.data, { from: acikBacak.from.key, to: acikBacak.to.key });
    bacakKaydet.mutate({ from: acikBacak.from.key, to: acikBacak.to.key, mod: mevcut === mod ? 'otomatik' : mod });
    if (acikBacak.kaynak === 'harita') bacakKapat();
  };
  const seciciCizgisi = acikBacak?.kaynak === 'harita' && gun ? cizgiler.find((c) => c.id === `rota:${gun.id}:${acikCift}`) : undefined;
  const seciciKonum = seciciCizgisi ? cizgiOrtasi(seciciCizgisi.noktalar) : null;
  const siralaTasi = (from: number, to: number) => {
    const a = gunDurak.findIndex((d) => d.id === siralaSatirlari[from]?.id);
    const b = gunDurak.findIndex((d) => d.id === siralaSatirlari[to]?.id);
    if (a >= 0 && b >= 0) tasi(a, b);
  };
  const baslangicSaati = gun ? saatKisa(gun.start_time, saatKisa(seyahat.day_start, '09:00')) : '09:00';

  // Puanlanan durağın fotoğrafı.
  const puanDurak = puanDurakId ? gunDurak.find((d) => d.id === puanDurakId) : undefined;
  const puanMekan = puanDurak ? mekanIle.get(puanDurak.place_ref) : undefined;
  const puanFoto = useOnizleme(puanMekan?.place_id);
  const puanSatir = puanDurakId ? satirlar.find((x) => x.durak.id === puanDurakId) : undefined;

  // #80: mekan paneli (kanvas PlacePanel9) en üst katmanda; harita dolgusu değişmez. CTA seçili güne göre: güne ekle / günden çıkar.
  const seciliDurak = seciliMekan ? durakIle.get(seciliMekan.id) : undefined;
  const seciliGunde = !!seciliDurak && !!gun && seciliDurak.day_id === gun.id;
  const mekanPaneli = seciliMekan ? (
    <MekanPaneli
      placeId={seciliMekan.place_id}
      tz={seyahat.tz}
      hafif={yerler.data?.[seciliMekan.place_id]}
      ekleyenAd={uyeAdi(seciliMekan.added_by)}
      dakika={seciliDurak?.minutes ?? seciliMekan.default_minutes}
      onSure={(fark) => mekanSuresi(seciliMekan, fark)}
      baglam="program"
      icinde={seciliGunde}
      mesgul={ata.isPending || durakKaldir.isPending || mekanSil.isPending}
      onCta={() => (seciliGunde && seciliDurak ? gundenCikar(seciliDurak) : gun && guneAta(seciliMekan, gun))}
      onYolTarifi={() =>
        Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${seciliMekan.lat},${seciliMekan.lng}&destination_place_id=${encodeURIComponent(seciliMekan.place_id)}&travelmode=walking`,
        )
      }
      onKapat={() => setSeciliMekanId(null)}
      gunSecici={{ gunler, mevcutGunId: seciliDurak?.day_id ?? null, onGunSec: (g) => guneAta(seciliMekan, g) }}
    />
  ) : null;

  // #56 §1 → #140 (kanvas 11): listenin başlangıç / bitiş satırları (saat sütunu; otel yoksa kesikli "Otel ekle"). Başlangıç
  // saatine dokununca başlangıç saati seçimi.
  const bitisSaati = prog ? dakikaSaat(prog.canli.bitisDk) : '';
  const otelAdi = (u: typeof seciliUclar.baslangic) => (u ? (u.konaklama.label ?? t('otel.adsiz')) : null);
  const otelAc = () => setOtelSayfasi(true);
  const basOtelSatiri = <OtelUcSatiri tur="baslangic" ad={otelAdi(seciliUclar.baslangic)} saat={baslangicSaati} onPress={otelAc} onSaat={() => setBaslangicMenu(true)} />;
  const sonOtelSatiri =
    !seciliUclar.baslangic && !seciliUclar.bitis ? undefined : (
      <OtelUcSatiri
        tur={seciliUclar.bitis && seciliUclar.bitis.key === seciliUclar.baslangic?.key ? 'donus' : 'bitis'}
        ad={otelAdi(seciliUclar.bitis)}
        saat={bitisSaati}
        onPress={otelAc}
      />
    );
  const gunMerkezi = gunMekanlari.length
    ? { lat: gunMekanlari.reduce((a, m) => a + m.lat, 0) / gunMekanlari.length, lng: gunMekanlari.reduce((a, m) => a + m.lng, 0) / gunMekanlari.length }
    : null;
  // #140 KK4: güne atanmamış mekanlar haritada yok — listenin altında kesikli kutu → Listem (#141).
  const atanmamisSayisi = mekanlar.filter((m) => !durakIle.has(m.id)).length;
  const atanmamisKutusu =
    atanmamisSayisi > 0 ? (
      <Pressable accessibilityRole="button" onPress={() => router.navigate({ pathname: '/seyahat/[id]/listem', params: { id: seyahat.id } })} style={({ pressed }) => [s.atanmamis, pressed && { opacity: 0.7 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.atanmamisBaslik}>{t('program.liste.atanmamis', { n: atanmamisSayisi })}</Text>
          <Text style={s.atanmamisAlt}>{t('program.liste.atanmamisAlt')}</Text>
        </View>
        <View style={s.ileri}>
          <Ikon ad="geri" boyut={18} renk={renk.ana} kalinlik={2.6} />
        </View>
      </Pressable>
    ) : null;

  // #55 §B7 → #140 (kanvas 11): alt sayfa üst şeridi. Katlı: ilerleme çizgisi + "Sırayı gör ve düzenle ˄". Açık: gün karesi
  // (gün rengi) · "Cuma, 16 Ekim" · "09:45 – 13:00 · 3 durak · 26 dk yol" · ··· · [Haritaya dön] + "Kaydedildi ✓".
  const yolDk = prog ? prog.canli.satirlar.reduce((t0, x) => t0 + (x.yuruyus ? yuruyusDk(x.yuruyus) : 0), 0) + (prog.canli.oteleDonus ? yuruyusDk(prog.canli.oteleDonus) : 0) : 0;
  const listeOzeti =
    prog && prog.canli.toplam > 0
      ? t('program.liste.ozet', { bas: dakikaSaat(prog.canli.baslangicDk), bit: dakikaSaat(prog.canli.bitisDk), n: prog.canli.toplam, yol: yolDk })
      : t('program.liste.ozetBos');
  const ustSerit = (
    <View style={s.serit}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={panel === 'katli' ? t('program.paneliAc') : t('program.paneliKapat')}
        onPress={() => setPanel((h) => (h === 'katli' ? 'yari' : 'katli'))}
        hitSlop={8}
        style={s.tutamakDokunma}>
        {panel === 'katli' ? (
          <View style={s.ilerlemeIz}>
            <View style={[s.ilerlemeDolu, { width: `${Math.round(ilerleme * 100)}%` }]} />
          </View>
        ) : (
          <View style={s.tutamakCizgi} />
        )}
      </Pressable>
      {panel === 'katli' ? (
        // #53 §5: katlı = "Sırayı gör ve düzenle" + ˄ (dokununca yarı açık).
        <Pressable accessibilityRole="button" accessibilityLabel={t('program.paneliAc')} onPress={() => setPanel('yari')} style={s.seritSatir}>
          <Text style={s.katliMetin}>{t('program.sirayiGor')}</Text>
          <Ikon ad="yukari" boyut={20} renk={renk.ana} kalinlik={2.4} />
        </Pressable>
      ) : (
        <View style={s.listeBaslik}>
          {gun ? (
            <View style={[s.gunKare, { backgroundColor: gunRengi(gun.index) }]}>
              <Text style={[s.gunKareMetin, { color: gunUstuMetin(gunRengi(gun.index)) }]}>{gun.index}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.listeGun} numberOfLines={1}>
              {gun ? gunEtiketUzun(gun) : ''}
            </Text>
            <Text style={s.listeOzet} numberOfLines={1}>
              {listeOzeti}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('program.diger')} onPress={() => setListeMenuAcik(true)} style={s.ikonDugme}>
            <Ikon ad="daha" boyut={20} renk={renk.ana} kalinlik={2.4} />
          </Pressable>
          <View style={s.haritayaDonKap}>
            <Pressable accessibilityRole="button" onPress={() => setPanel('katli')} style={({ pressed }) => [s.haritayaDon, pressed && { opacity: 0.8 }]}>
              <Text style={s.haritayaDonMetin}>{t('program.liste.haritayaDon')}</Text>
            </Pressable>
            {kaydedildi ? <Text style={s.kaydedildi}>{t('program.liste.kaydedildi')}</Text> : null}
          </View>
        </View>
      )}
    </View>
  );
  const ustUyari = (verisi.matrisHata ? 20 : 0) + (hata ? 20 : 0) + (bugun && izin === 'reddedildi' ? 20 : 0);
  const govde = (yukseklik: number) =>
    panel === 'katli' || !gun || !prog ? null : (
      <>
        {verisi.matrisHata ? <Text style={s.uyariMetin}>{t('program.yuruyusHata')}</Text> : null}
        {bugun && izin === 'reddedildi' ? <Text style={s.uyariMetin}>{t('program.konumIzni')}</Text> : null}
        {hata ? <Text style={s.hata}>{hata}</Text> : null}
        {siralaSatirlari.length === 0 ? (
          <View style={{ gap: 10 }}>
            {basOtelSatiri}
            <Text style={s.uyariMetin}>{t('program.ozetGunBos', { gun: gunEtiketKisa(gun) })}</Text>
            {atanmamisKutusu}
          </View>
        ) : (
          <SiralaListesi
            satirlar={siralaSatirlari}
            bas={basOtelSatiri}
            son={sonOtelSatiri}
            alt={atanmamisKutusu}
            yukseklik={Math.max(120, yukseklik - ustUyari)}
            numaraRengi={gunRengi(gun.index)}
            acikBacakId={acikBacak?.kaynak === 'panel' ? acikCift : null}
            onBacakBas={(id) => {
              const i = id.indexOf('>');
              if (i > 0) bacakAc(id.slice(0, i), id.slice(i + 1), 'panel');
            }}
            bacakSecici={acikBacak ? <BacakSegmenti mesafe={verisi.yuruyus(acikBacak.from.key, acikBacak.to.key)?.m !== undefined ? mesafeMetni(verisi.yuruyus(acikBacak.from.key, acikBacak.to.key)!.m) : null} secenekler={acikSecenekler} onSec={bacakSec} /> : null}
            onTasi={siralaTasi}
            onSatirBas={(durakId) => {
              const d = gunDurak.find((x) => x.id === durakId);
              if (d) setSeciliMekanId(d.place_ref);
            }}
            onUzunBas={(durakId) => {
              const d = gunDurak.find((x) => x.id === durakId);
              if (d) uzunBas(d.place_ref);
            }}
          />
        )}
      </>
    );

  // #140 KK10: gezi modunda gün çiplerinin altında "Plana göre 15 dk gerideyiz · Saatleri kaydır" (≥ 10 dk); buradayken az
  // gecikmede yalnız bilgi ("· sorun yok").
  const geriBandi =
    geriKalma && (geriKalma.dk >= GERIDEYIZ_ESIGI_DK || geriKalma.burada) ? (
      <View style={[s.geriBant, s.golgeHafif]}>
        <Text style={s.geriMetin} numberOfLines={1}>
          {geriKalma.dk >= GERIDEYIZ_ESIGI_DK ? t('program.gerideyiz', { dk: geriKalma.dk }) : t('program.gerideyizSorunYok', { dk: geriKalma.dk })}
        </Text>
        {geriKalma.dk >= GERIDEYIZ_ESIGI_DK ? (
          <Pressable accessibilityRole="button" onPress={saatleriKaydir} style={({ pressed }) => [s.geriDugme, pressed && { opacity: 0.85 }]}>
            <Text style={s.geriDugmeMetin}>{t('program.saatleriKaydir')}</Text>
          </Pressable>
        ) : null}
      </View>
    ) : null;

  // #140 KK8: saate göre odak — açılışta (bir kez) gezi gününde buradasın / sıradaki durağın kartı öne gelir (kamera kayar);
  // plan gününde ilk durağın kartı açılır (harita günü sığdırmaya devam eder).
  const [odakAcildi, setOdakAcildi] = useState(false);
  if (harita && !odakAcildi && kartlar.length > 0 && prog) {
    setOdakAcildi(true);
    const k = odakKarti(kartlar, prog.bugun);
    if (k) {
      setKartDurakId(k.durakId);
      if (prog.bugun) setOdak({ ...kartKamerasi({ konum: k.konum, zoom: 15, ekranYukseklik: ekran.height }), sayac: 1 });
    }
  }

  // ---------------------------------------------------------------- #182 Plan listesi (kanvas 24)
  const oylar = useOylar(seyahat.id);
  const sehirler = useSehirler();
  const sehir = sehirEslestir(sehirler.data, { ad: seyahat.city_label, lat: seyahat.lat, lng: seyahat.lng });
  const sehirYerleri = useSehirYerleri(sehir?.id);
  // Rehber yeri listeye `useYereEkle` ile (yer_eklendi olayı yazılır).
  const yereEkle = useYereEkle();
  // KK5: "Öner" → Güne ekle (13b). Rehberden gelen yer önce listeye eklenir; liste yenilenince sayfa onunla açılır.
  const [guneEkleId, setGuneEkleId] = useState<string | null>(null);
  const [bekleyenPlaceId, setBekleyenPlaceId] = useState<string | null>(null);
  const guneEkleMekan = guneEkleId ? mekanIle.get(guneEkleId) : bekleyenPlaceId ? mekanlar.find((m) => m.place_id === bekleyenPlaceId) : undefined;
  const guneEkleSecenekleri = useMemo(
    () => (guneEkleMekan ? listemGunSecenekleri({ seyahat, mekan: guneEkleMekan, gunler, duraklar, mekanIle, gunUclari: verisi.gunUclari, yuruyus: verisi.yuruyus }) : []),
    [guneEkleMekan, seyahat, gunler, duraklar, mekanIle, verisi.gunUclari, verisi.yuruyus],
  );
  const guneEkleKapat = () => {
    setGuneEkleId(null);
    setBekleyenPlaceId(null);
  };
  const guneEkle = async (o: GunSecenegi) => {
    if (!guneEkleMekan) return;
    try {
      await ata.mutateAsync({
        mekan: guneEkleMekan,
        gunId: o.gun.id,
        mevcut: durakIle.get(guneEkleMekan.id),
        gunDuraklari: duraklar.filter((d) => d.day_id === o.gun.id),
        ekleIndeksi: o.gun.order_manual ? o.ekleIndeksi : undefined,
      });
      guneEkleKapat();
    } catch {
      setHata(t('program.hata'));
    }
  };
  const planSatir = useMemo(() => planSatirlari(gunDurak, mekanIle, satirlar), [gunDurak, mekanIle, satirlar]);
  const oySayisi = useMemo(() => {
    const n = new Map<string, number>();
    for (const o of oylar.data ?? []) n.set(o.mekan, (n.get(o.mekan) ?? 0) + 1);
    return n;
  }, [oylar.data]);
  const ilkEtkin = planSatir.find((r) => r.numara !== null);
  // Kanvas 24: bizim rehberimizde yazısı olan mekanın alt satırında "Mekan rehberi var".
  const rehberliYerler = useMemo(() => new Set((sehirYerleri.data ?? []).filter((y) => y.place_id && y.rehber_md?.trim()).map((y) => y.place_id!)), [sehirYerleri.data]);
  const satirGorunumleri: PlanSatirGorunumu[] = planSatir.map((r) => {
    const puan = (yerler.data?.[r.mekan.place_id] ?? hafifOnbellek.oku(r.mekan.place_id, ['puan']))?.puan ?? null;
    const oy = oySayisi.get(r.mekan.id) ?? 0;
    // Ad bilinmiyorsa başlık zaten kategori; alt satırda tekrar etmez.
    const adBilinen = !!(yerler.data?.[r.mekan.place_id]?.ad ?? bilinen.ad(r.mekan));
    const alt = [
      adBilinen ? kategoriEtiketi(r.mekan.primary_type) : null,
      puan ? `★ ${puan.toFixed(1).replace('.', ',')}` : null,
      oy > 0 ? t('plan.oy', { n: oy }) : null,
      r.mekan.added_by && r.mekan.added_by !== session?.user.id ? t('plan.onerdi', { ad: uyeAdi(r.mekan.added_by) }) : null,
      rehberliYerler.has(r.mekan.place_id) ? t('plan.rehberVar') : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const dk = r.gelis ? yuruyusDk(r.gelis) : 0;
    const dkMetni = `${r.gelis?.kestirim ? '~' : ''}${dk}`;
    const otelden = r === ilkEtkin && !!seciliUclar.baslangic;
    return {
      id: r.durak.id,
      mekanId: r.mekan.id,
      numara: r.numara,
      numaraRengi: r.yemek ? YEMEK_RENGI : gunRengi(gun?.index ?? 1),
      saat: r.varisDk !== null && r.ayrilisDk !== null ? `${dakikaSaat(r.varisDk)} – ${dakikaSaat(r.ayrilisDk)}` : null,
      sure: sureMetni(r.durak.minutes),
      ad: adGoster(r.mekan),
      alt,
      foto: bilinen.foto(r.mekan.place_id),
      fotoZemin: kutuRengi(r.mekan.primary_type),
      gelis: r.gelis
        ? { metin: otelden ? t('plan.otelden', { dk: dkMetni }) : r.gelis.mod === 'taksi' ? t('plan.dkArac', { dk: dkMetni }) : t('plan.dk', { dk: dkMetni }), araba: r.gelis.mod === 'taksi' }
        : null,
      vurgulu: !!prog?.bugun && (r.durum === 'buradasin' || r.durum === 'siradaki'),
      gecildi: !!prog?.bugun && r.durum === 'gecildi',
      atlandi: r.numara === null,
    };
  });
  // KK3: şerit — yalnız bu günün koordinatları; önbellekte gerçek yol çizgisi varsa o, yoksa noktalar düz bağlanır.
  const seritNoktalari = [
    ...(seciliUclar.baslangic ? [{ key: seciliUclar.baslangic.key, konum: { lat: seciliUclar.baslangic.lat, lng: seciliUclar.baslangic.lng } }] : []),
    ...planSatir.filter((r) => r.numara !== null).map((r) => ({ key: r.mekan.place_id, konum: { lat: r.mekan.lat, lng: r.mekan.lng } })),
    ...(seciliUclar.bitis && planSatir.some((r) => r.numara !== null) ? [{ key: seciliUclar.bitis.key, konum: { lat: seciliUclar.bitis.lat, lng: seciliUclar.bitis.lng } }] : []),
  ];
  const seritCizgileri = seritNoktalari.slice(1).map((b, i) => {
    const a = seritNoktalari[i];
    const kodlu = verisi.rotalar[`${a.key}>${b.key}`]?.polyline;
    return kodlu ? polylineCoz(kodlu) : [a.konum, b.konum];
  });
  const seritEtiketi =
    prog && planSatir.some((r) => r.numara !== null)
      ? t('plan.seritEtiket', { bas: dakikaSaat(prog.canli.baslangicDk), bit: dakikaSaat(prog.canli.bitisDk), km: kmMetni(yurumeMetresi(planSatir, prog.canli.oteleDonus)) })
      : null;
  const aksam = useMemo(() => aksamOnerisi({ satirlar: planSatir, mekanlar, duraklar, yerler: sehirYerleri.data ?? [] }), [planSatir, mekanlar, duraklar, sehirYerleri.data]);
  const aksamOner = async () => {
    if (!aksam) return;
    if (aksam.liste) return setGuneEkleId(aksam.liste.id);
    const y = aksam.rehber!;
    try {
      await yereEkle.mutateAsync({ seyahatId: seyahat.id, yerId: y.id, place_id: y.place_id, primary_type: y.kategori, lat: y.lat, lng: y.lng });
      setBekleyenPlaceId(y.place_id);
    } catch {
      setHata(t('program.hata'));
    }
  };
  const aksamMetni = aksam
    ? aksam.liste && aksam.rehber
      ? t('plan.aksamIkisi', { rehber: aksam.rehber.ad, liste: adGoster(aksam.liste) })
      : aksam.liste
        ? t('plan.aksamListe', { liste: adGoster(aksam.liste) })
        : t('plan.aksamRehber', { rehber: aksam.rehber!.ad })
    : null;
  const gunTemasi = gun ? gunKartlari({ gunler: [gun], duraklar, mekanlar, tempolar: verisi.tempolar, ad: (m) => yerler.data?.[m.place_id]?.ad ?? bilinen.ad(m) })[0]?.tema : null;
  const gunAdiUzun = gun?.date ? GUNLER[haftaGunu(gun.date)] : gun ? t('geziSayfasi.gunNo', { n: gun.index }) : '';
  const haritayiAc = () => {
    setHaritaGezidenAcildi(false);
    setGorunum('harita');
  };
  const sirayiDuzenle = () => {
    haritayiAc();
    setPanel('tam');
  };
  const haritaKapat = useCallback(() => {
    setKartDurakId(null);
    setAcikBacak(null);
    setPanel('katli');
    setGorunum('liste');
    if (haritaGezidenAcildi) {
      setHaritaGezidenAcildi(false);
      geziyeGit(seyahat.id);
    }
  }, [haritaGezidenAcildi, seyahat.id]);
  // Android geri tuşu haritadan listeye döner.
  useEffect(() => {
    if (!harita) return;
    const abonelik = BackHandler.addEventListener('hardwareBackPress', () => {
      haritaKapat();
      return true;
    });
    return () => abonelik.remove();
  }, [harita, haritaKapat]);

  const listeGorunumu = harita ? null : (
    <PlanListesi
      baslik={seyahatAdi(seyahat)}
      uyeler={uyeler.data ?? []}
      onGeri={() => geziyeGit(seyahat.id)}
      onGrup={() => setGrupAcik(true)}
      onSirala={sirayiDuzenle}
      gunler={[...gunler].sort((a, b) => a.index - b.index)}
      seciliGunId={gun?.id}
      gunEtiketi={gunEtiketi}
      gunRengi={(g) => gunRengi(g.index)}
      durakSayisi={(g) => duraklar.filter((d) => d.day_id === g.id && !d.skipped).length}
      onGunSec={(g) => setSeciliGunId(g.id)}
      onGunUzunBas={gunuSil}
      onGunEkle={() => guvenli(() => gunEkle.mutateAsync({ gunler, startDate: seyahat.start_date }))}
      serit={
        gun ? (
          <HaritaSeridi
            pinler={planSatir
              .filter((r) => r.numara !== null)
              .map((r) => ({ id: r.durak.id, konum: { lat: r.mekan.lat, lng: r.mekan.lng }, numara: r.numara!, renk: r.yemek ? YEMEK_RENGI : gunRengi(gun.index) }))}
            otel={seciliUclar.baslangic ? { lat: seciliUclar.baslangic.lat, lng: seciliUclar.baslangic.lng } : null}
            cizgiler={seritCizgileri}
            cizgiRengi={gunRengi(gun.index)}
            etiket={seritEtiketi}
            onAc={haritayiAc}
          />
        ) : null
      }
      gun={
        gun
          ? {
              renk: gunRengi(gun.index),
              index: gun.index,
              baslik: gunTemasi ? `${gunAdiUzun} · ${gunTemasi}` : gunAdiUzun,
              cikis: seciliUclar.baslangic ? t('plan.otelCikis', { saat: baslangicSaati }) : t('plan.cikis', { saat: baslangicSaati }),
              onCikis: () => setBaslangicMenu(true),
            }
          : null
      }
      satirlar={satirGorunumleri}
      onDurak={(mekanId) => setSeciliMekanId(mekanId)}
      onDurakUzunBas={uzunBas}
      aksam={aksamMetni ? { kalin: t('plan.aksam'), metin: aksamMetni, onOner: () => void aksamOner() } : null}
      bos={gun && planSatir.length === 0 ? { metin: t('plan.gunBos'), dugme: t('plan.mekanEkle'), onPress: () => router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: { id: seyahat.id } }) } : null}
      uyari={bugun && izin === 'reddedildi' ? t('program.konumIzni') : hata}
    />
  );

  return (
    <>
      {listeGorunumu ?? (
      <HaritaEkrani
        // #140 (kanvas 10) / #141 KK1: sol üstte "‹ {seyahat adı}" hapı. #182: harita Plan listesinden açılır; geri → liste.
        baslik={t('plan.baslik')}
        geri={haritaKapat}
        sagUst={
          <View style={s.sagUst}>
            {panel === 'tam' && !seciliMekan ? (
              // Tam ekranda sağ üstte beyaz harita düğmesi.
              <Pressable accessibilityRole="button" accessibilityLabel={t('program.haritadaGor')} onPress={() => setPanel('katli')} style={[s.haritaDugme, s.golge]}>
                <Ikon ad="harita" boyut={20} renk={renk.ana} kalinlik={2.2} />
              </Pressable>
            ) : null}
            {sagUst}
          </View>
        }
        altMenuVar
        onUstYukseklik={setUstYukseklik}
        altSerbest={
          panel !== 'tam' && !seciliMekan ? (
            <>
              {panel === 'katli' && bittiMi && puanlanmamis.length > 0 ? (
                <View style={s.puanlaSatir} pointerEvents="box-none">
                  <Pressable accessibilityRole="button" onPress={() => setPuanDurakId(puanlanmamis[0].durak.id)} style={[s.puanlaHap, s.golge]}>
                    <Text style={s.puanlaHapMetin}>{t('program.ilkiniPuanla')}</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : null
        }
        altSayfa={{ hal: panel, onHal: setPanel, ust: ustSerit, govde }}
        ustEk={
          <View>
            <GunKartlari
              gunler={gunler}
              duraklar={duraklar}
              seciliId={gun?.id}
              bugunIndex={bugunIndex}
              onSec={(id) => {
                setGunHapiMekanId(null);
                setKartDurakId(null);
                setAcikBacak(null);
                setSeciliGunId(id);
              }}
              onUzunBas={gunuSil}
              onEkle={() => guvenli(() => gunEkle.mutateAsync({ gunler, startDate: seyahat.start_date }))}
              ekleniyor={gunEkle.isPending}
            />
            {geriBandi}
            {otelSeridi ? <OtelSeridi onPress={() => setNereKaliyorAcik(true)} /> : null}
          </View>
        }
        altSayfaGizli={!!seciliMekan || !!acikKart}
        ustKatman={
          <>
            {acikKart && gun ? (
              <DurakKartlari
                kartlar={kartlar}
                seciliDurakId={acikKart.durakId}
                gezi={!!prog?.bugun}
                tz={seyahat.tz}
                konum={konum}
                onSec={kartAc}
                onRehber={(k) => paneliAc(k.mekanId)}
                onYolTarifi={(k) => {
                  const d = kartDuragi(k);
                  const satir = satirlar.find((x) => x.durak.id === k.durakId);
                  if (d) yolTarifi(d, satir?.yuruyus?.mod);
                }}
                onMenu={(k) => {
                  const d = kartDuragi(k);
                  if (d) setMenuDurak(d);
                }}
                onKapat={kartKapat}
              />
            ) : null}
            {mekanPaneli}
          </>
        }
        harita={{
          merkez: otel ?? { lat: seyahat.lat, lng: seyahat.lng },
          zoom: otel ? 14 : 13,
          pinler,
          cizgiler,
          sigdir: sigdirma,
          // #55 §A6: başlık alanına düşen rota hapları gizlenir.
          ustBosluk: ustYukseklik,
          // #55 §C10: pine uzun bas → menü.
          onPinUzunBas: (pinId) => {
            if (pinId.startsWith('m:')) uzunBas(pinId.slice(2));
          },
          daireler: otel ? [{ id: 'yurume', merkez: otel, yaricapM: YURUME_YARICAPI_M, renk: renk.metin }] : [],
          // KK6: pine dokununca harita kaymaz (Harita bileşeni), panel pin paneline döner.
          onPinBas: (pinId) => {
            // #101 KK2: bacak hapına dokunma → seçici hapın üstünde (geçilen bacakta hap yok → açılmaz).
            if (pinId.startsWith('bacak:')) {
              const cift = gun ? hapCifti(pinId, gun.id) : null;
              if (cift) bacakAc(cift.from, cift.to, 'harita');
              return;
            }
            // #91 KK3: başka pine dokununca hap kapanır (aynı noktaya ikinci dokunuş aşağıda "Güne git").
            if (!pinId.startsWith('m:') || pinId.slice(2) !== gunHapiMekanId) setGunHapiMekanId(null);
            // #56: ev pinine dokununca günün oteli alt sayfası.
            if (pinId.startsWith('otel:')) return otelAc();
            if (!pinId.startsWith('m:')) return;
            const mekanId = pinId.slice(2);
            const m = mekanIle.get(mekanId);
            if (!m) return;
            // #53 §6: gün seçiliyken atanmamış pine dokunmak doğrudan o günün sonuna ekler; seçili günün durağı → pin paneli;
            // #91 B: diğer günün noktası → gün hapı; hap açıkken aynı noktaya (ya da hapa) dokunmak → "Güne git".
            const karar = pinDokunusu({ durak: durakIle.get(mekanId), seciliGunId: gun?.id, gunSecili: !!gun, hapAcikMekanId: gunHapiMekanId, mekanId });
            // #140 KK4: atanmamış mekan Program haritasında yok; gelirse (eski önbellek) panel açılır.
            if (karar.tur === 'hizliEkle') setSeciliMekanId(mekanId);
            else if (karar.tur === 'kart') {
              // #99 KK5: seçili günün durağı → önce kart; Detay ile panel.
              const d = durakIle.get(mekanId);
              if (d) kartAc(d.id);
            } else if (karar.tur === 'guneGit') guneGit(karar.gunId, mekanId);
            else if (karar.tur === 'hapAc') {
              setSeciliMekanId(null);
              setGunHapiMekanId(mekanId);
            } else {
              setSeciliMekanId(mekanId);
            }
          },
          // Haritaya dokununca pin paneli ve "güne eklendi" kartı kapanır.
          onHaritaBas: () => {
            setSeciliMekanId(null);
            setKartDurakId(null);
            setAcikBacak(null);
            setGunHapiMekanId(null);
          },
          hap: gunHapi,
          // #101 KK2: seçili hap 2,5 px çerçeve (`seciliId`), seçici hapın üstünde React görünümü.
          seciliId: seciciCizgisi ? hapPinId(seciciCizgisi.id) : null,
          secici:
            acikBacak && seciciKonum
              ? { konum: seciciKonum, genislik: SECICI_GENISLIK, icerik: <BacakSecici baslik={seciciBasligi(bacakAdi(acikBacak.from.key), bacakAdi(acikBacak.to.key))} secenekler={acikSecenekler} onSec={bacakSec} /> }
              : null,
          odak,
          onBolgeDegisti: (b) => {
            sonZoom.current = b.zoom;
          },
        }}
      />
      )}
      {/* #182: listede mekan paneli ekranın üstünde (haritada `ustKatman` içinde). */}
      {!harita && mekanPaneli ? <View style={StyleSheet.absoluteFill}>{mekanPaneli}</View> : null}
      <GuneEkleSayfasi
        acik={!!guneEkleMekan}
        ad={guneEkleMekan ? adGoster(guneEkleMekan) : ''}
        foto={guneEkleMekan ? bilinen.foto(guneEkleMekan.place_id) : null}
        dakika={guneEkleMekan?.default_minutes ?? 0}
        secenekler={guneEkleSecenekleri}
        ilkAd={(gunId) => {
          const ilk = duraklar.filter((d) => d.day_id === gunId).sort((a, b) => (a.order_key < b.order_key ? -1 : 1))[0];
          const m = ilk ? mekanIle.get(ilk.place_ref) : undefined;
          return m ? adGoster(m) : null;
        }}
        mesgul={ata.isPending}
        onSec={guneEkle}
        onKapat={guneEkleKapat}
      />
      <SecimMenusu acik={!!menuDurak} baslik={menuDurak ? adi(menuDurak.id) : undefined} secenekler={menuSecenekleri} onKapat={() => setMenuDurak(null)} />
      <SecimMenusu
        acik={!!uzunBasilan}
        baslik={uzunBasilan ? (yerler.data?.[uzunBasilan.place_id]?.ad ?? undefined) : undefined}
        secenekler={uzunBasMenusu}
        onKapat={() => setUzunBasilan(null)}
      />
      <SecimMenusu acik={!!gunSecDurak} baslik={t('mekan.gunSecBaslik')} secenekler={gunSecenekleri} onKapat={() => setGunSecDurak(null)} />
      <SecimMenusu
        acik={listeMenuAcik}
        secenekler={
          gun
            ? [
                { etiket: t('program.kisaRota'), onPress: enKisaRotayaDiz, pasif: !gun.order_manual },
                { etiket: t('program.liste.baslangic'), onPress: () => setBaslangicMenu(true) },
                { etiket: t('gunOteli.menu'), onPress: otelAc },
              ]
            : []
        }
        onKapat={() => setListeMenuAcik(false)}
      />
      {/* #140: başlangıç saati — 15 dk adımla (kalış süresi gibi); saatler yuvarlanmadan yeniden akar. */}
      <SecimMenusu
        acik={baslangicMenu}
        baslik={`${t('program.liste.baslangic')} · ${baslangicSaati}`}
        secenekler={[-30, -15, 15, 30].map((fark) => ({
          etiket: t('program.liste.baslangicSec', { saat: dakikaSaat(saatDakika(baslangicSaati) + fark), fark: `${fark > 0 ? '+' : '−'}${Math.abs(fark)} dk` }),
          onPress: () => baslangicDegistir(fark),
        }))}
        onKapat={() => setBaslangicMenu(false)}
      />
      {otelSayfasi && gun ? (
        <GunOteliSayfasi
          key={gun.id}
          seyahat={seyahat}
          gun={gun}
          gunler={gunler}
          konaklamalar={konaklamalar}
          referans={gunMerkezi}
          onKapat={() => setOtelSayfasi(false)}
          onKaydet={(v) => gunOteliKaydet.mutateAsync({ gunler, konaklamalar, gunId: gun.id, ...v })}
        />
      ) : null}
      {puanDurak && puanMekan && puanSatir ? (
        <PuanSayfasi
          key={puanDurak.id}
          acik
          ad={yerler.data?.[puanMekan.place_id]?.ad ?? '…'}
          placeId={puanMekan.place_id}
          foto={puanFoto.data?.foto_uri}
          bas={dakikaSaat(puanSatir.varisDk)}
          bit={dakikaSaat(puanSatir.ayrilisDk)}
          kalinanDk={Math.max(0, puanSatir.ayrilisDk - puanSatir.varisDk)}
          mevcut={puanim(puanMekan.id)}
          kaydediliyor={puanKaydet.isPending}
          onKaydet={(v) => puanKaydet.mutateAsync({ place_ref: puanMekan.id, ...v })}
          onKapat={() => setPuanDurakId(null)}
        />
      ) : null}
      <GrupPenceresi acik={grupAcik} onKapat={() => setGrupAcik(false)} seyahat={seyahat} uyeler={uyeler.data ?? []} mekanlar={mekanlar} />
      <HarcamaFormu acik={!!harcamaDuragi} onKapat={() => setHarcamaDuragi(null)} seyahat={seyahat} uyeler={uyeler.data ?? []} durakId={harcamaDuragi} />
      <PlanHazirSayfasi
        acik={planHazirAcik && planOzeti.ozetler.length > 0}
        ozetler={planOzeti.ozetler}
        bosGunler={planOzeti.bosGunler}
        atanmamis={atanmamis}
        onDavet={() => {
          setPlanHazirAcik(false);
          davet.paylas();
        }}
        onGune={() => {
          setPlanHazirAcik(false);
          const ilk = planOzeti.ozetler[0]?.gun ?? gunler[0];
          if (ilk) setSeciliGunId(ilk.id);
        }}
        onKapat={() => setPlanHazirAcik(false)}
      />
      <ProfilOnayi acik={davet.onayAcik} onKapat={davet.onayKapat} onGonder={davet.onayla} />
      <OtelSayfasi
        acik={nereKaliyorAcik}
        seyahat={seyahat}
        geceSayisi={Math.max(1, gunler.length - 1)}
        onKapat={() => setNereKaliyorAcik(false)}
        onSimdiDegil={() => {
          setNereKaliyorAcik(false);
          otelSeridiniGizle();
        }}
        onKaydet={async (otel) => {
          await tumGunlereOtel.mutateAsync(otel);
        }}
        onAyriSec={() => {
          setNereKaliyorAcik(false);
          router.push({ pathname: '/seyahat/[id]/geceler', params: { id: seyahat.id } });
        }}
      />
      <KatilimSayfasi
        acik={karsilamaAcik && !!uyeler.data}
        seyahat={seyahat}
        uyeler={uyeler.data ?? []}
        gunSayisi={gunler.length}
        mekanSayisi={mekanlar.length}
        onProgram={() => setKarsilamaAcik(false)}
        onMekanEkle={() => {
          setKarsilamaAcik(false);
          router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: { id: seyahat.id } });
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  sagUst: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 },
  golgeHafif: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  avatarlar: { flexDirection: 'row', minHeight: minDokunma, alignItems: 'center', paddingHorizontal: 6, borderRadius: 999, backgroundColor: renk.zemin },
  avatarCerceve: { borderWidth: 2, borderColor: renk.zemin, borderRadius: 15 },
  // #140 KK5 (kanvas 10 · 12): sağ üst çipler.
  saatCip: { height: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: renk.zemin, justifyContent: 'center' },
  saatCipMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  bugunCip: { height: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: renk.basariMetin, flexDirection: 'row', alignItems: 'center', gap: 6 },
  bugunNokta: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9bf0c8' },
  bugunMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.zemin },
  // #140 KK10: Gerideyiz bandı.
  geriBant: { height: 44, marginBottom: 8, paddingLeft: 14, paddingRight: 8, borderRadius: 14, backgroundColor: '#fff6e6', borderWidth: 1.5, borderColor: '#f5a524', flexDirection: 'row', alignItems: 'center', gap: 8 },
  geriMetin: { flex: 1, fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  geriDugme: { height: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: renk.ana, justifyContent: 'center' },
  geriDugmeMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.zemin },
  tutamakCizgi: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: renk.ayrac, marginTop: -6 },
  puanlaHap: { alignSelf: 'flex-start', height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  puanlaHapMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ana },
  uyariMetin: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil, paddingTop: 6 },
  gezidenBildirim: { position: 'absolute', left: 20, right: 20, top: 110, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: renk.ana, shadowColor: renk.metin, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  gezidenBildirimMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin, textAlign: 'center' },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
  ikonDugme: { width: 40, height: 40, borderRadius: kose.alan, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  haritaDugme: { width: 44, height: 44, borderRadius: 22, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  // #55 §B7 alt sayfa üst şeridi: tutamak / ilerleme + satır.
  serit: { paddingHorizontal: 16 },
  tutamakDokunma: { height: 10, justifyContent: 'center' },
  seritSatir: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ilerlemeIz: { height: 3, borderRadius: 1.5, backgroundColor: renk.ayrac, overflow: 'hidden' },
  ilerlemeDolu: { height: '100%', backgroundColor: renk.basari },
  katliMetin: { flex: 1, fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  puanlaSatir: { alignItems: 'flex-start', paddingHorizontal: 16, paddingBottom: 8 },
  // #140 (kanvas 11): liste başlığı.
  listeBaslik: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 2, paddingBottom: 4 },
  gunKare: { width: 40, height: 40, borderRadius: kose.alan, alignItems: 'center', justifyContent: 'center' },
  gunKareMetin: { fontFamily: yazi.baslik, fontSize: 16 },
  listeGun: { fontFamily: yazi.baslik, fontSize: 19, letterSpacing: -0.38, color: renk.metin },
  listeOzet: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  haritayaDonKap: { alignItems: 'flex-end', gap: 4 },
  haritayaDon: { height: 36, paddingHorizontal: 12, borderRadius: kose.alan, backgroundColor: renk.yuzey, justifyContent: 'center' },
  haritayaDonMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  kaydedildi: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.basariMetin },
  atanmamis: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#b4bbd3' },
  atanmamisBaslik: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  atanmamisAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ileri: { transform: [{ rotate: '180deg' }] },
});
