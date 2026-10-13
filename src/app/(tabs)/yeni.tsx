import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { MekanPaneli } from '@/components/mekan/MekanPaneli';
import { AdimKabugu } from '@/components/sihirbaz/AdimKabugu';
import { AdimNereye } from '@/components/sihirbaz/AdimNereye';
import { AdimNeZaman } from '@/components/sihirbaz/AdimNeZaman';
import { AdimOnerilenler } from '@/components/sihirbaz/AdimOnerilenler';
import { PlanCubugu } from '@/components/sihirbaz/PlanCubugu';
import { useDuraklar, useGunler } from '@/features/gunler/sorgular';
import { icerikPlaceId, olayYaz, sehirEslestir, useSehirler, useYerlerIle } from '@/features/icerik/sorgular';
import { useYerleriEkle } from '@/features/icerik/yerEkle';
import { useMekanEkle, useMekanGuncelle, useMekanlar, useMekanSil } from '@/features/mekanlar/sorgular';
import { useProfil, useProfilGuncelle } from '@/features/profil/sorgular';
import { useSeyahat, useSeyahatAdiKaydet, useSeyahatOlustur } from '@/features/seyahatler/sorgular';
import { seyahatiKopyala, useIcerikSehirSecimi, useTekrarKaynagi } from '@/features/sihirbaz/girisler';
import type { OnerilenMekan } from '@/features/sihirbaz/onerilenler';
import { secimOzeti } from '@/features/sihirbaz/planKur';
import { usePlaniUygula } from '@/features/sihirbaz/planUygula';
import { oncekiAdim, seyahatAdiOner, sonrakiAdim, type Adim, type Aralik } from '@/features/sihirbaz/sihirbaz';
import type { HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import type { SehirSecimi } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

/**
 * #98 → #139 (kanvas 4 · 5 · 7 · 8): seyahat kurma sihirbazı — 3 adım: Nereye → Ne zaman → Neleri görmek istersin, sonra
 * "Planı kur" (seçilenler yakınlığa göre günlere dağıtılır) ve Program'da "Planın hazır". Otel Program'a, davet Plan hazır'a
 * taşındı. Şehir + ad + tarih yerelde tutulur; 2. adımdan çıkınca (Devam ya da "Tarihim belli değil") seyahat oluşturulur.
 * Geri: şehir ve tarihler oluşturulduktan sonra kilitlidir (ad değişir). Hedef: 3 dakikada saatlik rota (olay `plan_kuruldu`).
 * #144 girişleri: `tekrar` (geçmiş seyahat → aynı şehir ve ad, 2. adımdan; seyahat oluşunca plan kopyalanır, Program açılır),
 * `sehir` + `yerler` (Kaydettiklerim → rehberli şehir seçili; seyahat oluşunca kaydedilen yerler listeye).
 */
export default function SihirbazEkrani() {
  const [adim, setAdim] = useState<Adim>('nereye');
  const [sehir, setSehir] = useState<SehirSecimi | null>(null);
  const [ad, setAd] = useState<string | null>(null);
  const [aralik, setAralik] = useState<Aralik>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!tripId) baslangicAni.current = Date.now();
    }, [tripId]),
  );
  const [hata, setHata] = useState<string | null>(null);
  // KK8: sihirbaz başlangıcı → plan yazılana kadar süre (ölçüm: < 3 dk). Seyahat henüz kurulmadıysa ekran her odağa
  // geldiğinde sıfırlanır (sekmeden çıkıp dönünce süre uzun ölçülmesin).
  const baslangicAni = useRef(0);

  const sehirler = useSehirler();
  // #144: dışarıdan giriş parametreleri bir kez uygulanır (sekme ekranı açık kalır; aynı parametreyle tekrar uygulanmaz).
  const giris = useLocalSearchParams<{ tekrar?: string; sehir?: string; yerler?: string; n?: string }>();
  const tekrarKaynagi = useTekrarKaynagi(giris.tekrar);
  const girisSehri = useIcerikSehirSecimi(giris.tekrar ? undefined : sehirler.data?.find((k) => k.id === giris.sehir));
  const girisYerIdleri = useMemo(() => (giris.tekrar ? [] : (giris.yerler?.split(',').filter(Boolean) ?? [])), [giris.tekrar, giris.yerler]);
  const girisYerleri = useYerlerIle(girisYerIdleri);
  const yerleriEkle = useYerleriEkle();
  // `n`: her dokunuşta yeni (aynı seyahat için ikinci "Tekrar kur" da uygulanır).
  const girisAnahtari = giris.tekrar ? `tekrar:${giris.tekrar}:${giris.n ?? ''}` : giris.sehir ? `sehir:${giris.sehir}:${giris.yerler ?? ''}:${giris.n ?? ''}` : null;
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
    const hazir = giris.tekrar ? tekrarKaynagi.data : girisSehri.data;
    if (hazir) {
      setUygulananGiris(girisAnahtari);
      setTripId(null);
      setAralik(null);
      setHata(null);
      setTutulan(new Set());
      if (tekrarKaynagi.data && giris.tekrar) {
        setSehir(tekrarKaynagi.data.sehir);
        setAd(tekrarKaynagi.data.ad);
        setGirisPlani({ tur: 'tekrar', kaynak: tekrarKaynagi.data.id, sehirId: tekrarKaynagi.data.sehir.place_id });
        setAdim('nezaman');
      } else if (girisSehri.data) {
        setSehir(girisSehri.data);
        setAd(null);
        setGirisPlani({ tur: 'yerler', sehirId: girisSehri.data.place_id });
        setAdim('nereye');
      }
    }
  }

  const onerilenAd = seyahatAdiOner(sehir ? [sehir.ad] : []);
  const rehberSehir = sehirEslestir(sehirler.data, sehir);
  const kilitli = !!tripId;

  const geri = () => {
    setHata(null);
    const o = oncekiAdim(adim);
    if (o) setAdim(o);
    else router.navigate('/(tabs)');
  };
  const ileri = () => {
    setHata(null);
    const n = sonrakiAdim(adim);
    if (n) setAdim(n);
  };

  // 1 → 2: ad değiştiyse ve seyahat varsa kaydet.
  const nereyeDevam = async () => {
    if (!sehir) return;
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
  // 2 → 3: seyahat oluşturulur (tarihli ya da tarihsiz).
  const seyahatiKur = async (tarihsiz: boolean) => {
    if (!sehir) return;
    if (tripId) return ileri();
    setHata(null);
    try {
      const id = await olustur.mutateAsync({
        sehir,
        name: ad ?? onerilenAd,
        start_date: tarihsiz ? null : (aralik?.gidis ?? null),
        end_date: tarihsiz ? null : (aralik?.donus ?? aralik?.gidis ?? null),
      });
      // #144 Tekrar kur: aynı plan yeni tarihe; plan hazır olduğundan öneriler atlanır, Program açılır.
      if (girisPlani?.tur === 'tekrar' && girisPlani.sehirId === sehir.place_id) {
        const n = await seyahatiKopyala(girisPlani.kaynak, id);
        setGirisPlani(null);
        olayYaz('sihirbaz_bitti', id, { tekrar: girisPlani.kaynak, durak: n });
        router.replace({ pathname: '/seyahat/[id]/(sekmeler)/program', params: { id } });
        // Sekme açık kalır: bir sonraki "+" baştan başlasın.
        setAdim('nereye');
        setSehir(null);
        setAd(null);
        setAralik(null);
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
      setTripId(id);
      setAdim('onerilenler');
    } catch {
      setHata(t('sihirbaz.nezaman.hata'));
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

  if (adim === 'nereye') {
    return (
      <AdimKabugu adim={adim} baslik={t('sihirbaz.nereye.baslik')} onGeri={geri} hata={hata} devam={{ onPress: nereyeDevam, pasif: !sehir, yukleniyor: adKaydet.isPending }}>
        <AdimNereye sehir={sehir} onSehir={setSehir} ad={ad} onerilenAd={onerilenAd} onAd={setAd} sehirler={sehirler.data} kilitli={kilitli} />
      </AdimKabugu>
    );
  }
  if (adim === 'nezaman') {
    return (
      <AdimKabugu
        adim={adim}
        baslik={t('sihirbaz.nezaman.baslik')}
        ust={seyahat.data ? (seyahat.data.name ?? seyahat.data.city_label) : (ad ?? onerilenAd)}
        onGeri={geri}
        hata={hata}
        devam={{ onPress: () => seyahatiKur(false), pasif: !aralik && !kilitli, yukleniyor: olustur.isPending }}
        atla={kilitli ? undefined : { baslik: t('sihirbaz.nezaman.atla'), onPress: () => seyahatiKur(true) }}
        altNot={kilitli ? t('sihirbaz.nezaman.kilitli') : undefined}>
        <AdimNeZaman aralik={aralik} onAralik={setAralik} kilitli={kilitli} />
      </AdimKabugu>
    );
  }
  // 3: seyahat, günler ve duraklar yüklenene kadar bekleme.
  if (!seyahat.data || !gunler.data || !duraklar.data) {
    return (
      <AdimKabugu adim={adim} baslik="" onGeri={geri}>
        {seyahat.isError || gunler.isError ? <Text style={s.hata}>{t('sihirbaz.nezaman.hata')}</Text> : <ActivityIndicator color={renk.ana} style={{ marginTop: 40 }} />}
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
  return (
    <View style={{ flex: 1 }}>
      <AdimKabugu
        adim={adim}
        baslik={t('sihirbaz.onerilenler.baslik')}
        alt={t('sihirbaz.onerilenler.alt')}
        onGeri={geri}
        hata={hata}
        kaydirmasiz
        altIcerik={<PlanCubugu ozet={secimOzeti(havuz.map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, dakika: m.default_minutes })))} onPlaniKur={planiKur} onHaritayaGec={haritayaGec} yukleniyor={planUygula.isPending} />}>
        <AdimOnerilenler seyahat={seyahat.data} rehberSehir={rehberSehir} havuz={havuz} tutulan={tutulan} onTut={tut} onHata={setHata} onAc={setPanel} />
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
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari, paddingTop: 20 },
});
