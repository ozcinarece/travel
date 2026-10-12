// #98 KK2 · 1. adım "Nereye?": arama + popüler şehir karoları (yayınlı `sehirler`), seçili şehir siyah çip, "+ Şehir ekle"
// v1'de yakında, "SEYAHATİN ADI" otomatik ("{Şehir} Gezisi") + Değiştir.
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { GoogleAtfi } from '@/components/yerler/GoogleAtfi';
import { hafifYerler, otomatikTamamla, useSehirOnerileri, yeniOturumJetonu, type Oneri } from '@/features/yerler/api';
import { t } from '@/i18n';
import type { Sehir, SehirSecimi } from '@/lib/tipler';
import { minDokunma, renk, yazi } from '@/theme';

type Props = {
  sehir: SehirSecimi | null;
  onSehir: (s: SehirSecimi | null) => void;
  /** Kullanıcının yazdığı ad (null = otomatik öneri). */
  ad: string | null;
  onerilenAd: string;
  onAd: (ad: string | null) => void;
  sehirler: Sehir[] | undefined;
  /** Seyahat oluşturulduysa şehir değiştirilemez (ad değişir). */
  kilitli: boolean;
  onYakinda: () => void;
};

export function AdimNereye({ sehir, onSehir, ad, onerilenAd, onAd, sehirler, kilitli, onYakinda }: Props) {
  const [sorgu, setSorgu] = useState('');
  const [jeton, setJeton] = useState(yeniOturumJetonu);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [adDuzenle, setAdDuzenle] = useState(false);
  const [adTaslak, setAdTaslak] = useState('');
  const listeAcik = !sehir && sorgu.trim().length >= 2;
  const oneriler = useSehirOnerileri(listeAcik ? sorgu : '', jeton);

  // Seçim: hafif Details şehir maskesiyle (konum, tz, ülke) — oturum token'ı kapanır (yeni.tsx'teki akış).
  const sec = async (placeId: string, adi: string, ikincil: string, oturum: string) => {
    setHata(null);
    setMesgul(placeId);
    try {
      const [yer] = await hafifYerler([placeId], { sehir: true, oturum });
      if (!yer?.tz) throw new Error('tz yok');
      onSehir({ place_id: yer.place_id, ad: adi || yer.ad, ikincil, lat: yer.lat, lng: yer.lng, tz: yer.tz, country_code: yer.ulke_kodu });
      setSorgu('');
      setJeton(yeniOturumJetonu());
    } catch {
      setHata(t('sihirbaz.nereye.secimHata'));
    } finally {
      setMesgul(null);
    }
  };
  const oneriSec = (o: Oneri) => sec(o.place_id, o.ana, o.ikincil, jeton);
  // Popüler karo: içerik tablosunda Google kimliği yok → adıyla Autocomplete (cities), ilk öneri.
  const karoSec = async (k: Sehir) => {
    if (kilitli) return;
    setHata(null);
    setMesgul(k.id);
    try {
      const oturum = yeniOturumJetonu();
      const [o] = await otomatikTamamla({ girdi: k.ad, oturum, tur: 'cities', limit: 1, merkez: { lat: k.lat, lng: k.lng, yaricapM: 50_000 } });
      if (!o) throw new Error('öneri yok');
      await sec(o.place_id, k.ad, o.ikincil, oturum);
    } catch {
      setHata(t('sihirbaz.nereye.secimHata'));
    } finally {
      setMesgul(null);
    }
  };

  const gorunenAd = ad ?? onerilenAd;
  return (
    <View style={s.kap}>
      {!sehir ? (
        <View style={s.arama}>
          <Text style={s.buyutec}>⌕</Text>
          <TextInput
            accessibilityLabel={t('sihirbaz.nereye.ara')}
            placeholder={t('sihirbaz.nereye.araYer')}
            placeholderTextColor={renk.soluk}
            value={sorgu}
            onChangeText={setSorgu}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            style={s.girdi}
          />
          {listeAcik && oneriler.isFetching ? <ActivityIndicator color={renk.ikincil} /> : null}
        </View>
      ) : null}
      {listeAcik ? (
        <View style={s.liste}>
          {oneriler.isError ? <Text style={s.hata}>{t('sihirbaz.nereye.araHata')}</Text> : null}
          {oneriler.data?.length === 0 ? <Text style={s.bos}>{t('sihirbaz.nereye.sonucYok')}</Text> : null}
          {oneriler.data?.map((o) => (
            <Pressable key={o.place_id} accessibilityRole="button" disabled={!!mesgul} onPress={() => oneriSec(o)} style={({ pressed }) => [s.satir, pressed && { opacity: 0.7 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.ana} numberOfLines={1}>
                  {o.ana}
                </Text>
                <Text style={s.ikincil} numberOfLines={1}>
                  {o.ikincil}
                </Text>
              </View>
              {mesgul === o.place_id ? <ActivityIndicator color={renk.ikincil} /> : <Text style={s.ok}>›</Text>}
            </Pressable>
          ))}
          {oneriler.data && oneriler.data.length > 0 ? <GoogleAtfi /> : null}
        </View>
      ) : null}

      {/* Seçili şehir çipleri + "+ Şehir ekle" (v1: yakında). */}
      <View style={s.cipler}>
        {sehir ? (
          <View style={s.cip}>
            <Text style={s.cipMetin}>{sehir.ad}</Text>
            {!kilitli ? (
              // #117 KK1: × 28 px yuvarlak dokunma hedefi (küçük metin hedefi kaçıyordu); seyahat oluşmadan serbest.
              <Pressable accessibilityRole="button" accessibilityLabel={t('sihirbaz.nereye.kaldir')} onPress={() => onSehir(null)} hitSlop={10} style={s.cipKapatHedef}>
                <Text style={s.cipKapat}>×</Text>
              </Pressable>
            ) : (
              <Ikon ad="kilit" boyut={14} renk={renk.zemin} kalinlik={2.2} />
            )}
          </View>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onYakinda} style={s.cipEkle}>
          <Text style={s.cipEkleMetin}>{t('sihirbaz.nereye.sehirEkle')}</Text>
        </Pressable>
      </View>
      {kilitli ? <Text style={s.not}>{t('sihirbaz.nereye.kilitli')}</Text> : null}

      {sehir ? (
        <View style={s.adKutu}>
          <Text style={s.adBaslik}>{t('sihirbaz.nereye.adBaslik')}</Text>
          {adDuzenle ? (
            <View style={s.adSatir}>
              <TextInput
                accessibilityLabel={t('sihirbaz.nereye.adYer')}
                value={adTaslak}
                onChangeText={setAdTaslak}
                autoFocus
                maxLength={80}
                returnKeyType="done"
                onSubmitEditing={() => {
                  onAd(adTaslak.trim() ? adTaslak.trim() : null);
                  setAdDuzenle(false);
                }}
                style={s.adGirdi}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onAd(adTaslak.trim() ? adTaslak.trim() : null);
                  setAdDuzenle(false);
                }}
                hitSlop={8}>
                <Text style={s.degistir}>{t('sihirbaz.nereye.tamam')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.adSatir}>
              <Text style={s.adMetin} numberOfLines={1}>
                {gorunenAd}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setAdTaslak(gorunenAd);
                  setAdDuzenle(true);
                }}
                hitSlop={8}>
                <Text style={s.degistir}>{t('sihirbaz.nereye.degistir')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}

      {!sehir && !listeAcik && sehirler && sehirler.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text style={s.bolum}>{t('sihirbaz.nereye.populer')}</Text>
          <View style={s.karolar}>
            {sehirler.map((k) => (
              <Pressable key={k.id} accessibilityRole="button" disabled={!!mesgul} onPress={() => karoSec(k)} style={({ pressed }) => [s.karo, pressed && { opacity: 0.85 }]}>
                <View style={s.karoZemin}>
                  <Text style={s.karoHarf}>{k.ad.charAt(0).toLocaleUpperCase('tr')}</Text>
                  {mesgul === k.id ? <ActivityIndicator color={renk.zemin} style={s.karoYukleniyor} /> : null}
                </View>
                <Text style={s.karoAd} numberOfLines={1}>
                  {k.ad}
                </Text>
                <Text style={s.karoAlt}>{t('sihirbaz.nereye.rehberli')}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {hata ? <Text style={s.hata}>{hata}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 14 },
  arama: { height: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 10 },
  buyutec: { fontSize: 18, color: renk.ikincil },
  girdi: { flex: 1, fontFamily: yazi.yari, fontSize: 14, color: renk.metin, paddingVertical: 0 },
  liste: { gap: 0 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: minDokunma, borderTopWidth: 1, borderTopColor: renk.ayrac },
  ana: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  ikincil: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ok: { fontFamily: yazi.kalin, fontSize: 22, color: '#c4c4c4' },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 12 },
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  cip: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingLeft: 14, paddingRight: 10, borderRadius: 999, backgroundColor: renk.metin },
  cipMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin },
  cipKapat: { fontFamily: yazi.kalin, fontSize: 16, color: renk.zemin, opacity: 0.8 },
  cipKapatHedef: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  cipEkle: { height: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: '#c4c4c4', justifyContent: 'center' },
  cipEkleMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.ikincil },
  not: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  adKutu: { padding: 14, borderRadius: 14, backgroundColor: renk.yuzey, gap: 6 },
  adBaslik: { fontFamily: yazi.kalin, fontSize: 10, letterSpacing: 0.6, color: renk.ikincil },
  adSatir: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  adMetin: { flex: 1, fontFamily: yazi.ekstra, fontSize: 17, color: renk.metin },
  adGirdi: { flex: 1, fontFamily: yazi.ekstra, fontSize: 17, color: renk.metin, paddingVertical: 0, borderBottomWidth: 1, borderBottomColor: renk.metin },
  degistir: { fontFamily: yazi.kalin, fontSize: 13, color: renk.vurgu, paddingVertical: 6 },
  bolum: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  karolar: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  karo: { width: '47%', gap: 6 },
  karoZemin: { height: 96, borderRadius: 16, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  karoHarf: { fontFamily: yazi.ekstra, fontSize: 28, color: renk.zemin },
  karoYukleniyor: { position: 'absolute', right: 10, top: 10 },
  karoAd: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  karoAlt: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari },
});
