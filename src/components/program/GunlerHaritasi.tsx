import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BilgiHapi, HaritaEkrani } from '@/components/harita/HaritaEkrani';
import type { HaritaCizgisi, HaritaPini } from '@/components/harita/tipler';
import { GunCipleri } from '@/components/program/GunCipleri';
import { Buton } from '@/components/ui/Buton';
import { useDuragaAta, useDurakKaldir, useGunEkle, useGunSil } from '@/features/gunler/sorgular';
import { bacakKaynagi, bacakListesi, matrisNoktalari, useRotaBacaklari, useYuruyusMatrisi, type MatrisNoktasi } from '@/features/program/sorgular';
import { useHafifYerler } from '@/features/yerler/api';
import { t } from '@/i18n';
import { sureMetni } from '@/lib/kategori';
import { pinIkonu } from '@/lib/pinIkonu';
import { polylineCoz } from '@/lib/polyline';
import { GUNLER, haftaGunu } from '@/lib/takvim';
import type { Durak, Gun, Mekan, Seyahat } from '@/lib/tipler';
import { enUcuzEklemeIndeksi } from '@/schedule/program';
import { enYakinGun, kestirimYuruyusSn, bacakModu, tempoHesapla, type BacakKaynagi, type TempoSonucu } from '@/schedule/tempo';
import { gunRengi, renk, yazi } from '@/theme';

// PRD 3.3 KK3: 20 dk yürüyüş ≈ 1,5 km.
const YURUME_YARICAPI_M = 1500;

/**
 * PRD 3.5 Günlere dağıt — #34 ile Program sekmesinin **Harita** görünümü (HaritaEkrani kabuğu).
 * KK1 gün çipleri + "N boşta" + tempo paneli; KK2 gün seç → pine dokun (ata / kaldır); KK3 gün renkleri;
 * KK4 otel pini + daire sabit; KK5 tempo kestirimle; KK6 boştaki için en yakın gün; KK7 gün ekle/sil;
 * KK8 "Çizelgeye geç" + boşta uyarısı. #33 gün rota çizgileri.
 */
/** Gün adı: tarihliyse hafta günü ("Pazartesi"), değilse "1. gün". */
function gunAdi(gun: Gun): string {
  return gun.date ? GUNLER[haftaGunu(gun.date)] : t('gunler.gunAdi', { n: gun.index });
}

/** Postgres time "09:00:00" → "09:00". */
const saat = (tm: string | null | undefined, varsayilan: string) => (tm ? tm.slice(0, 5) : varsayilan);

export type GunlerHaritasiProps = {
  seyahat: Seyahat;
  gunler: Gun[];
  duraklar: Durak[];
  mekanlar: Mekan[];
  seciliGun: Gun | undefined;
  onGunSec: (id: string | null) => void;
  /** Gün çiplerinin altına yerleşen görünüm anahtarı (#34). */
  gorunumAnahtari: ReactNode;
  /** Sağ üst: üye avatarları. */
  sagUst?: ReactNode;
  onCizelgeyeGec: () => void;
};

export function GunlerHaritasi({ seyahat, gunler, duraklar, mekanlar, seciliGun, onGunSec, gorunumAnahtari, sagUst, onCizelgeyeGec }: GunlerHaritasiProps) {
  const ata = useDuragaAta(seyahat.id);
  const kaldir = useDurakKaldir(seyahat.id);
  const gunEkle = useGunEkle(seyahat.id);
  const gunSil = useGunSil(seyahat.id);
  const [hata, setHata] = useState<string | null>(null);
  const setSeciliGunId = onGunSec;
  const seciliGunId = seciliGun?.id ?? null;
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

  // #33: tempo paneli çizelgeyle aynı yürüyüş matrisini kullanır (atanmış duraklar + otel, ≤ 25 nokta); gelene kadar kestirim "~".
  const atanmisMekanlar = useMemo(() => {
    const atanan = new Set(duraklar.filter((d) => !d.skipped).map((d) => d.place_ref));
    return mekanlar.filter((m) => atanan.has(m.id)).slice(0, 24);
  }, [duraklar, mekanlar]);
  const matris = useYuruyusMatrisi(seyahat.id, matrisNoktalari(otel, atanmisMekanlar));

  // Seçili günün §5.1 sırası (ya da elle sırası) → gerçek rota bacakları (route-legs; yalnız seçili gün, maliyet).
  const konumKey = useMemo(() => {
    const k = new Map<string, string>();
    if (otel) k.set(`${otel.lat},${otel.lng}`, 'hotel');
    for (const m of mekanlar) k.set(`${m.lat},${m.lng}`, m.place_id);
    return k;
  }, [mekanlar, otel]);
  const seciliSira = useMemo(() => {
    if (!seciliGun) return [] as Mekan[];
    const sirali = duraklar
      .filter((d) => d.day_id === seciliGun.id && !d.skipped)
      .sort((a, b) => (a.order_key < b.order_key ? -1 : 1))
      .map((d) => mekanIle.get(d.place_ref))
      .filter((m): m is Mekan => !!m);
    if (seciliGun.order_manual || sirali.length < 2) return sirali;
    // Otomatik günde §5.1 sırası (gerçek yürüyüşle, 3.7 ile aynı).
    const tp = tempoHesapla({
      duraklar: sirali.map((m) => ({ id: m.id, konum: { lat: m.lat, lng: m.lng }, dakika: 0 })),
      otel,
      baslangic: '09:00',
      bitis: '20:00',
      yuruyusSn: (a, b) => matris.yuruyus(konumKey.get(`${a.lat},${a.lng}`) ?? '', konumKey.get(`${b.lat},${b.lng}`) ?? '')?.sn ?? kestirimYuruyusSn(a, b),
    });
    return tp.sira.map((id) => mekanIle.get(id)).filter((m): m is Mekan => !!m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seciliGun?.id, seciliGun?.order_manual, duraklar, mekanlar, otel, matris.yuruyus, konumKey]);
  const seciliNoktalar: MatrisNoktasi[] = useMemo(() => {
    const n = seciliSira.map((m) => ({ key: m.place_id, lat: m.lat, lng: m.lng }));
    return otel && n.length > 0 ? [{ key: 'hotel', ...otel }, ...n, { key: 'hotel', ...otel }] : n;
  }, [seciliSira, otel]);
  const rota = useRotaBacaklari(seyahat.id, bacakListesi(seciliNoktalar));

  // Matris + gerçek bacaklar → tempo kaynağı (konumdan anahtara).
  const kaynak = useMemo(() => bacakKaynagi(matris.yuruyus, rota.rotalar), [matris.yuruyus, rota.rotalar]);
  const bacak: BacakKaynagi = useMemo(
    () => (a, b) => {
      const c = kaynak(konumKey.get(`${a.lat},${a.lng}`) ?? '', konumKey.get(`${b.lat},${b.lng}`) ?? '');
      return c ? { yuruyusSn: c.sn, taksiSn: c.taksi?.sn ?? null, kestirim: false } : { yuruyusSn: kestirimYuruyusSn(a, b), taksiSn: null, kestirim: true };
    },
    [kaynak, konumKey],
  );

  // KK5: her gün için tempo. Gün başlangıcı/bitişi: days.* yoksa trips.day_*. Elle sıralanmış günde mevcut sıra.
  const tempolar = useMemo(() => {
    const mekanIle = new Map(mekanlar.map((m) => [m.id, m]));
    const sonuc = new Map<string, TempoSonucu>();
    for (const g of gunler) {
      const gunDuraklari = duraklar
        .filter((d) => d.day_id === g.id && !d.skipped)
        .sort((a, b) => (a.order_key < b.order_key ? -1 : 1))
        .map((d) => ({ durak: d, mekan: mekanIle.get(d.place_ref) }))
        .filter((x): x is { durak: Durak; mekan: Mekan } => !!x.mekan);
      sonuc.set(
        g.id,
        tempoHesapla({
          duraklar: gunDuraklari.map(({ durak, mekan }) => ({ id: mekan.id, konum: { lat: mekan.lat, lng: mekan.lng }, dakika: durak.minutes })),
          otel,
          baslangic: saat(g.start_time, saat(seyahat.day_start, '09:00')),
          bitis: saat(g.end_time, saat(seyahat.day_end, '20:00')),
          bacak,
          sira: g.order_manual ? gunDuraklari.map(({ mekan }) => mekan.id) : undefined,
        }),
      );
    }
    return sonuc;
  }, [gunler, duraklar, mekanlar, otel, seyahat.day_start, seyahat.day_end, bacak]);

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

  // #30: pin numarası = gün içi sıra (§5.1 ya da elle), gün numarası değil; rota çizgisiyle okunur.
  const gunSiralari = new Map<string, number>();
  for (const g of gunler) tempolar.get(g.id)?.sira.forEach((mekanId, i) => gunSiralari.set(mekanId, i + 1));

  const pinler: HaritaPini[] = [
    ...(otel ? [{ id: 'otel', tur: 'otel' as const, konum: otel, renk: renk.metin }] : []),
    ...mekanlar.map((m) => {
      const d = durakIle.get(m.id);
      const idx = d ? gunIndex.get(d.day_id) : undefined;
      const hafif = adlar.data?.[m.place_id];
      const ortak = { id: `m:${m.id}`, konum: { lat: m.lat, lng: m.lng }, ad: adi(m), puan: hafif?.puan ?? null, yorumSayisi: hafif?.puan_sayisi ?? null };
      // #30: atanmış = gün renginde daire + sıra numarası (gün içi sıra); atanmamış = beyaz daire + kategori ikonu.
      if (idx) {
        const sira = gunSiralari.get(m.id);
        return { ...ortak, tur: 'durak' as const, renk: gunRengi(idx), etiket: sira ? String(sira) : '' };
      }
      return { ...ortak, tur: 'bos' as const, renk: renk.metin, ikon: pinIkonu(m.primary_type) };
    }),
  ];

  // #33: rota çizgileri. Seçili gün: bacak bacak GERÇEK yol (polyline), araç bacağı kesikli + "🚕 9 dk", yürüyüş "🚶 12 dk";
  // gelene kadar kuş uçuşu. Diğer günler: kuş uçuşu, %30 opaklık (maliyet).
  const cizgiler: HaritaCizgisi[] = gunler.flatMap((g): HaritaCizgisi[] => {
    const tp = tempolar.get(g.id);
    if (!tp || tp.sira.length === 0) return [];
    const rengi = gunRengi(g.index);
    if (g.id !== seciliGun?.id) {
      const noktalar = tp.sira.map((mekanId) => mekanIle.get(mekanId)).filter((m): m is Mekan => !!m).map((m) => ({ lat: m.lat, lng: m.lng }));
      const yol = otel ? [otel, ...noktalar, otel] : noktalar;
      return yol.length >= 2 ? [{ id: `rota:${g.id}`, noktalar: yol, renk: rengi, opaklik: 0.3 }] : [];
    }
    return bacakListesi(seciliNoktalar).map((b, i): HaritaCizgisi => {
      const r = rota.rotalar[`${b.from.key}>${b.to.key}`];
      const a = { lat: b.from.lat, lng: b.from.lng };
      const z = { lat: b.to.lat, lng: b.to.lng };
      if (r) {
        const taksi = r.mode === 'DRIVE' && r.drive_seconds;
        const dk = Math.max(1, Math.round((taksi ? r.drive_seconds! : r.seconds) / 60));
        return { id: `rota:${g.id}:${i}`, noktalar: polylineCoz(r.polyline), renk: rengi, opaklik: 0.9, kesik: !!taksi, etiket: `${taksi ? '🚕' : '🚶'} ${dk} dk` };
      }
      const m = bacakModu(a, z, bacak(a, z));
      return { id: `rota:${g.id}:${i}`, noktalar: [a, z], renk: rengi, opaklik: 0.9, kesik: m.mod === 'taksi', etiket: `${m.mod === 'taksi' ? '🚕' : '🚶'} ~${Math.max(1, Math.round(m.sn / 60))} dk` };
    });
  });

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

  // KK8: Çizelgeye geç; boşta mekan varsa uyarı.
  const programaGec = () => {
    const git = onCizelgeyeGec;
    if (bostakiler.length === 0) return git();
    Alert.alert(t('gunler.uyariBaslik', { n: bostakiler.length }), t('gunler.uyariMetin'), [
      { text: t('genel.vazgec'), style: 'cancel' },
      { text: t('gunler.devam'), onPress: git },
    ]);
  };

  const merkez = otel ?? { lat: seyahat.lat, lng: seyahat.lng };

  return (
    <HaritaEkrani
      baslik={t('program.sekmeBaslik')}
      geri={() => router.replace('/(tabs)')}
      sagUst={
        <View style={s.sagUst}>
          <BilgiHapi metin={bostakiler.length > 0 ? t('gunler.bosta', { n: bostakiler.length }) : t('gunler.bostaYok')} />
          {sagUst}
        </View>
      }
      ustEk={
        <>
          <GunCipleri
            gunler={gunler}
            duraklar={duraklar}
            seciliId={seciliGun?.id}
            onSec={(id) => setSeciliGunId(id)}
            onUzunBas={gunuSil}
            onEkle={() => gunEkle.mutateAsync({ gunler, startDate: seyahat.start_date }).catch(() => setHata(t('gunler.hata')))}
            ekleniyor={gunEkle.isPending}
            yuzen
          />
          <View style={s.anahtarSatir}>
            {gorunumAnahtari}
            <Text style={s.ipucu}>{t('gunler.ipucu')}</Text>
          </View>
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
                        ? `${t('gunler.ozet', { n: tp.durakSayisi, gezi: sureMetni(tp.geziDk), yuruyus: `${tp.kestirim ? '~' : ''}${sureMetni(tp.yuruyusDk)}` })}${
                            tp.taksiDk > 0 ? ` + ${tp.kestirim ? '~' : ''}${t('gunler.taksi', { sure: sureMetni(tp.taksiDk) })}` : ''
                          }`
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
            <Text style={s.not}>{matris.hata || rota.hata ? t('program.yuruyusHata') : t('gunler.kestirimNot')}</Text>
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
  sagUst: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  anahtarSatir: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  ipucu: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil, flexShrink: 1 },
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
