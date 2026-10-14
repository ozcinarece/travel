import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GrupPenceresi } from '@/components/davet/GrupPenceresi';
import { KatilimSayfasi } from '@/components/davet/KatilimSayfasi';
import { ProfilOnayi } from '@/components/davet/ProfilOnayi';
import { mesafeM } from '@/components/harita/geo';
import { BugunKarti } from '@/components/gezi/BugunKarti';
import { GeziKapagi } from '@/components/gezi/GeziKapagi';
import { GeziMenusu } from '@/components/gezi/GeziMenusu';
import { SiradakiAdimSatiri } from '@/components/gezi/GeziParcalari';
import { GrupKarti } from '@/components/gezi/GrupKarti';
import { ListemOnizleme } from '@/components/gezi/ListemOnizleme';
import { PlanOzeti } from '@/components/gezi/PlanOzeti';
import { RehberKartlari, RehberOnerileri } from '@/components/gezi/RehberOnerileri';
import { GeziHarcamaKarti } from '@/components/harcama/GeziHarcamaKarti';
import { HarcamaFormu } from '@/components/harcama/HarcamaFormu';
import { HatirlatmaSatiri } from '@/components/harcama/HatirlatmaSatiri';
import { GeziAlYukleyici } from '@/components/icerik/GeziAl';
import { GeziSohbetKarti } from '@/components/sohbet/GeziSohbetKarti';
import { SecimMenusu } from '@/components/program/SecimMenusu';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { useDavetPaylas } from '@/features/davet/paylas';
import { useBilinenMekanlar } from '@/features/gezi/bilinenMekanlar';
import { durumCipi, geziModu, grupDurumlari, gunKartlari, gunTarihi, listemOnizlemesi, mekanAdi, rehberOnerileri, tarihSatiri } from '@/features/gezi/geziOzeti';
import { siradakiAdim, type SiradakiAdim } from '@/features/gezi/siradakiAdim';
import { useDuragaAta, useDuraklar, useGunler } from '@/features/gunler/sorgular';
import { harcamaOzeti, hatirlatmaVakti } from '@/features/harcama/hesap';
import { kisiler as kisiKaynagi } from '@/features/harcama/metin';
import { useHarcamalar, useIbanlar, useOdesmeler } from '@/features/harcama/sorgular';
import { sehirEslestir, useGeziler, useSehirler, useSehirYerleri } from '@/features/icerik/sorgular';
import { useYereEkle } from '@/features/icerik/yerEkle';
import { OTEL_SERIT_ONEKI } from '@/features/konaklama/otelSeridi';
import type { Konaklama } from '@/features/konaklama/plan';
import { useKonaklamalar } from '@/features/konaklama/sorgular';
import { useKonum, yakinDurakId } from '@/features/konum/useKonum';
import { useOylar, useOyVer } from '@/features/listem/sorgular';
import { useMekanlar, useUyeler } from '@/features/mekanlar/sorgular';
import { kartListesi, odakKarti, sonrakiKart, type DurakKarti } from '@/features/program/durakKarti';
import { useDurakGuncelle } from '@/features/program/sorgular';
import { gunDuraklari, saatKisa, useGunProgrami, useSimdi } from '@/features/program/useProgram';
import { useProgramVerisi } from '@/features/program/useProgramVerisi';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { usePlaniUygula } from '@/features/sihirbaz/planUygula';
import { saatMetni } from '@/features/sohbet/sohbet';
import { useMesajlar, useOkunmamis, useOylamalar } from '@/features/sohbet/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import type { HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import { mesafeMetni } from '@/lib/mesafe';
import { useOturum } from '@/lib/oturum';
import type { Durak, Gun, Mekan, Seyahat, Yer } from '@/lib/tipler';
import { kacinciGun, yerelTarih } from '@/lib/zaman';
import { kestirimTaksiSn, kestirimYuruyusSn } from '@/schedule/tempo';
import { gunRengi, renk, yazi } from '@/theme';

/**
 * #181 (kanvas 23 · 23b · 27): seyahatin ana sayfası (açılış sekmesi). Plan modunda kapak + Sıradaki adım + Plan özeti + Listem +
 * Rehberden öneriler + Rehber; gezi modunda (tarihler içinde) Sıradaki adım yerine bugünün durak kartı ve Grup kartı. KK13:
 * açılışta Google'a istek gitmez — adlar ve öneriler DB'den (ya da oturum önbelleğinden), gün saatleri eldeki yürüyüşlerden.
 */
/** #200 KK1: plan modunda ekranda kendi satırı olan eksikler (PlanOzeti'nin otel satırı). */
const EKRANDAKI_SATIRLAR: readonly SiradakiAdim['tur'][] = ['otel'];

export default function GeziEkrani() {
  const id = useSeyahatId();
  // #181 KK14: davetle gelen kullanıcı doğrudan buraya iner ("Katıldın ✓" alt sayfası bir kez).
  const { katildin } = useLocalSearchParams<{ katildin?: string }>();
  const seyahat = useSeyahat(id);
  const gunler = useGunler(id);
  const duraklar = useDuraklar(id);
  const mekanlar = useMekanlar(id);
  const konaklamalar = useKonaklamalar(id);
  if (!id || !seyahat.data || !gunler.data || !duraklar.data || !mekanlar.data || !konaklamalar.data) {
    return <SeyahatYukleme sorgular={[seyahat, gunler, duraklar, mekanlar, konaklamalar]} kimlikYok={!id} />;
  }
  return <GeziSayfasi key={id} seyahat={seyahat.data} gunler={gunler.data} duraklar={duraklar.data} mekanlar={mekanlar.data} konaklamalar={konaklamalar.data} katildin={katildin === '1'} />;
}

type SayfaProps = { seyahat: Seyahat; gunler: Gun[]; duraklar: Durak[]; mekanlar: Mekan[]; konaklamalar: Konaklama[]; katildin: boolean };

function GeziSayfasi({ seyahat, gunler, duraklar, mekanlar, konaklamalar, katildin }: SayfaProps) {
  const { session } = useOturum();
  const benId = session?.user.id ?? null;
  const uyeler = useUyeler(seyahat.id);
  const oylar = useOylar(seyahat.id);
  const oyVer = useOyVer(seyahat.id);
  // Rehber yeri listeye `useYereEkle` ile (yer_eklendi olayı yazılır).
  const yereEkle = useYereEkle();
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
  const [karsilamaAcik, setKarsilamaAcik] = useState(katildin);
  const [geziAlSlug, setGeziAlSlug] = useState<string | null>(null);
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
  const mod = geziModu(seyahat, an);
  const bugunIndex = kacinciGun(seyahat, an);
  const bugunGun = mod === 'gezi' ? gunler.find((g) => g.index === bugunIndex) : undefined;
  // KK13: ag=false — yürüyüş matrisi ve rota bacakları istenmez; Plan açıldıysa önbellektekiler, yoksa kuş uçuşu kestirimi.
  const verisi = useProgramVerisi({ seyahat, gunler, duraklar, mekanlar, seciliGun: bugunGun, konaklamalar, ag: false });
  const bilinen = useBilinenMekanlar(useMemo(() => mekanlar.map((m) => m.place_id), [mekanlar]));
  const mekanIle = useMemo(() => new Map(mekanlar.map((m) => [m.id, m])), [mekanlar]);
  const adiYaDaKategori = (mekanId: string) => {
    const m = mekanIle.get(mekanId);
    return m ? mekanAdi(m, bilinen.ad) : '';
  };

  // Şehrin içeriği (bizim veri): rehber, öne çıkan yerler, önerilen gezi.
  const sehirler = useSehirler();
  const sehir = sehirEslestir(sehirler.data, { ad: seyahat.city_label, lat: seyahat.lat, lng: seyahat.lng });
  const sehirYerleri = useSehirYerleri(sehir?.id);
  const geziler = useGeziler(sehir?.id);
  const oneriler = useMemo(() => rehberOnerileri(sehirYerleri.data ?? [], mekanlar), [sehirYerleri.data, mekanlar]);
  const onerilenGezi = geziler.data?.[0] ?? null;

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
  const acikOylama = (oylamalar.data ?? []).find((o) => !o.kapanis_at || Date.parse(o.kapanis_at) > an.getTime()) ?? null;
  const oylamaMesaji = acikOylama ? (mesajlar.data ?? []).find((m) => m.oylama_id === acikOylama.id && !m.silindi_at) : undefined;
  const sonMesaj = (mesajlar.data ?? []).find((m) => !m.silindi_at) ?? null;
  const ozetMesaj = oylamaMesaji ?? sonMesaj;
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
    // #200 KK1: Plan bölümünde otel satırı hep var ("Otel seçilmedi · Seç") — Sıradaki adım onu tekrar etmez.
    ekranda: mod === 'plan' ? EKRANDAKI_SATIRLAR : undefined,
  });
  // Uye listesi gelmeden "Davet et" gösterilmez (tek kişi sanılmasın).
  const gorunenAdim = adim?.tur === 'davet' && !uyeler.data ? null : adim;

  const kartlar = useMemo(() => gunKartlari({ gunler, duraklar, mekanlar, tempolar: verisi.tempolar, ad: bilinen.ad }), [gunler, duraklar, mekanlar, verisi.tempolar, bilinen.ad]);
  const listem = useMemo(() => listemOnizlemesi({ mekanlar, duraklar, gunler, oylar: oylar.data ?? [], benId }), [mekanlar, duraklar, gunler, oylar.data, benId]);
  const otel = konaklamalar.length > 0 ? { etiket: konaklamalar[0].label?.trim() || t('geziSayfasi.otel'), gece: Math.max(1, gunler.length - 1) } : null;

  // ---------------------------------------------------------------- gezi modu: bugünün kartı ve grup
  const { konum } = useKonum(mod === 'gezi' && odakta);
  const bugunDuraklari = useMemo(() => (bugunGun ? gunDuraklari(bugunGun, duraklar) : []), [bugunGun, duraklar]);
  const buradaId = useMemo(
    () => (konum ? yakinDurakId(konum, bugunDuraklari.filter((d) => !d.skipped && !d.completed_at).map((d) => ({ id: d.id, konum: mekanIle.get(d.place_ref) ?? { lat: 0, lng: 0 } }))) : null),
    [konum, bugunDuraklari, mekanIle],
  );
  const prog = useGunProgrami({ seyahat, gun: bugunGun, duraklar, mekanlar, yuruyus: verisi.yuruyus, an, buradaId: konum ? buradaId : undefined, uclar: verisi.seciliUclar });
  const bugunKartlari = useMemo(() => {
    // Ad kaynağı: DB ya da oturum önbelleği; bilinmiyorsa kartta kategori.
    const adlar: Record<string, HafifYer> = {};
    for (const m of mekanlar) {
      const ad = bilinen.ad(m);
      if (ad) adlar[m.place_id] = { place_id: m.place_id, ad, lat: m.lat, lng: m.lng, primary_type: m.primary_type, tz: null, puan: null, puan_sayisi: null, acik: null, ulke_kodu: null };
    }
    return kartListesi({ gunDurak: bugunDuraklari, mekanIle, adlar, satirlar: prog?.canli.satirlar ?? [] }).map((k) => (k.ad === '…' ? { ...k, ad: k.kategori } : k));
  }, [mekanlar, bilinen, bugunDuraklari, mekanIle, prog]);
  const odak = odakKarti(bugunKartlari, true);
  const sonraki = odak ? sonrakiKart(bugunKartlari, odak.durakId) : null;
  const kalan = (() => {
    if (!konum || !odak || odak.durum !== 'siradaki') return null;
    const m = mesafeM(konum, odak.konum);
    const sn = odak.gelis?.mod === 'taksi' ? kestirimTaksiSn(konum, odak.konum) : kestirimYuruyusSn(konum, odak.konum);
    return t('program.kart.kalan', { dk: Math.max(1, Math.ceil(sn / 60)), mesafe: mesafeMetni(Math.round(m / 10) * 10) });
  })();
  const bugunTema = bugunGun ? kartlar.find((k) => k.gun.id === bugunGun.id)?.tema : null;
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

  const listeyeEkle = (y: Yer & { place_id: string }) => {
    setEklenenler((e) => new Set(e).add(y.place_id));
    yereEkle.mutate(
      { seyahatId: seyahat.id, yerId: y.id, place_id: y.place_id, primary_type: y.kategori, lat: y.lat, lng: y.lng },
      {
        onError: () => {
          setEklenenler((e) => {
            const yeni = new Set(e);
            yeni.delete(y.place_id);
            return yeni;
          });
          setBildirim(t('geziSayfasi.kaydedilemedi'));
        },
      },
    );
  };
  const oyla = (mekanId: string) => {
    const benim = (oylar.data ?? []).some((o) => o.mekan === mekanId && o.kullanici === benId);
    oyVer.mutate({ mekan: mekanId, ver: !benim });
  };
  const yolTarifi = (k: DurakKarti) => {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${k.konum.lat},${k.konum.lng}&destination_place_id=${encodeURIComponent(k.placeId)}&travelmode=${k.gelis?.mod === 'taksi' ? 'driving' : 'walking'}`,
    );
  };
  const durakTasi = (k: DurakKarti, hedef: Gun) => {
    const mekan = mekanIle.get(k.mekanId);
    const mevcut = duraklar.find((d) => d.id === k.durakId);
    if (!mekan || !mevcut) return;
    ata.mutate({ mekan, gunId: hedef.id, mevcut, gunDuraklari: duraklar.filter((d) => d.day_id === hedef.id) }, { onError: () => setBildirim(t('geziSayfasi.kaydedilemedi')) });
  };

  const benUye = uyeListesi.find((u) => u.user_id === benId);
  const harcamaKarti =
    harcamalar.data && odesmeler.data ? (
      <GeziHarcamaKarti
        gezi={mod === 'gezi'}
        ozet={hOzet}
        adet={harcamalar.data.length}
        k={kisiler}
        benId={benId}
        onTumu={() => router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/harcama', params: { id: seyahat.id } })}
        onEkle={() => setHarcamaFormu(true)}
        onBakiyeler={bakiyeler}
      />
    ) : null;
  const sohbetKarti = mesajlar.data ? (
    <GeziSohbetKarti
      mesaj={ozetMesaj}
      oylama={oylamaMesaji ? acikOylama : null}
      saat={ozetMesaj ? saatMetni(ozetMesaj.created_at, seyahat.tz) : ''}
      okunmamis={okunmamis.data ?? 0}
      k={kisiler}
      benId={benId}
      mekanAdi={(placeId) => bilinen.ad({ place_id: placeId }) ?? t('sohbet.mekan.birMekan')}
      onAc={sohbeteGit}
    />
  ) : null;
  const siraNo = (uid: string) => Math.max(0, uyeListesi.findIndex((u) => u.user_id === uid));
  const metin = adim ? adimMetni(adim) : null;

  return (
    <View style={s.ekran}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <GeziKapagi
          baslik={seyahatAdi(seyahat)}
          tarih={tarihSatiri(seyahat, gunler.length)}
          uyeler={uyeListesi}
          cip={durumCipi(seyahat, an)}
          onSeyahatler={() => router.navigate('/(tabs)/seyahatler')}
          onPaylas={davet.paylas}
          onMenu={() => setMenuAcik(true)}
          onGrup={() => setGrupAcik(true)}
        />
        <View style={[s.icerik, mod === 'gezi' && s.icerikGezi]}>
          {hatirlatmaVakti(seyahat, an) && mod !== 'plan' ? <HatirlatmaSatiri ozet={hOzet} k={kisiler} ibanlar={ibanlar.data} onBakiyeler={bakiyeler} /> : null}
          {mod === 'gezi' ? (
            <>
              <BugunKarti
                baslik={bugunTema ? t('geziSayfasi.bugunTema', { tema: bugunTema }) : t('geziSayfasi.bugun')}
                kartlar={bugunKartlari}
                odak={odak}
                sonraki={sonraki}
                gunRenk={gunRengi(bugunGun?.index ?? 1)}
                kalan={kalan}
                foto={bilinen.foto}
                tip={(mid) => mekanIle.get(mid)?.primary_type ?? null}
                onYolTarifi={yolTarifi}
                onHarita={() => plan({ gun: String(bugunGun?.index ?? 1), harita: '1' })}
                onMenu={setDurakMenu}
                onPlan={() => plan({ gun: String(bugunGun?.index ?? 1) })}
              />
              <GrupKarti durumlar={grup} sira={siraNo} mekanAdi={adiYaDaKategori} an={an} onSeyahattekiler={() => setGrupAcik(true)} onMesajAt={sohbeteGit} />
              {harcamaKarti}
              {sohbetKarti}
            </>
          ) : gorunenAdim && metin ? (
            <SiradakiAdimSatiri baslik={metin.baslik} alt={metin.alt} dugme={metin.dugme} mesgul={gorunenAdim.tur === 'planKur' && planUygula.isPending} onPress={() => void adimEylemi(gorunenAdim)} />
          ) : null}

          {/* Gezi modunda (kanvas 23b) Plan özeti, Listem ve rehber önerileri yok: Bugün → Grup → (Harcamalar → Sohbet) → Rehber. */}
          {mod !== 'gezi' ? (
            <>
              <PlanOzeti
                kartlar={kartlar}
                otel={otel}
                onPlan={() => plan()}
                onGun={(k) => plan({ gun: String(k.gun.index) })}
                onMekanEkle={() => sekme('kesfet')}
                onOtel={() => plan({ otel: '1' })}
              />
              <ListemOnizleme
                toplam={mekanlar.length}
                satirlar={listem}
                ad={(placeId) => bilinen.ad({ place_id: placeId })}
                foto={bilinen.foto}
                onTumu={() => listemiAc()}
                onOy={oyla}
                onEkle={() => sekme('kesfet')}
              />
              {sehir && oneriler.length > 0 ? (
                <RehberOnerileri sehir={sehir.ad} yerler={oneriler} eklenenler={eklenenler} onEkle={listeyeEkle} onKesfet={() => sekme('kesfet', { cekmece: 'rehber' })} />
              ) : null}
            </>
          ) : null}
          {mod !== 'gezi' ? harcamaKarti : null}
          {mod !== 'gezi' ? sohbetKarti : null}
          {sehir ? (
            <RehberKartlari
              sehir={sehir.ad}
              kapak={sehir.kapak_url}
              rehberVar
              gezi={onerilenGezi}
              onRehber={() => router.push({ pathname: '/seyahat/[id]/rehber', params: { id: seyahat.id } })}
              onGezi={() => onerilenGezi && router.push({ pathname: '/gezi/[slug]', params: { slug: onerilenGezi.slug } })}
              onGeziAl={() => onerilenGezi && setGeziAlSlug(onerilenGezi.slug)}
            />
          ) : null}
        </View>
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
      />
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
      {geziAlSlug ? <GeziAlYukleyici slug={geziAlSlug} ilkHedefId={seyahat.id} onKapat={() => setGeziAlSlug(null)} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.haritaZemin },
  icerik: { paddingTop: 14, paddingHorizontal: 20, gap: 20 },
  icerikGezi: { paddingTop: 16, gap: 22 },
  bildirim: { position: 'absolute', left: 20, right: 20, bottom: 16, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: renk.metin },
  bildirimMetin: { fontFamily: yazi.yari, fontSize: 14, color: renk.zemin, textAlign: 'center' },
});
