import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniCubuk } from '@/components/program/MiniCubuk';
import { SecimMenusu, type SecimSecenegi } from '@/components/program/SecimMenusu';
import { SurukleListe } from '@/components/program/SurukleListe';
import { Avatar } from '@/components/ui/Avatar';
import { Buton } from '@/components/ui/Buton';
import { useDuraklar, useDurakKaldir, useGunler } from '@/features/gunler/sorgular';
import { useMekanlar, useUyeler } from '@/features/mekanlar/sorgular';
import { matrisNoktalari, useDurakGuncelle, useGunGuncelle, useSiraYaz, useYuruyusMatrisi } from '@/features/program/sorgular';
import { gunDuraklari, saatKisa, useGunProgrami, useSimdi } from '@/features/program/useProgram';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { useHafifYerler } from '@/features/yerler/api';
import { t } from '@/i18n';
import { sureMetni } from '@/lib/kategori';
import { onayIste } from '@/lib/onay';
import { useOturum } from '@/lib/oturum';
import { AYLAR, GUNLER, GUNLER_KISA, haftaGunu, parcala } from '@/lib/takvim';
import type { Durak, Gun, Mekan, Seyahat } from '@/lib/tipler';
import { kacinciGun } from '@/lib/zaman';
import { acilisDurumu, kapaliGunler } from '@/schedule/acilis';
import { kaydirSuresi } from '@/schedule/kaydir';
import { enUcuzEklemeIndeksi, saatAraligi, yuruyusDk } from '@/schedule/program';
import { arasindaAnahtar } from '@/schedule/sira';
import { varsayilanSira } from '@/schedule/siralama';
import { dakikaSaat, kestirimYuruyusSn, saatDakika } from '@/schedule/tempo';
import { bosluk, minDokunma, renk, yazi } from '@/theme';

const SATIR_YUKSEKLIGI = 84;

/**
 * PRD 3.7 Program. KK1 gün seçici + başlangıç saati + sıralı duraklar + yürüyüşler; KK2 §5.1 varsayılan sıra,
 * sürükle-bırak → order_manual; KK3 süre −/+; KK4 uzun basma menüsü; KK5 açılış saati bandı; KK6/KK7 Vardık;
 * KK8 mini-çubuk (Kaydır/Atla/Planı koru); KK9 üye avatarları → Grup; KK10 iskelet (kestirim) yürüyüş süreleri.
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
  return <Program key={id} seyahat={seyahat.data} gunler={gunler.data} duraklar={duraklar.data} mekanlar={mekanlar.data} gunParam={gunParam} />;
}

/** "Pazartesi 12 Ekim" / "1. gün". */
function gunBasligi(gun: Gun): string {
  if (!gun.date) return t('program.altTarihsiz');
  const { ay, gun: g } = parcala(gun.date);
  return `${GUNLER[haftaGunu(gun.date)]} ${g} ${AYLAR[ay - 1]}`;
}

/** Google periyot günü (0 = Pazar) ← takvim günü (0 = Pazartesi). */
const googleGunu = (tarih: string) => (haftaGunu(tarih) + 1) % 7;

function Program({ seyahat, gunler, duraklar, mekanlar, gunParam }: { seyahat: Seyahat; gunler: Gun[]; duraklar: Durak[]; mekanlar: Mekan[]; gunParam?: string }) {
  const ust = useSafeAreaInsets().top;
  const { session } = useOturum();
  const uyeler = useUyeler(seyahat.id);
  const durakGuncelle = useDurakGuncelle(seyahat.id);
  const durakKaldir = useDurakKaldir(seyahat.id);
  const siraYaz = useSiraYaz(seyahat.id);
  const gunGuncelle = useGunGuncelle(seyahat.id);

  // Varsayılan gün: aktif seyahatte bugün, değilse ilk gün (ya da parametre).
  const bugunIndex = kacinciGun(seyahat);
  const [seciliGunId, setSeciliGunId] = useState<string | null>(null);
  const gun =
    gunler.find((g) => g.id === seciliGunId) ??
    gunler.find((g) => String(g.index) === gunParam) ??
    gunler.find((g) => g.index === bugunIndex) ??
    gunler[0];

  const [duzenle, setDuzenle] = useState(false);
  const [menuDurak, setMenuDurak] = useState<Durak | null>(null);
  const [gunSecDurak, setGunSecDurak] = useState<Durak | null>(null);
  const [yolaCikilanlar, setYolaCikilanlar] = useState<Set<string>>(() => new Set());
  const [korunan, setKorunan] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const mekanIle = useMemo(() => new Map(mekanlar.map((m) => [m.id, m])), [mekanlar]);
  const gunDurak = useMemo(() => (gun ? gunDuraklari(gun, duraklar) : []), [gun, duraklar]);
  const gunMekanlari = useMemo(() => gunDurak.map((d) => mekanIle.get(d.place_ref)).filter((m): m is Mekan => !!m), [gunDurak, mekanIle]);
  const otel = seyahat.hotel_lat !== null && seyahat.hotel_lng !== null ? { lat: seyahat.hotel_lat, lng: seyahat.hotel_lng } : null;

  // KK5 için saatli hafif Details (yalnız günün durakları); KK6 kartı için puan/açık.
  const yerler = useHafifYerler(
    gunMekanlari.map((m) => m.place_id),
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

  const matris = useYuruyusMatrisi(seyahat.id, matrisNoktalari(otel, gunMekanlari));
  const an = useSimdi(true);
  const prog = useGunProgrami({ seyahat, gun, duraklar, mekanlar, yuruyus: matris.yuruyus, an, yolaCikilanlar });

  // T7: elle sıralanmamış günde §5.1 sırası gerçek yürüyüşle hesaplanır ve farklıysa yazılır (herkes aynı sırayı görür).
  const sonYazilan = useRef('');
  useEffect(() => {
    if (!gun || gun.order_manual || matris.yukleniyor || gunMekanlari.length < 2) return;
    const aktifler = gunDurak.filter((d) => !d.skipped);
    const noktalar = aktifler.map((d) => mekanIle.get(d.place_ref)).filter((m): m is Mekan => !!m);
    if (noktalar.length !== aktifler.length) return;
    const key = (i: number) => (i < 0 ? 'hotel' : noktalar[i].place_id);
    const konum = (i: number) => (i < 0 ? otel! : { lat: noktalar[i].lat, lng: noktalar[i].lng });
    const mesafe = (a: number, b: number) => matris.yuruyus(key(a), key(b))?.sn ?? kestirimYuruyusSn(konum(a), konum(b));
    const sira = varsayilanSira(noktalar.length, mesafe, !!otel);
    const hedef = sira.map((i) => aktifler[i].id);
    const mevcut = aktifler.map((d) => d.id);
    const imza = `${gun.id}:${hedef.join(',')}`;
    if (hedef.join(',') === mevcut.join(',') || sonYazilan.current === imza) return;
    sonYazilan.current = imza;
    // Anahtarlar baştan dağıtılır; atlananlar sona.
    let onceki: string | undefined;
    const guncellemeler = [...hedef, ...gunDurak.filter((d) => d.skipped).map((d) => d.id)].map((id) => {
      const k = arasindaAnahtar(onceki, undefined);
      onceki = k;
      return { id, order_key: k };
    });
    siraYaz.mutateAsync(guncellemeler).catch(() => setHata(t('program.hata')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gun?.id, gun?.order_manual, matris.yukleniyor, gunDurak.map((d) => `${d.id}:${d.skipped}`).join(',')]);

  if (!gun || !prog) return null;

  const satirlar = prog.canli.satirlar;
  const satirIle = (durakId: string) => satirlar.find((x) => x.durak.id === durakId);

  // KK2: sürükleme → tek order_key yazımı + order_manual.
  const tasi = async (from: number, to: number) => {
    const liste = gunDurak.slice();
    const [eleman] = liste.splice(from, 1);
    liste.splice(to, 0, eleman);
    const onceki = liste[to - 1]?.order_key;
    const sonraki = liste[to + 1]?.order_key;
    setHata(null);
    try {
      await durakGuncelle.mutateAsync({ id: eleman.id, order_key: arasindaAnahtar(onceki, sonraki) });
      if (!gun.order_manual) await gunGuncelle.mutateAsync({ id: gun.id, order_manual: true });
    } catch {
      setHata(t('program.hata'));
    }
  };

  const enKisaRotayaDiz = async () => {
    setHata(null);
    sonYazilan.current = '';
    try {
      await gunGuncelle.mutateAsync({ id: gun.id, order_manual: false });
    } catch {
      setHata(t('program.hata'));
    }
  };

  const baslangicDegistir = async (fark: number) => {
    const simdi = saatDakika(saatKisa(gun.start_time, saatKisa(seyahat.day_start, '09:00')));
    const yeni = Math.min(23 * 60, Math.max(5 * 60, simdi + fark));
    try {
      await gunGuncelle.mutateAsync({ id: gun.id, start_time: `${dakikaSaat(yeni)}:00` });
    } catch {
      setHata(t('program.hata'));
    }
  };

  const sureDegistir = async (d: Durak, fark: number) => {
    const yeni = Math.min(480, Math.max(15, d.minutes + fark));
    if (yeni === d.minutes) return;
    try {
      await durakGuncelle.mutateAsync({ id: d.id, minutes: yeni });
    } catch {
      setHata(t('program.hata'));
    }
  };

  // KK7: "Vardık" seyahat düzeyinde.
  const vardik = async (d: Durak, geriAl = false) => {
    try {
      await durakGuncelle.mutateAsync({ id: d.id, arrived_at: geriAl ? null : new Date().toISOString(), arrived_by: geriAl ? null : (session?.user.id ?? null) });
      if (!geriAl) setYolaCikilanlar((e) => new Set([...e].filter((x) => x !== d.id)));
    } catch {
      setHata(t('program.hata'));
    }
  };

  const yolTarifi = (d: Durak) => {
    const m = mekanIle.get(d.place_ref);
    if (!m) return;
    // §5.4 (a): Yol tarifi'ne basınca bulunulan duraktan ayrılmış sayılır.
    const buradasin = satirlar.find((x) => x.durum === 'buradasin');
    if (buradasin) setYolaCikilanlar((e) => new Set([...e, buradasin.durak.id]));
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}&destination_place_id=${encodeURIComponent(m.place_id)}&travelmode=walking`);
  };

  // KK4 menü: Başka güne al / Atla / Plandan çıkar (durak günden çıkar, mekan listede kalır).
  const baskaGuneAl = async (d: Durak, hedef: Gun) => {
    setHata(null);
    try {
      const hedefDuraklar = gunDuraklari(hedef, duraklar);
      const m = mekanIle.get(d.place_ref);
      let order_key: string;
      if (hedef.order_manual && m) {
        const sira = hedefDuraklar.filter((x) => !x.skipped).map((x) => mekanIle.get(x.place_ref)).filter((x): x is Mekan => !!x);
        const i = enUcuzEklemeIndeksi(
          sira.map((x) => ({ key: x.place_id, konum: { lat: x.lat, lng: x.lng } })),
          { key: m.place_id, konum: { lat: m.lat, lng: m.lng } },
          otel,
          matris.yuruyus,
        );
        order_key = arasindaAnahtar(hedefDuraklar[i - 1]?.order_key, hedefDuraklar[i]?.order_key);
      } else {
        order_key = arasindaAnahtar(hedefDuraklar[hedefDuraklar.length - 1]?.order_key, undefined);
      }
      await durakGuncelle.mutateAsync({ id: d.id, day_id: hedef.id, order_key, arrived_at: null, arrived_by: null });
    } catch {
      setHata(t('program.hata'));
    }
  };
  const atla = (d: Durak) => durakGuncelle.mutateAsync({ id: d.id, skipped: !d.skipped }).catch(() => setHata(t('program.hata')));
  const cikar = async (d: Durak) => {
    const onay = await onayIste(t('program.menuCikar'), t('program.menuCikarMetin'), t('program.menuCikar'), t('genel.vazgec'));
    if (!onay) return;
    durakKaldir.mutateAsync(d.id).catch(() => setHata(t('program.hata')));
  };

  // KK8 mini-çubuk eylemleri.
  const cubuk = prog.cubuk && korunan !== `${prog.cubuk.tur}:${'durakId' in prog.cubuk ? prog.cubuk.durakId : prog.cubuk.hedefId}` ? prog.cubuk : null;
  const kaydir = () => {
    if (!cubuk || prog.simdiDk === null) return;
    if (cubuk.tur === 'uzun') {
      const d = gunDurak.find((x) => x.id === cubuk.durakId);
      const satir = satirIle(cubuk.durakId);
      if (d && satir) durakGuncelle.mutateAsync({ id: d.id, minutes: kaydirSuresi(satir.varisDk, prog.simdiDk) }).catch(() => setHata(t('program.hata')));
    }
    // Yürüyüş (a) durumunda Kaydır düğmesi yok (ürün kararı): canlı saatler zaten kaymış durumda.
  };
  const cubukAtla = () => {
    if (!cubuk) return;
    const hedefId = cubuk.tur === 'uzun' ? satirlar.find((x) => x.durum === 'siradaki')?.durak.id : cubuk.hedefId;
    const d = hedefId ? gunDurak.find((x) => x.id === hedefId) : undefined;
    if (d) atla(d);
  };
  const koru = () => cubuk && setKorunan(`${cubuk.tur}:${'durakId' in cubuk ? cubuk.durakId : cubuk.hedefId}`);

  const menuSecenekleri: SecimSecenegi[] = menuDurak
    ? [
        { etiket: t('program.baskaGuneAl'), onPress: () => setGunSecDurak(menuDurak), pasif: gunler.length < 2 },
        { etiket: menuDurak.skipped ? t('program.menuAtlama') : t('program.menuAtla'), onPress: () => atla(menuDurak) },
        // "Günden çıkar": durak günden çıkar, mekan havuzda kalır (3.8'deki "Plandan çıkar" mekanı siler).
        { etiket: t('program.menuCikar'), onPress: () => cikar(menuDurak), tehlike: true },
      ]
    : [];
  const gunSecenekleri: SecimSecenegi[] = gunSecDurak
    ? gunler.filter((g) => g.id !== gun.id).map((g) => ({ etiket: `${t('program.guneAl', { n: g.index })} · ${gunBasligi(g)}`, onPress: () => baskaGuneAl(gunSecDurak, g) }))
    : [];

  const baslangicSaati = saatKisa(gun.start_time, saatKisa(seyahat.day_start, '09:00'));
  const altMetin = duzenle
    ? t('program.altDuzenle', { tarih: gunBasligi(gun) })
    : prog.bugun && prog.simdiDk !== null
      ? t('program.altBugun', { tarih: gunBasligi(gun), saat: dakikaSaat(prog.simdiDk) })
      : t('program.altTarih', { tarih: gunBasligi(gun) });

  return (
    <View style={s.ekran}>
      <View style={[s.ust, { paddingTop: ust + 8 }]}>
        <View style={s.ustSol}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={() => router.replace('/(tabs)')} style={s.geri}>
            <Text style={s.geriIsaret}>‹</Text>
          </Pressable>
          <View style={{ minWidth: 0, flex: 1 }}>
            <Text style={s.baslik} numberOfLines={1}>
              {t('program.baslik', { n: gun.index })}
            </Text>
            <Text style={s.alt} numberOfLines={1}>
              {altMetin}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('seyahat.grup.baslik')}
          onPress={() => router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/grup', params: { id: seyahat.id } })}
          style={s.avatarlar}>
          {(uyeler.data ?? []).slice(0, 3).map((u, i) => (
            <View key={u.user_id} style={[s.avatarCerceve, i > 0 && { marginLeft: -8 }]}>
              <Avatar ad={u.display_name} boyut={26} arkaPlan={['#0f0f0f', '#ff5a1f', '#4c6ef5'][i % 3]} />
            </View>
          ))}
        </Pressable>
      </View>

      <View style={s.gunSatir}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.gunler}>
          {gunler.map((g) => {
            const aktif = g.id === gun.id;
            return (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                accessibilityState={{ selected: aktif }}
                accessibilityLabel={t('program.gunSec', { n: g.index })}
                onPress={() => setSeciliGunId(g.id)}
                style={[s.gunDaire, aktif && s.gunDaireAktif, g.index === bugunIndex && !aktif && s.gunDaireBugun]}>
                <Text style={[s.gunDaireMetin, aktif && { color: renk.zemin }]}>{g.index}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={() => setDuzenle((d) => !d)} style={s.duzenle}>
          <Text style={s.duzenleMetin}>{duzenle ? t('program.bitti') : t('program.duzenle')}</Text>
        </Pressable>
      </View>

      {matris.hata ? <Text style={s.uyariMetin}>{t('program.yuruyusHata')}</Text> : null}
      {hata ? <Text style={s.hataMetin}>{hata}</Text> : null}

      {gunDurak.length === 0 ? (
        <Text style={s.bos}>{t('program.bos')}</Text>
      ) : duzenle ? (
        <ScrollView contentContainerStyle={s.icerik} keyboardShouldPersistTaps="handled">
          <View style={s.araclar}>
            <Pressable accessibilityRole="button" onPress={enKisaRotayaDiz} disabled={!gun.order_manual} style={[s.arac, !gun.order_manual && { opacity: 0.4 }]}>
              <Text style={s.aracMetin}>{t('program.enKisa')}</Text>
            </Pressable>
            <View style={s.arac}>
              <Pressable accessibilityRole="button" accessibilityLabel="−15" onPress={() => baslangicDegistir(-15)} hitSlop={8} style={s.aracAdim}>
                <Text style={s.aracAdimMetin}>−</Text>
              </Pressable>
              <Text style={s.aracMetin}>{t('program.baslangic', { saat: baslangicSaati })}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="+15" onPress={() => baslangicDegistir(15)} hitSlop={8} style={s.aracAdim}>
                <Text style={s.aracAdimMetin}>+</Text>
              </Pressable>
            </View>
          </View>
          <SurukleListe
            veriler={gunDurak}
            anahtar={(d) => d.id}
            yukseklik={SATIR_YUKSEKLIGI}
            onTasi={tasi}
            cizim={(d, i, tutamac, aktif) => {
              const satir = satirIle(d.id);
              const m = mekanIle.get(d.place_ref);
              return (
                <View style={[s.duzenSatir, aktif && s.duzenSatirAktif]}>
                  <View {...tutamac} style={s.tutamac} accessibilityLabel={t('program.surukle')}>
                    <Text style={s.tutamacMetin}>⋮⋮</Text>
                  </View>
                  <View style={[s.numara, d.skipped && { backgroundColor: renk.soluk }]}>
                    <Text style={s.numaraMetin}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={[s.ad, d.skipped && s.cizili]} numberOfLines={1}>
                      {m ? (yerler.data?.[m.place_id]?.ad ?? '…') : '…'}
                    </Text>
                    <Text style={s.satirAlt} numberOfLines={1}>
                      {satir && !d.skipped ? saatAraligi(satir.varisDk, satir.ayrilisDk) : t('program.atlandi')}
                      {m?.added_by ? ` · ${uyeAdi(m.added_by)}` : ''}
                      {satir?.yuruyus ? ` · ${yuruyusDk(satir.yuruyus)} dk${satir.yuruyus.kestirim ? '~' : ''} · ${mesafeMetni(satir.yuruyus.m)}` : ''}
                    </Text>
                  </View>
                  <View style={s.sureKontrol}>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('program.azalt')} onPress={() => sureDegistir(d, -15)} style={s.sureDugme}>
                      <Text style={s.sureIsaret}>−</Text>
                    </Pressable>
                    <Text style={s.sureMetin}>{sureMetni(d.minutes)}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('program.artir')} onPress={() => sureDegistir(d, 15)} style={s.sureDugme}>
                      <Text style={s.sureIsaret}>+</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
          <View style={s.ozetSatir}>
            <Text style={s.ozet}>
              {t('program.gunBitisi')} <Text style={s.ozetKalin}>{dakikaSaat(prog.canli.bitisDk)}</Text>
            </Text>
            <Text style={s.ozet}>
              {t('program.toplamYuruyus')}{' '}
              <Text style={s.ozetKalin}>
                {Math.round(prog.canli.yuruyusSn / 60)} dk · {mesafeMetni(prog.canli.yuruyusM)}
              </Text>
            </Text>
          </View>
          <Buton baslik={t('program.programiGor')} onPress={() => setDuzenle(false)} stil={{ height: 50, marginTop: 10 }} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.icerik}>
          {satirlar.map((satir, i) => {
            const d = satir.durak;
            const durak = gunDurak.find((x) => x.id === d.id)!;
            const m = mekanIle.get(durak.place_ref);
            const yer = m ? yerler.data?.[m.place_id] : undefined;
            const ad = yer?.ad ?? '…';
            const acilis = gun.date ? acilisDurumu(yer?.periyotlar, googleGunu(gun.date), satir.varisDk) : null;
            const kapali = acilis && acilis.durum !== 'acik' && acilis.durum !== 'bilinmiyor' && satir.durum !== 'atlandi' && satir.durum !== 'gecildi';
            const haftaKapali = !gun.date ? kapaliGunler(yer?.periyotlar) : [];
            const ac = () => m && router.push({ pathname: '/seyahat/[id]/mekan/[placeId]', params: { id: seyahat.id, placeId: m.place_id } });
            const uzunBas = () => setMenuDurak(durak);
            return (
              <View key={d.id}>
                {satir.yuruyus && i > 0 ? (
                  <View style={s.yuruyusSatir}>
                    <View style={s.noktaCizgi} />
                    <Text style={s.yuruyusMetin}>
                      🚶 {matris.yukleniyor && satir.yuruyus.kestirim ? '…' : yuruyusDk(satir.yuruyus) > 40 ? t('program.yuruyusUzun') : `${t('program.yuruyus', { n: yuruyusDk(satir.yuruyus) })}${satir.yuruyus.kestirim ? ' ~' : ''}`}
                    </Text>
                  </View>
                ) : null}
                <View style={s.satir}>
                  <View style={s.saatSutun}>
                    <Text style={[s.saat, satir.durum === 'siradaki' && s.saatBuyuk, satir.durum === 'gecildi' && s.soluk]}>
                      {satir.durum === 'atlandi' ? '—' : dakikaSaat(satir.varisDk)}
                    </Text>
                    {satir.durum === 'siradaki' ? <Text style={s.siradakiEtiket}>{t('program.siradaki')}</Text> : null}
                    {satir.durum === 'buradasin' ? <Text style={s.siradakiEtiket}>{t('program.buradasin')}</Text> : null}
                  </View>
                  {satir.durum === 'siradaki' || satir.durum === 'buradasin' ? (
                    <Pressable accessibilityRole="button" onPress={ac} onLongPress={uzunBas} style={s.siyahKart}>
                      <View style={s.kartUst}>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={s.kartAd} numberOfLines={2}>
                            {ad}
                          </Text>
                          <Text style={s.kartAlt} numberOfLines={1}>
                            {sureMetni(durak.minutes)}
                            {yer?.puan !== null && yer?.puan !== undefined ? ` · ★ ${yer.puan.toLocaleString('tr-TR')}` : ''}
                            {yer?.acik === true ? ` · ${t('mekan.acik')}` : yer?.acik === false ? ` · ${t('mekan.kapali')}` : ''}
                          </Text>
                        </View>
                        {m?.added_by ? <Avatar ad={uyeAdi(m.added_by) || '?'} boyut={24} arkaPlan="#4c6ef5" /> : null}
                      </View>
                      {m?.note ? (
                        <Text style={s.kartNot} numberOfLines={2}>
                          {`“${m.note}”`} <Text style={s.kartNotKim}>— {uyeAdi(m.added_by)}</Text>
                        </Text>
                      ) : null}
                      <View style={s.kartDugmeler}>
                        <Pressable accessibilityRole="button" onPress={() => yolTarifi(durak)} style={s.kartDugmeBeyaz}>
                          <Text style={s.kartDugmeBeyazMetin}>{t('program.yolTarifi')}</Text>
                        </Pressable>
                        {satir.durum === 'buradasin' ? (
                          <Pressable accessibilityRole="button" onPress={() => vardik(durak, true)} style={s.kartDugmeCizgi}>
                            <Text style={s.kartDugmeCizgiMetin}>✓ {dakikaSaat(satir.varisDk)}</Text>
                          </Pressable>
                        ) : prog.bugun ? (
                          <Pressable accessibilityRole="button" onPress={() => vardik(durak)} style={s.kartDugmeCizgi}>
                            <Text style={s.kartDugmeCizgiMetin}>{t('program.vardik')}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </Pressable>
                  ) : kapali ? (
                    <Pressable accessibilityRole="button" onPress={ac} onLongPress={uzunBas} style={s.kapaliKart}>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={s.ad} numberOfLines={1}>
                          {ad}
                        </Text>
                        <Text style={s.kapaliMetin} numberOfLines={1}>
                          {acilis!.durum === 'kapali_gun'
                            ? t('program.kapaliGun')
                            : acilis!.durum === 'kapali_saat' && acilis!.sonrakiAcilis
                              ? t('program.kapaliSaat', { saat: acilis!.sonrakiAcilis })
                              : t('program.kapaliSaatBelirsiz')}
                          {m?.added_by ? ` · ${uyeAdi(m.added_by)}` : ''}
                        </Text>
                      </View>
                      {gunler.length > 1 ? (
                        <Pressable accessibilityRole="button" onPress={() => setGunSecDurak(durak)} style={s.kapaliDugme}>
                          <Text style={s.kapaliDugmeMetin}>{t('program.baskaGuneAl')}</Text>
                        </Pressable>
                      ) : null}
                    </Pressable>
                  ) : (
                    <Pressable accessibilityRole="button" onPress={ac} onLongPress={uzunBas} style={s.duzSatir}>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={[s.ad, (satir.durum === 'gecildi' || satir.durum === 'atlandi') && s.cizili, satir.durum === 'gecildi' && s.soluk]} numberOfLines={1}>
                          {ad}
                        </Text>
                        <Text style={[s.satirAlt, satir.durum === 'gecildi' && s.soluk]} numberOfLines={1}>
                          {satir.durum === 'atlandi' ? t('program.atlandi') : sureMetni(durak.minutes)}
                          {m?.added_by ? ` · ${uyeAdi(m.added_by)}` : ''}
                          {haftaKapali.length > 0 ? ` · ${t('program.kapaliHafta', { gunler: haftaKapali.map((g) => GUNLER_KISA[(g + 6) % 7]).join(', ') })}` : ''}
                          {m?.note ? ` · “${m.note}”` : ''}
                        </Text>
                      </View>
                      {satir.durum === 'gecildi' ? <Text style={s.tik}>✓</Text> : null}
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
          {prog.canli.oteleDonus ? (
            <View style={s.yuruyusSatir}>
              <View style={s.noktaCizgi} />
              <Text style={s.yuruyusMetin}>
                🏠 {t('program.oteleDonus', { n: yuruyusDk(prog.canli.oteleDonus) })}
                {prog.canli.oteleDonus.kestirim ? ' ~' : ''} · {dakikaSaat(prog.canli.bitisDk)}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {cubuk ? <MiniCubuk cubuk={cubuk} adi={adi} onKaydir={kaydir} onAtla={cubukAtla} onKoru={koru} /> : null}

      <SecimMenusu acik={!!menuDurak} baslik={menuDurak ? adi(menuDurak.id) : undefined} secenekler={menuSecenekleri} onKapat={() => setMenuDurak(null)} />
      <SecimMenusu acik={!!gunSecDurak} baslik={t('mekan.gunSecBaslik')} secenekler={gunSecenekleri} onKapat={() => setGunSecDurak(null)} />
    </View>
  );
}

function mesafeMetni(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${m} m`;
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ortala: { alignItems: 'center', justifyContent: 'center' },
  ust: { paddingHorizontal: bosluk.kenar, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  ustSol: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  geri: { width: 36, height: 36, borderRadius: 18, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  geriIsaret: { fontFamily: yazi.kalin, fontSize: 24, lineHeight: 26, color: renk.metin, marginTop: -2 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 26, letterSpacing: -0.8, lineHeight: 29, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  avatarlar: { flexDirection: 'row', minHeight: minDokunma, alignItems: 'center' },
  avatarCerceve: { borderWidth: 2, borderColor: renk.zemin, borderRadius: 15 },
  gunSatir: { flexDirection: 'row', alignItems: 'center', paddingLeft: bosluk.kenar, paddingTop: 12, gap: 8 },
  gunler: { gap: 6, paddingRight: 8 },
  gunDaire: { width: 30, height: 30, borderRadius: 15, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  gunDaireAktif: { backgroundColor: renk.metin },
  gunDaireBugun: { borderWidth: 1.5, borderColor: renk.vurgu },
  gunDaireMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  duzenle: { height: 36, paddingHorizontal: 14, marginRight: bosluk.kenar, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  duzenleMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  uyariMetin: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil, paddingHorizontal: bosluk.kenar, paddingTop: 8 },
  hataMetin: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari, paddingHorizontal: bosluk.kenar, paddingTop: 8 },
  bos: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil, paddingHorizontal: bosluk.kenar, paddingTop: 24 },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 14, paddingBottom: 24 },
  satir: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  saatSutun: { width: 50, alignItems: 'flex-end', paddingTop: 12 },
  saat: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  saatBuyuk: { fontFamily: yazi.ekstra, fontSize: 16 },
  soluk: { color: renk.soluk },
  siradakiEtiket: { fontFamily: yazi.kalin, fontSize: 10, color: renk.vurgu },
  duzSatir: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, minHeight: minDokunma },
  ad: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  cizili: { textDecorationLine: 'line-through' },
  satirAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  tik: { fontFamily: yazi.kalin, fontSize: 16, color: renk.basari },
  yuruyusSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 30, paddingLeft: 64 },
  noktaCizgi: { width: 2, height: '100%', borderLeftWidth: 2, borderLeftColor: '#c4c4c4', borderStyle: 'dotted' },
  yuruyusMetin: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  siyahKart: { flex: 1, padding: 14, borderRadius: 18, backgroundColor: renk.metin, gap: 10 },
  kartUst: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 18, letterSpacing: -0.4, color: renk.zemin },
  kartAlt: { fontFamily: yazi.normal, fontSize: 12, color: '#a3a3a3' },
  kartNot: { fontFamily: yazi.normal, fontSize: 13, color: '#d4d4d4' },
  kartNotKim: { color: '#8a8a8a' },
  kartDugmeler: { flexDirection: 'row', gap: 8 },
  kartDugmeBeyaz: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center' },
  kartDugmeBeyazMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  kartDugmeCizgi: { height: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: '#4a4a4a', justifyContent: 'center' },
  kartDugmeCizgiMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.zemin },
  kapaliKart: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: renk.uyariZemin },
  kapaliMetin: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari },
  kapaliDugme: { height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.uyari, justifyContent: 'center' },
  kapaliDugmeMetin: { fontFamily: yazi.kalin, fontSize: 11, color: renk.zemin },
  araclar: { flexDirection: 'row', gap: 8, paddingBottom: 12, flexWrap: 'wrap' },
  arac: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 6 },
  aracMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  aracAdim: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  aracAdimMetin: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  duzenSatir: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: renk.ayrac, backgroundColor: renk.zemin },
  duzenSatirAktif: { backgroundColor: renk.yuzey, borderRadius: 14, borderTopWidth: 0, paddingHorizontal: 6 },
  tutamac: { width: 24, height: minDokunma, alignItems: 'center', justifyContent: 'center' },
  tutamacMetin: { fontFamily: yazi.kalin, fontSize: 16, color: '#c4c4c4' },
  numara: { width: 30, height: 30, borderRadius: 15, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  numaraMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.zemin },
  sureKontrol: { flexDirection: 'row', alignItems: 'center', height: 36, borderRadius: 999, backgroundColor: renk.yuzey, paddingHorizontal: 2 },
  sureDugme: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sureIsaret: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  sureMetin: { width: 44, textAlign: 'center', fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  ozetSatir: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14 },
  ozet: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ozetKalin: { fontFamily: yazi.kalin, color: renk.metin },
});
