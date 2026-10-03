import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BilgiHapi, HaritaEkrani } from '@/components/harita/HaritaEkrani';
import type { HaritaCizgisi, HaritaPini } from '@/components/harita/tipler';
import { Buton } from '@/components/ui/Buton';
import { useDuragaAta, useDurakKaldir, useGunEkle, useGunler, useGunSil, useDuraklar } from '@/features/gunler/sorgular';
import { useMekanlar } from '@/features/mekanlar/sorgular';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { useHafifYerler } from '@/features/yerler/api';
import { t } from '@/i18n';
import { sureMetni } from '@/lib/kategori';
import { GUNLER, haftaGunu } from '@/lib/takvim';
import type { Durak, Gun, Mekan, Seyahat } from '@/lib/tipler';
import { enUcuzEklemeIndeksi } from '@/schedule/program';
import { enYakinGun, tempoHesapla, type TempoSonucu } from '@/schedule/tempo';
import { bosluk, gunRengi, renk, yazi } from '@/theme';

// PRD 3.3 KK3: 20 dk yürüyüş ≈ 1,5 km.
const YURUME_YARICAPI_M = 1500;

/**
 * PRD 3.5 Günlere dağıt — HaritaEkrani kabuğu. KK1 gün çipleri + "N boşta" + tempo paneli;
 * KK2 gün seç → pine dokun (ata / kaldır); KK3 gün renkleri; KK4 otel pini + daire sabit;
 * KK5 tempo kestirimle (Routes çağrısı yok); KK6 boştaki için en yakın gün; KK7 gün ekle/sil; KK8 Programa geç + uyarı.
 */
export default function GunlerEkrani() {
  const id = useSeyahatId();
  const seyahat = useSeyahat(id);
  const gunler = useGunler(id);
  const duraklar = useDuraklar(id);
  const mekanlar = useMekanlar(id);
  if (!id || !seyahat.data || !gunler.data || !duraklar.data || !mekanlar.data) {
    return <SeyahatYukleme sorgular={[seyahat, gunler, duraklar, mekanlar]} kimlikYok={!id} />;
  }
  return <Gunler key={id} seyahat={seyahat.data} gunler={gunler.data} duraklar={duraklar.data} mekanlar={mekanlar.data} />;
}

/** Gün adı: tarihliyse hafta günü ("Pazartesi"), değilse "1. gün". */
function gunAdi(gun: Gun): string {
  return gun.date ? GUNLER[haftaGunu(gun.date)] : t('gunler.gunAdi', { n: gun.index });
}

/** Postgres time "09:00:00" → "09:00". */
const saat = (tm: string | null | undefined, varsayilan: string) => (tm ? tm.slice(0, 5) : varsayilan);

function Gunler({ seyahat, gunler, duraklar, mekanlar }: { seyahat: Seyahat; gunler: Gun[]; duraklar: Durak[]; mekanlar: Mekan[] }) {
  const ata = useDuragaAta(seyahat.id);
  const kaldir = useDurakKaldir(seyahat.id);
  const gunEkle = useGunEkle(seyahat.id);
  const gunSil = useGunSil(seyahat.id);
  const [seciliGunId, setSeciliGunId] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const seciliGun = gunler.find((g) => g.id === seciliGunId) ?? gunler[0];
  const otel = useMemo(
    () => (seyahat.hotel_lat !== null && seyahat.hotel_lng !== null ? { lat: seyahat.hotel_lat, lng: seyahat.hotel_lng } : null),
    [seyahat.hotel_lat, seyahat.hotel_lng],
  );
  const mekanIle = new Map(mekanlar.map((m) => [m.id, m]));
  const durakIle = new Map(duraklar.map((d) => [d.place_ref, d]));
  const gunIndex = new Map(gunler.map((g) => [g.id, g.index]));
  const bostakiler = mekanlar.filter((m) => !durakIle.has(m.id));

  // Adlar canlı (PRD §7): tempo önerileri ve boşta önerisi için.
  const adlar = useHafifYerler(mekanlar.map((m) => m.place_id));
  const adi = (m: Mekan | undefined) => (m ? (adlar.data?.[m.place_id]?.ad ?? '…') : '…');

  // KK5: her gün için tempo (kestirim). Gün başlangıcı/bitişi: days.* yoksa trips.day_*.
  const tempolar = useMemo(() => {
    const mekanIle = new Map(mekanlar.map((m) => [m.id, m]));
    const sonuc = new Map<string, TempoSonucu>();
    for (const g of gunler) {
      const gunDuraklari = duraklar
        .filter((d) => d.day_id === g.id && !d.skipped)
        .map((d) => ({ durak: d, mekan: mekanIle.get(d.place_ref) }))
        .filter((x): x is { durak: Durak; mekan: Mekan } => !!x.mekan);
      sonuc.set(
        g.id,
        tempoHesapla({
          duraklar: gunDuraklari.map(({ durak, mekan }) => ({ id: mekan.id, konum: { lat: mekan.lat, lng: mekan.lng }, dakika: durak.minutes })),
          otel,
          baslangic: saat(g.start_time, saat(seyahat.day_start, '09:00')),
          bitis: saat(g.end_time, saat(seyahat.day_end, '20:00')),
        }),
      );
    }
    return sonuc;
  }, [gunler, duraklar, mekanlar, otel, seyahat.day_start, seyahat.day_end]);

  // KK6: ilk boştaki mekan için en yakın gün.
  const bostaOneri = useMemo(() => {
    const mekanIle = new Map(mekanlar.map((m) => [m.id, m]));
    const atanan = new Set(duraklar.map((d) => d.place_ref));
    const ilk = mekanlar.find((m) => !atanan.has(m.id));
    if (!ilk) return null;
    const gunId = enYakinGun(
      { lat: ilk.lat, lng: ilk.lng },
      gunler.map((g) => ({
        id: g.id,
        duraklar: duraklar
          .filter((d) => d.day_id === g.id)
          .map((d) => mekanIle.get(d.place_ref))
          .filter((m): m is Mekan => !!m)
          .map((m) => ({ lat: m.lat, lng: m.lng })),
      })),
    );
    return gunId ? { mekan: ilk, gunIndex: gunler.find((g) => g.id === gunId)?.index ?? 1 } : null;
  }, [duraklar, gunler, mekanlar]);

  const pinler: HaritaPini[] = [
    ...(otel ? [{ id: 'otel', tur: 'otel' as const, konum: otel, renk: renk.metin }] : []),
    ...mekanlar.map((m) => {
      const d = durakIle.get(m.id);
      const idx = d ? gunIndex.get(d.day_id) : undefined;
      return idx
        ? { id: `m:${m.id}`, tur: 'durak' as const, konum: { lat: m.lat, lng: m.lng }, renk: gunRengi(idx), etiket: String(idx), ad: adi(m) }
        : { id: `m:${m.id}`, tur: 'bos' as const, konum: { lat: m.lat, lng: m.lng }, renk: renk.metin, etiket: '?', ad: adi(m) };
    }),
  ];

  // #33: gün rotası çizgisi — otel → §5.1 sırası → otel; seçili gün tam renk, diğerleri %30.
  const cizgiler: HaritaCizgisi[] = gunler
    .map((g): HaritaCizgisi | null => {
      const tp = tempolar.get(g.id);
      if (!tp || tp.sira.length === 0) return null;
      const noktalar = tp.sira.map((mekanId) => mekanIle.get(mekanId)).filter((m): m is Mekan => !!m).map((m) => ({ lat: m.lat, lng: m.lng }));
      const yol = otel ? [otel, ...noktalar, otel] : noktalar;
      return yol.length >= 2 ? { id: `rota:${g.id}`, noktalar: yol, renk: gunRengi(g.index), opaklik: g.id === seciliGun?.id ? 0.9 : 0.3 } : null;
    })
    .filter((c): c is HaritaCizgisi => !!c);

  // KK2: seçili güne ata; aynı güne atalıysa kaldır; başka güne atalıysa seçili güne taşı.
  const pinBas = async (pinId: string) => {
    if (!pinId.startsWith('m:') || !seciliGun) return;
    const mekan = mekanIle.get(pinId.slice(2));
    if (!mekan) return;
    const mevcut = durakIle.get(mekan.id);
    setHata(null);
    try {
      if (mevcut && mevcut.day_id === seciliGun.id) await kaldir.mutateAsync(mevcut.id);
      else {
        const gunDuraklari = duraklar.filter((d) => d.day_id === seciliGun.id).sort((a, b) => (a.order_key < b.order_key ? -1 : 1));
        // T7: elle sıralanmış günde yeni durak en ucuz noktaya (kestirimle); otomatik günde sıra 3.7'de yeniden hesaplanır.
        const ekleIndeksi = seciliGun.order_manual
          ? enUcuzEklemeIndeksi(
              gunDuraklari.filter((d) => !d.skipped).map((d) => mekanIle.get(d.place_ref)).filter((m): m is Mekan => !!m).map((m) => ({ key: m.place_id, konum: { lat: m.lat, lng: m.lng } })),
              { key: mekan.place_id, konum: { lat: mekan.lat, lng: mekan.lng } },
              otel,
              () => null,
            )
          : undefined;
        await ata.mutateAsync({ mekan, gunId: seciliGun.id, mevcut, gunDuraklari, ekleIndeksi });
      }
    } catch {
      setHata(t('gunler.hata'));
    }
  };

  // KK7: gün sil — uzun basınca onay; durakları boşa düşer.
  const gunuSil = (gun: Gun) => {
    if (gunler.length <= 1) {
      Alert.alert(t('gunler.sonGun'));
      return;
    }
    const n = duraklar.filter((d) => d.day_id === gun.id).length;
    Alert.alert(t('gunler.gunSilBaslik', { gun: gunAdi(gun) }), n > 0 ? t('gunler.gunSilMetin', { n }) : t('gunler.gunSilMetinBos'), [
      { text: t('genel.vazgec'), style: 'cancel' },
      {
        text: t('gunler.sil'),
        style: 'destructive',
        onPress: () => {
          if (seciliGunId === gun.id) setSeciliGunId(null);
          gunSil.mutateAsync({ gun, gunler, startDate: seyahat.start_date }).catch(() => setHata(t('gunler.hata')));
        },
      },
    ]);
  };

  // KK8: Programa geç; boşta mekan varsa uyarı.
  const programaGec = () => {
    const git = () => router.push({ pathname: '/seyahat/[id]/(sekmeler)/program', params: { id: seyahat.id } });
    if (bostakiler.length === 0) return git();
    Alert.alert(t('gunler.uyariBaslik', { n: bostakiler.length }), t('gunler.uyariMetin'), [
      { text: t('genel.vazgec'), style: 'cancel' },
      { text: t('gunler.devam'), onPress: git },
    ]);
  };

  const merkez = otel ?? { lat: seyahat.lat, lng: seyahat.lng };

  return (
    <HaritaEkrani
      baslik={t('gunler.baslik')}
      geri={() => router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: { id: seyahat.id } })}
      sagUst={<BilgiHapi metin={bostakiler.length > 0 ? t('gunler.bosta', { n: bostakiler.length }) : t('gunler.bostaYok')} />}
      ustEk={
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.ciplerKaydirma} contentContainerStyle={s.cipler}>
            {gunler.map((g) => {
              const aktif = g.id === seciliGun?.id;
              const rengi = gunRengi(g.index);
              const n = duraklar.filter((d) => d.day_id === g.id).length;
              return (
                <Pressable
                  key={g.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: aktif }}
                  accessibilityLabel={`${gunAdi(g)} · ${t('gunler.durakSayisi', { n })}`}
                  onPress={() => setSeciliGunId(g.id)}
                  onLongPress={() => gunuSil(g)}
                  style={[s.cip, s.golge, aktif ? { backgroundColor: rengi, borderColor: rengi } : { borderColor: rengi }]}>
                  <View style={[s.cipNumara, aktif ? { backgroundColor: renk.zemin } : { backgroundColor: rengi }]}>
                    <Text style={[s.cipNumaraMetin, { color: aktif ? rengi : renk.zemin }]}>{g.index}</Text>
                  </View>
                  <Text style={[s.cipMetin, aktif && { color: renk.zemin }]}>{n > 0 ? t('gunler.durakSayisi', { n }) : t('gunler.durakYok')}</Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              disabled={gunEkle.isPending}
              onPress={() => gunEkle.mutateAsync({ gunler, startDate: seyahat.start_date }).catch(() => setHata(t('gunler.hata')))}
              style={[s.cip, s.golge, s.cipEkle]}>
              <Text style={s.cipMetin}>{t('gunler.gunEkle')}</Text>
            </Pressable>
          </ScrollView>
          <Text style={s.ipucu}>{t('gunler.ipucu')}</Text>
        </>
      }
      altPanel={
        <>
          <ScrollView style={s.panelKaydirma} contentContainerStyle={s.panelIcerik} showsVerticalScrollIndicator={false}>
            {gunler.map((g) => {
              const tp = tempolar.get(g.id);
              if (!tp) return null;
              const rengi = gunRengi(g.index);
              const oneri =
                tp.etiket === 'yogun' && tp.enUzun
                  ? t('gunler.yogunOneri', { ad: adi(mekanIle.get(tp.enUzun.id)), sure: sureMetni(tp.enUzun.dakika) })
                  : tp.etiket === 'rahat' && tp.durakSayisi > 0
                    ? tp.sigar >= 2
                      ? t('gunler.sigar', { n: tp.sigar })
                      : tp.sigar === 1
                        ? t('gunler.sigarBir')
                        : t('gunler.sigmaz')
                    : '';
              const yakin = bostaOneri && bostaOneri.gunIndex === g.index ? t('gunler.bostaYakin', { ad: adi(bostaOneri.mekan), gun: `${g.index}.` }) : '';
              return (
                <Pressable key={g.id} accessibilityRole="button" onPress={() => setSeciliGunId(g.id)} style={[s.kart, g.id === seciliGun?.id && s.kartSecili]}>
                  <View style={s.kartUst}>
                    <View style={s.kartBaslik}>
                      <View style={[s.kartNumara, { backgroundColor: rengi }]}>
                        <Text style={s.kartNumaraMetin}>{g.index}</Text>
                      </View>
                      <Text style={s.kartAd}>{gunAdi(g)}</Text>
                    </View>
                    <View style={[s.etiket, ETIKET_ZEMIN[tp.etiket]]}>
                      <Text style={[s.etiketMetin, ETIKET_METIN[tp.etiket]]}>{t(`gunler.tempo.${tp.etiket}`)}</Text>
                    </View>
                  </View>
                  <View style={s.cubuk}>
                    <View style={[s.cubukDolu, { width: `${Math.min(100, Math.round(tp.doluluk * 100))}%`, backgroundColor: tp.etiket === 'yogun' ? renk.vurgu : rengi }]} />
                  </View>
                  <View style={s.kartSatir}>
                    <Text style={s.kartAlt}>
                      {tp.durakSayisi > 0
                        ? t('gunler.ozet', { n: tp.durakSayisi, gezi: sureMetni(tp.geziDk), yuruyus: sureMetni(tp.yuruyusDk) })
                        : t('gunler.ozetBos')}
                    </Text>
                    <Text style={s.kartAlt}>{t('gunler.saatler', { bas: tp.baslangic, bit: tp.bitis })}</Text>
                  </View>
                  {oneri || yakin ? (
                    <Text style={[s.oneri, tp.etiket === 'yogun' && { color: renk.uyari }]}>{[oneri, yakin].filter(Boolean).join(' ')}</Text>
                  ) : null}
                </Pressable>
              );
            })}
            <Text style={s.not}>{t('gunler.kestirimNot')}</Text>
          </ScrollView>
          {hata ? <Text style={s.hata}>{hata}</Text> : null}
          <Buton baslik={t('gunler.programaGec')} onPress={programaGec} stil={{ height: 50 }} />
        </>
      }
      harita={{
        merkez,
        zoom: otel ? 14 : 13,
        pinler,
        cizgiler,
        daireler: otel ? [{ id: 'yurume', merkez: otel, yaricapM: YURUME_YARICAPI_M, renk: renk.metin }] : [],
        onPinBas: pinBas,
      }}
    />
  );
}

const ETIKET_ZEMIN = { rahat: { backgroundColor: '#e6f4ec' }, normal: { backgroundColor: renk.yuzey }, yogun: { backgroundColor: renk.uyariZemin } } as const;
const ETIKET_METIN = { rahat: { color: renk.basari }, normal: { color: renk.ikincil }, yogun: { color: renk.uyari } } as const;

const s = StyleSheet.create({
  ortala: { alignItems: 'center', justifyContent: 'center' },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  ciplerKaydirma: { marginHorizontal: -bosluk.kenar },
  cipler: { gap: 8, paddingHorizontal: bosluk.kenar },
  cip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingLeft: 5, paddingRight: 12, borderRadius: 999, backgroundColor: renk.zemin, borderWidth: 1.5 },
  cipEkle: { borderColor: renk.ayrac, paddingLeft: 12 },
  cipNumara: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cipNumaraMetin: { fontFamily: yazi.ekstra, fontSize: 11 },
  cipMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  ipucu: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil, paddingLeft: 4 },
  panelKaydirma: { maxHeight: 290 },
  panelIcerik: { gap: 8 },
  kart: { padding: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: renk.yuzey, gap: 6, borderWidth: 1.5, borderColor: renk.yuzey },
  kartSecili: { borderColor: renk.metin },
  kartUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kartBaslik: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  kartNumara: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  kartNumaraMetin: { fontFamily: yazi.ekstra, fontSize: 9, color: renk.zemin },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  etiket: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  etiketMetin: { fontFamily: yazi.kalin, fontSize: 11 },
  cubuk: { height: 6, borderRadius: 3, backgroundColor: '#e0e0e0', overflow: 'hidden' },
  cubukDolu: { height: '100%' },
  kartSatir: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  kartAlt: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  oneri: { fontFamily: yazi.yari, fontSize: 12, color: renk.metin },
  not: { fontFamily: yazi.normal, fontSize: 10, color: renk.soluk, textAlign: 'center', paddingTop: 2 },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});
