import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HaritaEkrani } from '@/components/harita/HaritaEkrani';
import type { HaritaCizgisi, HaritaPini } from '@/components/harita/tipler';
import { useDuragaAta, useDurakKaldir } from '@/features/gunler/sorgular';
import { bacakListesi } from '@/features/program/sorgular';
import type { ProgramVerisi } from '@/features/program/useProgramVerisi';
import { useHafifYerler } from '@/features/yerler/api';
import { t } from '@/i18n';
import { sureMetni } from '@/lib/kategori';
import { pinIkonu } from '@/lib/pinIkonu';
import { polylineCoz } from '@/lib/polyline';
import type { Durak, Gun, Mekan, Seyahat } from '@/lib/tipler';
import { enUcuzEklemeIndeksi } from '@/schedule/program';
import { bacakModu, enYakinGun } from '@/schedule/tempo';
import { gunRengi, renk, yazi } from '@/theme';

// PRD 3.3 KK3: 20 dk yürüyüş ≈ 1,5 km.
const YURUME_YARICAPI_M = 1500;

export type GunlerHaritasiProps = {
  seyahat: Seyahat;
  gunler: Gun[];
  duraklar: Durak[];
  mekanlar: Mekan[];
  seciliGun: Gun | undefined;
  onGunSec: (id: string | null) => void;
  /** Paylaşılan veri: matris, gerçek rota, tempolar (#39, useProgramVerisi). */
  verisi: ProgramVerisi;
  /** #39 KK1–4: anahtar + gün kartları + ipucu (ProgramUstu). */
  ustEk: ReactNode;
  /** Sağ üst: üye avatarları. */
  sagUst?: ReactNode;
  onCizelgeyeGec: () => void;
};

/**
 * PRD 3.5 Günlere dağıt — Program sekmesinin **Harita** görünümü (HaritaEkrani kabuğu). #39 v0.4:
 * üstte ortak başlık (ProgramUstu), altta **katlanır** tempo paneli (varsayılan katlı: tek satır özet + çubuk + ok;
 * tutamaktan yukarı çekilince tam panel). Harita ekranın en az %65'i. KK2 gün seç → pine dokun (ata / kaldır);
 * KK3 gün renkleri; KK4 otel pini + daire; KK6 boştaki için en yakın gün. #30 ikonlu pinler, #33 gerçek rota + taksi bacağı.
 */
export function GunlerHaritasi({ seyahat, gunler, duraklar, mekanlar, seciliGun, onGunSec, verisi, ustEk, sagUst, onCizelgeyeGec }: GunlerHaritasiProps) {
  const ata = useDuragaAta(seyahat.id);
  const kaldir = useDurakKaldir(seyahat.id);
  const [hata, setHata] = useState<string | null>(null);
  const [panelAcik, setPanelAcik] = useState(false);
  const { otel, tempolar, rotalar, bacak, seciliNoktalar } = verisi;
  const mekanIle = useMemo(() => new Map(mekanlar.map((m) => [m.id, m])), [mekanlar]);
  const durakIle = new Map(duraklar.map((d) => [d.place_ref, d]));
  const gunIndex = new Map(gunler.map((g) => [g.id, g.index]));
  const bostakiler = mekanlar.filter((m) => !durakIle.has(m.id));

  // Adlar canlı (PRD §7): pin etiketleri, tempo önerileri ve boşta önerisi için.
  const adlar = useHafifYerler(mekanlar.map((m) => m.place_id));
  const adi = (m: Mekan | undefined) => (m ? (adlar.data?.[m.place_id]?.ad ?? '…') : '…');

  // KK6: ilk boştaki mekan için en yakın gün.
  const bostaOneri = useMemo(() => {
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
  }, [duraklar, gunler, mekanlar, mekanIle]);

  // #30: pin numarası = gün içi sıra (§5.1 ya da elle); rota çizgisiyle okunur.
  const gunSiralari = new Map<string, number>();
  for (const g of gunler) tempolar.get(g.id)?.sira.forEach((mekanId, i) => gunSiralari.set(mekanId, i + 1));

  const pinler: HaritaPini[] = [
    ...(otel ? [{ id: 'otel', tur: 'otel' as const, konum: otel, renk: renk.metin }] : []),
    ...mekanlar.map((m) => {
      const d = durakIle.get(m.id);
      const idx = d ? gunIndex.get(d.day_id) : undefined;
      const hafif = adlar.data?.[m.place_id];
      const ortak = { id: `m:${m.id}`, konum: { lat: m.lat, lng: m.lng }, ad: adi(m), puan: hafif?.puan ?? null, yorumSayisi: hafif?.puan_sayisi ?? null };
      if (idx) {
        const sira = gunSiralari.get(m.id);
        return { ...ortak, tur: 'durak' as const, renk: gunRengi(idx), etiket: sira ? String(sira) : '' };
      }
      return { ...ortak, tur: 'bos' as const, renk: renk.metin, ikon: pinIkonu(m.primary_type) };
    }),
  ];

  // #33: seçili gün bacak bacak gerçek yol (araç bacağı kesikli + 🚕); gelene kadar kuş uçuşu. Diğer günler kuş uçuşu %30.
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
      const r = rotalar[`${b.from.key}>${b.to.key}`];
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
        // T7: elle sıralanmış günde yeni durak en ucuz noktaya; otomatik günde sıra 3.7'de yeniden hesaplanır.
        const ekleIndeksi = seciliGun.order_manual
          ? enUcuzEklemeIndeksi(
              gunDuraklari.filter((d) => !d.skipped).map((d) => mekanIle.get(d.place_ref)).filter((m): m is Mekan => !!m).map((m) => ({ key: m.place_id, konum: { lat: m.lat, lng: m.lng } })),
              { key: mekan.place_id, konum: { lat: mekan.lat, lng: mekan.lng } },
              otel,
              verisi.yuruyus,
            )
          : undefined;
        await ata.mutateAsync({ mekan, gunId: seciliGun.id, mevcut, gunDuraklari, ekleIndeksi });
      }
    } catch {
      setHata(t('gunler.hata'));
    }
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

  // #39 KK6: tutamak — dokun → aç/kapat; yukarı çek → aç, aşağı çek → kapat.
  const tutamak = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_, g) => {
          if (g.dy < -20) setPanelAcik(true);
          else if (g.dy > 20) setPanelAcik(false);
          else setPanelAcik((a) => !a);
        },
      }),
    [],
  );

  const merkez = otel ?? { lat: seyahat.lat, lng: seyahat.lng };
  const seciliTempo = seciliGun ? tempolar.get(seciliGun.id) : undefined;
  const oneriMetni = (g: Gun) => {
    const tp = tempolar.get(g.id);
    if (!tp) return '';
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
    return [oneri, yakin].filter(Boolean).join(' · ');
  };
  const k = (tp: NonNullable<typeof seciliTempo>) => (tp.kestirim ? '~' : '');

  return (
    <HaritaEkrani
      baslik={seyahat.city_label}
      geri={() => router.replace('/(tabs)')}
      sagUst={sagUst}
      ustEk={ustEk}
      altPanel={
        <>
          {/* KK5: katlı özet — tutamak, tek satır, kısa ilerleme çubuğu, ok; altında bir satır öneri. */}
          <View {...tutamak.panHandlers} accessibilityRole="button" accessibilityLabel={panelAcik ? t('gunler.paneliKapat') : t('gunler.paneliAc')} style={s.tutamakAlan}>
            <View style={s.tutamakCizgi} />
            {seciliGun ? (
              <View style={s.ozetSatir}>
                <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                  <Text style={s.ozet} numberOfLines={1}>
                    {seciliTempo && seciliTempo.durakSayisi > 0
                      ? `${t('gunler.ozetKisa', {
                          gun: seciliGun.index,
                          tempo: t(`gunler.tempo.${seciliTempo.etiket}`),
                          n: seciliTempo.durakSayisi,
                          gezi: sureMetni(seciliTempo.geziDk),
                          yuruyus: `${k(seciliTempo)}${sureMetni(seciliTempo.yuruyusDk)}`,
                        })}${seciliTempo.taksiDk > 0 ? t('gunler.ozetKisaTaksi', { taksi: `${k(seciliTempo)}${sureMetni(seciliTempo.taksiDk)}` }) : ''} · ${seciliTempo.baslangic} → ${seciliTempo.bitis}`
                      : t('gunler.ozetKisaBos', { gun: seciliGun.index })}
                  </Text>
                  <View style={s.cubukKisa}>
                    <View
                      style={[
                        s.cubukDolu,
                        {
                          width: `${Math.min(100, Math.round((seciliTempo?.doluluk ?? 0) * 100))}%`,
                          backgroundColor: seciliTempo?.etiket === 'yogun' ? renk.vurgu : gunRengi(seciliGun.index),
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={s.ok}>{panelAcik ? '⌄' : '⌃'}</Text>
              </View>
            ) : null}
            {seciliGun && !panelAcik ? (
              <Text style={s.oneri} numberOfLines={1}>
                {oneriMetni(seciliGun) || t('gunler.ipucu')}
              </Text>
            ) : null}
          </View>

          {panelAcik ? (
            <>
              <ScrollView style={s.panelKaydirma} contentContainerStyle={s.panelIcerik} showsVerticalScrollIndicator={false}>
                {gunler.map((g) => {
                  const tp = tempolar.get(g.id);
                  if (!tp) return null;
                  const rengi = gunRengi(g.index);
                  const oneri = oneriMetni(g);
                  return (
                    <Pressable key={g.id} accessibilityRole="button" onPress={() => onGunSec(g.id)} style={[s.kart, g.id === seciliGun?.id && s.kartSecili]}>
                      <View style={s.kartUst}>
                        <View style={s.kartBaslik}>
                          <View style={[s.kartNumara, { backgroundColor: rengi }]}>
                            <Text style={s.kartNumaraMetin}>{g.index}</Text>
                          </View>
                          <Text style={s.kartAd}>{t('program.gunSec', { n: g.index })}</Text>
                        </View>
                        <View style={[s.etiket, ETIKET_ZEMIN[tp.etiket]]}>
                          <Text style={[s.etiketMetin, ETIKET_METIN[tp.etiket]]}>{t(`gunler.tempo.${tp.durakSayisi > 0 ? tp.etiket : 'bos'}`)}</Text>
                        </View>
                      </View>
                      <View style={s.cubuk}>
                        <View style={[s.cubukDolu, { width: `${Math.min(100, Math.round(tp.doluluk * 100))}%`, backgroundColor: tp.etiket === 'yogun' ? renk.vurgu : rengi }]} />
                      </View>
                      <View style={s.kartSatir}>
                        <Text style={s.kartAlt}>
                          {tp.durakSayisi > 0
                            ? `${t('gunler.ozet', { n: tp.durakSayisi, gezi: sureMetni(tp.geziDk), yuruyus: `${k(tp)}${sureMetni(tp.yuruyusDk)}` })}${
                                tp.taksiDk > 0 ? ` + ${k(tp)}${t('gunler.taksi', { sure: sureMetni(tp.taksiDk) })}` : ''
                              }`
                            : t('gunler.ozetBos')}
                        </Text>
                        <Text style={s.kartAlt}>{t('gunler.saatler', { bas: tp.baslangic, bit: tp.bitis })}</Text>
                      </View>
                      {oneri ? <Text style={[s.oneri, { textAlign: 'left' }, tp.etiket === 'yogun' && { color: renk.uyari }]}>{oneri}</Text> : null}
                    </Pressable>
                  );
                })}
                <Text style={s.not}>{verisi.matrisHata || verisi.rotaHata ? t('program.yuruyusHata') : t('gunler.kestirimNot')}</Text>
              </ScrollView>
              <Pressable accessibilityRole="button" onPress={programaGec} style={s.gecDugme}>
                <Text style={s.gecMetin}>{t('gunler.programaGec')} →</Text>
              </Pressable>
            </>
          ) : null}
          {hata ? <Text style={s.hata}>{hata}</Text> : null}
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
  tutamakAlan: { gap: 8, paddingBottom: 2 },
  tutamakCizgi: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: renk.ayrac, marginTop: -6 },
  ozetSatir: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ozet: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  cubukKisa: { height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', overflow: 'hidden', width: '60%' },
  ok: { fontFamily: yazi.kalin, fontSize: 18, lineHeight: 20, color: renk.ikincil, width: 20, textAlign: 'center' },
  oneri: { fontFamily: yazi.yari, fontSize: 12, color: renk.metin },
  // Harita ekranın en az %65'i: açık panel sınırlı yükseklikte kayar.
  panelKaydirma: { maxHeight: 220 },
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
  not: { fontFamily: yazi.normal, fontSize: 10, color: renk.soluk, textAlign: 'center', paddingTop: 2 },
  gecDugme: { alignSelf: 'center', height: 36, paddingHorizontal: 16, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  gecMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});
