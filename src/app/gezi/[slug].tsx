import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeziPlani } from '@/components/icerik/GeziPlani';
import { Kalp } from '@/components/icerik/Kalp';
import { MdYazi } from '@/components/icerik/MdYazi';
import { GeziAl } from '@/components/icerik/GeziAl';
import { MekanPaneli } from '@/components/mekan/MekanPaneli';
import { SecimMenusu } from '@/components/program/SecimMenusu';
import { Buton } from '@/components/ui/Buton';
import { EkleDugmesi } from '@/components/ui/EkleDugmesi';
import { Ikon } from '@/components/ui/Ikon';
import { Logo } from '@/components/ui/Logo';
import { SegmentSecici } from '@/components/ui/SegmentSecici';
import { kalinParcalar } from '@/features/icerik/aktar';
import { useIcerikCanli } from '@/features/icerik/fotolar';
import { rehberMekanIdleri } from '@/features/icerik/rehber';
import { cozumSebebi, olayYaz, useGezi, useGeziAlinma } from '@/features/icerik/sorgular';
import { hedefSeyahatler, useYereEkle, varsayilanHedef } from '@/features/icerik/yerEkle';
import { useMekanGuncelle, useMekanlar, useMekanSil } from '@/features/mekanlar/sorgular';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { useHafifYerler, useYerFotolari, type HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import { davetLinki } from '@/lib/davetLinki';
import { kategoriEtiketi, sureMetni, varsayilanDakika } from '@/lib/kategori';
import { okumaSuresiDk } from '@/lib/markdown';
import { puanMetni } from '@/lib/puan';
import { AYLAR, parcala, tarihAraligi } from '@/lib/takvim';
import type { GeziDuragi } from '@/lib/tipler';
import { bosluk, renk, yazi } from '@/theme';

type Sekme = 'plan' | 'yazi';
/** Eklenecek / çıkarılacak mekan (durak satırı ya da yazıdaki mekan kartı). */
type Yer = { anahtar: string; place_id: string; primary_type: string | null; lat: number; lng: number; dakika?: number };

/**
 * #97 B → #143 (kanvas 17 · 18 · 19): önerilen gezi tek sayfa — kapak (geri / kalp / paylaş, "2 GÜNLÜK GEZİ", "N kez alındı",
 * başlık), altında kaydırınca yapışan [Rota & plan] | [Gezi yazısı] (varsayılan Rota & plan; yazı yoksa sekme yok), "+ ve ✓
 * {seyahat} listene göre · Değiştir" bağlamı (aynı şehirde en yakın tarihli seyahat; yoksa satır da ✓ da yok, + ilk dokunuşta
 * "Hangi seyahate?"), iki sekmede ortak alt çubuk "N gün · M mekan · Seyahatime al".
 */
export default function GeziEkrani() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const gezi = useGezi(slug);
  const alinma = useGeziAlinma(gezi.data?.id);
  const kenar = useSafeAreaInsets();
  const kaydirici = useRef<ScrollView>(null);
  const [sekme, setSekme] = useState<Sekme>('plan');
  const [gunSira, setGunSira] = useState(0);
  const [segmentY, setSegmentY] = useState(0);
  const [yapisik, setYapisik] = useState(false);
  const [alAcik, setAlAcik] = useState(false);
  const [alHata, setAlHata] = useState<string | null>(null);

  // KK3: hedef seyahat — kullanıcı seçtiyse o, değilse aynı şehirdeki en yakın tarihli seyahat.
  const seyahatler = useSeyahatler();
  const hedefler = useMemo(() => hedefSeyahatler(seyahatler.data), [seyahatler.data]);
  const [secilenHedefId, setSecilenHedefId] = useState<string | null>(null);
  const hedef = hedefler.find((s) => s.id === secilenHedefId) ?? varsayilanHedef(hedefler, gezi.data?.sehirler?.ad);
  const [hedefMenusu, setHedefMenusu] = useState<{ bekleyen: Yer | null } | null>(null);
  const hedefMekanlar = useMekanlar(hedef?.id);
  const listedeki = (placeId: string) => hedefMekanlar.data?.find((m) => m.place_id === placeId);
  const ekle = useYereEkle();
  const sil = useMekanSil(hedef?.id ?? '');
  const guncelle = useMekanGuncelle(hedef?.id ?? '');
  const [mesgulId, setMesgulId] = useState<string | null>(null);

  const duraklar = useMemo(() => gezi.data?.gezi_gunleri.flatMap((g) => g.gezi_duraklari) ?? [], [gezi.data]);
  const canli = useIcerikCanli(duraklar, () => gezi.data?.sehirler?.ad ?? '', !!gezi.data);
  const kimlik = useCallback((d: GeziDuragi) => canli.data?.get(d.id)?.place_id ?? d.place_id ?? null, [canli.data]);
  // Gezi yazısındaki mekan kartları (`::mekan[place_id]`) ve satır içi bağlantılar.
  const yaziIdleri = useMemo(() => rehberMekanIdleri([gezi.data?.yazi_md ?? '']), [gezi.data?.yazi_md]);
  const yaziHafif = useHafifYerler(yaziIdleri);
  const yaziFoto = useYerFotolari(yaziIdleri);
  const [panel, setPanel] = useState<{ placeId: string; hafif: HafifYer; dakika: number } | null>(null);

  useEffect(() => {
    if (gezi.data) olayYaz('gezi_goruntulendi', gezi.data.id, { slug });
  }, [gezi.data, slug]);

  if (gezi.isPending) {
    return (
      <View style={[s.ekran, s.ortala]}>
        <ActivityIndicator color={renk.ana} />
      </View>
    );
  }
  if (gezi.isError || !gezi.data) {
    return (
      <View style={[s.ekran, s.ortala, { paddingTop: kenar.top }]}>
        <Text style={s.hata}>{t('gezi.hata')}</Text>
        <Buton baslik={t('genel.geri')} tur="ikincil" onPress={() => router.back()} />
      </View>
    );
  }
  const g = gezi.data;
  const yaziVar = !!g.yazi_md?.trim();
  const aktifSekme: Sekme = yaziVar ? sekme : 'plan';
  const kapakUri = g.kapak_url ?? g.sehirler?.kapak_url ?? (duraklar.map((d) => canli.data?.get(d.id)?.foto_uri).find((u): u is string => !!u) ?? null);
  const tarih = parcala(g.created_at.slice(0, 10));
  const alinmaSayisi = alinma.data ?? 0;
  const paylas = () => Share.share({ message: t('gezi.paylasMetin', { baslik: g.baslik, link: davetLinki(`gezi/${g.slug}`).replace('/r/gezi/', '/gezi/') }) }).catch(() => {});
  const yapismaY = segmentY - kenar.top - 6;

  const hedefeEkle = async (y: Yer, seyahatId: string) => {
    setMesgulId(y.anahtar);
    try {
      await ekle.mutateAsync({ seyahatId, yerId: null, place_id: y.place_id, primary_type: y.primary_type, lat: y.lat, lng: y.lng, dakika: y.dakika });
      setAlHata(null);
    } catch (e) {
      setAlHata(t('gezi.mekanEkleHata', { sebep: e instanceof Error ? e.message : String(e) }));
    } finally {
      setMesgulId(null);
    }
  };
  // KK3: ✓ → listeden çıkar; + → hedef seyahate ekle; hedef yoksa önce "Hangi seyahate?".
  const degistir = async (y: Yer) => {
    const m = listedeki(y.place_id);
    if (m && hedef) {
      setMesgulId(y.anahtar);
      try {
        await sil.mutateAsync(m.id);
      } finally {
        setMesgulId(null);
      }
      return;
    }
    if (hedef) return hedefeEkle(y, hedef.id);
    setHedefMenusu({ bekleyen: y });
  };
  const durakYeri = (d: GeziDuragi): Yer | null => {
    const pid = kimlik(d);
    if (!pid) {
      // #118: sebebi söyle — kimlik henüz çözülüyor / Google'da yok / sunucu hatası.
      const sebep = cozumSebebi(d.id);
      setAlHata(canli.isPending ? t('anasayfa.cozuluyor') : t('anasayfa.ekleHataSebep', { sebep: sebep === 'bulunamadi' || !sebep ? t('anasayfa.bulunamadi') : sebep }));
      return null;
    }
    return { anahtar: d.id, place_id: pid, primary_type: canli.data?.get(d.id)?.hafif?.primary_type ?? d.kategori, lat: d.lat, lng: d.lng, dakika: d.sure_dk };
  };
  const durakArti = (d: GeziDuragi) => {
    const y = durakYeri(d);
    if (y) degistir(y);
  };
  const durakListede = (d: GeziDuragi) => {
    const pid = kimlik(d);
    return !!pid && !!listedeki(pid);
  };
  const paneliAc = (placeId: string, hafif: HafifYer | null | undefined, dakika?: number) => {
    if (hafif) setPanel({ placeId, hafif, dakika: dakika ?? varsayilanDakika(hafif.primary_type) });
  };

  const sekmeSec = (yeni: Sekme) => {
    setSekme(yeni);
    // Yapışıkken sekme değişirse yeni içerik segmentin hemen altından başlar.
    if (yapisik) kaydirici.current?.scrollTo({ y: yapismaY, animated: false });
  };
  const segment = (
    <SegmentSecici
      buyuk
      deger={aktifSekme}
      onDeger={sekmeSec}
      secenekler={[
        { deger: 'plan', etiket: t('gezi.sekmePlan'), ikon: (secili) => <Ikon ad="harita" boyut={16} renk={secili ? renk.metin : renk.ikincil} kalinlik={2.2} /> },
        { deger: 'yazi', etiket: t('gezi.sekmeYazi'), ikon: (secili) => <Ikon ad="kitap" boyut={16} renk={secili ? renk.metin : renk.ikincil} kalinlik={2.2} /> },
      ]}
    />
  );

  const yeniSeyahat = () => {
    setAlAcik(false);
    router.navigate('/(tabs)/yeni');
  };

  const mekanKarti = (placeId: string) => {
    const durak = duraklar.find((d) => kimlik(d) === placeId);
    const hafif = yaziHafif.data?.[placeId] ?? (durak ? canli.data?.get(durak.id)?.hafif : null) ?? null;
    if (!hafif && !durak) return null;
    const foto = yaziFoto.data?.get(placeId) ?? (durak ? canli.data?.get(durak.id)?.foto_uri : null) ?? null;
    const puan = puanMetni(hafif?.puan);
    const y: Yer = { anahtar: placeId, place_id: placeId, primary_type: hafif?.primary_type ?? durak?.kategori ?? null, lat: hafif?.lat ?? durak!.lat, lng: hafif?.lng ?? durak!.lng, dakika: durak?.sure_dk };
    return (
      <Pressable accessibilityRole="button" disabled={!hafif} onPress={() => paneliAc(placeId, hafif, listedeki(placeId)?.default_minutes ?? durak?.sure_dk)} style={({ pressed }) => [s.kart, pressed && { opacity: 0.85 }]}>
        <View style={s.kartFoto}>{foto ? <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.kartAd} numberOfLines={1}>
            {hafif?.ad ?? durak?.ad}
          </Text>
          <Text style={s.kartAlt} numberOfLines={1}>
            {[kategoriEtiketi(y.primary_type), puan ? `★ ${puan}` : null, durak ? sureMetni(durak.sure_dk) : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <EkleDugmesi listede={!!listedeki(placeId)} mesgul={mesgulId === placeId} onPress={() => degistir(y)} />
      </Pressable>
    );
  };
  const panelMekani = panel ? listedeki(panel.placeId) : undefined;

  return (
    <View style={s.ekran}>
      <ScrollView
        ref={kaydirici}
        contentContainerStyle={{ paddingBottom: 112 + kenar.bottom }}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const yeni = yaziVar && segmentY > 0 && y >= yapismaY;
          if (yeni !== yapisik) setYapisik(yeni);
        }}>
        <View style={[s.kapak, { height: 166 + kenar.top }]}>
          {kapakUri ? (
            <>
              <Image source={{ uri: kapakUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              <View style={s.kapakGolge} />
            </>
          ) : null}
          <View style={[s.kapakUst, { top: kenar.top + 8 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={() => router.back()} style={s.kare}>
              <Ikon ad="geri" boyut={20} renk={renk.metin} kalinlik={2.4} />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Kalp tur="gezi" hedefId={g.id} boyut={44} kose={14} arkaPlan={renk.zemin} />
              <Pressable accessibilityRole="button" accessibilityLabel={t('gezi.paylas')} onPress={paylas} style={s.kare}>
                <Ikon ad="paylas" boyut={18} renk={renk.metin} kalinlik={2.2} />
              </Pressable>
            </View>
          </View>
          <View style={s.kapakMetin}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Text style={s.rozet}>{t('gezi.rozetGun', { n: g.gun_sayisi })}</Text>
              {alinmaSayisi > 0 ? <Text style={[s.rozet, s.rozetSaydam]}>{t('gezi.alindi', { n: alinmaSayisi })}</Text> : null}
            </View>
            <Text style={s.baslik}>{g.baslik}</Text>
          </View>
        </View>
        {yaziVar ? (
          <View style={s.segmentKap} onLayout={(e) => setSegmentY(e.nativeEvent.layout.y)}>
            {segment}
          </View>
        ) : null}
        {hedef ? (
          <Pressable accessibilityRole="button" accessibilityHint={t('gezi.degistir')} onPress={() => setHedefMenusu({ bekleyen: null })} style={s.hedef}>
            <View style={s.hedefNokta} />
            <Text style={s.hedefMetin} numberOfLines={1}>
              {kalinParcalar(t('gezi.hedefSatir', { seyahat: seyahatAdi(hedef) })).map((p, i) => (
                <Text key={i} style={p.kalin ? s.hedefKalin : undefined}>
                  {p.metin}
                </Text>
              ))}
            </Text>
            <Text style={s.hedefDegistir}>{t('gezi.degistir')}</Text>
            <Ikon ad="asagi" boyut={14} renk={renk.ana} kalinlik={2.4} />
          </Pressable>
        ) : null}
        {aktifSekme === 'plan' ? (
          <View style={s.plan}>
            <GeziPlani
              gezi={g}
              gunSira={gunSira}
              onGunSira={setGunSira}
              canli={canli.data}
              listede={durakListede}
              mesgulId={mesgulId}
              onDurakEkle={durakArti}
              onDurak={(d) => paneliAc(kimlik(d) ?? '', canli.data?.get(d.id)?.hafif, listedeki(kimlik(d) ?? '')?.default_minutes ?? d.sure_dk)}
            />
          </View>
        ) : (
          <View style={s.yazi}>
            <View style={s.yazar}>
              <View style={s.yazarKare}>
                <Logo boyut={20} koyuZemin />
              </View>
              <Text style={s.yazarMetin}>
                {[g.yazar_ad, `${tarih.gun} ${AYLAR[tarih.ay - 1]}`, t('gezi.okuma', { n: okumaSuresiDk(g.yazi_md) }), alinmaSayisi > 0 ? t('gezi.alindi', { n: alinmaSayisi }) : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <MdYazi kaynak={g.yazi_md} kenar={22} buyuk mekanKarti={mekanKarti} onMekan={(id) => paneliAc(id, yaziHafif.data?.[id], listedeki(id)?.default_minutes)} />
          </View>
        )}
      </ScrollView>

      {yapisik ? <View style={[s.yapisik, { paddingTop: kenar.top + 6 }]}>{segment}</View> : null}

      <View style={[s.altCubuk, { paddingBottom: Math.max(kenar.bottom, 12) + 8 }]}>
        {alHata && !alAcik ? <Text style={s.hata}>{alHata}</Text> : null}
        <View style={s.altSatir}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.altBaslik} numberOfLines={1}>
              {t('gezi.gunMekan', { gun: g.gun_sayisi, mekan: g.mekan_sayisi })}
            </Text>
            {g.gun_sayisi > 1 ? <Text style={s.altAlt}>{t('gezi.altAlt')}</Text> : null}
          </View>
          <Buton
            baslik={t('gezi.al')}
            tur="vurgu"
            onPress={() => {
              setAlHata(null);
              setAlAcik(true);
            }}
          />
        </View>
      </View>

      {alAcik ? (
        <GeziAl gezi={g} kimlik={kimlik} ilkHedefId={hedef?.id ?? null} onKapat={() => setAlAcik(false)} />
      ) : null}
      <SecimMenusu
        acik={!!hedefMenusu}
        baslik={t('anasayfa.hangiSeyahat')}
        secenekler={[
          ...hedefler.map((sy) => ({
            etiket: `${seyahatAdi(sy)}${sy.start_date && sy.end_date ? ` · ${tarihAraligi(sy.start_date, sy.end_date)}` : ''}`,
            onPress: () => {
              setSecilenHedefId(sy.id);
              // Seçilen seyahatte zaten varsa ekleme sessizce mevcut sayılır (23505).
              if (hedefMenusu?.bekleyen) hedefeEkle(hedefMenusu.bekleyen, sy.id);
            },
          })),
          { etiket: `+ ${t('gezi.yeniSeyahat')}`, onPress: yeniSeyahat },
        ]}
        onKapat={() => setHedefMenusu(null)}
      />

      {panel ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <MekanPaneli
            placeId={panel.placeId}
            hafif={panel.hafif}
            dakika={panelMekani?.default_minutes ?? panel.dakika}
            onSure={(fark) => {
              const yeni = Math.min(480, Math.max(15, (panelMekani?.default_minutes ?? panel.dakika) + fark));
              if (panelMekani) guncelle.mutate({ id: panelMekani.id, default_minutes: yeni });
              else setPanel({ ...panel, dakika: yeni });
            }}
            baglam="kesfet"
            icinde={!!panelMekani}
            mesgul={mesgulId === panel.placeId}
            onCta={() => degistir({ anahtar: panel.placeId, place_id: panel.placeId, primary_type: panel.hafif.primary_type, lat: panel.hafif.lat, lng: panel.hafif.lng, dakika: panel.dakika })}
            onYolTarifi={() =>
              Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${panel.hafif.lat},${panel.hafif.lng}&destination_place_id=${encodeURIComponent(panel.placeId)}&travelmode=walking`)
            }
            onKapat={() => setPanel(null)}
          />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ortala: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  // Kanvas 17: 210 px Gece kapak (durum çubuğu dahil), düğmeler 44 px beyaz kare (köşe 14).
  kapak: { backgroundColor: renk.ana, justifyContent: 'flex-end', overflow: 'hidden' },
  kapakGolge: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(21,42,107,0.55)' },
  kapakUst: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  kare: { width: 44, height: 44, borderRadius: 14, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  kapakMetin: { paddingHorizontal: bosluk.kenar, paddingBottom: 18, gap: 6 },
  rozet: { height: 24, lineHeight: 24, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden', backgroundColor: renk.vurgu, color: renk.metin, fontFamily: yazi.ekstra, fontSize: 11 },
  rozetSaydam: { backgroundColor: 'rgba(255,255,255,0.16)', color: renk.zemin },
  baslik: { fontFamily: yazi.baslik, fontSize: 26, lineHeight: 28, letterSpacing: -0.8, color: renk.zemin },
  segmentKap: { marginTop: 12, paddingHorizontal: bosluk.kenar },
  yapisik: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: bosluk.kenar, paddingBottom: 8, backgroundColor: renk.zemin, borderBottomWidth: 1, borderBottomColor: renk.ayrac },
  hedef: { marginTop: 10, marginHorizontal: bosluk.kenar, height: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#b4bbd3', flexDirection: 'row', alignItems: 'center', gap: 8 },
  hedefNokta: { width: 8, height: 8, borderRadius: 4, backgroundColor: renk.vurgu },
  hedefMetin: { flex: 1, fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  hedefKalin: { fontFamily: yazi.ekstra, color: renk.metin },
  hedefDegistir: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  plan: { paddingTop: 10, paddingHorizontal: bosluk.kenar },
  yazi: { paddingTop: 18, gap: 14 },
  yazar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22 },
  yazarKare: { width: 28, height: 28, borderRadius: 9, backgroundColor: renk.ana, alignItems: 'center', justifyContent: 'center' },
  yazarMetin: { flex: 1, fontFamily: yazi.yari, fontSize: 13, color: renk.ikincil },
  kart: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderWidth: 1.5, borderColor: renk.ayrac, backgroundColor: renk.zemin },
  kartFoto: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden', backgroundColor: renk.yuzey },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  kartAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  altCubuk: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: bosluk.kenar, paddingTop: 12, backgroundColor: renk.zemin, borderTopWidth: 1, borderTopColor: renk.ayrac, gap: 8 },
  altSatir: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  altBaslik: { fontFamily: yazi.baslik, fontSize: 17, color: renk.metin },
  altAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari, textAlign: 'center' },
});
