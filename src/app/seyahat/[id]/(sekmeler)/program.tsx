import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { HaritaEkrani } from '@/components/harita/HaritaEkrani';
import { CizelgeListesi } from '@/components/program/CizelgeListesi';
import { GunKartlari } from '@/components/program/GunKartlari';
import { MiniCubuk } from '@/components/program/MiniCubuk';
import { PinPaneli } from '@/components/program/PinPaneli';
import { PuanSayfasi } from '@/components/program/PuanSayfasi';
import { ProgramUstu } from '@/components/program/ProgramUstu';
import { SecimMenusu, type SecimSecenegi } from '@/components/program/SecimMenusu';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { useDuragaAta, useDuraklar, useDurakKaldir, useGunEkle, useGunler, useGunSil } from '@/features/gunler/sorgular';
import { useKonum, yakinDurakId } from '@/features/konum/useKonum';
import { useMekanGuncelle, useMekanlar, useMekanSil, useUyeler } from '@/features/mekanlar/sorgular';
import { programCizgileri, programPinleri } from '@/features/program/haritaVerisi';
import { useDurakGuncelle, useGunGuncelle, useSiraYaz } from '@/features/program/sorgular';
import { gunDuraklari, saatKisa, useGunProgrami, useSimdi } from '@/features/program/useProgram';
import { useProgramVerisi } from '@/features/program/useProgramVerisi';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { usePuanKaydet, usePuanlar } from '@/features/puanlar/sorgular';
import { useHafifYerler, useMekanOzeti, useOnizleme } from '@/features/yerler/api';
import { t } from '@/i18n';
import { sureMetni } from '@/lib/kategori';
import { onayIste } from '@/lib/onay';
import { useOturum } from '@/lib/oturum';
import { AYLAR, GUNLER, haftaGunu, parcala } from '@/lib/takvim';
import type { Durak, Gun, Mekan, Seyahat } from '@/lib/tipler';
import { kacinciGun, yerelAn } from '@/lib/zaman';
import { kaydirSuresi } from '@/schedule/kaydir';
import { enUcuzEklemeIndeksi, yuruyusDk } from '@/schedule/program';
import { arasindaAnahtar } from '@/schedule/sira';
import { varsayilanSira } from '@/schedule/siralama';
import { dakikaSaat, kestirimYuruyusSn, saatDakika } from '@/schedule/tempo';
import { gunRengi, minDokunma, renk, yazi } from '@/theme';

// PRD 3.3 KK3: 20 dk yürüyüş ≈ 1,5 km.
const YURUME_YARICAPI_M = 1500;
/** #45 §3: yarı açık panel ekranın ~%55'i. */
const YARI_ORANI = 0.55;

/** #45 §3: alt panel üç hal. */
type PanelHali = 'katli' | 'yari' | 'tam';

/**
 * #42 Program v0.5 — tek ekran: harita + alt panel. Panel katlıyken tek satır özet (seyahat gününde canlı ilerleme);
 * yukarı çekilince çizelge (3.7) aynı panelde açılır. Pine dokununca panel "pin paneli"ne döner (gün atama, süre, detay).
 * #43: "Vardık" → "Tamamlandı" + otomatik tamamlanma; konumla sessiz varış kaydı.
 */
export default function ProgramEkrani() {
  const id = useSeyahatId();
  const { gun: gunParam } = useLocalSearchParams<{ gun?: string }>();
  const seyahat = useSeyahat(id);
  const gunler = useGunler(id);
  const duraklar = useDuraklar(id);
  const mekanlar = useMekanlar(id);
  if (!id || !seyahat.data || !gunler.data || !duraklar.data || !mekanlar.data) {
    return <SeyahatYukleme sorgular={[seyahat, gunler, duraklar, mekanlar]} kimlikYok={!id} />;
  }
  return <ProgramSekmesi key={id} seyahat={seyahat.data} gunler={gunler.data} duraklar={duraklar.data} mekanlar={mekanlar.data} gunParam={gunParam} />;
}

/** "Pazartesi 12 Ekim" / "1. gün". */
function gunBasligi(gun: Gun): string {
  if (!gun.date) return t('program.altTarihsiz');
  const { ay, gun: g } = parcala(gun.date);
  return `${GUNLER[haftaGunu(gun.date)]} ${g} ${AYLAR[ay - 1]}`;
}

function ProgramSekmesi({ seyahat, gunler, duraklar, mekanlar, gunParam }: { seyahat: Seyahat; gunler: Gun[]; duraklar: Durak[]; mekanlar: Mekan[]; gunParam?: string }) {
  const { session } = useOturum();
  const ekran = useWindowDimensions();
  const uyeler = useUyeler(seyahat.id);
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
  const [seciliGunId, setSeciliGunId] = useState<string | null>(null);
  const gun = gunler.find((g) => g.id === seciliGunId) ?? gunler.find((g) => String(g.index) === gunParam) ?? gunler.find((g) => g.index === bugunIndex) ?? gunler[0];
  const [panel, setPanel] = useState<PanelHali>('katli');
  const [puanDurakId, setPuanDurakId] = useState<string | null>(null);
  const [pinMenuAcik, setPinMenuAcik] = useState(false);
  const [listeMenuAcik, setListeMenuAcik] = useState(false);
  const [seciliMekanId, setSeciliMekanId] = useState<string | null>(null);
  const [duzenle, setDuzenle] = useState(false);
  const [menuDurak, setMenuDurak] = useState<Durak | null>(null);
  const [gunSecDurak, setGunSecDurak] = useState<Durak | null>(null);
  const [korunan, setKorunan] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const verisi = useProgramVerisi({ seyahat, gunler, duraklar, mekanlar, seciliGun: gun });
  const { otel } = verisi;
  const mekanIle = useMemo(() => new Map(mekanlar.map((m) => [m.id, m])), [mekanlar]);
  const durakIle = useMemo(() => new Map(duraklar.map((d) => [d.place_ref, d])), [duraklar]);
  const gunDurak = useMemo(() => (gun ? gunDuraklari(gun, duraklar) : []), [gun, duraklar]);
  const gunMekanlari = useMemo(() => gunDurak.map((d) => mekanIle.get(d.place_ref)).filter((m): m is Mekan => !!m), [gunDurak, mekanIle]);
  const bostakiler = mekanlar.filter((m) => !durakIle.has(m.id)).length;

  // Adlar canlı (PRD §7); günün durakları için saatler (KK5). Tek sorgu: saatli, tüm mekanlar.
  const yerler = useHafifYerler(
    mekanlar.map((m) => m.place_id),
    { saatler: true },
  );
  const adi = (durakId: string) => {
    const d = duraklar.find((x) => x.id === durakId);
    const m = d ? mekanIle.get(d.place_ref) : undefined;
    return (m && yerler.data?.[m.place_id]?.ad) || '…';
  };
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
    () => (konum ? yakinDurakId(konum, gunDurak.filter((d) => !d.skipped).map((d) => ({ id: d.id, konum: mekanIle.get(d.place_ref) ?? { lat: 0, lng: 0 } }))) : null),
    [konum, gunDurak, mekanIle],
  );
  const prog = useGunProgrami({ seyahat, gun, duraklar, mekanlar, yuruyus: verisi.yuruyus, an, buradaId: konum ? buradaId : undefined });

  // T7: elle sıralanmamış günde §5.1 sırası gerçek yürüyüşle hesaplanır ve farklıysa yazılır (herkes aynı sırayı görür).
  const sonYazilan = useRef('');
  useEffect(() => {
    if (!gun || gun.order_manual || verisi.matrisYukleniyor || gunMekanlari.length < 2) return;
    const aktifler = gunDurak.filter((d) => !d.skipped);
    const noktalar = aktifler.map((d) => mekanIle.get(d.place_ref)).filter((m): m is Mekan => !!m);
    if (noktalar.length !== aktifler.length) return;
    const key = (i: number) => (i < 0 ? 'hotel' : noktalar[i].place_id);
    const konumu = (i: number) => (i < 0 ? otel! : { lat: noktalar[i].lat, lng: noktalar[i].lng });
    const mesafe = (a: number, b: number) => verisi.yuruyus(key(a), key(b))?.sn ?? kestirimYuruyusSn(konumu(a), konumu(b));
    const sira = varsayilanSira(noktalar.length, mesafe, !!otel);
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
  }, [gun?.id, gun?.order_manual, verisi.matrisYukleniyor, gunDurak.map((d) => `${d.id}:${d.skipped}`).join(',')]);

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

  // #43 KK4: konum 60 m içine girince varış sessizce yazılır (istatistik).
  const varisYazilan = useRef(new Set<string>());
  useEffect(() => {
    if (!buradaId) return;
    const d = gunDurak.find((x) => x.id === buradaId);
    if (!d || d.arrived_at || varisYazilan.current.has(d.id)) return;
    varisYazilan.current.add(d.id);
    durakGuncelle.mutateAsync({ id: d.id, arrived_at: new Date().toISOString(), arrived_by: session?.user.id ?? null }).catch(() => varisYazilan.current.delete(d.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buradaId]);

  // Seçili mekan (pin paneli) — önizleme fotoğrafıyla. Mekan silinmişse panel kendiliğinden kapanır (türetilmiş).
  const seciliMekan = seciliMekanId ? mekanIle.get(seciliMekanId) : undefined;
  // #45 §6: foto + editoryal özet yalnız pin paneli açıkken (pahalı SKU).
  const mekanOzeti = useMekanOzeti(seciliMekan?.place_id);
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
    // T7: elle sıralanmış günde en ucuz noktaya; otomatik günde sıra 3.7 akışında yeniden hesaplanır.
    const ekleIndeksi = hedef.order_manual
      ? enUcuzEklemeIndeksi(
          hedefDuraklar.filter((d) => !d.skipped).map((d) => mekanIle.get(d.place_ref)).filter((m): m is Mekan => !!m).map((m) => ({ key: m.place_id, konum: { lat: m.lat, lng: m.lng } })),
          { key: mekan.place_id, konum: { lat: mekan.lat, lng: mekan.lng } },
          otel,
          verisi.yuruyus,
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
  const listedenCikar = async (m: Mekan) => {
    const onay = await onayIste(t('program.pin.cikarBaslik'), t('program.pin.cikarMetin', { ad: yerler.data?.[m.place_id]?.ad ?? '…' }), t('mekan.cikarOnay'), t('genel.vazgec'));
    if (!onay) return;
    setSeciliMekanId(null);
    guvenli(() => mekanSil.mutateAsync(m.id));
  };
  const tasi = async (from: number, to: number) => {
    if (!gun) return;
    const liste = gunDurak.slice();
    const [eleman] = liste.splice(from, 1);
    liste.splice(to, 0, eleman);
    guvenli(async () => {
      await durakGuncelle.mutateAsync({ id: eleman.id, order_key: arasindaAnahtar(liste[to - 1]?.order_key, liste[to + 1]?.order_key) });
      if (!gun.order_manual) await gunGuncelle.mutateAsync({ id: gun.id, order_manual: true });
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

  // §5.4 mini-çubuk eylemleri (#43 KK5): Kaydır = süreyi fiilen geçene çek + otomatik tamamlamayı geri al.
  const cubuk = prog?.cubuk && korunan !== `${prog.cubuk.tur}:${'durakId' in prog.cubuk ? prog.cubuk.durakId : prog.cubuk.hedefId}` ? prog.cubuk : null;
  const kaydir = () => {
    if (!cubuk || !prog || prog.simdiDk === null || cubuk.tur !== 'uzun') return;
    const d = gunDurak.find((x) => x.id === cubuk.durakId);
    const satir = prog.canli.satirlar.find((x) => x.durak.id === cubuk.durakId);
    if (d && satir) guvenli(() => durakGuncelle.mutateAsync({ id: d.id, minutes: kaydirSuresi(satir.varisDk, prog.simdiDk!), completed_at: null, completed_by: null, auto_completed: false }));
  };
  const cubukAtla = () => {
    if (!cubuk || !prog) return;
    const hedefId = cubuk.tur === 'uzun' ? prog.canli.satirlar.find((x) => x.durum === 'siradaki' || x.durum === 'buradasin')?.durak.id : cubuk.hedefId;
    const d = hedefId ? gunDurak.find((x) => x.id === hedefId) : undefined;
    if (d) atla(d);
  };
  const koru = () => cubuk && setKorunan(`${cubuk.tur}:${'durakId' in cubuk ? cubuk.durakId : cubuk.hedefId}`);

  // Uzun bas menüsü: Başka güne al / Atla / Günden çıkar (+ Tamamlamayı geri al, #43 KK3).
  const menuSecenekleri: SecimSecenegi[] = menuDurak
    ? [
        { etiket: t('program.detay'), onPress: () => detayAc(menuDurak.place_ref) },
        ...(menuDurak.completed_at ? [{ etiket: t('program.tamamlamayiGeriAl'), onPress: () => tamamla(menuDurak, true) }] : []),
        { etiket: t('program.baskaGuneAl'), onPress: () => setGunSecDurak(menuDurak), pasif: gunler.length < 2 },
        { etiket: menuDurak.skipped ? t('program.menuAtlama') : t('program.menuAtla'), onPress: () => atla(menuDurak) },
        { etiket: t('program.menuCikar'), onPress: () => gundenCikar(menuDurak), tehlike: true },
      ]
    : [];
  const gunSecenekleri: SecimSecenegi[] =
    gunSecDurak && gun
      ? gunler.filter((g) => g.id !== gun.id).map((g) => ({ etiket: `${t('program.guneAl', { n: g.index })} · ${gunBasligi(g)}`, onPress: () => baskaGuneAl(gunSecDurak, g) }))
      : [];

  const detayAc = (mekanId: string) => {
    const m = mekanIle.get(mekanId);
    if (m) router.push({ pathname: '/seyahat/[id]/mekan/[placeId]', params: { id: seyahat.id, placeId: m.place_id } });
  };
  const kesfeteGit = () => router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: { id: seyahat.id } });

  // #45 §3: tutamak — dokun: katlı ↔ yarı; yukarı çek: bir hal yukarı (sonuna kadar çekmek tam ekran); aşağı çek: bir hal aşağı.
  const tutamak = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_, g) => {
          if (g.dy < -20) setPanel((h) => (h === 'katli' && g.dy > -220 ? 'yari' : 'tam'));
          else if (g.dy > 20) setPanel((h) => (h === 'tam' && g.dy < 220 ? 'yari' : 'katli'));
          else setPanel((h) => (h === 'katli' ? 'yari' : 'katli'));
        },
      }),
    [],
  );

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
  const pinler = programPinleri({ otel, mekanlar, duraklar, gunler, tempolar: verisi.tempolar, adlar: yerler.data, seciliGunId: gun?.id, seciliMekanId, tamamlananMekanIds, konum });
  const cizgiler = programCizgileri({ otel, mekanIle, gunler, tempolar: verisi.tempolar, seciliGunId: gun?.id, seciliNoktalar: verisi.seciliNoktalar, rotalar: verisi.rotalar, bacak: verisi.bacak, gecilenBacak });

  // ---------------------------------------------------------------- üst
  const siradaki = satirlar.find((x) => x.durum === 'siradaki' || x.durum === 'buradasin');
  const puanlanmamis = satirlar.filter((x) => {
    if (x.durum !== 'gecildi') return false;
    const ref = gunDurak.find((d) => d.id === x.durak.id)?.place_ref;
    return !!ref && !puanim(ref);
  });
  // #45 §2: üst satırda yalnız "‹ Şehir" + avatarlar ("Şu an" hapı kalktı).
  const sagUst = (
    <View style={s.sagUst}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('seyahat.grup.baslik')}
        onPress={() => router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/grup', params: { id: seyahat.id } })}
        style={[s.avatarlar, s.golge]}>
        {(uyeler.data ?? []).slice(0, 3).map((u, i) => (
          <View key={u.user_id} style={[s.avatarCerceve, i > 0 && { marginLeft: -8 }]}>
            <Avatar ad={u.display_name} boyut={26} arkaPlan={['#0f0f0f', '#ff5a1f', '#4c6ef5'][i % 3]} />
          </View>
        ))}
      </Pressable>
    </View>
  );
  // #47 C11: gün bittiyse ipucu yok.
  const ipucu = bugun ? (prog && prog.canli.toplam > 0 && !siradaki ? '' : t('program.ipucuBugun')) : bostakiler > 0 ? t('program.ipucu', { n: bostakiler }) : t('program.ipucuBostaYok');

  // ---------------------------------------------------------------- panel
  const tempo = gun ? verisi.tempolar.get(gun.id) : undefined;
  const ozetSatiri = () => {
    if (!gun || !prog) return '';
    if (prog.bugun && prog.simdiDk !== null && prog.canli.toplam > 0) {
      // #47 C10: bitince ✓ + "puanlamadığın N durak var" (dokununca ilk puanlanmamış).
      if (!siradaki) return puanlanmamis.length > 0 ? t('program.ilerlemeBittiPuan', { n: prog.canli.toplam, k: puanlanmamis.length }) : t('program.ilerlemeBitti', { n: prog.canli.toplam });
      const k = prog.canli.tamamlanan + 1;
      return siradaki.durum === 'buradasin'
        ? t('program.ilerlemeBurada', { ad: adi(siradaki.durak.id), k, n2: prog.canli.toplam })
        : t('program.ilerleme', { ad: adi(siradaki.durak.id), n: Math.max(0, siradaki.varisDk - prog.simdiDk) || (siradaki.yuruyus ? yuruyusDk(siradaki.yuruyus) : 0), k, n2: prog.canli.toplam });
    }
    if (!tempo || tempo.durakSayisi === 0) return t('program.ozetGunBos', { gun: gun.index });
    const k = tempo.kestirim ? '~' : '';
    return `${t('program.ozetGun', { gun: gun.index, n: tempo.durakSayisi, gezi: sureMetni(tempo.geziDk), yuruyus: `${k}${sureMetni(tempo.yuruyusDk)}` })}${
      tempo.taksiDk > 0 ? t('program.ozetGunTaksi', { taksi: `${k}${sureMetni(tempo.taksiDk)}` }) : ''
    }${t('program.ozetGunSaat', { bas: tempo.baslangic, bit: tempo.bitis })}`;
  };
  const bittiMi = !!prog?.bugun && prog.simdiDk !== null && prog.canli.toplam > 0 && !siradaki;
  const ozetAlt = () => {
    if (!prog?.bugun || prog.simdiDk === null || !siradaki) return '';
    const sonTamam = [...satirlar].reverse().find((x) => x.durum === 'gecildi');
    const ortak = { sonraki: adi(siradaki.durak.id), bas: dakikaSaat(siradaki.varisDk), bit: dakikaSaat(siradaki.ayrilisDk), son: dakikaSaat(prog.canli.bitisDk) };
    return sonTamam ? t('program.ilerlemeAlt', { ...ortak, tamam: adi(sonTamam.durak.id), saat: dakikaSaat(sonTamam.ayrilisDk) }) : t('program.ilerlemeAltIlk', ortak);
  };
  const ilerleme = prog?.bugun && prog.canli.toplam > 0 ? prog.canli.tamamlanan / prog.canli.toplam : Math.min(1, tempo?.doluluk ?? 0);
  const cubukRengi = prog?.bugun ? renk.basari : tempo?.etiket === 'yogun' ? renk.vurgu : gun ? gunRengi(gun.index) : renk.metin;
  const baslangicSaati = gun ? saatKisa(gun.start_time, saatKisa(seyahat.day_start, '09:00')) : '09:00';
  // Liste yüksekliği: yarı açık ~%55; tam ekranda gün kartlarının altından alta kadar (özet + başlık payı düşülür).
  const listeYuksekligi = Math.max(160, Math.round(ekran.height * YARI_ORANI) - 150);

  // Sıradaki durağın ilk fotoğrafı (kompakt kart) ve puanlanan durağın fotoğrafı.
  const siradakiMekan = siradaki ? mekanIle.get(gunDurak.find((d) => d.id === siradaki.durak.id)?.place_ref ?? '') : undefined;
  const siradakiFoto = useOnizleme(panel !== 'katli' && prog?.bugun ? siradakiMekan?.place_id : undefined);
  const puanDurak = puanDurakId ? gunDurak.find((d) => d.id === puanDurakId) : undefined;
  const puanMekan = puanDurak ? mekanIle.get(puanDurak.place_ref) : undefined;
  const puanFoto = useOnizleme(puanMekan?.place_id);
  const puanSatir = puanDurakId ? satirlar.find((x) => x.durak.id === puanDurakId) : undefined;

  const altPanel = seciliMekan ? (
    <PinPaneli
      mekan={seciliMekan}
      yer={mekanOzeti.data ?? yerler.data?.[seciliMekan.place_id]}
      ozet={mekanOzeti.data?.ozet}
      ekleyenAd={uyeAdi(seciliMekan.added_by)}
      dakika={durakIle.get(seciliMekan.id)?.minutes ?? seciliMekan.default_minutes}
      gunler={gunler}
      mevcutGunId={durakIle.get(seciliMekan.id)?.day_id ?? null}
      mesgul={ata.isPending || mekanSil.isPending}
      onGunSec={(g) => guneAta(seciliMekan, g)}
      onSure={(fark) => mekanSuresi(seciliMekan, fark)}
      onDetay={() => detayAc(seciliMekan.id)}
      onYolTarifi={() =>
        Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${seciliMekan.lat},${seciliMekan.lng}&destination_place_id=${encodeURIComponent(seciliMekan.place_id)}&travelmode=walking`,
        )
      }
      onDiger={() => setPinMenuAcik(true)}
      onKapat={() => setSeciliMekanId(null)}
    />
  ) : (
    <>
      <View
        {...tutamak.panHandlers}
        accessibilityRole="button"
        accessibilityLabel={panel !== 'katli' ? t('program.paneliKapat') : t('program.paneliAc')}
        style={s.tutamakAlan}>
        <View style={s.tutamakCizgi} />
        <View style={s.ozetSatir}>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <View style={s.ozetIc}>
              {prog?.bugun && prog.canli.toplam > 0 ? (
                <Ikon ad={bittiMi ? 'tik' : 'yurume'} boyut={16} renk={bittiMi ? renk.basari : renk.metin} kalinlik={2.2} />
              ) : null}
              <Text style={[s.ozet, { flexShrink: 1 }]} numberOfLines={1}>
                {ozetSatiri()}
              </Text>
            </View>
            {ozetAlt() ? (
              <Text style={s.ozetAlt} numberOfLines={1}>
                {ozetAlt()}
              </Text>
            ) : null}
            {/* #47 C9: çubuk tam genişlik; tamamlanan/toplam ile birebir. */}
            <View style={s.cubukKisa}>
              <View style={[s.cubukDolu, { width: `${Math.round(ilerleme * 100)}%`, backgroundColor: cubukRengi }]} />
            </View>
          </View>
          <Ikon ad={panel !== 'katli' ? 'asagi' : 'yukari'} boyut={20} renk={renk.ikincil} kalinlik={2.2} />
        </View>
      </View>
      {bittiMi && puanlanmamis.length > 0 && panel === 'katli' ? (
        <Pressable accessibilityRole="button" onPress={() => setPuanDurakId(puanlanmamis[0].durak.id)} style={s.puanlaHap}>
          <Text style={s.puanlaHapMetin}>{t('program.ilkiniPuanla')}</Text>
        </Pressable>
      ) : null}
      {cubuk ? <MiniCubuk cubuk={cubuk} adi={adi} onKaydir={kaydir} onAtla={cubukAtla} onKoru={koru} /> : null}
      {panel !== 'katli' && gun && prog ? (
        // #47 A2: tam ekranda liste kalan alanı doldurur (panel gün kartlarının altından alta).
        <View style={panel === 'tam' ? { flex: 1 } : { height: listeYuksekligi }}>
          {/* #45 §3: başlık "N. gün · 09:00 → 15:03" + ··· (Düzenle, Kısa rota) + ⤢ / ⤡. */}
          <View style={s.listeBaslik}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.basBit} numberOfLines={1}>
                {t('program.panelBaslik', { gun: gun.index, bas: baslangicSaati, bit: dakikaSaat(prog.canli.bitisDk) })}
              </Text>
              {tempo && tempo.durakSayisi > 0 ? (
                // #47 C12: tempo etiketi yok; yalnız toplam süre.
                <Text style={s.tempoMetin}>{sureMetni(tempo.geziDk + tempo.yuruyusDk + tempo.taksiDk)}</Text>
              ) : null}
            </View>
            {duzenle ? (
              <Pressable accessibilityRole="button" onPress={() => setDuzenle(false)} style={[s.kucukDugme, s.kucukDugmeAktif]}>
                <Text style={[s.kucukDugmeMetin, { color: renk.zemin }]}>{t('program.bitti')}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel={t('program.diger')} onPress={() => setListeMenuAcik(true)} style={s.ikonDugme}>
              <Ikon ad="daha" boyut={20} renk={renk.metin} kalinlik={2.2} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={panel === 'tam' ? t('program.yariAcik') : t('program.tamEkran')}
              onPress={() => setPanel((h) => (h === 'tam' ? 'yari' : 'tam'))}
              style={s.ikonDugme}>
              <Ikon ad={panel === 'tam' ? 'daralt' : 'genislet'} boyut={20} renk={renk.metin} kalinlik={2.2} />
            </Pressable>
          </View>
          {verisi.matrisHata ? <Text style={s.uyariMetin}>{t('program.yuruyusHata')}</Text> : null}
          {bugun && izin === 'reddedildi' ? <Text style={s.uyariMetin}>{t('program.konumIzni')}</Text> : null}
          <CizelgeListesi
            seyahat={seyahat}
            gun={gun}
            gunler={gunler}
            gunDurak={gunDurak}
            mekanIle={mekanIle}
            yerler={yerler.data}
            uyeAdi={uyeAdi}
            prog={prog}
            matrisYukleniyor={verisi.matrisYukleniyor}
            rotaYukleniyor={verisi.rotaYukleniyor}
            buradaId={konum ? buradaId : undefined}
            duzenle={duzenle}
            baslangicSaati={baslangicSaati}
            onTamamla={tamamla}
            onPuanla={(d) => setPuanDurakId(d.id)}
            onDetay={(d) => detayAc(d.place_ref)}
            puanim={puanim}
            siradakiFoto={siradakiFoto.data?.foto_uri}
            onYolTarifi={yolTarifi}
            onMenu={setMenuDurak}
            onGunSec={setGunSecDurak}
            onTasi={tasi}
            onSure={sureDegistir}
            onBaslangic={baslangicDegistir}
          />
        </View>
      ) : null}
      {panel === 'tam' ? (
        // #45 §3: tam ekranda altta ortada siyah "Haritada gör" hapı (katlanmış harita ikonu) — katlı hale döner.
        <Pressable accessibilityRole="button" onPress={() => setPanel('katli')} style={s.haritadaGor}>
          <Ikon ad="harita" boyut={18} renk={renk.zemin} kalinlik={2.2} />
          <Text style={s.haritadaGorMetin}>{t('program.haritadaGor')}</Text>
        </Pressable>
      ) : null}
      {hata ? <Text style={s.hata}>{hata}</Text> : null}
    </>
  );

  return (
    <>
      <HaritaEkrani
        baslik={seyahat.city_label}
        // #45 §1: "‹ Şehir" artık Keşfet'e gider.
        geri={kesfeteGit}
        sagUst={
          <View style={s.sagUst}>
            {panel === 'tam' && !seciliMekan ? (
              // Tam ekranda sağ üstte beyaz harita düğmesi.
              <Pressable accessibilityRole="button" accessibilityLabel={t('program.haritadaGor')} onPress={() => setPanel('katli')} style={[s.haritaDugme, s.golge]}>
                <Ikon ad="harita" boyut={20} renk={renk.metin} kalinlik={2.2} />
              </Pressable>
            ) : null}
            {sagUst}
          </View>
        }
        altMenuVar
        panelTam={panel === 'tam' && !seciliMekan}
        altSerbest={
          panel === 'katli' && !seciliMekan ? (
            // #45 §1: haritada sağda siyah "+" → Keşfet (mekan ekle).
            <View style={s.artiSatir} pointerEvents="box-none">
              <Pressable accessibilityRole="button" accessibilityLabel={t('program.mekanEkle')} onPress={kesfeteGit} style={[s.arti, s.golge]}>
                <Ikon ad="yeni" boyut={24} renk={renk.zemin} kalinlik={2.2} />
              </Pressable>
            </View>
          ) : null
        }
        ustEk={
          <ProgramUstu
            kartlar={
              <GunKartlari
                gunler={gunler}
                duraklar={duraklar}
                seciliId={gun?.id}
                bugunIndex={bugunIndex}
                onSec={(id) => {
                  setSeciliGunId(id);
                  setDuzenle(false);
                }}
                onUzunBas={gunuSil}
                onEkle={() => guvenli(() => gunEkle.mutateAsync({ gunler, startDate: seyahat.start_date }))}
                ekleniyor={gunEkle.isPending}
              />
            }
            ipucu={ipucu}
          />
        }
        altPanel={altPanel}
        harita={{
          merkez: otel ?? { lat: seyahat.lat, lng: seyahat.lng },
          zoom: otel ? 14 : 13,
          pinler,
          cizgiler,
          daireler: otel ? [{ id: 'yurume', merkez: otel, yaricapM: YURUME_YARICAPI_M, renk: renk.metin }] : [],
          // KK6: pine dokununca harita kaymaz (Harita bileşeni), panel pin paneline döner.
          onPinBas: (pinId) => {
            if (pinId.startsWith('m:')) setSeciliMekanId(pinId.slice(2));
          },
          // Haritaya dokununca pin paneli katlı özete döner.
          onHaritaBas: () => setSeciliMekanId(null),
        }}
      />
      <SecimMenusu acik={!!menuDurak} baslik={menuDurak ? adi(menuDurak.id) : undefined} secenekler={menuSecenekleri} onKapat={() => setMenuDurak(null)} />
      <SecimMenusu acik={!!gunSecDurak} baslik={t('mekan.gunSecBaslik')} secenekler={gunSecenekleri} onKapat={() => setGunSecDurak(null)} />
      <SecimMenusu
        acik={listeMenuAcik}
        secenekler={
          gun
            ? [
                { etiket: duzenle ? t('program.bitti') : t('program.duzenle'), onPress: () => setDuzenle((d) => !d) },
                { etiket: t('program.kisaRota'), onPress: enKisaRotayaDiz, pasif: !gun.order_manual },
              ]
            : []
        }
        onKapat={() => setListeMenuAcik(false)}
      />
      <SecimMenusu
        acik={pinMenuAcik && !!seciliMekan}
        baslik={seciliMekan ? (yerler.data?.[seciliMekan.place_id]?.ad ?? undefined) : undefined}
        secenekler={seciliMekan ? [{ etiket: t('program.pin.listedenCikar'), onPress: () => listedenCikar(seciliMekan), tehlike: true }] : []}
        onKapat={() => setPinMenuAcik(false)}
      />
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
    </>
  );
}

const s = StyleSheet.create({
  sagUst: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4 },
  avatarlar: { flexDirection: 'row', minHeight: minDokunma, alignItems: 'center', paddingHorizontal: 6, borderRadius: 999, backgroundColor: renk.zemin },
  avatarCerceve: { borderWidth: 2, borderColor: renk.zemin, borderRadius: 15 },
  tutamakAlan: { gap: 8, paddingBottom: 2 },
  tutamakCizgi: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: renk.ayrac, marginTop: -6 },
  ozetSatir: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ozet: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  ozetAlt: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  cubukKisa: { height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', overflow: 'hidden', width: '100%' },
  ozetIc: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  puanlaHap: { alignSelf: 'flex-start', height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  puanlaHapMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  cubukDolu: { height: '100%' },
  ok: { fontFamily: yazi.kalin, fontSize: 18, lineHeight: 20, color: renk.ikincil, width: 20, textAlign: 'center' },
  listeBaslik: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: renk.ayrac },
  basBit: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  tempoMetin: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  kucukDugme: { height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  kucukDugmeAktif: { backgroundColor: renk.metin },
  kucukDugmeMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  uyariMetin: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil, paddingTop: 6 },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
  // #47 B6: 40 px yuvarlak düğme, 20 px ikon.
  ikonDugme: { width: 40, height: 40, borderRadius: 20, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  haritadaGor: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 18, borderRadius: 999, backgroundColor: renk.metin, justifyContent: 'center', marginTop: 4 },
  haritadaGorMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin },
  haritaDugme: { width: 44, height: 44, borderRadius: 22, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  artiSatir: { alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 10 },
  arti: { width: 52, height: 52, borderRadius: 26, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
});

