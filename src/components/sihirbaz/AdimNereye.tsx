// #98 KK2 → #139 (kanvas 4): 1. adım "Nereye gidiyorsun?" — arama kutusunda seçili şehir Gece çip (×), altında "ÖNERİLER"
// hap çipleri (rehberi hazır şehirler), "SEYAHAT ADI" otomatik ("{Şehir} Gezisi") + Değiştir.
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { GoogleAtfi } from '@/components/yerler/GoogleAtfi';
import { hafifYerler, otomatikTamamla, useSehirOnerileri, yeniOturumJetonu, type Oneri } from '@/features/yerler/api';
import { t } from '@/i18n';
import type { Sehir, SehirSecimi } from '@/lib/tipler';
import { kose, minDokunma, renk, yazi } from '@/theme';

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
};

export function AdimNereye({ sehir, onSehir, ad, onerilenAd, onAd, sehirler, kilitli }: Props) {
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
  const ONERI_ZEMINLERI = ['#c9d2f2', '#ffe2cc', '#dce6ff', '#d7f0e6'];
  return (
    <View style={s.kap}>
      {/* #139 KK2 (kanvas 4): arama kutusu 2 px Gece kenar; seçili şehir içinde Gece çip (×). */}
      <View style={s.arama}>
        <Ikon ad="ara" boyut={20} renk={renk.ana} kalinlik={2.4} />
        {sehir ? (
          <View style={s.cip}>
            <Text style={s.cipMetin} numberOfLines={1}>
              {sehir.ad}
            </Text>
            {!kilitli ? (
              // #117 KK1: × 28 px dokunma hedefi; seyahat oluşmadan serbest.
              <Pressable accessibilityRole="button" accessibilityLabel={t('sihirbaz.nereye.kaldir')} onPress={() => onSehir(null)} hitSlop={10} style={s.cipKapatHedef}>
                <Text style={s.cipKapat}>×</Text>
              </Pressable>
            ) : (
              <View style={s.cipKapatHedef}>
                <Ikon ad="kilit" boyut={13} renk={renk.zemin} kalinlik={2.2} />
              </View>
            )}
          </View>
        ) : (
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
        )}
        {listeAcik && oneriler.isFetching ? <ActivityIndicator color={renk.ikincil} /> : null}
      </View>
      {kilitli ? <Text style={s.not}>{t('sihirbaz.nereye.kilitli')}</Text> : null}
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

      {/* KK2: "ÖNERİLER" küçük hap çipler (rehberi hazır şehirler); "+ Şehir ekle / yakında" kartı yok. */}
      {!listeAcik && sehirler && sehirler.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text style={s.etiket}>{t('sihirbaz.nereye.oneriler')}</Text>
          <View style={s.oneriler}>
            {sehirler.map((k, i) => {
              const secili = sehir?.ad === k.ad;
              return (
                <Pressable
                  key={k.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: secili, disabled: kilitli }}
                  disabled={!!mesgul || kilitli || secili}
                  onPress={() => karoSec(k)}
                  style={({ pressed }) => [s.oneri, secili && s.oneriSecili, (pressed || (kilitli && !secili)) && { opacity: 0.6 }]}>
                  <View style={[s.oneriIkon, { backgroundColor: secili ? renk.anaAcik : ONERI_ZEMINLERI[i % ONERI_ZEMINLERI.length] }]}>
                    {mesgul === k.id ? <ActivityIndicator color={renk.ana} /> : secili ? <Ikon ad="tik" boyut={14} renk={renk.ana} kalinlik={3} /> : <Text style={s.oneriHarf}>{k.ad.charAt(0).toLocaleUpperCase('tr')}</Text>}
                  </View>
                  <Text style={[s.oneriMetin, secili && { color: renk.ana }]}>{k.ad}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.not}>{t('sihirbaz.nereye.onerilerNot')}</Text>
        </View>
      ) : null}

      {sehir ? (
        <View style={s.adKutu}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.etiket}>{t('sihirbaz.nereye.adBaslik')}</Text>
            {adDuzenle ? (
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
            ) : (
              <Text style={s.adMetin} numberOfLines={1}>
                {gorunenAd}
              </Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (adDuzenle) {
                onAd(adTaslak.trim() ? adTaslak.trim() : null);
                setAdDuzenle(false);
              } else {
                setAdTaslak(gorunenAd);
                setAdDuzenle(true);
              }
            }}
            style={s.degistir}>
            <Text style={s.degistirMetin}>{adDuzenle ? t('sihirbaz.nereye.tamam') : t('sihirbaz.nereye.degistir')}</Text>
          </Pressable>
        </View>
      ) : null}
      {hata ? <Text style={s.hata}>{hata}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 18 },
  arama: { minHeight: 56, paddingVertical: 8, paddingLeft: 16, paddingRight: 10, borderRadius: 16, borderWidth: 2, borderColor: renk.ana, flexDirection: 'row', alignItems: 'center', gap: 10 },
  girdi: { flex: 1, fontFamily: yazi.yari, fontSize: 16, color: renk.metin, paddingVertical: 0 },
  liste: { gap: 0 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: minDokunma, borderTopWidth: 1, borderTopColor: renk.ayrac },
  ana: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  ikincil: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ok: { fontFamily: yazi.kalin, fontSize: 22, color: renk.soluk },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 12 },
  cip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingLeft: 12, paddingRight: 4, borderRadius: kose.cip, backgroundColor: renk.ana, flexShrink: 1 },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.zemin, flexShrink: 1 },
  cipKapat: { fontFamily: yazi.ekstra, fontSize: 17, color: renk.zemin },
  cipKapatHedef: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  not: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 19, color: renk.ikincil },
  etiket: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.5, color: renk.ikincil },
  oneriler: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  oneri: { height: minDokunma, paddingLeft: 6, paddingRight: 14, borderRadius: kose.cip, borderWidth: 1.5, borderColor: renk.ayrac, backgroundColor: renk.zemin, flexDirection: 'row', alignItems: 'center', gap: 8 },
  oneriSecili: { backgroundColor: renk.yuzey, borderColor: renk.yuzey, opacity: 0.5 },
  oneriIkon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  oneriHarf: { fontFamily: yazi.baslik, fontSize: 14, color: renk.ana },
  oneriMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  adKutu: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 12 },
  adMetin: { fontFamily: yazi.baslik, fontSize: 19, letterSpacing: -0.4, color: renk.metin },
  adGirdi: { fontFamily: yazi.baslik, fontSize: 19, color: renk.metin, paddingVertical: 0, borderBottomWidth: 1.5, borderBottomColor: renk.ana },
  degistir: { height: 40, paddingHorizontal: 14, borderRadius: kose.alan, backgroundColor: renk.zemin, justifyContent: 'center' },
  degistirMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari },
});
