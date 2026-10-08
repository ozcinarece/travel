import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { mesafeM } from '@/components/harita/geo';
import type { Konum } from '@/components/harita/tipler';
import { Buton } from '@/components/ui/Buton';
import { Ikon } from '@/components/ui/Ikon';
import { GoogleAtfi } from '@/components/yerler/GoogleAtfi';
import { haritadanSecimBekle, haritaSeciminiBirak } from '@/features/konaklama/haritaSecimi';
import { otelinGeceleri, type Konaklama, type OtelKapsami } from '@/features/konaklama/plan';
import type { OtelSecimiVeyaKayitli } from '@/features/konaklama/sorgular';
import { hafifYerler, linkCoz, linkGibiMi, useOtelOnerileri, yeniOturumJetonu, type Oneri } from '@/features/yerler/api';
import { t } from '@/i18n';
import type { Gun, OtelSecimi, Seyahat } from '@/lib/tipler';
import { minDokunma, renk, yazi } from '@/theme';

import { mesafeMetni } from './CizelgeListesi';
import { gunEtiketKisa } from './GunKartlari';

/** Bir uç için seçim: kayıtlı otel, aramadan / haritadan yeni otel ya da otel yok. */
type Secim = { tur: 'kayitli'; stayId: string } | { tur: 'yeni'; otel: OtelSecimi } | { tur: 'yok' };
type Uc = 'baslangic' | 'bitis';

const ilkSecim = (stayId: string | null): Secim => (stayId ? { tur: 'kayitli', stayId } : { tur: 'yok' });
const kayda = (s: Secim): OtelSecimiVeyaKayitli => (s.tur === 'kayitli' ? { stayId: s.stayId } : s.tur === 'yeni' ? s.otel : null);
const ayniSecim = (a: Secim, b: Secim) =>
  a.tur === b.tur && (a.tur !== 'kayitli' || a.stayId === (b as typeof a).stayId) && (a.tur !== 'yeni' || a.otel === (b as typeof a).otel);

/** "Cmt 17 ve Paz 18" */
export function geceMetni(gunler: Gun[]): string {
  const adlar = gunler.map(gunEtiketKisa);
  if (adlar.length <= 1) return adlar.join('');
  return `${adlar.slice(0, -1).join(', ')}${t('gunOteli.ve')}${adlar[adlar.length - 1]}`;
}

type Props = {
  seyahat: Seyahat;
  gun: Gun;
  gunler: Gun[];
  konaklamalar: Konaklama[];
  /** Mesafe için referans (günün duraklarının ortası); yoksa mesafe yazılmaz. */
  referans: Konum | null;
  onKapat: () => void;
  onKaydet: (p: { kapsam: OtelKapsami; otel: OtelSecimiVeyaKayitli; bitis?: OtelSecimiVeyaKayitli }) => Promise<void>;
};

/**
 * #56 §2: "Cum 16 Eki gecesi nerede kalıyorsun?" — arama (3.3 bileşenleri) + Haritadan (3.3 harita seçimi),
 * seyahatteki oteller (radyo), Otel yok, Hangi günler? (varsayılan bu gün ve sonrası), taşınma anahtarı (bitiş oteli
 * aynı listeden). Kaydet'e kadar hiçbir şey yazılmaz.
 */
export function GunOteliSayfasi({ seyahat, gun, gunler, konaklamalar, referans, onKapat, onKaydet }: Props) {
  const [secim, setSecim] = useState<Record<Uc, Secim>>(() => ({ baslangic: ilkSecim(gun.start_stay_id), bitis: ilkSecim(gun.end_stay_id) }));
  const [tasinma, setTasinma] = useState(() => !!gun.end_stay_id && gun.end_stay_id !== gun.start_stay_id);
  const [aktif, setAktif] = useState<Uc>('baslangic');
  const [kapsam, setKapsam] = useState<OtelKapsami>('sonrasi');
  const [sorgu, setSorgu] = useState('');
  const [jeton, setJeton] = useState(yeniOturumJetonu);
  const [mesgul, setMesgul] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [haritada, setHaritada] = useState(false);

  const uc: Uc = tasinma ? aktif : 'baslangic';
  const merkez = { lat: seyahat.lat, lng: seyahat.lng, yaricapM: 30_000 };
  const linkMi = linkGibiMi(sorgu);
  const listeAcik = !linkMi && sorgu.trim().length >= 2;
  const oneriler = useOtelOnerileri(listeAcik ? sorgu : '', jeton, merkez, listeAcik);

  // 3.3 haritasından dönünce (seçimle ya da geri tuşuyla) sayfa yeniden görünür.
  useFocusEffect(
    useCallback(() => {
      setHaritada(false);
      haritaSeciminiBirak();
    }, []),
  );

  const yeniSec = (otel: OtelSecimi) => {
    setSecim((s) => ({ ...s, [uc]: { tur: 'yeni', otel } }));
    setSorgu('');
  };

  const oneriSec = async (o: Oneri) => {
    setHata(null);
    setMesgul(true);
    try {
      const [yer] = await hafifYerler([o.place_id], { oturum: jeton });
      if (!yer) throw new Error('yer yok');
      yeniSec({ place_id: yer.place_id, ad: o.ana || yer.ad, lat: yer.lat, lng: yer.lng });
      setJeton(yeniOturumJetonu());
    } catch {
      setHata(t('gunOteli.secimHata'));
    } finally {
      setMesgul(false);
    }
  };

  const linkiCoz = async () => {
    setHata(null);
    setMesgul(true);
    try {
      const { yer } = await linkCoz(sorgu.trim(), merkez);
      yeniSec({ place_id: yer.place_id || null, ad: yer.ad || t('otel.adsiz'), lat: yer.lat, lng: yer.lng });
    } catch (e) {
      setHata((e as Error).message === 'desteklenmeyen_link' ? t('otel.linkDesteksiz') : t('otel.linkHata'));
    } finally {
      setMesgul(false);
    }
  };

  const haritadan = () => {
    const hedef = uc;
    haritadanSecimBekle((otel) => setSecim((s) => ({ ...s, [hedef]: { tur: 'yeni', otel } })));
    setHaritada(true);
    router.push({ pathname: '/yeni/otel', params: { trip: seyahat.id, secim: '1' } });
  };

  const kaydet = async () => {
    setHata(null);
    setKaydediliyor(true);
    try {
      await onKaydet({ kapsam, otel: kayda(secim.baslangic), bitis: tasinma ? kayda(secim.bitis) : undefined });
      onKapat();
    } catch {
      setHata(t('gunOteli.kaydetHata'));
      setKaydediliyor(false);
    }
  };

  const ad = (s: Secim) =>
    s.tur === 'yok' ? t('gunOteli.otelYok') : s.tur === 'yeni' ? s.otel.ad : (konaklamalar.find((k) => k.id === s.stayId)?.label ?? t('otel.adsiz'));

  // Radyo seçenekleri: aramadan / haritadan gelen yeniler, seyahatin otelleri, otel yok.
  const yeniler = (['baslangic', 'bitis'] as Uc[])
    .map((u) => secim[u])
    .filter((s, i, d): s is Extract<Secim, { tur: 'yeni' }> => s.tur === 'yeni' && d.findIndex((x) => ayniSecim(x, s)) === i);
  const secenekler: { anahtar: string; secim: Secim; ad: string; alt: string }[] = [
    ...yeniler.map((s, i) => ({ anahtar: `yeni:${i}`, secim: s as Secim, ad: s.otel.ad, alt: t('gunOteli.yeni') })),
    ...konaklamalar.map((k) => {
      const geceler = otelinGeceleri(gunler, k.id);
      const ids = new Set(geceler.map((g) => g.id));
      const parcalar = [geceler.length ? t('gunOteli.geceleri', { geceler: geceMetni(gunler.filter((g) => ids.has(g.id))) }) : t('gunOteli.geceYok')];
      if (referans) parcalar.push(mesafeMetni(Math.round(mesafeM(referans, k) / 100) * 100));
      return { anahtar: k.id, secim: { tur: 'kayitli', stayId: k.id } as Secim, ad: k.label ?? t('otel.adsiz'), alt: parcalar.join(' · ') };
    }),
    { anahtar: 'yok', secim: { tur: 'yok' }, ad: t('gunOteli.otelYok'), alt: t('gunOteli.otelYokAlt') },
  ];

  return (
    <Modal visible={!haritada} transparent animationType="slide" onRequestClose={onKapat}>
      <KeyboardAvoidingView style={s.perde} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onKapat} accessibilityLabel={t('genel.vazgec')} />
        <View style={s.kutu}>
          <View style={s.tutamak} />
          <Text style={s.baslik}>{t('gunOteli.baslik', { gun: gunEtiketKisa(gun) })}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.icerik}>
            {tasinma ? (
              <View style={s.segment}>
                {(['baslangic', 'bitis'] as Uc[]).map((u) => (
                  <Pressable
                    key={u}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: aktif === u }}
                    onPress={() => setAktif(u)}
                    style={[s.segmentHucre, aktif === u && s.segmentSecili]}>
                    <Text style={s.segmentUst}>{t(u === 'baslangic' ? 'gunOteli.sabah' : 'gunOteli.aksam')}</Text>
                    <Text style={s.segmentMetin} numberOfLines={1}>
                      {ad(secim[u])}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={s.aramaSatiri}>
              <View style={s.arama}>
                <Text style={s.buyutec}>⌕</Text>
                <TextInput
                  accessibilityLabel={t('otel.ara')}
                  placeholder={t('gunOteli.araYer')}
                  placeholderTextColor={renk.soluk}
                  value={sorgu}
                  onChangeText={setSorgu}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType={linkMi ? 'go' : 'search'}
                  onSubmitEditing={linkMi ? linkiCoz : undefined}
                  style={s.girdi}
                />
                {mesgul || (listeAcik && oneriler.isFetching) ? <ActivityIndicator color={renk.ikincil} /> : null}
                {linkMi && !mesgul ? (
                  <Pressable accessibilityRole="button" onPress={linkiCoz} hitSlop={10}>
                    <Text style={s.linkDugme}>{t('otel.linkCoz')}</Text>
                  </Pressable>
                ) : null}
              </View>
              <Pressable accessibilityRole="button" onPress={haritadan} style={s.haritadan}>
                <Ikon ad="harita" boyut={16} renk={renk.metin} />
                <Text style={s.haritadanMetin}>{t('gunOteli.haritadan')}</Text>
              </Pressable>
            </View>

            {listeAcik ? (
              <View style={s.oneriler}>
                {oneriler.isError ? <Text style={s.hata}>{t('otel.araHata')}</Text> : null}
                {oneriler.data?.length === 0 ? <Text style={s.bos}>{t('otel.sonucYok')}</Text> : null}
                {oneriler.data?.map((o, i) => (
                  <Pressable
                    key={o.place_id}
                    accessibilityRole="button"
                    disabled={mesgul}
                    onPress={() => oneriSec(o)}
                    style={({ pressed }) => [s.oneri, i > 0 && s.ayrac, pressed && { opacity: 0.7 }]}>
                    <Text style={s.ad} numberOfLines={1}>
                      {o.ana}
                    </Text>
                    <Text style={s.alt} numberOfLines={1}>
                      {o.ikincil}
                    </Text>
                  </Pressable>
                ))}
                {oneriler.data && oneriler.data.length > 0 ? <GoogleAtfi /> : null}
              </View>
            ) : null}

            {konaklamalar.length > 0 ? <Text style={s.bolum}>{t('gunOteli.kullanilan')}</Text> : null}
            {secenekler.map((o) => {
              const secili = ayniSecim(secim[uc], o.secim);
              return (
                <Pressable
                  key={o.anahtar}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: secili }}
                  onPress={() => setSecim((s) => ({ ...s, [uc]: o.secim }))}
                  style={({ pressed }) => [s.radyo, pressed && { opacity: 0.7 }]}>
                  <View style={[s.daire, secili && s.daireSecili]}>{secili ? <View style={s.nokta} /> : null}</View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.ad} numberOfLines={1}>
                      {o.ad}
                    </Text>
                    <Text style={s.alt} numberOfLines={1}>
                      {o.alt}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            <Text style={s.bolum}>{t('gunOteli.hangiGunler')}</Text>
            <View style={s.segment}>
              {(['bugun', 'sonrasi'] as OtelKapsami[]).map((k) => (
                <Pressable
                  key={k}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: kapsam === k }}
                  onPress={() => setKapsam(k)}
                  style={[s.segmentHucre, kapsam === k && s.segmentSecili]}>
                  <Text style={s.segmentMetin}>{t(k === 'bugun' ? 'gunOteli.yalnizBugun' : 'gunOteli.buVeSonrasi')}</Text>
                </Pressable>
              ))}
            </View>

            <View style={s.anahtar}>
              <Text style={[s.ad, { flex: 1 }]}>{t('gunOteli.tasiniyorum')}</Text>
              <Switch
                accessibilityLabel={t('gunOteli.tasiniyorum')}
                value={tasinma}
                onValueChange={(v) => {
                  setTasinma(v);
                  setAktif(v ? 'bitis' : 'baslangic');
                  // Açılınca bitiş, başlangıçla aynı başlar; kullanıcı Akşam sekmesinden değiştirir.
                  if (v && !gun.end_stay_id) setSecim((s) => ({ ...s, bitis: s.baslangic }));
                }}
                trackColor={{ true: renk.metin, false: renk.ayrac }}
              />
            </View>

            {hata ? <Text style={s.hata}>{hata}</Text> : null}
            <Buton baslik={t('gunOteli.kaydet')} onPress={kaydet} yukleniyor={kaydediliyor} stil={s.kaydet} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(15,15,15,0.35)', justifyContent: 'flex-end' },
  kutu: { maxHeight: '88%', backgroundColor: renk.zemin, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
  tutamak: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: renk.ayrac },
  baslik: { fontFamily: yazi.ekstra, fontSize: 17, color: renk.metin, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  icerik: { paddingHorizontal: 20, paddingBottom: 32, gap: 8 },
  aramaSatiri: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arama: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.yuzey },
  buyutec: { fontSize: 16, color: renk.ikincil },
  girdi: { flex: 1, fontFamily: yazi.yari, fontSize: 14, color: renk.metin, paddingVertical: 0 },
  linkDugme: { fontFamily: yazi.kalin, fontSize: 12, color: renk.vurgu, paddingVertical: 8 },
  haritadan: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: renk.ayrac },
  haritadanMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  oneriler: { borderRadius: 14, borderWidth: 1, borderColor: renk.ayrac, paddingHorizontal: 14, paddingVertical: 4 },
  oneri: { minHeight: minDokunma, justifyContent: 'center', paddingVertical: 8, gap: 2 },
  ayrac: { borderTopWidth: 1, borderTopColor: renk.ayrac },
  bolum: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil, marginTop: 8 },
  radyo: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: minDokunma, paddingVertical: 6 },
  daire: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: renk.soluk, alignItems: 'center', justifyContent: 'center' },
  daireSecili: { borderColor: renk.metin },
  nokta: { width: 10, height: 10, borderRadius: 5, backgroundColor: renk.metin },
  ad: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 12 },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: renk.yuzey },
  segmentHucre: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  segmentSecili: { backgroundColor: renk.zemin },
  segmentUst: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  segmentMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  anahtar: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: minDokunma, marginTop: 4 },
  kaydet: { height: 50, marginTop: 8 },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});
