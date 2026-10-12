import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { MekanPaneli } from '@/components/mekan/MekanPaneli';
import { AdimDavet } from '@/components/sihirbaz/AdimDavet';
import { AdimKabugu } from '@/components/sihirbaz/AdimKabugu';
import { AdimNereye } from '@/components/sihirbaz/AdimNereye';
import { AdimNeZaman } from '@/components/sihirbaz/AdimNeZaman';
import { AdimOnerilenler } from '@/components/sihirbaz/AdimOnerilenler';
import { AdimOteller } from '@/components/sihirbaz/AdimOteller';
import { useGunler } from '@/features/gunler/sorgular';
import { sehirEslestir, useSehirler } from '@/features/icerik/sorgular';
import { useKonaklamalar } from '@/features/konaklama/sorgular';
import { useMekanEkle, useMekanGuncelle, useMekanlar, useMekanSil } from '@/features/mekanlar/sorgular';
import { useProfil, useProfilGuncelle } from '@/features/profil/sorgular';
import { useSeyahat, useSeyahatAdiKaydet, useSeyahatOlustur } from '@/features/seyahatler/sorgular';
import type { OnerilenMekan } from '@/features/sihirbaz/onerilenler';
import { oncekiAdim, seyahatAdiOner, sonrakiAdim, type Adim, type Aralik } from '@/features/sihirbaz/sihirbaz';
import type { HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import type { SehirSecimi } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

/**
 * #98 (kanvas TripWizard14): seyahat kurma sihirbazı — 5 soru, sonra harita. NewTrip (3.2) / Hotel (3.3) / FirstTrip (0.3)
 * ekranlarının yerini alır. Şehir + ad + tarih yerelde tutulur; 2. adımdan çıkınca (Devam ya da "Tarihim belli değil")
 * seyahat oluşturulur, kalan adımlar seyahate yazar. Geri: şehir ve tarihler oluşturulduktan sonra kilitlidir (ad değişir).
 */
export default function SihirbazEkrani() {
  const [adim, setAdim] = useState<Adim>('nereye');
  const [sehir, setSehir] = useState<SehirSecimi | null>(null);
  const [ad, setAd] = useState<string | null>(null);
  const [aralik, setAralik] = useState<Aralik>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yakinda, setYakinda] = useState(false);

  const sehirler = useSehirler();
  const olustur = useSeyahatOlustur();
  const adKaydet = useSeyahatAdiKaydet(tripId ?? '');
  const seyahat = useSeyahat(tripId ?? undefined);
  const gunler = useGunler(tripId ?? undefined);
  const konaklamalar = useKonaklamalar(tripId ?? undefined);
  const mekanlar = useMekanlar(tripId ?? undefined);
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
      setTripId(id);
      setAdim('oteller');
    } catch {
      setHata(t('sihirbaz.nezaman.hata'));
    }
  };
  const haritayaGec = () => {
    if (!tripId) return;
    router.replace({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: { id: tripId } });
  };

  if (adim === 'nereye') {
    return (
      <AdimKabugu adim={adim} baslik={t('sihirbaz.nereye.baslik')} alt={t('sihirbaz.nereye.alt')} onGeri={geri} hata={hata ?? (yakinda ? t('sihirbaz.nereye.yakinda') : null)} devam={{ onPress: nereyeDevam, pasif: !sehir, yukleniyor: adKaydet.isPending }}>
        <AdimNereye sehir={sehir} onSehir={setSehir} ad={ad} onerilenAd={onerilenAd} onAd={setAd} sehirler={sehirler.data} kilitli={kilitli} onYakinda={() => setYakinda(true)} />
      </AdimKabugu>
    );
  }
  if (adim === 'nezaman') {
    return (
      <AdimKabugu
        adim={adim}
        baslik={t('sihirbaz.nezaman.baslik')}
        alt={t('sihirbaz.nezaman.alt')}
        onGeri={geri}
        hata={hata}
        devam={{ onPress: () => seyahatiKur(false), pasif: !aralik && !kilitli, yukleniyor: olustur.isPending }}
        atla={kilitli ? undefined : { baslik: t('sihirbaz.nezaman.atla'), onPress: () => seyahatiKur(true) }}>
        <AdimNeZaman aralik={aralik} onAralik={setAralik} kilitli={kilitli} />
      </AdimKabugu>
    );
  }
  // 3–5: seyahat ve günler yüklenene kadar bekleme.
  if (!seyahat.data || !gunler.data || !konaklamalar.data) {
    return (
      <AdimKabugu adim={adim} baslik="" onGeri={geri}>
        {seyahat.isError || gunler.isError ? <Text style={s.hata}>{t('sihirbaz.nezaman.hata')}</Text> : <ActivityIndicator color={renk.metin} style={{ marginTop: 40 }} />}
      </AdimKabugu>
    );
  }
  if (adim === 'oteller') {
    return (
      <AdimKabugu adim={adim} baslik={t('sihirbaz.oteller.baslik')} alt={t('sihirbaz.oteller.alt')} onGeri={geri} hata={hata} devam={{ onPress: ileri }} atla={{ baslik: t('sihirbaz.oteller.atla'), onPress: ileri }}>
        <AdimOteller seyahat={seyahat.data} gunler={gunler.data} konaklamalar={konaklamalar.data} onHata={setHata} />
      </AdimKabugu>
    );
  }
  if (adim === 'kimlerle') {
    return (
      <AdimKabugu adim={adim} baslik={t('sihirbaz.kimlerle.baslik')} alt={t('sihirbaz.kimlerle.alt')} onGeri={geri} hata={hata} devam={{ onPress: ileri }} atla={{ baslik: t('sihirbaz.kimlerle.atla'), onPress: ileri }}>
        <AdimDavet seyahat={seyahat.data} />
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
        baslik={t('sihirbaz.onerilenler.baslik', { sehir: seyahat.data.city_label })}
        alt={t('sihirbaz.onerilenler.alt')}
        onGeri={geri}
        hata={hata}
        kaydirmasiz
        altIcerik={
          <View style={s.cubuk}>
            <View style={{ flex: 1 }}>
              <Text style={s.cubukBaslik}>{havuz.length > 0 ? t('sihirbaz.onerilenler.listedeN', { n: havuz.length }) : t('sihirbaz.onerilenler.listedeBos')}</Text>
              <Text style={s.cubukAlt}>{t('sihirbaz.onerilenler.haritaNot')}</Text>
            </View>
            <Text onPress={haritayaGec} accessibilityRole="button" style={s.cubukDugme}>
              {t('sihirbaz.onerilenler.haritayaGec')} →
            </Text>
          </View>
        }>
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
  cubuk: { height: 60, paddingLeft: 16, paddingRight: 6, borderRadius: 999, backgroundColor: renk.metin, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cubukBaslik: { fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin },
  cubukAlt: { fontFamily: yazi.normal, fontSize: 11, color: '#a3a3a3' },
  cubukDugme: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin, backgroundColor: renk.zemin, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 13, overflow: 'hidden' },
});
