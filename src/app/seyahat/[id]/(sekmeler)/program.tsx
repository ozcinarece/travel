import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { HaritaEkrani } from '@/components/harita/HaritaEkrani';
import type { HaritaSigdirma } from '@/components/harita/tipler';
import { CizelgeListesi } from '@/components/program/CizelgeListesi';
import { GunKartlari, gunEtiketKisa, gunEtiketUzun } from '@/components/program/GunKartlari';
import { GunOteliSayfasi } from '@/components/program/GunOteliSayfasi';
import { MiniCubuk } from '@/components/program/MiniCubuk';
import { OtelUcSatiri } from '@/components/program/OtelUcSatiri';
import { PinPaneli } from '@/components/program/PinPaneli';
import { PuanSayfasi } from '@/components/program/PuanSayfasi';
import { SecimMenusu, type SecimSecenegi } from '@/components/program/SecimMenusu';
import { SiralaListesi, type SiralaSatiri } from '@/components/program/SiralaListesi';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import type { Konaklama } from '@/features/konaklama/plan';
import { useGunOteliKaydet, useKonaklamalar } from '@/features/konaklama/sorgular';
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
import { kategoriPini } from '@/lib/pinIkonu';
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
/** #53 §6: "güne eklendi" kartı bu kadar sonra kendiliğinden kapanır. */
const KART_SURESI_MS = 6000;
/** #61 §5: sürükleme sonrası başlıktaki bitiş farkı bu kadar sonra kalkar. */
const BITIS_FARKI_MS = 8000;

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
  const konaklamalar = useKonaklamalar(id);
  if (!id || !seyahat.data || !gunler.data || !duraklar.data || !mekanlar.data || !konaklamalar.data) {
    return <SeyahatYukleme sorgular={[seyahat, gunler, duraklar, mekanlar, konaklamalar]} kimlikYok={!id} />;
  }
  return (
    <ProgramSekmesi
      key={id}
      seyahat={seyahat.data}
      gunler={gunler.data}
      duraklar={duraklar.data}
      mekanlar={mekanlar.data}
      konaklamalar={konaklamalar.data}
      gunParam={gunParam}
    />
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
}: {
  seyahat: Seyahat;
  gunler: Gun[];
  duraklar: Durak[];
  mekanlar: Mekan[];
  konaklamalar: Konaklama[];
  gunParam?: string;
}) {
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
  // #56 §2: günün oteli alt sayfası.
  const [otelSayfasi, setOtelSayfasi] = useState(false);
  const gunOteliKaydet = useGunOteliKaydet(seyahat.id);
  const [seciliMekanId, setSeciliMekanId] = useState<string | null>(null);
  const [duzenle, setDuzenle] = useState(false);
  const [menuDurak, setMenuDurak] = useState<Durak | null>(null);
  const [gunSecDurak, setGunSecDurak] = useState<Durak | null>(null);
  const [korunan, setKorunan] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  // #53 §6: boştaki pine dokununca eklenen mekan (kart).
  const [eklenen, setEklenen] = useState<{ mekanId: string; gunId: string } | null>(null);
  // #55 §A5–6: başlık + gün seçici yüksekliği (harita sığdırma ve hap gizleme payı).
  const [ustYukseklik, setUstYukseklik] = useState(0);
  // #55 §C10: planlama aşamasında uzun basılan durak / mekan (Başka güne al · Günden çıkar · Listeden sil).
  const [uzunBasilan, setUzunBasilan] = useState<Mekan | null>(null);
  // #53 §5: sürükle-bırak öncesi gün bitişi (başlıkta "−22 dk" farkı); #61 §5: 8 sn sonra silinir (kalıcı "+1 dk" belirsizdi).
  const [onceBitis, setOnceBitis] = useState<{ gunId: string; dk: number } | null>(null);
  useEffect(() => {
    if (!onceBitis) return;
    const z = setTimeout(() => setOnceBitis(null), BITIS_FARKI_MS);
    return () => clearTimeout(z);
  }, [onceBitis]);
  const qc = useQueryClient();

  const verisi = useProgramVerisi({ seyahat, gunler, duraklar, mekanlar, seciliGun: gun, konaklamalar });
  // #56: seçili günün başlangıç (otel) ve bitiş noktası.
  const { otel, seciliUclar } = verisi;
  const bitisOtel = seciliUclar.bitis ? { lat: seciliUclar.bitis.lat, lng: seciliUclar.bitis.lng } : null;
  const mekanIle = useMemo(() => new Map(mekanlar.map((m) => [m.id, m])), [mekanlar]);
  const durakIle = useMemo(() => new Map(duraklar.map((d) => [d.place_ref, d])), [duraklar]);
  const gunDurak = useMemo(() => (gun ? gunDuraklari(gun, duraklar) : []), [gun, duraklar]);
  const gunMekanlari = useMemo(() => gunDurak.map((d) => mekanIle.get(d.place_ref)).filter((m): m is Mekan => !!m), [gunDurak, mekanIle]);

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
  const prog = useGunProgrami({ seyahat, gun, duraklar, mekanlar, yuruyus: verisi.yuruyus, an, buradaId: konum ? buradaId : undefined, uclar: seciliUclar });

  // T7: elle sıralanmamış günde §5.1 sırası gerçek yürüyüşle hesaplanır ve farklıysa yazılır (herkes aynı sırayı görür).
  const sonYazilan = useRef('');
  useEffect(() => {
    if (!gun || gun.order_manual || verisi.matrisYukleniyor || gunMekanlari.length < 2) return;
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
  }, [gun?.id, gun?.order_manual, verisi.matrisYukleniyor, gunDurak.map((d) => `${d.id}:${d.skipped}`).join(','), seciliUclar.baslangic?.key, seciliUclar.bitis?.key]);

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
  const listedenCikar = async (m: Mekan) => {
    const onay = await onayIste(t('program.pin.cikarBaslik'), t('program.pin.cikarMetin', { ad: yerler.data?.[m.place_id]?.ad ?? '…' }), t('mekan.cikarOnay'), t('genel.vazgec'));
    if (!onay) return;
    setSeciliMekanId(null);
    guvenli(() => mekanSil.mutateAsync(m.id));
  };
  const tasi = async (from: number, to: number) => {
    if (!gun || from === to) return;
    const liste = gunDurak.slice();
    const [eleman] = liste.splice(from, 1);
    liste.splice(to, 0, eleman);
    const order_key = arasindaAnahtar(liste[to - 1]?.order_key, liste[to + 1]?.order_key);
    if (prog) setOnceBitis((o) => (o && o.gunId === gun.id ? o : { gunId: gun.id, dk: prog.canli.bitisDk }));
    // #53 §5: bırakınca numaralar, rota, saatler anında güncellenir (iyimser önbellek; sunucu yanıtıyla doğrulanır).
    qc.setQueryData<Durak[]>(['duraklar', seyahat.id], (eski) => eski?.map((d) => (d.id === eleman.id ? { ...d, order_key } : d)));
    if (!gun.order_manual) qc.setQueryData<Gun[]>(['gunler', seyahat.id], (eski) => eski?.map((g) => (g.id === gun.id ? { ...g, order_manual: true } : g)));
    guvenli(async () => {
      await durakGuncelle.mutateAsync({ id: eleman.id, order_key });
      if (!gun.order_manual) await gunGuncelle.mutateAsync({ id: gun.id, order_manual: true });
    });
  };
  // #53 §6: boştaki pine dokununca seçili güne eklenir; altta "güne eklendi · N. sıra" kartı (canlı sıra).
  // Ürün kararı: otomatik günde order_manual false kalır (§5.1 en uygun yere koyar), elle sıralı günde en ucuz
  // ekleme noktası (T7) — guneAta ile aynı kural; "sona ekle" sözü verilmez.
  const hizliEkle = (mekan: Mekan) => {
    if (!gun) return;
    setSeciliMekanId(null);
    setEklenen({ mekanId: mekan.id, gunId: gun.id });
    guneAta(mekan, gun);
  };
  const eklemeyiGeriAl = () => {
    const d = eklenen ? durakIle.get(eklenen.mekanId) : undefined;
    setEklenen(null);
    if (d) guvenli(() => durakKaldir.mutateAsync(d.id));
  };
  const eklenenTasi = (hedef: Gun) => {
    const m = eklenen ? mekanIle.get(eklenen.mekanId) : undefined;
    setEklenen(null);
    if (m) guneAta(m, hedef);
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
              { etiket: `${t('program.baskaGuneAl')} ›`, onPress: () => setGunSecDurak(uzunDurak), pasif: gunler.length < 2 },
              { etiket: t('program.menuCikar'), onPress: () => gundenCikar(uzunDurak) },
            ]
          : []),
        { etiket: t('program.listedenSil'), onPress: () => listedenSil(uzunBasilan), tehlike: true },
      ]
    : [];

  const detayAc = (mekanId: string) => {
    const m = mekanIle.get(mekanId);
    if (m) router.push({ pathname: '/seyahat/[id]/mekan/[placeId]', params: { id: seyahat.id, placeId: m.place_id } });
  };
  const kesfeteGit = () => router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: { id: seyahat.id } });


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
  const pinler = programPinleri({ gunUclari: verisi.gunUclari, mekanlar, duraklar, gunler, tempolar: verisi.tempolar, adlar: yerler.data, seciliGunId: gun?.id, seciliMekanId, tamamlananMekanIds, konum });
  const cizgiler = programCizgileri({ gunUclari: verisi.gunUclari, mekanIle, gunler, tempolar: verisi.tempolar, seciliGunId: gun?.id, seciliNoktalar: verisi.seciliNoktalar, rotalar: verisi.rotalar, bacak: verisi.bacak, gecilenBacak });

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
    // #53 §3: "1. gün · 5 durak · 09:00 → 14:40".
    // #55 §D12: tarihli seyahatte "Cuma, 16 Ekim · 4 durak · 09:00 → 13:36".
    if (!tempo || tempo.durakSayisi === 0) return t('program.ozetGunBos', { gun: gunEtiketUzun(gun) });
    return t('program.baslikOzet', { gun: gunEtiketUzun(gun), n: tempo.durakSayisi, bas: tempo.baslangic, bit: dakikaSaat(prog.canli.bitisDk) });
  };
  const bittiMi = !!prog?.bugun && prog.simdiDk !== null && prog.canli.toplam > 0 && !siradaki;
  // #53 §5: katlı panelin üst kenarında yeşil ilerleme çizgisi (tamamlanan/toplam; seyahat günü dışında boş).
  const ilerleme = prog?.bugun && prog.canli.toplam > 0 ? prog.canli.tamamlanan / prog.canli.toplam : 0;
  // #53 §5: sürükledikten sonra bitiş farkı ("−22 dk" yeşil / "+10 dk" kırmızı).
  const bitisFarki = gun && prog && onceBitis?.gunId === gun.id ? prog.canli.bitisDk - onceBitis.dk : 0;
  // #53 §5: yarı açık liste satırları — numara · kategori ikonu · ad · süre; aralarda yürüyüş.
  let numara = 0;
  const siralaSatirlari: SiralaSatiri[] = satirlar.map((x) => {
    const d = gunDurak.find((dd) => dd.id === x.durak.id);
    const m = d ? mekanIle.get(d.place_ref) : undefined;
    const kat = kategoriPini(m?.primary_type);
    const atlandi = x.durum === 'atlandi';
    if (!atlandi) numara++;
    return {
      id: x.durak.id,
      ad: (m && yerler.data?.[m.place_id]?.ad) || '…',
      ikon: kat.ikon,
      ikonRenk: kat.kategoriRenk,
      saat: atlandi ? t('program.atlandi') : t('program.saatAraligi', { bas: dakikaSaat(x.varisDk), bit: dakikaSaat(x.ayrilisDk), sure: sureMetni(d?.minutes ?? 0) }),
      numara: atlandi ? null : numara,
      tamam: prog?.bugun ? x.durum === 'gecildi' : false,
      atlandi,
      bacak: x.yuruyus ? { metin: `${yuruyusDk(x.yuruyus)} dk${x.yuruyus.kestirim ? ' ~' : ''}`, ikon: x.yuruyus.mod === 'taksi' ? 'araba' : 'yurume' } : undefined,
    };
  });
  const siralaTasi = (from: number, to: number) => {
    const a = gunDurak.findIndex((d) => d.id === siralaSatirlari[from]?.id);
    const b = gunDurak.findIndex((d) => d.id === siralaSatirlari[to]?.id);
    if (a >= 0 && b >= 0) tasi(a, b);
  };
  const baslangicSaati = gun ? saatKisa(gun.start_time, saatKisa(seyahat.day_start, '09:00')) : '09:00';

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
  ) : undefined;

  // #56 §1: listenin Başlangıç / Bitiş satırları (otel yoksa kesikli "+ Otel ekle").
  const bitisSaati = prog ? dakikaSaat(prog.canli.bitisDk) : '';
  const otelAdi = (u: typeof seciliUclar.baslangic) => (u ? (u.konaklama.label ?? t('otel.adsiz')) : null);
  const otelAc = () => setOtelSayfasi(true);
  const basOtelSatiri = <OtelUcSatiri tur="baslangic" ad={otelAdi(seciliUclar.baslangic)} saat={baslangicSaati} onPress={otelAc} />;
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

  // #55 §B7: alt sayfa — üst şerit (her halde görünür, sabit yükseklik) + gövde.
  const ustBaslikMetni = gun && prog ? (panel === 'tam' ? t('program.panelBaslik', { gun: gunEtiketKisa(gun), bas: baslangicSaati, bit: dakikaSaat(prog.canli.bitisDk) }) : t('program.bitisBaslik', { gun: gunEtiketKisa(gun), bit: dakikaSaat(prog.canli.bitisDk) })) : '';
  // #55 §A4: başlık tek satıra sığmazsa "≡ tutup sürükle" ipucu gizlenir (kaba ölçü: harf ~7,5 px + düğmeler).
  const ipucuSigar = ustBaslikMetni.length * 7.5 + (bitisFarki ? 70 : 0) + 120 + 2 * 46 + 40 < ekran.width;
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
          <Ikon ad="yukari" boyut={20} renk={renk.metin} kalinlik={2.2} />
        </Pressable>
      ) : (
        <View style={s.seritSatir}>
          <Text style={[s.basBit, { flexShrink: 1 }]} numberOfLines={1}>
            {ustBaslikMetni}
            {panel === 'yari' && bitisFarki ? (
              <Text style={{ color: bitisFarki < 0 ? renk.basari : renk.uyari }}>{`  ${bitisFarki < 0 ? '−' : '+'}${sureMetni(Math.abs(bitisFarki))}`}</Text>
            ) : null}
          </Text>
          <View style={{ flex: 1 }} />
          {panel === 'yari' && ipucuSigar ? (
            <View style={s.ipucuSurukle}>
              <Ikon ad="tutamac" boyut={14} renk={renk.ikincil} kalinlik={2.2} />
              <Text style={s.tempoMetin}>{t('program.surukleIpucu')}</Text>
            </View>
          ) : null}
          {panel === 'tam' && duzenle ? (
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
            onPress={() => setPanel(panel === 'tam' ? 'yari' : 'tam')}
            style={s.ikonDugme}>
            <Ikon ad={panel === 'tam' ? 'daralt' : 'genislet'} boyut={20} renk={renk.metin} kalinlik={2.2} />
          </Pressable>
        </View>
      )}
    </View>
  );
  const govde = (yukseklik: number) =>
    panel === 'katli' || !gun || !prog ? null : panel === 'yari' ? (
      <>
        {verisi.matrisHata ? <Text style={s.uyariMetin}>{t('program.yuruyusHata')}</Text> : null}
        {hata ? <Text style={s.hata}>{hata}</Text> : null}
        {siralaSatirlari.length === 0 ? (
          <>
            {basOtelSatiri}
            <Text style={s.uyariMetin}>{t('program.ozetGunBos', { gun: gunEtiketKisa(gun) })}</Text>
          </>
        ) : (
          <SiralaListesi
            satirlar={siralaSatirlari}
            bas={basOtelSatiri}
            son={sonOtelSatiri}
            yukseklik={Math.max(120, yukseklik - (verisi.matrisHata ? 20 : 0) - (hata ? 20 : 0))}
            numaraRengi={gunRengi(gun.index)}
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
    ) : (
      <View style={{ flex: 1, gap: 6 }}>
        {tempo && tempo.durakSayisi > 0 ? <Text style={s.tempoMetin}>{sureMetni(tempo.geziDk + tempo.yuruyusDk + tempo.taksiDk)}</Text> : null}
        {verisi.matrisHata ? <Text style={s.uyariMetin}>{t('program.yuruyusHata')}</Text> : null}
        {bugun && izin === 'reddedildi' ? <Text style={s.uyariMetin}>{t('program.konumIzni')}</Text> : null}
        <View style={{ flex: 1 }}>
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
            bas={basOtelSatiri}
            son={sonOtelSatiri}
            onTamamla={tamamla}
            onPuanla={(d) => setPuanDurakId(d.id)}
            onDetay={(d) => detayAc(d.place_ref)}
            puanim={puanim}
            siradakiFoto={siradakiFoto.data?.foto_uri}
            onYolTarifi={yolTarifi}
            onMenu={(d) => (d.completed_at ? setMenuDurak(d) : uzunBas(d.place_ref))}
            onGunSec={setGunSecDurak}
            onTasi={tasi}
            onSure={sureDegistir}
            onBaslangic={baslangicDegistir}
          />
        </View>
        {/* #53 §5: "Haritada gör" yarı açık hale döner. */}
        <Pressable accessibilityRole="button" onPress={() => setPanel('yari')} style={s.haritadaGor}>
          <Ikon ad="harita" boyut={18} renk={renk.zemin} kalinlik={2.2} />
          <Text style={s.haritadaGorMetin}>{t('program.haritadaGor')}</Text>
        </Pressable>
        {hata ? <Text style={s.hata}>{hata}</Text> : null}
      </View>
    );

  // #53 §6: "güne eklendi" kartı — eklenen mekan, sırası ve gün bitişi; Geri al; Taşı: gün hapları.
  const eklenenMekan = eklenen ? mekanIle.get(eklenen.mekanId) : undefined;
  const eklenenFoto = useOnizleme(eklenenMekan?.place_id);
  const eklenenGun = eklenen ? gunler.find((g) => g.id === eklenen.gunId) : undefined;
  const eklenenSira = eklenen ? (verisi.tempolar.get(eklenen.gunId)?.sira.indexOf(eklenen.mekanId) ?? -1) + 1 : 0;
  const eklenenBitis = eklenen ? verisi.tempolar.get(eklenen.gunId)?.bitis : undefined;
  useEffect(() => {
    if (!eklenen) return;
    const z = setTimeout(() => setEklenen(null), KART_SURESI_MS);
    return () => clearTimeout(z);
  }, [eklenen]);
  const eklendiKarti =
    eklenen && eklenenMekan && eklenenGun ? (
      <View style={[s.eklendiKart, s.golge]}>
        <View style={s.eklendiUst}>
          {eklenenFoto.data?.foto_uri ? <Image source={{ uri: eklenenFoto.data.foto_uri }} style={s.eklendiFoto} contentFit="cover" /> : <View style={s.eklendiFoto} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.eklendiAd} numberOfLines={1}>
              {yerler.data?.[eklenenMekan.place_id]?.ad ?? '…'}
            </Text>
            <Text style={s.eklendiAlt} numberOfLines={1}>
              {eklenenSira > 0
                ? t('program.eklendi', { gun: eklenenGun.index, sira: eklenenSira, bit: eklenenBitis ?? '' })
                : t('program.eklendiKisa', { gun: eklenenGun.index })}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={eklemeyiGeriAl} hitSlop={8} style={s.geriAl}>
            <Text style={s.geriAlMetin}>{t('program.geriAl')}</Text>
          </Pressable>
        </View>
        <View style={s.tasiSatir}>
          <Text style={s.tempoMetin}>{t('program.tasi')}</Text>
          {gunler.map((g) => {
            const burada = g.id === eklenen.gunId;
            return (
              <Pressable key={g.id} accessibilityRole="button" accessibilityState={{ selected: burada }} disabled={burada} onPress={() => eklenenTasi(g)} style={[s.tasiHap, burada && s.tasiHapAktif]}>
                <Text style={[s.tasiHapMetin, burada && { color: renk.zemin }]}>{`${t('program.gunSec', { n: g.index })}${burada ? ' ✓' : ''}`}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ) : null;

  return (
    <>
      <HaritaEkrani
        baslik={seyahat.city_label}
        // #53 §3: büyük başlık — şehir adı + seçili günün özeti; geri → Keşfet.
        altBaslik={ozetSatiri()}
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
        onUstYukseklik={setUstYukseklik}
        altSerbest={
          panel !== 'tam' && !seciliMekan ? (
            <>
              {/* #53 §8: sağ altta, panelin üstünde 48 px siyah "+" → Keşfet. */}
              <View style={s.artiSatir} pointerEvents="box-none">
                <Pressable accessibilityRole="button" accessibilityLabel={t('program.mekanEkle')} onPress={kesfeteGit} style={[s.arti, s.golge]}>
                  <Ikon ad="yeni" boyut={24} renk={renk.zemin} kalinlik={2.2} />
                </Pressable>
              </View>
              {panel === 'katli' ? eklendiKarti : null}
              {panel === 'katli' && cubuk ? <MiniCubuk cubuk={cubuk} adi={adi} onKaydir={kaydir} onAtla={cubukAtla} onKoru={koru} /> : null}
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
          <GunKartlari
            gunler={gunler}
            duraklar={duraklar}
            seciliId={gun?.id}
            bugunIndex={bugunIndex}
            onSec={(id) => {
              setSeciliGunId(id);
              setDuzenle(false);
              setOnceBitis(null);
              setEklenen(null);
            }}
            onUzunBas={gunuSil}
            onEkle={() => guvenli(() => gunEkle.mutateAsync({ gunler, startDate: seyahat.start_date }))}
            ekleniyor={gunEkle.isPending}
          />
        }
        altPanel={altPanel}
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
            // #56: ev pinine dokununca günün oteli alt sayfası.
            if (pinId.startsWith('otel:')) return otelAc();
            if (!pinId.startsWith('m:')) return;
            const mekanId = pinId.slice(2);
            const m = mekanIle.get(mekanId);
            // #53 §6: gün seçiliyken atanmamış pine dokunmak doğrudan o günün sonuna ekler; atanmış pin → pin paneli.
            if (m && gun && !durakIle.has(mekanId)) hizliEkle(m);
            else {
              setEklenen(null);
              setSeciliMekanId(mekanId);
            }
          },
          // Haritaya dokununca pin paneli ve "güne eklendi" kartı kapanır.
          onHaritaBas: () => {
            setSeciliMekanId(null);
            setEklenen(null);
          },
        }}
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
                { etiket: duzenle ? t('program.bitti') : t('program.duzenle'), onPress: () => setDuzenle((d) => !d) },
                { etiket: t('program.kisaRota'), onPress: enKisaRotayaDiz, pasif: !gun.order_manual },
                { etiket: t('gunOteli.menu'), onPress: otelAc },
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
  // #53 §8: 48 px.
  arti: { width: 48, height: 48, borderRadius: 24, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  // #55 §B7 alt sayfa üst şeridi: sabit yükseklik (tutamak / ilerleme + 44 px satır).
  serit: { paddingHorizontal: 16 },
  tutamakDokunma: { height: 10, justifyContent: 'center' },
  seritSatir: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ilerlemeIz: { height: 3, borderRadius: 1.5, backgroundColor: renk.ayrac, overflow: 'hidden' },
  ilerlemeDolu: { height: '100%', backgroundColor: renk.basari },
  katliMetin: { flex: 1, fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  puanlaSatir: { alignItems: 'flex-start', paddingHorizontal: 16, paddingBottom: 8 },
  ipucuSurukle: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  // #53 §6 "güne eklendi" kartı.
  eklendiKart: { marginHorizontal: 12, marginBottom: 8, padding: 12, gap: 10, borderRadius: 16, backgroundColor: renk.zemin },
  eklendiUst: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eklendiFoto: { width: 44, height: 44, borderRadius: 10, backgroundColor: renk.ayrac },
  eklendiAd: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  eklendiAlt: { fontFamily: yazi.yari, fontSize: 12, color: renk.basari },
  geriAl: { height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  geriAlMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  tasiSatir: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tasiHap: { height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  tasiHapAktif: { backgroundColor: renk.metin },
  tasiHapMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
});

