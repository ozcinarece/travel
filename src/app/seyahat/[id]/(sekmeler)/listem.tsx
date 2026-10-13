import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GrupPenceresi } from '@/components/davet/GrupPenceresi';
import { GeriHapi } from '@/components/harita/HaritaEkrani';
import { GuneEkleSayfasi } from '@/components/listem/GuneEkleSayfasi';
import { KaydirilirSatir } from '@/components/listem/KaydirilirSatir';
import { MekanPaneli } from '@/components/mekan/MekanPaneli';
import { gunAdi } from '@/components/program/PlanHazirSayfasi';
import { SecimMenusu } from '@/components/program/SecimMenusu';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { SegmentSecici } from '@/components/ui/SegmentSecici';
import { useDuragaAta, useDuraklar, useDurakKaldir, useGunler } from '@/features/gunler/sorgular';
import type { Konaklama } from '@/features/konaklama/plan';
import { useKonaklamalar } from '@/features/konaklama/sorgular';
import { gunProgramlari, gunSecenekleri, listemGruplari, type GunSecenegi, type ListemSatiri, type ListemSiralama } from '@/features/listem/listem';
import { useOylar, useOyVer } from '@/features/listem/sorgular';
import { useMekanGuncelle, useMekanlar, useMekanSil, useUyeler } from '@/features/mekanlar/sorgular';
import { useDurakGuncelle } from '@/features/program/sorgular';
import { useProgramVerisi } from '@/features/program/useProgramVerisi';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { usePlaniUygula } from '@/features/sihirbaz/planUygula';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { useHafifYerler, useYerFotolari } from '@/features/yerler/api';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni } from '@/lib/kategori';
import { useOturum } from '@/lib/oturum';
import type { Durak, Gun, Mekan, Seyahat } from '@/lib/tipler';
import { dakikaSaat } from '@/schedule/tempo';
import { bosluk, gunRengi, gunUstuMetin, kose, renk, yazi } from '@/theme';

/** #141 KK4: Çıkar'dan sonra bu kadar "Geri al" süresi; sonra mekan listeden silinir. */
const GERI_AL_MS = 5000;

type Segment = 'tumu' | 'gunlerde' | 'atanmamis';

export default function ListemEkrani() {
  const id = useSeyahatId();
  const seyahat = useSeyahat(id);
  const gunler = useGunler(id);
  const duraklar = useDuraklar(id);
  const mekanlar = useMekanlar(id);
  const konaklamalar = useKonaklamalar(id);
  if (!id || !seyahat.data || !gunler.data || !duraklar.data || !mekanlar.data || !konaklamalar.data) {
    return <SeyahatYukleme sorgular={[seyahat, gunler, duraklar, mekanlar, konaklamalar]} kimlikYok={!id} />;
  }
  return <Listem key={id} seyahat={seyahat.data} gunler={gunler.data} duraklar={duraklar.data} mekanlar={mekanlar.data} konaklamalar={konaklamalar.data} />;
}

/**
 * #141 (kanvas 13 · 13b · 16): Listem — "Tümü · Günlerde · Atanmamış"; üstte açık turuncu "Güne atanmamış · N" kutusu (her
 * satırda Güne ekle, kutuda Günlere dağıt = #139 dağıtımı); sonra günlere göre gruplar (gün rengi, saat, "Ayşe ekledi").
 * 👍 oy (kendi oyun dolu Gece), "Sırala: En çok oy". Satırı sola kaydır → Çıkar → 5 sn Geri al. Herkes düzenler; güvence
 * Grup penceresindeki Son değişiklikler · Geri al.
 */
function Listem({ seyahat, gunler, duraklar, mekanlar, konaklamalar }: { seyahat: Seyahat; gunler: Gun[]; duraklar: Durak[]; mekanlar: Mekan[]; konaklamalar: Konaklama[] }) {
  const kenar = useSafeAreaInsets();
  const { session } = useOturum();
  const ben = session?.user.id ?? null;
  const uyeler = useUyeler(seyahat.id);
  const oylar = useOylar(seyahat.id);
  const oyVer = useOyVer(seyahat.id);
  const sil = useMekanSil(seyahat.id);
  const ata = useDuragaAta(seyahat.id);
  const kaldir = useDurakKaldir(seyahat.id);
  const durakGuncelle = useDurakGuncelle(seyahat.id);
  const mekanGuncelle = useMekanGuncelle(seyahat.id);
  const dagit = usePlaniUygula(seyahat.id);
  // #144: Seyahatler'deki "N mekan güne atanmadı" çipi Atanmamış segmentiyle açar.
  const { segment: segmentParam } = useLocalSearchParams<{ segment?: string }>();
  const [segment, setSegment] = useState<Segment>(segmentParam === 'atanmamis' ? 'atanmamis' : 'tumu');
  const [siralama, setSiralama] = useState<ListemSiralama>('plan');
  const [siralamaMenu, setSiralamaMenu] = useState(false);
  const [grupAcik, setGrupAcik] = useState(false);
  const [guneEkleId, setGuneEkleId] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [bildirim, setBildirim] = useState<string | null>(null);

  // KK4: Çıkar → satır gizlenir, 5 sn "Geri al"; süre dolunca (ya da ekrandan çıkınca) silinir. Aynı anda tek bekleyen.
  const [bekleyen, setBekleyen] = useState<{ mekan: Mekan; ad: string } | null>(null);
  const bekleyenRef = useRef<{ id: string; zaman: ReturnType<typeof setTimeout> } | null>(null);
  const silMutate = sil.mutate;
  const kesinlestir = () => {
    const b = bekleyenRef.current;
    if (!b) return;
    clearTimeout(b.zaman);
    bekleyenRef.current = null;
    silMutate(b.id, { onError: () => setBildirim(t('listem.hata')) });
  };
  useEffect(
    () => () => {
      const b = bekleyenRef.current;
      if (!b) return;
      clearTimeout(b.zaman);
      silMutate(b.id);
    },
    [silMutate],
  );
  const cikar = (m: Mekan, ad: string) => {
    kesinlestir();
    const zaman = setTimeout(() => {
      kesinlestir();
      setBekleyen(null);
    }, GERI_AL_MS);
    bekleyenRef.current = { id: m.id, zaman };
    setBekleyen({ mekan: m, ad });
  };
  const geriAl = () => {
    const b = bekleyenRef.current;
    if (b) clearTimeout(b.zaman);
    bekleyenRef.current = null;
    setBekleyen(null);
  };
  useEffect(() => {
    if (!bildirim) return;
    const z = setTimeout(() => setBildirim(null), 3500);
    return () => clearTimeout(z);
  }, [bildirim]);

  const yerler = useHafifYerler(
    mekanlar.map((m) => m.place_id),
    { saatler: true },
  );
  const fotolar = useYerFotolari(mekanlar.map((m) => m.place_id));
  const verisi = useProgramVerisi({ seyahat, gunler, duraklar, mekanlar, seciliGun: undefined, konaklamalar });
  const mekanIle = useMemo(() => new Map(mekanlar.map((m) => [m.id, m])), [mekanlar]);
  const durakIle = useMemo(() => new Map(duraklar.map((d) => [d.place_ref, d])), [duraklar]);
  const programlar = useMemo(
    () => gunProgramlari({ seyahat, gunler, duraklar, mekanIle, gunUclari: verisi.gunUclari, yuruyus: verisi.yuruyus, saatler: yerler.data }),
    [seyahat, gunler, duraklar, mekanIle, verisi.gunUclari, verisi.yuruyus, yerler.data],
  );
  const gizli = bekleyen?.mekan.id;
  const gruplar = useMemo(
    () =>
      listemGruplari({
        mekanlar: gizli ? mekanlar.filter((m) => m.id !== gizli) : mekanlar,
        duraklar: gizli ? duraklar.filter((d) => d.place_ref !== gizli) : duraklar,
        gunler,
        oylar: oylar.data ?? [],
        benId: ben,
        siralama,
      }),
    [mekanlar, duraklar, gunler, oylar.data, ben, siralama, gizli],
  );

  const adi = (m: Mekan) => yerler.data?.[m.place_id]?.ad ?? '…';
  const kategori = (m: Mekan) => kategoriEtiketi(yerler.data?.[m.place_id]?.primary_type ?? m.primary_type);
  const ekleyen = (m: Mekan) => (!m.added_by ? null : m.added_by === ben ? t('listem.sen') : uyeler.data?.find((u) => u.user_id === m.added_by) ? t('listem.ekledi', { ad: uyeler.data.find((u) => u.user_id === m.added_by)!.display_name }) : null);
  const ilkAd = (gunId: string) => {
    const ilk = duraklar
      .filter((d) => d.day_id === gunId && !d.skipped)
      .sort((a, b) => (a.order_key < b.order_key ? -1 : 1))[0];
    const m = ilk ? mekanIle.get(ilk.place_ref) : undefined;
    return m ? adi(m) : null;
  };
  const varisSaati = (d: Durak) => {
    const x = programlar.get(d.day_id)?.satirlar.find((y) => y.durak.id === d.id);
    return x && !d.skipped ? dakikaSaat(x.varisDk) : null;
  };

  // KK5: Güne ekle alt sayfası — seçenekler yalnız açıkken hesaplanır.
  const guneEkleMekan = guneEkleId ? mekanIle.get(guneEkleId) : undefined;
  const secenekler = useMemo(
    () => (guneEkleMekan ? gunSecenekleri({ seyahat, mekan: guneEkleMekan, gunler, duraklar, mekanIle, gunUclari: verisi.gunUclari, yuruyus: verisi.yuruyus, saatler: yerler.data }) : []),
    [guneEkleMekan, seyahat, gunler, duraklar, mekanIle, verisi.gunUclari, verisi.yuruyus, yerler.data],
  );
  const guneEkle = async (o: GunSecenegi) => {
    if (!guneEkleMekan) return;
    const m = guneEkleMekan;
    try {
      await ata.mutateAsync({
        mekan: m,
        gunId: o.gun.id,
        mevcut: durakIle.get(m.id),
        gunDuraklari: duraklar.filter((d) => d.day_id === o.gun.id),
        // T7: elle sıralanmış günde en ucuz yere; otomatik günde §5.1 yeniden dizer.
        ekleIndeksi: o.gun.order_manual ? o.ekleIndeksi : undefined,
      });
      setGuneEkleId(null);
      setBildirim(t('listem.guneEkle.eklendi', { ad: adi(m), gun: o.gun.index }));
    } catch {
      setBildirim(t('listem.hata'));
    }
  };
  const gunlereDagit = async () => {
    try {
      const plan = await dagit.mutateAsync({ mekanlar, gunler, duraklar });
      const n = plan.gunler.reduce((t0, g) => t0 + g.mekanlar.length, 0);
      setBildirim(plan.atanmamis.length > 0 ? t('listem.dagitildiKalan', { n, k: plan.atanmamis.length }) : t('listem.dagitildi', { n }));
    } catch {
      setBildirim(t('listem.hata'));
    }
  };

  const satirOgesi = (x: ListemSatiri, atanmamis: boolean) => {
    const m = x.mekan;
    const ad = adi(m);
    const saat = x.durak ? (x.durak.skipped ? t('listem.atlandi') : varisSaati(x.durak)) : null;
    const alt = [atanmamis || !saat ? t('listem.satirAtanmamis', { kategori: kategori(m), sure: sureMetni(x.durak?.minutes ?? m.default_minutes) }) : t('listem.satirGunde', { kategori: kategori(m), saat }), ekleyen(m)]
      .filter(Boolean)
      .join(' · ');
    const foto = fotolar.data?.get(m.place_id) ?? null;
    const icerik = (
      <View style={[s.satir, atanmamis && s.satirKutuda]}>
        <Pressable accessibilityRole="button" onPress={() => setPanelId(m.id)} style={s.satirIc}>
          <View style={s.foto}>{foto ? <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}</View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.ad, x.durak?.skipped && s.cizili]} numberOfLines={1}>
              {ad}
            </Text>
            <Text style={s.alt} numberOfLines={1}>
              {alt}
            </Text>
          </View>
        </Pressable>
        {atanmamis ? (
          <Pressable accessibilityRole="button" onPress={() => setGuneEkleId(m.id)} style={({ pressed }) => [s.guneEkle, pressed && { opacity: 0.85 }]}>
            <Text style={s.guneEkleMetin}>{t('listem.guneEkleDugme')}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: x.benimOyum }}
            accessibilityLabel={x.benimOyum ? t('listem.oyGeriAl', { n: x.oy }) : t('listem.oyVer', { n: x.oy })}
            onPress={() => oyVer.mutate({ mekan: m.id, ver: !x.benimOyum })}
            style={({ pressed }) => [s.oy, x.benimOyum && s.oyBenim, pressed && { opacity: 0.85 }]}>
            <Ikon ad="begen" boyut={16} renk={x.benimOyum ? renk.zemin : renk.ana} kalinlik={2.4} />
            <Text style={[s.oyMetin, x.benimOyum && { color: renk.zemin }]}>{x.oy}</Text>
          </Pressable>
        )}
      </View>
    );
    return (
      <KaydirilirSatir key={m.id} etiket={ad} onCikar={() => cikar(m, ad)}>
        {icerik}
      </KaydirilirSatir>
    );
  };

  const { atanmamis, sayi } = gruplar;
  const panelMekan = panelId ? mekanIle.get(panelId) : undefined;
  const panelDurak = panelMekan ? durakIle.get(panelMekan.id) : undefined;

  return (
    <View style={s.ekran}>
      <ScrollView contentContainerStyle={[s.icerik, { paddingTop: kenar.top + 12 }]}>
        <View style={s.ustSatir}>
          <GeriHapi baslik={seyahatAdi(seyahat)} onPress={() => router.navigate('/(tabs)')} duz />
          <Pressable accessibilityRole="button" accessibilityLabel={t('seyahat.grup.baslik')} onPress={() => setGrupAcik(true)} hitSlop={8} style={s.yuzler}>
            {(uyeler.data ?? []).slice(0, 2).map((u, i) => (
              <View key={u.user_id} style={[s.yuzCerceve, i > 0 && { marginLeft: -8 }]}>
                <Avatar ad={u.display_name} boyut={28} arkaPlan={[renk.vurgu, renk.ana][i % 2]} />
              </View>
            ))}
            {(uyeler.data?.length ?? 0) > 2 ? (
              <View style={[s.yuzCerceve, s.dahaYuz]}>
                <Text style={s.dahaYuzMetin}>{`+${(uyeler.data?.length ?? 0) - 2}`}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        <View style={s.baslikSatir}>
          <Text accessibilityRole="header" style={s.baslik}>
            {t('listem.baslik')}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => setSiralamaMenu(true)} style={s.sirala}>
            <Text style={s.siralaMetin}>{t('listem.sirala', { ne: t(siralama === 'oy' ? 'listem.siralaOy' : 'listem.siralaPlan') })}</Text>
            <Ikon ad="asagi" boyut={14} renk={renk.ana} kalinlik={2.6} />
          </Pressable>
        </View>
        <SegmentSecici
          secenekler={[
            { deger: 'tumu', etiket: t('listem.tumu', { n: sayi.tumu }) },
            { deger: 'gunlerde', etiket: t('listem.gunlerde', { n: sayi.gunlerde }) },
            { deger: 'atanmamis', etiket: t('listem.atanmamisSeg', { n: sayi.atanmamis }) },
          ]}
          deger={segment}
          onDeger={setSegment}
        />

        {sayi.tumu === 0 ? (
          <View style={s.bos}>
            <Text style={s.bosBaslik}>{t('listem.bos')}</Text>
            <Text style={s.bosAlt}>{t('listem.bosAlt')}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: { id: seyahat.id } })} style={s.bosDugme}>
              <Text style={s.bosDugmeMetin}>{t('listem.bosDugme')}</Text>
            </Pressable>
          </View>
        ) : null}

        {segment !== 'gunlerde' && atanmamis.length > 0 ? (
          <View style={s.atanmamisKutu}>
            <View style={s.atanmamisUst}>
              <Text style={s.atanmamisBaslik}>{t('listem.atanmamis', { n: atanmamis.length })}</Text>
              <Pressable accessibilityRole="button" disabled={dagit.isPending} onPress={gunlereDagit} style={({ pressed }) => [s.dagit, pressed && { opacity: 0.85 }]}>
                {dagit.isPending ? <ActivityIndicator size="small" color={renk.zemin} /> : <Text style={s.dagitMetin}>{t('listem.dagit')}</Text>}
              </Pressable>
            </View>
            {atanmamis.map((x) => satirOgesi(x, true))}
          </View>
        ) : null}

        {segment !== 'atanmamis'
          ? gruplar.gunler.map((g) => {
              const rengi = gunRengi(g.gun.index);
              const ilk = ilkAd(g.gun.id);
              return (
                <View key={g.gun.id} style={{ gap: 8 }}>
                  <View style={s.gunBaslik}>
                    <View style={[s.gunKare, { backgroundColor: rengi }]}>
                      <Text style={[s.gunKareMetin, { color: gunUstuMetin(rengi) }]}>{g.gun.index}</Text>
                    </View>
                    <Text style={s.gunAd} numberOfLines={1}>
                      {ilk ? t('listem.gunBaslik', { gun: gunAdi(g.gun), ad: ilk }) : gunAdi(g.gun)}
                    </Text>
                    <Text style={s.gunSayi}>{t('listem.mekanSayisi', { n: g.satirlar.length })}</Text>
                  </View>
                  {g.satirlar.length === 0 ? <Text style={s.gunBos}>{t('listem.gunBos')}</Text> : g.satirlar.map((x) => satirOgesi(x, false))}
                </View>
              );
            })
          : null}
      </ScrollView>

      {bekleyen ? (
        <View style={[s.bant, { bottom: 16 }]}>
          <Text style={s.bantMetin} numberOfLines={1}>
            {t('listem.cikti', { ad: bekleyen.ad })}
          </Text>
          <Pressable accessibilityRole="button" onPress={geriAl} hitSlop={8} style={s.bantDugme}>
            <Text style={s.bantDugmeMetin}>{t('listem.geriAl')}</Text>
          </Pressable>
        </View>
      ) : bildirim ? (
        <View style={[s.bant, { bottom: 16 }]} pointerEvents="none">
          <Text style={s.bantMetin}>{bildirim}</Text>
        </View>
      ) : null}

      {panelMekan ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <MekanPaneli
            placeId={panelMekan.place_id}
            tz={seyahat.tz}
            hafif={yerler.data?.[panelMekan.place_id]}
            ekleyenAd={ekleyen(panelMekan) ?? undefined}
            dakika={panelDurak?.minutes ?? panelMekan.default_minutes}
            onSure={(fark) => {
              const simdi = panelDurak?.minutes ?? panelMekan.default_minutes;
              const yeni = Math.min(480, Math.max(15, simdi + fark));
              if (yeni === simdi) return;
              if (panelDurak) durakGuncelle.mutate({ id: panelDurak.id, minutes: yeni });
              else mekanGuncelle.mutate({ id: panelMekan.id, default_minutes: yeni });
            }}
            baglam="program"
            icinde={!!panelDurak}
            mesgul={ata.isPending || kaldir.isPending}
            onCta={() => {
              if (panelDurak) kaldir.mutate(panelDurak.id);
              else {
                setPanelId(null);
                setGuneEkleId(panelMekan.id);
              }
            }}
            onYolTarifi={() =>
              Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${panelMekan.lat},${panelMekan.lng}&destination_place_id=${encodeURIComponent(panelMekan.place_id)}&travelmode=walking`)
            }
            onKapat={() => setPanelId(null)}
          />
        </View>
      ) : null}

      <GuneEkleSayfasi
        acik={!!guneEkleMekan}
        ad={guneEkleMekan ? adi(guneEkleMekan) : ''}
        foto={guneEkleMekan ? (fotolar.data?.get(guneEkleMekan.place_id) ?? null) : null}
        dakika={guneEkleMekan?.default_minutes ?? 0}
        secenekler={secenekler}
        ilkAd={ilkAd}
        mesgul={ata.isPending}
        onSec={guneEkle}
        onKapat={() => setGuneEkleId(null)}
      />
      <SecimMenusu
        acik={siralamaMenu}
        baslik={t('listem.sirala', { ne: '' }).replace(/:\s*$/, '')}
        secenekler={[
          { etiket: t('listem.siralaPlan'), onPress: () => setSiralama('plan') },
          { etiket: t('listem.siralaOy'), onPress: () => setSiralama('oy') },
        ]}
        onKapat={() => setSiralamaMenu(false)}
      />
      <GrupPenceresi acik={grupAcik} onKapat={() => setGrupAcik(false)} seyahat={seyahat} uyeler={uyeler.data ?? []} mekanlar={mekanlar} />
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingHorizontal: bosluk.kenar, paddingBottom: 96, gap: 12 },
  ustSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yuzler: { flexDirection: 'row', alignItems: 'center' },
  yuzCerceve: { borderWidth: 2, borderColor: renk.zemin, borderRadius: 11 },
  dahaYuz: { width: 32, height: 32, borderRadius: 10, marginLeft: -8, backgroundColor: renk.anaAcik, alignItems: 'center', justifyContent: 'center' },
  dahaYuzMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
  baslikSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  baslik: { fontFamily: yazi.baslik, fontSize: 28, letterSpacing: -0.84, color: renk.metin },
  sirala: { height: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 4 },
  siralaMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  atanmamisKutu: { padding: 12, borderRadius: 20, backgroundColor: '#fff6e6', gap: 10, marginTop: 4 },
  atanmamisUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  atanmamisBaslik: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  dagit: { height: 30, minWidth: 96, paddingHorizontal: 10, borderRadius: 9, backgroundColor: renk.ana, alignItems: 'center', justifyContent: 'center' },
  dagitMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.zemin },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, backgroundColor: renk.zemin },
  satirKutuda: { padding: 8, borderRadius: 14 },
  satirIc: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  foto: { width: 46, height: 46, borderRadius: kose.alan, overflow: 'hidden', backgroundColor: renk.yuzey },
  ad: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  cizili: { textDecorationLine: 'line-through', color: renk.soluk },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  guneEkle: { height: 34, paddingHorizontal: 10, borderRadius: 10, backgroundColor: renk.vurgu, justifyContent: 'center' },
  guneEkleMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.metin },
  oy: { height: 34, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, borderColor: renk.ayrac, backgroundColor: renk.zemin, flexDirection: 'row', alignItems: 'center', gap: 5 },
  oyBenim: { backgroundColor: renk.ana, borderColor: renk.ana },
  oyMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  gunBaslik: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6 },
  gunKare: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  gunKareMetin: { fontFamily: yazi.ekstra, fontSize: 12 },
  gunAd: { flex: 1, fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  gunSayi: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  gunBos: { fontFamily: yazi.normal, fontSize: 13, color: renk.soluk, paddingVertical: 4 },
  bos: { paddingVertical: 32, gap: 8, alignItems: 'flex-start' },
  bosBaslik: { fontFamily: yazi.baslik, fontSize: 20, color: renk.metin },
  bosAlt: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 20, color: renk.ikincil },
  bosDugme: { marginTop: 6, height: 44, paddingHorizontal: 16, borderRadius: kose.dugme, backgroundColor: renk.ana, justifyContent: 'center' },
  bosDugmeMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.zemin },
  bant: { position: 'absolute', left: 16, right: 16, minHeight: 48, paddingLeft: 16, paddingRight: 8, borderRadius: 14, backgroundColor: renk.ana, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: renk.metin, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  bantMetin: { flex: 1, fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin, paddingVertical: 12 },
  bantDugme: { height: 34, paddingHorizontal: 12, borderRadius: 10, backgroundColor: renk.vurgu, justifyContent: 'center' },
  bantDugmeMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
});
