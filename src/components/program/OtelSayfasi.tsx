// #139 KK7 (kanvas 6 · Otel sonradan): Program'daki "Otel ekle" şeridinden açılan "Nerede kalıyorsun?" — otel arama (3.3 Autocomplete),
// seçili otel kartı, "Her gece aynı otel" (varsayılan açık) → tüm günler; kapatınca / "Geceleri ayrı seç" → gece gece ekranı.
// "Şimdi değil" → gün ilk duraktan başlar (şerit gizlenir).
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AltPencere } from '@/components/ui/AltPencere';
import { Buton } from '@/components/ui/Buton';
import { Ikon } from '@/components/ui/Ikon';
import { GoogleAtfi } from '@/components/yerler/GoogleAtfi';
import { tarihOzeti } from '@/features/sihirbaz/sihirbaz';
import { hafifYerler, useOtelOnerileri, yeniOturumJetonu, type Oneri } from '@/features/yerler/api';
import { t } from '@/i18n';
import type { OtelSecimi, Seyahat } from '@/lib/tipler';
import { kose, olcek, renk, yazi } from '@/theme';

type Props = { acik: boolean; seyahat: Seyahat; geceSayisi: number; onKapat: () => void; onSimdiDegil: () => void; onKaydet: (otel: OtelSecimi) => Promise<void>; onAyriSec: () => void };

export function OtelSayfasi({ acik, seyahat, geceSayisi, onKapat, onSimdiDegil, onKaydet, onAyriSec }: Props) {
  const [sorgu, setSorgu] = useState('');
  const [jeton, setJeton] = useState(yeniOturumJetonu);
  const [secim, setSecim] = useState<OtelSecimi | null>(null);
  const [hepsiAyni, setHepsiAyni] = useState(true);
  const [mesgul, setMesgul] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const listeAcik = sorgu.trim().length >= 2;
  const oneriler = useOtelOnerileri(listeAcik ? sorgu : '', jeton, { lat: seyahat.lat, lng: seyahat.lng, yaricapM: 30_000 }, listeAcik);

  const sec = async (o: Oneri) => {
    setHata(null);
    setMesgul(true);
    try {
      const [yer] = await hafifYerler([o.place_id], { oturum: jeton });
      if (!yer) throw new Error('yer yok');
      setSecim({ place_id: yer.place_id, ad: o.ana || yer.ad, lat: yer.lat, lng: yer.lng });
      setSorgu('');
      setJeton(yeniOturumJetonu());
    } catch {
      setHata(t('gunOteli.secimHata'));
    } finally {
      setMesgul(false);
    }
  };
  const kaydet = async () => {
    if (!hepsiAyni) return onAyriSec();
    if (!secim) return;
    setHata(null);
    setKaydediliyor(true);
    try {
      await onKaydet(secim);
      onKapat();
    } catch {
      setHata(t('program.otelSayfa.hata'));
    } finally {
      setKaydediliyor(false);
    }
  };
  const tarih = seyahat.start_date && seyahat.end_date ? tarihOzeti({ gidis: seyahat.start_date, donus: seyahat.end_date }).split(' · ')[0] : null;

  return (
    <AltPencere acik={acik} onKapat={onKapat} kapatEtiketi={t('genel.vazgec')} kaydirilir stil={{ paddingHorizontal: 22 }}>
      <View style={{ gap: 6 }}>
        <Text accessibilityRole="header" style={s.baslik}>
          {t('program.otelSayfa.baslik')}
        </Text>
        <Text style={s.metin}>{t('program.otelSayfa.alt')}</Text>
      </View>
      <View style={s.arama}>
        <Ikon ad="ara" boyut={20} renk={renk.ana} kalinlik={2.4} />
        <TextInput accessibilityLabel={t('program.otelSayfa.ara')} placeholder={t('program.otelSayfa.ara')} placeholderTextColor={renk.soluk} value={sorgu} onChangeText={setSorgu} autoCorrect={false} style={s.girdi} />
        {(listeAcik && oneriler.isFetching) || mesgul ? <ActivityIndicator color={renk.ikincil} /> : null}
      </View>
      {listeAcik ? (
        <View>
          {oneriler.data?.map((o) => (
            <Pressable key={o.place_id} accessibilityRole="button" onPress={() => sec(o)} style={({ pressed }) => [s.oneri, pressed && { opacity: 0.7 }]}>
              <Text style={s.oneriAd} numberOfLines={1}>
                {o.ana}
              </Text>
              <Text style={s.oneriAlt} numberOfLines={1}>
                {o.ikincil}
              </Text>
            </Pressable>
          ))}
          {oneriler.data && oneriler.data.length > 0 ? <GoogleAtfi /> : null}
        </View>
      ) : null}
      {secim ? (
        <View style={s.secili}>
          <View style={s.seciliIkon}>
            <Ikon ad="ev" boyut={20} renk={renk.ana} kalinlik={2.2} />
          </View>
          <Text style={s.seciliAd} numberOfLines={2}>
            {secim.ad}
          </Text>
          <Ikon ad="tik" boyut={22} renk={renk.basari} kalinlik={3} />
        </View>
      ) : null}
      <View style={s.anahtar}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.anahtarBaslik}>{t('program.otelSayfa.hepsiAyni')}</Text>
          <Text style={s.anahtarAlt}>
            {tarih ? t('program.otelSayfa.hepsiAyniAlt', { gece: geceSayisi, tarih }) : t('program.otelSayfa.hepsiAyniAltTarihsiz')} ·{' '}
            <Text onPress={onAyriSec} accessibilityRole="link" style={s.baglanti}>
              {t('program.otelSayfa.ayriSec')}
            </Text>
          </Text>
        </View>
        <Switch value={hepsiAyni} onValueChange={setHepsiAyni} trackColor={{ true: renk.ana, false: renk.ayrac }} thumbColor={renk.zemin} accessibilityLabel={t('program.otelSayfa.hepsiAyni')} />
      </View>
      {hata ? <Text style={s.hata}>{hata}</Text> : null}
      <View style={s.dugmeler}>
        <Buton baslik={t('program.otelSayfa.simdiDegil')} tur="ikincil" boy="buyuk" onPress={onSimdiDegil} stil={{ flex: 1 }} />
        <Buton baslik={hepsiAyni ? t('program.otelSayfa.kaydet') : t('program.otelSayfa.geceler')} boy="buyuk" onPress={kaydet} pasif={hepsiAyni && !secim} yukleniyor={kaydediliyor} stil={{ flex: 1.4 }} />
      </View>
    </AltPencere>
  );
}

/** #139 KK7: konaklama yokken Program'da gün kartlarının altında kesik çizgili şerit — "Otel ekle · gün otelden başlasın". */
export function OtelSeridi({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.serit, pressed && { opacity: 0.8 }]}>
      <View style={s.seritIkon}>
        <Ikon ad="ev" boyut={16} renk={renk.zemin} kalinlik={2.4} />
      </View>
      <Text style={s.seritMetin} numberOfLines={1}>
        {t('program.otelSerit')}
      </Text>
      <Ikon ad="yeni" boyut={18} renk={renk.ana} kalinlik={2.6} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  serit: {
    marginHorizontal: 16,
    marginTop: 8,
    minHeight: 44,
    paddingLeft: 7,
    paddingRight: 14,
    borderRadius: kose.cip,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#b4bbd3',
    backgroundColor: renk.zemin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  seritIkon: { width: 30, height: 30, borderRadius: 10, backgroundColor: renk.vurgu, alignItems: 'center', justifyContent: 'center' },
  seritMetin: { flex: 1, fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  baslik: { fontFamily: yazi.baslik, fontSize: olcek.kart + 1, lineHeight: 28, letterSpacing: -0.6, color: renk.metin },
  metin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22, color: renk.ikincil },
  arama: { height: 52, paddingHorizontal: 16, borderRadius: kose.dugme, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 10 },
  girdi: { flex: 1, fontFamily: yazi.yari, fontSize: 15, color: renk.metin, paddingVertical: 0 },
  oneri: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: renk.ayrac, gap: 2 },
  oneriAd: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  oneriAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  secili: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, borderWidth: 2, borderColor: renk.ana },
  seciliIkon: { width: 44, height: 44, borderRadius: 14, backgroundColor: renk.anaAcik, alignItems: 'center', justifyContent: 'center' },
  seciliAd: { flex: 1, fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  anahtar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  anahtarBaslik: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  anahtarAlt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  baglanti: { fontFamily: yazi.ekstra, color: renk.ana },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari },
  dugmeler: { flexDirection: 'row', gap: 10 },
});
