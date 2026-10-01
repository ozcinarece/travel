import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SecimMenusu } from '@/components/program/SecimMenusu';
import { Buton } from '@/components/ui/Buton';
import { Avatar } from '@/components/ui/Avatar';
import { useDuraklar, useGunler } from '@/features/gunler/sorgular';
import { useMekanEkle, useMekanGuncelle, useMekanSil, useMekanlar, useUyeler } from '@/features/mekanlar/sorgular';
import { matrisNoktalari, useDurakGuncelle, useYuruyusMatrisi } from '@/features/program/sorgular';
import { gunDuraklari, useGunProgrami, useSimdi } from '@/features/program/useProgram';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { useTamYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni, varsayilanDakika } from '@/lib/kategori';
import { onayIste } from '@/lib/onay';
import { useOturum } from '@/lib/oturum';
import { arasindaAnahtar } from '@/schedule/sira';
import { dakikaSaat } from '@/schedule/tempo';
import { bosluk, minDokunma, renk, yazi } from '@/theme';

// PRD 3.8 Mekan detayı: tam Details (yalnız burada), kim ekledi + not, süre −/+, yol tarifi, ··· menüsü.
export default function MekanDetayEkrani() {
  const { id, placeId } = useLocalSearchParams<{ id: string; placeId: string }>();
  const ust = useSafeAreaInsets().top;
  const { session } = useOturum();
  const seyahat = useSeyahat(id);
  const yer = useTamYer(placeId, seyahat.data?.tz);
  const mekanlar = useMekanlar(id);
  const uyeler = useUyeler(id);
  const guncelle = useMekanGuncelle(id ?? '');
  const sil = useMekanSil(id ?? '');
  const ekle = useMekanEkle(id ?? '');
  const [notTaslak, setNotTaslak] = useState<string | null>(null);
  const [menuAcik, setMenuAcik] = useState(false);
  const [gunSecAcik, setGunSecAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const mekan = mekanlar.data?.find((m) => m.place_id === placeId);

  // 3.7 ile: güne atanmışsa "N. gün · HH:MM" (o günün programından), menüde Başka güne al / Atla.
  const gunler = useGunler(id);
  const duraklar = useDuraklar(id);
  const durakGuncelle = useDurakGuncelle(id ?? '');
  const durak = mekan ? duraklar.data?.find((d) => d.place_ref === mekan.id) : undefined;
  const gun = durak ? gunler.data?.find((g) => g.id === durak.day_id) : undefined;
  const otel = seyahat.data && seyahat.data.hotel_lat !== null && seyahat.data.hotel_lng !== null ? { lat: seyahat.data.hotel_lat, lng: seyahat.data.hotel_lng } : null;
  const gunMekanlari = gun ? gunDuraklari(gun, duraklar.data ?? []).map((d) => mekanlar.data?.find((m) => m.id === d.place_ref)).filter((m): m is NonNullable<typeof m> => !!m) : [];
  const matris = useYuruyusMatrisi(gun ? id : undefined, matrisNoktalari(otel, gunMekanlari));
  const an = useSimdi(false);
  const prog = useGunProgrami({ seyahat: seyahat.data, gun, duraklar: duraklar.data ?? [], mekanlar: mekanlar.data ?? [], yuruyus: matris.yuruyus, an });
  const satir = durak ? prog?.canli.satirlar.find((x) => x.durak.id === durak.id) : undefined;
  const gunMetni = gun
    ? durak?.skipped
      ? `${t('mekan.gunAtandi', { n: gun.index })} · ${t('mekan.atlandi')}`
      : satir
        ? t('mekan.gunSaat', { n: gun.index, saat: dakikaSaat(satir.varisDk) })
        : t('mekan.gunAtandi', { n: gun.index })
    : t('mekan.gunAtanmadi');

  const baskaGuneAl = async (hedefId: string) => {
    if (!durak) return;
    const hedefDuraklar = (duraklar.data ?? []).filter((d) => d.day_id === hedefId).sort((a, b) => (a.order_key < b.order_key ? -1 : 1));
    try {
      await durakGuncelle.mutateAsync({
        id: durak.id,
        day_id: hedefId,
        order_key: arasindaAnahtar(hedefDuraklar[hedefDuraklar.length - 1]?.order_key, undefined),
        arrived_at: null,
        arrived_by: null,
      });
    } catch {
      setHata(t('mekan.kaydetHata'));
    }
  };
  const ekleyen = mekan ? uyeler.data?.find((u) => u.user_id === mekan.added_by) : undefined;
  const sahip = uyeler.data?.find((u) => u.user_id === session?.user.id)?.role === 'owner';
  const notDuzenler = !!mekan && (mekan.added_by === session?.user.id || sahip);
  const dakika = mekan?.default_minutes ?? varsayilanDakika(yer.data?.primary_type);

  const sureDegistir = async (fark: number) => {
    if (!mekan) return;
    const yeni = Math.min(480, Math.max(15, mekan.default_minutes + fark));
    if (yeni === mekan.default_minutes) return;
    try {
      await guncelle.mutateAsync({ id: mekan.id, default_minutes: yeni });
    } catch {
      setHata(t('mekan.kaydetHata'));
    }
  };

  const notuKaydet = async () => {
    if (!mekan || notTaslak === null) return;
    try {
      await guncelle.mutateAsync({ id: mekan.id, note: notTaslak.trim() || null });
      setNotTaslak(null);
    } catch {
      setHata(t('mekan.kaydetHata'));
    }
  };

  const cikar = async () => {
    if (!mekan) return;
    const onay = await onayIste(t('mekan.cikarBaslik'), t('mekan.cikarMetin', { ad: yer.data?.ad ?? '' }), t('mekan.cikarOnay'), t('genel.vazgec'));
    if (!onay) return;
    try {
      await sil.mutateAsync(mekan.id);
      router.back();
    } catch {
      setHata(t('mekan.kaydetHata'));
    }
  };

  const yolTarifi = () => {
    const y = yer.data;
    if (!y) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${y.lat},${y.lng}&destination_place_id=${encodeURIComponent(y.place_id)}&travelmode=walking`;
    Linking.openURL(url);
  };

  return (
    <View style={s.ekran}>
      <ScrollView contentContainerStyle={s.icerik}>
        <View style={s.foto}>
          {yer.data?.foto_uri ? (
            <Image source={{ uri: yer.data.foto_uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Text style={s.fotoYok}>{yer.isPending ? '' : t('mekan.fotoYok')}</Text>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={() => router.back()} style={[s.geri, { top: ust + 8 }]}>
            <Text style={s.geriIsaret}>‹</Text>
          </Pressable>
          {yer.data?.foto_uri ? (
            <View style={[s.atif, { top: ust + 14 }]}>
              <Text style={s.atifMetin}>{t('yerler.atif')}</Text>
            </View>
          ) : null}
        </View>

        {yer.isPending ? (
          <ActivityIndicator color={renk.metin} style={{ marginTop: 30 }} />
        ) : yer.isError || !yer.data ? (
          <Text style={[s.hata, { paddingTop: 20 }]}>{t('mekan.hata')}</Text>
        ) : (
          <>
            <View style={s.baslikKutu}>
              <Text style={s.ustMetin}>
                {kategoriEtiketi(yer.data.primary_type)} · {gunMetni}
              </Text>
              <Text style={s.baslik}>{yer.data.ad}</Text>
              <View style={s.puanSatir}>
                {yer.data.puan !== null ? (
                  <>
                    <Text style={s.yildiz}>★</Text>
                    <Text style={s.puan}>{yer.data.puan.toLocaleString('tr-TR')}</Text>
                  </>
                ) : null}
                {yer.data.puan_sayisi !== null ? <Text style={s.gri}>{t('mekan.yorum', { n: yer.data.puan_sayisi.toLocaleString('tr-TR') })}</Text> : null}
                {yer.data.acik !== null ? (
                  <>
                    <Text style={s.gri}>·</Text>
                    <Text style={[s.acik, yer.data.acik ? { color: renk.basari } : { color: renk.uyari }]}>
                      {yer.data.acik ? t('mekan.acik') : t('mekan.kapali')}
                    </Text>
                    {yer.data.acik && yer.data.kapanis ? <Text style={s.gri}>· {t('mekan.kadar', { saat: yer.data.kapanis })}</Text> : null}
                  </>
                ) : null}
                {yer.data.google_maps_uri ? (
                  <>
                    <Text style={s.gri}>·</Text>
                    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(yer.data!.google_maps_uri!)} hitSlop={6}>
                      <Text style={s.link}>{t('mekan.googleAc')}</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>

            {mekan ? (
              <View style={s.ekleyenKutu}>
                <Avatar ad={ekleyen?.display_name ?? '?'} boyut={32} arkaPlan="#4c6ef5" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.ekleyenAd}>{t('mekan.ekledi', { ad: ekleyen?.display_name ?? '' })}</Text>
                  {notDuzenler ? (
                    <View style={s.notSatir}>
                      <TextInput
                        accessibilityLabel={t('mekan.notYer')}
                        placeholder={t('mekan.notYer')}
                        placeholderTextColor={renk.soluk}
                        value={notTaslak ?? mekan.note ?? ''}
                        onChangeText={setNotTaslak}
                        multiline
                        maxLength={500}
                        style={s.notGirdi}
                      />
                      {notTaslak !== null && notTaslak !== (mekan.note ?? '') ? (
                        <Pressable accessibilityRole="button" onPress={notuKaydet} hitSlop={8}>
                          <Text style={s.link}>{t('mekan.notKaydet')}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : mekan.note ? (
                    <Text style={s.not}>{`“${mekan.note}”`}</Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={s.ekleKutu}>
                <Buton
                  baslik={t('mekan.listeyeEkle')}
                  onPress={() =>
                    ekle
                      .mutateAsync({ place_id: yer.data!.place_id, primary_type: yer.data!.primary_type, lat: yer.data!.lat, lng: yer.data!.lng })
                      .catch(() => setHata(t('mekan.ekleHata')))
                  }
                  yukleniyor={ekle.isPending}
                />
              </View>
            )}

            <View style={s.kutular}>
              <View style={s.kutu}>
                <Text style={s.kutuEtiket}>{t('mekan.sure')}</Text>
                <Text style={s.kutuDeger}>{sureMetni(dakika)}</Text>
                {mekan ? (
                  <View style={s.sureKontrol}>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('mekan.azalt')} onPress={() => sureDegistir(-15)} style={s.sureDugme}>
                      <Text style={s.sureIsaret}>−</Text>
                    </Pressable>
                    <Text style={s.sureMetin}>{sureMetni(dakika)}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('mekan.artir')} onPress={() => sureDegistir(15)} style={s.sureDugme}>
                      <Text style={s.sureIsaret}>+</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              <View style={s.kutu}>
                <Text style={s.kutuEtiket}>{t('mekan.saatler')}</Text>
                {yer.data.saatler.length > 0 ? (
                  yer.data.saatler.map((satir) => (
                    <Text key={satir} style={s.saat} numberOfLines={1}>
                      {satir}
                    </Text>
                  ))
                ) : (
                  <Text style={s.saat}>{t('mekan.saatYok')}</Text>
                )}
              </View>
            </View>

            <Text style={s.bolum}>{t('mekan.yorumlar')}</Text>
            {yer.data.yorumlar.length === 0 ? (
              <Text style={[s.gri, { paddingHorizontal: bosluk.kenar }]}>{t('mekan.yorumYok')}</Text>
            ) : (
              yer.data.yorumlar.map((y, i) => (
                <View key={i} style={s.yorum}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.yorumcu}>
                      {y.yazar} <Text style={s.gri}>· {y.zaman}</Text>
                    </Text>
                    <Text style={s.yorumMetin}>{y.metin}</Text>
                  </View>
                  {y.puan !== null ? <Text style={s.gri}>{'★'.repeat(Math.round(y.puan))}</Text> : null}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <View style={s.altKisim}>
        {hata ? <Text style={s.hata}>{hata}</Text> : null}
        <SecimMenusu
          acik={menuAcik && !!mekan}
          baslik={yer.data?.ad}
          onKapat={() => setMenuAcik(false)}
          secenekler={[
            { etiket: t('mekan.baskaGun'), onPress: () => setGunSecAcik(true), pasif: !durak || (gunler.data?.length ?? 0) < 2 },
            {
              etiket: durak?.skipped ? t('mekan.atlamaGeri') : t('mekan.atla'),
              onPress: () => durak && durakGuncelle.mutateAsync({ id: durak.id, skipped: !durak.skipped }).catch(() => setHata(t('mekan.kaydetHata'))),
              pasif: !durak,
            },
            { etiket: t('mekan.cikar'), onPress: cikar, tehlike: true },
          ]}
        />
        <SecimMenusu
          acik={gunSecAcik}
          baslik={t('mekan.gunSecBaslik')}
          onKapat={() => setGunSecAcik(false)}
          secenekler={(gunler.data ?? []).filter((g) => g.id !== durak?.day_id).map((g) => ({ etiket: t('mekan.gunAtandi', { n: g.index }), onPress: () => baskaGuneAl(g.id) }))}
        />
        <View style={s.altSatir}>
          {mekan ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('mekan.menu')} onPress={() => setMenuAcik((a) => !a)} style={s.menuDugme}>
              <Text style={s.menuDugmeMetin}>···</Text>
            </Pressable>
          ) : null}
          <Buton baslik={t('mekan.yolTarifi')} onPress={yolTarifi} pasif={!yer.data} stil={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingBottom: 24 },
  foto: { height: 240, backgroundColor: '#d9d9d6', alignItems: 'center', justifyContent: 'center' },
  fotoYok: { fontFamily: yazi.yari, fontSize: 12, color: renk.ikincil },
  geri: { position: 'absolute', left: bosluk.kenar, width: 36, height: 36, borderRadius: 18, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  geriIsaret: { fontFamily: yazi.kalin, fontSize: 24, lineHeight: 26, color: renk.metin, marginTop: -2 },
  atif: { position: 'absolute', right: bosluk.kenar, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: renk.zemin },
  atifMetin: { fontFamily: yazi.kalin, fontSize: 11, color: renk.ikincil },
  baslikKutu: { paddingHorizontal: bosluk.kenar, paddingTop: 16, gap: 6 },
  ustMetin: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  baslik: { fontFamily: yazi.ekstra, fontSize: 28, letterSpacing: -0.9, lineHeight: 30, color: renk.metin },
  puanSatir: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  yildiz: { color: renk.vurgu, fontSize: 13 },
  puan: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  gri: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  acik: { fontFamily: yazi.kalin, fontSize: 13 },
  link: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  ekleyenKutu: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: bosluk.kenar, paddingTop: 14 },
  ekleyenAd: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  not: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  notSatir: { gap: 4 },
  notGirdi: { fontFamily: yazi.normal, fontSize: 13, color: renk.metin, padding: 0, minHeight: 20 },
  ekleKutu: { paddingHorizontal: bosluk.kenar, paddingTop: 14 },
  kutular: { flexDirection: 'row', gap: 10, paddingHorizontal: bosluk.kenar, paddingTop: 14 },
  kutu: { flex: 1, padding: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: renk.yuzey, gap: 6 },
  kutuEtiket: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  kutuDeger: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin },
  sureKontrol: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 34, borderRadius: 999, backgroundColor: renk.zemin, paddingHorizontal: 4 },
  sureDugme: { width: 28, height: 28, minWidth: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sureIsaret: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  sureMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  saat: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  bolum: { fontFamily: yazi.ekstra, fontSize: 17, letterSpacing: -0.4, color: renk.metin, paddingHorizontal: bosluk.kenar, paddingTop: 22, paddingBottom: 8 },
  yorum: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: bosluk.kenar, paddingVertical: 12, borderTopWidth: 1, borderTopColor: renk.ayrac },
  yorumcu: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  yorumMetin: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  altKisim: { paddingHorizontal: bosluk.kenar, paddingBottom: 12, paddingTop: 8, gap: 10, backgroundColor: renk.zemin },
  altSatir: { flexDirection: 'row', gap: 10 },
  menuDugme: { width: 56, height: 50, minHeight: minDokunma, borderRadius: 999, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  menuDugmeMetin: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari, paddingHorizontal: bosluk.kenar },
});
