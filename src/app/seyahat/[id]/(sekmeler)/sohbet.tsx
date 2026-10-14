// #184 (kanvas 26): Sohbet — üstte "‹ {seyahat}", yüzler ve "Seyahattekiler ve konumlar"; tarih ayraçlı zaman çizelgesi: balonlar
// (benim sağda Gece, diğerleri solda beyaz + avatar ve ad; saat, kendi mesajımda "okundu"), mekan kartı, oylama, fotoğraf ve plan /
// harcama değişikliklerinin gri satırları (changes akışından; aynı kişinin 2 dk içindekiler tek satır, "Geri al"). Altta hızlı ekler
// (Mekan · Oylama · Fotoğraf · Harcama) ve giriş + Mandalina gönder. Ekran açıkken okundu işaretlenir (rozet sıfırlanır).
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GrupPenceresi } from '@/components/davet/GrupPenceresi';
import { HarcamaFormu } from '@/components/harcama/HarcamaFormu';
import { GeriHapi } from '@/components/harita/HaritaEkrani';
import { SecimMenusu } from '@/components/program/SecimMenusu';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { MekanKarti } from '@/components/sohbet/MekanKarti';
import { MekanSecici } from '@/components/sohbet/MekanSecici';
import { MesajBalonu, SistemSatiri, TarihAyraci } from '@/components/sohbet/MesajParcalari';
import { OylamaFormu } from '@/components/sohbet/OylamaFormu';
import { OylamaKarti } from '@/components/sohbet/OylamaKarti';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon, type IkonAdi } from '@/components/ui/Ikon';
import { useBilinenMekanlar } from '@/features/gezi/bilinenMekanlar';
import { mekanAdi as mekanAdiYaDaKategori } from '@/features/gezi/geziOzeti';
import { geziyeGit } from '@/features/gezi/gezinti';
import { useDuraklar, useGunler } from '@/features/gunler/sorgular';
import { paraMetni, type Harcama } from '@/features/harcama/hesap';
import { kisiler as kisiKaynagi } from '@/features/harcama/metin';
import { useHarcamalar } from '@/features/harcama/sorgular';
import { useDegisikligiGeriAl } from '@/features/listem/sorgular';
import { useMekanEkle, useMekanlar, useUyeler } from '@/features/mekanlar/sorgular';
import { degisiklikGruplari, geriAlinabilir, geriAlmaYetkisi, grupMetni, type DegisiklikGrubu } from '@/features/program/degisiklikMetni';
import { useSimdi } from '@/features/program/useProgram';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import {
  enYakinGun,
  kapanisZamani,
  okunduMu,
  oylamaOzeti,
  saatMetni,
  sistemSatirlari,
  tarihEtiketi,
  zamanCizelgesi,
  type CizelgeOgesi,
  type Mesaj,
  type Oylama,
  type OylamaSecenegi,
  type SistemSatiri as SistemSatiriTipi,
} from '@/features/sohbet/sohbet';
import {
  sohbetFotoSecVeYukle,
  sohbetFotoSil,
  useMesajGonder,
  useMesajlar,
  useMesajOkumalari,
  useMesajSil,
  useOylamaOlustur,
  useOylamaOyu,
  useOylamalar,
  useSohbetDegisiklikleri,
  useSohbetFotoAdresi,
  useSohbetOkundu,
} from '@/features/sohbet/sorgular';
import { useHafifYerler } from '@/features/yerler/api';
import { t } from '@/i18n';
import { kategoriEtiketi } from '@/lib/kategori';
import { useOturum } from '@/lib/oturum';
import type { Mekan, Seyahat, Uye } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';
import { kestirimYuruyusSn } from '@/schedule/tempo';
import { renk, yazi } from '@/theme';

/** Aynı kişinin art arda mesajları (bu süre içinde) tek kümede: avatar ve ad yalnız ilkinde. */
const KUME_MS = 5 * 60 * 1000;

export default function SohbetSekmesi() {
  const id = useSeyahatId();
  const seyahat = useSeyahat(id);
  const uyeler = useUyeler(id);
  const mesajlar = useMesajlar(id);
  const oylamalar = useOylamalar(id);
  if (!id || !seyahat.data || !uyeler.data || !mesajlar.data || !oylamalar.data) {
    return <SeyahatYukleme sorgular={[seyahat, uyeler, mesajlar, oylamalar]} kimlikYok={!id} />;
  }
  return <Sohbet seyahat={seyahat.data} uyeler={uyeler.data} mesajlar={mesajlar.data} oylamalar={oylamalar.data} />;
}

type Acik = 'mekan' | 'oylama' | 'harcama' | 'grup' | null;

function Sohbet({ seyahat, uyeler, mesajlar, oylamalar }: { seyahat: Seyahat; uyeler: Uye[]; mesajlar: Mesaj[]; oylamalar: Oylama[] }) {
  const { session } = useOturum();
  const benId = session?.user.id ?? null;
  const kenar = useSafeAreaInsets();
  const an = useSimdi(true);
  const okumalar = useMesajOkumalari(seyahat.id);
  const degisiklikler = useSohbetDegisiklikleri(seyahat.id);
  const mekanlarQ = useMekanlar(seyahat.id);
  const duraklarQ = useDuraklar(seyahat.id);
  const gunlerQ = useGunler(seyahat.id);
  const harcamalarQ = useHarcamalar(seyahat.id);
  const mekanlar = useMemo(() => mekanlarQ.data ?? [], [mekanlarQ.data]);
  const duraklar = useMemo(() => duraklarQ.data ?? [], [duraklarQ.data]);
  const gunler = useMemo(() => gunlerQ.data ?? [], [gunlerQ.data]);
  const k = useMemo(() => kisiKaynagi(uyeler), [uyeler]);
  const sahip = uyeler.some((u) => u.user_id === benId && u.role === 'owner');

  const gonder = useMesajGonder(seyahat.id);
  const sil = useMesajSil(seyahat.id);
  const oyVer = useOylamaOyu(seyahat.id);
  const oylamaOlustur = useOylamaOlustur(seyahat.id);
  const okundu = useSohbetOkundu(seyahat.id);
  const geriAl = useDegisikligiGeriAl(seyahat.id);
  const mekanEkle = useMekanEkle(seyahat.id);

  const [metin, setMetin] = useState('');
  const [acik, setAcik] = useState<Acik>(null);
  const [menuMesaj, setMenuMesaj] = useState<Mesaj | null>(null);
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false);
  const [bildirim, setBildirim] = useState<string | null>(null);
  const bildir = (m: string) => {
    setBildirim(m);
    setTimeout(() => setBildirim(null), 2500);
  };

  // KK8: ekran açıkken (ve yeni mesaj geldikçe) okundu. Uygulama arka plandayken gelen mesaj okunmuş sayılmaz; öne gelince işaretlenir.
  const [odakta, setOdakta] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setOdakta(true);
      return () => setOdakta(false);
    }, []),
  );
  const [onde, setOnde] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const abonelik = AppState.addEventListener('change', (durum) => setOnde(durum === 'active'));
    return () => abonelik.remove();
  }, []);
  const sonMesaj = mesajlar[0]?.id;
  const okunduIsaretle = okundu.mutate;
  useEffect(() => {
    if (odakta && onde) okunduIsaretle();
  }, [odakta, onde, sonMesaj, okunduIsaretle]);

  // ---------------------------------------------------------------- adlar (DB / oturum önbelleği; listede olmayan mekanlar places-light)
  const mesajYerleri = useMemo(() => {
    const ids = new Set<string>();
    for (const m of mesajlar) if (m.tur === 'mekan' && m.place_id) ids.add(m.place_id);
    for (const o of oylamalar) for (const sc of o.oylama_secenekleri) if (sc.place_id) ids.add(sc.place_id);
    return [...ids];
  }, [mesajlar, oylamalar]);
  const bilinen = useBilinenMekanlar(useMemo(() => [...mekanlar.map((m) => m.place_id), ...mesajYerleri], [mekanlar, mesajYerleri]));
  // Liste gelmeden istenmez (listedeki mekanın konumu ve türü zaten bizde; yalnız listede olmayanlar places-light'tan).
  const listedeOlmayan = mekanlarQ.data ? mesajYerleri.filter((p) => !mekanlar.some((m) => m.place_id === p)) : [];
  const hafif = useHafifYerler(listedeOlmayan, { puan: false, foto: true });
  const mekanIle = useMemo(() => new Map(mekanlar.map((m) => [m.id, m])), [mekanlar]);
  const yerIle = useMemo(() => new Map(mekanlar.map((m) => [m.place_id, m])), [mekanlar]);
  const durakKonumlari = useMemo(() => {
    const gunIle = new Map(gunler.map((g) => [g.id, g.index]));
    return duraklar
      .filter((d) => !d.skipped)
      .map((d) => ({ gunIndex: gunIle.get(d.day_id) ?? 1, konum: mekanIle.get(d.place_ref) }))
      .filter((x): x is { gunIndex: number; konum: Mekan } => !!x.konum);
  }, [duraklar, gunler, mekanIle]);

  const yerBilgisi = (placeId: string) => {
    const liste = yerIle.get(placeId);
    const hy = hafif.data?.[placeId];
    const tip = liste?.primary_type ?? hy?.primary_type ?? null;
    const ad = bilinen.ad({ place_id: placeId }) ?? hy?.ad ?? kategoriEtiketi(tip);
    const konum = liste ? { lat: liste.lat, lng: liste.lng } : hy ? { lat: hy.lat, lng: hy.lng } : null;
    const yakin = konum ? enYakinGun(konum, durakKonumlari, kestirimYuruyusSn) : null;
    const puan = hy?.puan ? `★ ${hy.puan.toFixed(1).replace('.', ',')}` : null;
    const alt = [kategoriEtiketi(tip), puan, yakin ? t('sohbet.mekan.gune', { n: yakin.gunIndex, dk: yakin.dk }) : null].filter(Boolean).join(' · ');
    return { ad, tip, konum, alt, foto: bilinen.foto(placeId) ?? hy?.foto_uri ?? null, liste, planda: !!liste && duraklar.some((d) => d.place_ref === liste.id) };
  };
  const listeyeEkle = (placeId: string) => {
    const b = yerBilgisi(placeId);
    if (!b.konum || b.liste) return;
    mekanEkle.mutate({ place_id: placeId, primary_type: b.tip, lat: b.konum.lat, lng: b.konum.lng }, { onSuccess: () => bildir(t('sohbet.listeyeEklendi')), onError: () => bildir(t('sohbet.gonderilemedi')) });
  };
  const planaEkle = (sc: OylamaSecenegi) => {
    if (!sc.place_id) return;
    const b = yerBilgisi(sc.place_id);
    const listemeGit = () => router.push({ pathname: '/seyahat/[id]/listem', params: { id: seyahat.id, segment: 'atanmamis' } });
    if (b.liste) return listemeGit();
    if (!b.konum) return;
    mekanEkle.mutate({ place_id: sc.place_id, primary_type: b.tip, lat: b.konum.lat, lng: b.konum.lng }, { onSuccess: listemeGit, onError: () => bildir(t('sohbet.gonderilemedi')) });
  };

  // ---------------------------------------------------------------- sistem satırları (changes)
  const gruplar = useMemo(() => degisiklikGruplari(degisiklikler.data ?? []), [degisiklikler.data]);
  const sistem = useMemo(() => sistemSatirlari(gruplar), [gruplar]);
  const enYeniler = useMemo(() => {
    const goruldu = new Set<string>();
    const ids = new Set<number>();
    for (const g of gruplar) {
      const anahtar = `${g.entity}:${g.entity_id}`;
      if (!goruldu.has(anahtar)) ids.add(g.id);
      goruldu.add(anahtar);
    }
    return ids;
  }, [gruplar]);
  const metinKaynagi = {
    mekanAdi: (placesId: string | null | undefined) => {
      const m = placesId ? mekanIle.get(placesId) : undefined;
      return m ? mekanAdiYaDaKategori(m, bilinen.ad) : '…';
    },
    gunNo: (dayId: string) => gunler.find((g) => g.id === dayId)?.index ?? null,
    durakMekani: (durakId: string) => duraklar.find((d) => d.id === durakId)?.place_ref ?? null,
  };
  const harcamaIle = useMemo(() => new Map((harcamalarQ.data ?? []).map((h) => [h.id, h])), [harcamalarQ.data]);
  const satirCumlesi = (satir: SistemSatiriTipi) => {
    const tek = grupCumlesi(satir.gruplar[0], metinKaynagi, harcamaIle, benId);
    return satir.gruplar.length > 1 ? t('sohbet.veDaha', { cumle: tek, n: satir.gruplar.length - 1 }) : tek;
  };
  const satirGeriAlinir = (satir: SistemSatiriTipi) => {
    const g = satir.gruplar[0];
    return enYeniler.has(g.id) && geriAlinabilir(g) && geriAlmaYetkisi(g, benId, sahip);
  };
  const geriAlBas = (g: DegisiklikGrubu) => geriAl.mutate(g.id, { onError: () => bildir(t('davet.grup.geriAlHata')) });

  // ---------------------------------------------------------------- zaman çizelgesi
  const cizelge = useMemo(() => zamanCizelgesi(mesajlar, sistem, seyahat.tz), [mesajlar, sistem, seyahat.tz]);
  const ustler = useMemo(() => {
    const ust = new Set<string>();
    let onceki: CizelgeOgesi | null = null;
    for (const o of cizelge) {
      if (o.tur === 'mesaj') {
        const ayni = onceki?.tur === 'mesaj' && onceki.mesaj.user_id === o.mesaj.user_id && Date.parse(o.mesaj.created_at) - Date.parse(onceki.mesaj.created_at) < KUME_MS;
        if (!ayni) ust.add(o.anahtar);
      }
      onceki = o;
    }
    return ust;
  }, [cizelge]);
  const tersCizelge = useMemo(() => [...cizelge].reverse(), [cizelge]);
  const oylamaIle = useMemo(() => new Map(oylamalar.map((o) => [o.id, o])), [oylamalar]);
  const uyeIdleri = k.uyeIdleri;
  const bugun = yerelTarih(an, seyahat.tz);

  const ogeCiz = ({ item }: { item: CizelgeOgesi }) => {
    if (item.tur === 'ayrac') return <TarihAyraci metin={tarihEtiketi(item.tarih, bugun, { bugun: t('sohbet.bugun'), dun: t('sohbet.dun') })} />;
    if (item.tur === 'sistem') {
      const g = item.satir.gruplar[0];
      return <SistemSatiri kim={item.satir.kim ? k.ad(item.satir.kim) : t('sohbet.biri')} cumle={satirCumlesi(item.satir)} geriAl={satirGeriAlinir(item.satir)} onGeriAl={() => geriAlBas(g)} />;
    }
    const m = item.mesaj;
    const benim = m.user_id === benId;
    const silindi = !!m.silindi_at;
    let ek: ReactNode = null;
    if (m.tur === 'mekan' && m.place_id) {
      const b = yerBilgisi(m.place_id);
      ek = <MekanKarti ad={b.ad} alt={b.alt} tip={b.tip} foto={b.foto} listede={!!b.liste} ekleniyor={mekanEkle.isPending || !b.konum} onListeye={() => listeyeEkle(m.place_id!)} />;
    } else if (m.tur === 'oylama' && m.oylama_id) {
      const o = oylamaIle.get(m.oylama_id);
      if (o) {
        const ozet = oylamaOzeti(o, uyeIdleri, benId, an);
        const kz = o.kapanis_at ? kapanisZamani(o.kapanis_at, an, seyahat.tz) : null;
        const kapanis = o.kapanis_at ? (kz ? t(`sohbet.oylama.kapanir_${kz.gun}`, { saat: kz.saat, tarih: tarihEtiketi(kz.tarih, bugun, { bugun: '', dun: '' }) }) : t('sohbet.oylama.kapandi')) : null;
        const kazananPlanda = ozet.kazanan?.place_id ? yerBilgisi(ozet.kazanan.place_id).planda : true;
        ek = (
          <OylamaKarti
            oylama={o}
            ozet={ozet}
            k={k}
            benId={benId}
            kapanis={kapanis}
            onOy={(secenekId) => oyVer.mutate({ oylamaId: o.id, secenekId }, { onError: () => bildir(t('sohbet.oyVerilemedi')) })}
            onPlanaEkle={kazananPlanda ? undefined : planaEkle}
          />
        );
      }
    } else if (m.tur === 'foto' && m.foto_yolu) {
      ek = <FotoMesaji yol={m.foto_yolu} />;
    }
    const ad = m.user_id ? k.ad(m.user_id) : t('sohbet.biri');
    return (
      <View style={{ alignSelf: benim ? 'flex-end' : 'stretch' }}>
        <MesajBalonu
          benim={benim}
          ad={ad}
          avatarRenk={m.user_id ? k.renk(m.user_id) : renk.anaAcik}
          foto={m.user_id ? k.foto(m.user_id) : null}
          ust={ustler.has(item.anahtar)}
          metin={m.metin}
          silindi={silindi}
          saat={saatMetni(m.created_at, seyahat.tz)}
          okundu={benim && !silindi && okunduMu(m, okumalar.data ?? [], uyeIdleri, benId)}
          ek={ek}
          onUzunBas={benim && !silindi && !m.id.startsWith('gecici-') ? () => setMenuMesaj(m) : undefined}
        />
      </View>
    );
  };

  // ---------------------------------------------------------------- gönderme
  const metniGonder = () => {
    const temiz = metin.trim();
    if (!temiz) return;
    setMetin('');
    gonder.mutate(
      { tur: 'metin', metin: temiz.slice(0, 2000) },
      {
        onError: () => {
          setMetin(temiz);
          bildir(t('sohbet.gonderilemedi'));
        },
      },
    );
  };
  const mekanGonder = (placeId: string) => {
    setAcik(null);
    const not = metin.trim();
    setMetin('');
    gonder.mutate({ tur: 'mekan', place_id: placeId, metin: not.slice(0, 2000) }, { onError: () => bildir(t('sohbet.gonderilemedi')) });
  };
  const fotoGonder = async () => {
    setFotoYukleniyor(true);
    try {
      const yol = await sohbetFotoSecVeYukle(seyahat.id);
      if (yol) {
        const not = metin.trim();
        setMetin('');
        gonder.mutate(
          { tur: 'foto', foto_yolu: yol, metin: not.slice(0, 2000) },
          {
            onError: () => {
              void sohbetFotoSil(yol);
              bildir(t('sohbet.gonderilemedi'));
            },
          },
        );
      }
    } catch {
      bildir(t('sohbet.fotoYuklenemedi'));
    } finally {
      setFotoYukleniyor(false);
    }
  };

  const ekler: { ad: string; ikon: IkonAdi; onPress: () => void }[] = [
    { ad: t('sohbet.ek.mekan'), ikon: 'pin', onPress: () => setAcik('mekan') },
    { ad: t('sohbet.ek.oylama'), ikon: 'grafik', onPress: () => setAcik('oylama') },
    { ad: t('sohbet.ek.foto'), ikon: 'galeri', onPress: () => void fotoGonder() },
    { ad: t('sohbet.ek.harcama'), ikon: 'cuzdan', onPress: () => setAcik('harcama') },
  ];

  return (
    <KeyboardAvoidingView style={s.ekran} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.ust, { paddingTop: kenar.top + 8 }]}>
        <View style={{ flexShrink: 1 }}>
          <GeriHapi baslik={seyahatAdi(seyahat)} onPress={() => geziyeGit(seyahat.id)} duz />
        </View>
        <View style={s.ustSag}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('harcama.seyahattekiler')} onPress={() => setAcik('grup')} style={{ flexDirection: 'row' }}>
            {uyeler.slice(0, 4).map((u, i) => (
              <View key={u.user_id} style={[s.yuz, i > 0 && { marginLeft: -8 }]}>
                <Avatar ad={u.display_name} url={u.photo_url} boyut={28} arkaPlan={k.renk(u.user_id)} />
              </View>
            ))}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('sohbet.konumlar')} onPress={() => setAcik('grup')} style={s.konum}>
            <Ikon ad="goz" boyut={18} renk={renk.ana} kalinlik={2.3} />
          </Pressable>
        </View>
      </View>

      <FlatList
        inverted
        data={tersCizelge}
        keyExtractor={(o) => o.anahtar}
        renderItem={ogeCiz}
        contentContainerStyle={s.liste}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          cizelge.length === 0 ? (
            <View style={s.bos}>
              <Ikon ad="sohbet" boyut={26} renk={renk.ana} kalinlik={2.2} />
              <Text style={s.bosMetin}>{t('sohbet.bos')}</Text>
            </View>
          ) : null
        }
      />

      <View style={[s.alt, { paddingBottom: 10 }]}>
        <View style={s.ekler}>
          {ekler.map((e) => (
            <Pressable key={e.ad} accessibilityRole="button" onPress={e.onPress} disabled={e.ikon === 'galeri' && fotoYukleniyor} style={({ pressed }) => [s.ek, pressed && { opacity: 0.8 }]}>
              {e.ikon === 'galeri' && fotoYukleniyor ? <ActivityIndicator size="small" color={renk.ana} /> : <Ikon ad={e.ikon} boyut={14} renk={renk.ana} kalinlik={2.4} />}
              <Text style={s.ekMetin}>{e.ad}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.girisSatiri}>
          <TextInput
            value={metin}
            onChangeText={setMetin}
            placeholder={t('sohbet.yaz')}
            placeholderTextColor={renk.ikincil}
            multiline
            maxLength={2000}
            accessibilityLabel={t('sohbet.yaz')}
            style={s.giris}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={t('sohbet.gonder')} disabled={!metin.trim()} onPress={metniGonder} style={({ pressed }) => [s.gonder, !metin.trim() && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}>
            <Ikon ad="gonder" boyut={20} renk={renk.metin} kalinlik={2.4} />
          </Pressable>
        </View>
      </View>

      {bildirim ? (
        <View style={s.bildirim} pointerEvents="none">
          <Text style={s.bildirimMetin}>{bildirim}</Text>
        </View>
      ) : null}

      <MekanSecici
        acik={acik === 'mekan'}
        onKapat={() => setAcik(null)}
        merkez={{ lat: seyahat.lat, lng: seyahat.lng }}
        mekanlar={mekanlar}
        ad={(m) => mekanAdiYaDaKategori(m, bilinen.ad)}
        foto={bilinen.foto}
        onSec={mekanGonder}
      />
      <OylamaFormu
        acik={acik === 'oylama'}
        onKapat={() => setAcik(null)}
        tz={seyahat.tz}
        mekanlar={mekanlar}
        ad={(m) => mekanAdiYaDaKategori(m, bilinen.ad)}
        gonderiliyor={oylamaOlustur.isPending}
        onGonder={(o) => oylamaOlustur.mutate(o, { onSuccess: () => setAcik(null), onError: () => bildir(t('sohbet.gonderilemedi')) })}
      />
      <HarcamaFormu acik={acik === 'harcama'} onKapat={() => setAcik(null)} seyahat={seyahat} uyeler={uyeler} onBildirim={bildir} />
      <GrupPenceresi acik={acik === 'grup'} onKapat={() => setAcik(null)} seyahat={seyahat} uyeler={uyeler} mekanlar={mekanlar} />
      <SecimMenusu
        acik={!!menuMesaj}
        onKapat={() => setMenuMesaj(null)}
        secenekler={menuMesaj ? [{ etiket: t('sohbet.mesajiSil'), tehlike: true, onPress: () => sil.mutate({ id: menuMesaj.id, fotoYolu: menuMesaj.foto_yolu }, { onError: () => bildir(t('sohbet.gonderilemedi')) }) }] : []}
      />
    </KeyboardAvoidingView>
  );
}

/** Sistem satırının cümlesi: harcama eklemesi "550 ₺ harcama ekledi · payın 183 ₺"; diğerleri Son değişiklikler'deki gibi. */
function grupCumlesi(g: DegisiklikGrubu, kaynak: Parameters<typeof grupMetni>[1], harcamaIle: Map<string, Harcama>, benId: string | null): string {
  const ilk = g.satirlar[0];
  if (g.entity === 'harcamalar' && !ilk.field && !ilk.old && ilk.new) {
    const yeni = ilk.new as { tl_kurus?: number };
    const pay = harcamaIle.get(g.entity_id)?.harcama_paylari.find((p) => p.user_id === benId)?.pay_kurus;
    const cumle = t('sohbet.harcamaEkledi', { tutar: paraMetni(Number(yeni.tl_kurus ?? 0)) });
    return pay ? `${cumle} · ${t('harcama.payin', { tutar: paraMetni(pay) })}` : cumle;
  }
  return grupMetni(g, kaynak);
}

function FotoMesaji({ yol }: { yol: string }) {
  const adres = useSohbetFotoAdresi(yol);
  return (
    <View style={s.foto}>
      {adres.data ? <Image source={{ uri: adres.data }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessibilityLabel={t('sohbet.ek.foto')} /> : <ActivityIndicator color={renk.ana} />}
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.haritaZemin },
  ust: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: renk.zemin, borderBottomWidth: 1, borderBottomColor: renk.ayrac, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  ustSag: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  yuz: { borderRadius: 11, borderWidth: 2, borderColor: renk.zemin },
  konum: { width: 36, height: 36, borderRadius: 11, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  liste: { paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  bos: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  bosMetin: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 20, color: renk.ikincil, textAlign: 'center', maxWidth: 280 },
  alt: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: renk.zemin, borderTopWidth: 1, borderTopColor: renk.ayrac, gap: 8 },
  ekler: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  ek: { height: 30, paddingLeft: 8, paddingRight: 10, borderRadius: 9, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 4 },
  ekMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
  girisSatiri: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  giris: { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, borderRadius: 14, backgroundColor: renk.haritaZemin, fontFamily: yazi.normal, fontSize: 14, color: renk.metin },
  gonder: { width: 44, height: 44, borderRadius: 14, backgroundColor: renk.vurgu, alignItems: 'center', justifyContent: 'center' },
  foto: { width: 220, height: 160, borderRadius: 14, overflow: 'hidden', backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  bildirim: { position: 'absolute', left: 20, right: 20, bottom: 120, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: renk.metin },
  bildirimMetin: { fontFamily: yazi.yari, fontSize: 14, color: renk.zemin, textAlign: 'center' },
});
