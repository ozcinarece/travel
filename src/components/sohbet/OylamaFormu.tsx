// #184 KK3: "Oylama" hızlı eki — soru, 2–4 seçenek (metin; isteğe bağlı listeden mekan bağı, etiket kullanıcının), isteğe bağlı
// kapanış (1 saat sonra · bu akşam 20:00 · yarın 12:00, seyahat saat dilimi) ve isteğe bağlı not. Gönderilince oylama ve sohbet
// mesajı tek işlemde yazılır (oylama_olustur).
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Cip } from '@/components/ui/Cip';
import { Ikon } from '@/components/ui/Ikon';
import { SayfaMetinAlani } from '@/components/ui/sayfaCekme';
import { kapanisSecenekleri } from '@/features/sohbet/sohbet';
import type { YeniOylama } from '@/features/sohbet/sorgular';
import { t } from '@/i18n';
import type { Mekan } from '@/lib/tipler';
import { yerelAn } from '@/lib/zaman';
import { renk, yazi } from '@/theme';

import { KlavyeliPencere } from './KlavyeliPencere';

type Props = {
  acik: boolean;
  onKapat: () => void;
  tz: string;
  mekanlar: Mekan[];
  ad: (m: Mekan) => string;
  gonderiliyor: boolean;
  onGonder: (o: YeniOylama) => void;
};

export function OylamaFormu(p: Props) {
  return (
    <KlavyeliPencere acik={p.acik} onKapat={p.onKapat} kapatEtiketi={t('harcama.form.kapat')}>
      <Icerik {...p} />
    </KlavyeliPencere>
  );
}

type Secenek = { metin: string; place_id: string | null };

function Icerik({ tz, mekanlar, ad, gonderiliyor, onGonder }: Props) {
  const [soru, setSoru] = useState('');
  const [secenekler, setSecenekler] = useState<Secenek[]>([
    { metin: '', place_id: null },
    { metin: '', place_id: null },
  ]);
  const [kapanis, setKapanis] = useState<'yok' | 'saat' | 'aksam' | 'yarin'>('yok');
  const [not, setNot] = useState('');
  const [mekanAcik, setMekanAcik] = useState<number | null>(null);
  const kapanislar = useMemo(() => kapanisSecenekleri(new Date(), tz, (tarih, dk) => yerelAn(tarih, dk, tz)), [tz]);
  const doluSecenekler = secenekler.filter((x) => x.metin.trim());
  const hazir = soru.trim().length > 0 && doluSecenekler.length >= 2 && !gonderiliyor;

  const degistir = (i: number, yeni: Partial<Secenek>) => setSecenekler((e) => e.map((x, j) => (j === i ? { ...x, ...yeni } : x)));
  const gonder = () => {
    if (!hazir) return;
    const kap = kapanis === 'yok' ? null : (kapanislar.find((k) => k.anahtar === kapanis)?.an.toISOString() ?? null);
    onGonder({ soru: soru.trim(), secenekler: doluSecenekler.map((x) => ({ metin: x.metin.trim().slice(0, 80), place_id: x.place_id })), kapanis: kap, metin: not.trim() });
  };

  return (
    <>
      <Text accessibilityRole="header" style={s.baslik}>
        {t('sohbet.oylama.yeni')}
      </Text>
      <SayfaMetinAlani value={soru} onChangeText={setSoru} placeholder={t('sohbet.oylama.soru')} placeholderTextColor={renk.soluk} maxLength={120} accessibilityLabel={t('sohbet.oylama.soru')} style={s.girdi} />
      <View style={{ gap: 8 }}>
        <Text style={s.etiket}>{t('sohbet.oylama.secenekler')}</Text>
        {secenekler.map((x, i) => (
          <View key={i} style={{ gap: 6 }}>
            <View style={s.secenekSatiri}>
              <SayfaMetinAlani
                value={x.metin}
                onChangeText={(v) => degistir(i, { metin: v })}
                placeholder={t('sohbet.oylama.secenek', { n: i + 1 })}
                placeholderTextColor={renk.soluk}
                maxLength={80}
                accessibilityLabel={t('sohbet.oylama.secenek', { n: i + 1 })}
                style={[s.girdi, { flex: 1 }]}
              />
              {mekanlar.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('sohbet.oylama.mekanBagla', { n: i + 1 })}
                  onPress={() => setMekanAcik((e) => (e === i ? null : i))}
                  style={[s.kucukDugme, x.place_id && { backgroundColor: renk.basariZemin }]}
                >
                  <Ikon ad="pin" boyut={18} renk={x.place_id ? renk.basariMetin : renk.ana} />
                </Pressable>
              ) : null}
              {secenekler.length > 2 ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t('sohbet.oylama.secenekSil', { n: i + 1 })} onPress={() => setSecenekler((e) => e.filter((_, j) => j !== i))} style={s.kucukDugme}>
                  <Ikon ad="kapat" boyut={16} renk={renk.ikincil} kalinlik={2.4} />
                </Pressable>
              ) : null}
            </View>
            {mekanAcik === i ? (
              <View style={s.mekanListesi}>
                {x.place_id ? (
                  <Pressable accessibilityRole="button" onPress={() => {
                      degistir(i, { place_id: null });
                      setMekanAcik(null);
                    }} style={s.mekanSatiri}>
                    <Text style={[s.mekanAd, { color: renk.ikincil }]}>{t('sohbet.oylama.mekanKaldir')}</Text>
                  </Pressable>
                ) : null}
                {mekanlar.map((m) => (
                  <Pressable
                    key={m.id}
                    accessibilityRole="button"
                    onPress={() => {
                      degistir(i, { place_id: m.place_id, metin: x.metin.trim() ? x.metin : ad(m).slice(0, 80) });
                      setMekanAcik(null);
                    }}
                    style={s.mekanSatiri}
                  >
                    <Text style={[s.mekanAd, x.place_id === m.place_id && { color: renk.ana }]} numberOfLines={1}>
                      {ad(m)}
                    </Text>
                    {x.place_id === m.place_id ? <Ikon ad="tik" boyut={16} renk={renk.ana} /> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ))}
        {secenekler.length < 4 ? (
          <Pressable accessibilityRole="button" onPress={() => setSecenekler((e) => [...e, { metin: '', place_id: null }])} style={s.ekle}>
            <Ikon ad="arti" boyut={16} renk={renk.ana} kalinlik={2.6} />
            <Text style={s.ekleMetin}>{t('sohbet.oylama.secenekEkle')}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ gap: 8 }}>
        <Text style={s.etiket}>{t('sohbet.oylama.kapanis')}</Text>
        <View style={s.ciplar}>
          <Cip kucuk baslik={t('sohbet.oylama.kapanisYok')} secili={kapanis === 'yok'} onPress={() => setKapanis('yok')} />
          {kapanislar.map((k) => (
            <Cip key={k.anahtar} kucuk baslik={t(`sohbet.oylama.kapanis_${k.anahtar}`)} secili={kapanis === k.anahtar} onPress={() => setKapanis(k.anahtar)} />
          ))}
        </View>
      </View>
      <SayfaMetinAlani value={not} onChangeText={setNot} placeholder={t('sohbet.oylama.not')} placeholderTextColor={renk.soluk} maxLength={300} accessibilityLabel={t('sohbet.oylama.not')} style={s.girdi} />
      <Pressable accessibilityRole="button" disabled={!hazir} onPress={gonder} style={({ pressed }) => [s.gonder, !hazir && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}>
        {gonderiliyor ? <ActivityIndicator color={renk.zemin} /> : <Text style={s.gonderMetin}>{t('sohbet.oylama.gonder')}</Text>}
      </Pressable>
    </>
  );
}

const s = StyleSheet.create({
  baslik: { fontFamily: yazi.baslik, fontSize: 22, letterSpacing: -0.5, color: renk.metin },
  etiket: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  girdi: { height: 46, paddingHorizontal: 14, borderRadius: 12, backgroundColor: renk.yuzey, fontFamily: yazi.yari, fontSize: 15, color: renk.metin },
  secenekSatiri: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kucukDugme: { width: 46, height: 46, borderRadius: 12, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  mekanListesi: { borderRadius: 14, borderWidth: 1.5, borderColor: renk.ayrac, overflow: 'hidden' },
  mekanSatiri: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: renk.ayrac },
  mekanAd: { flex: 1, fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  ekle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  ekleMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  ciplar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gonder: { height: 48, borderRadius: 14, backgroundColor: renk.ana, alignItems: 'center', justifyContent: 'center' },
  gonderMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.zemin },
});
