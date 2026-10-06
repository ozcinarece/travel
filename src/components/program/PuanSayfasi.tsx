import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { googleYorumLinki, PUAN_ETIKETLERI, type Puan, type PuanEtiketi } from '@/features/puanlar/sorgular';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

type Props = {
  acik: boolean;
  ad: string;
  placeId: string;
  foto: string | null | undefined;
  /** "09:00", "09:52", 52 */
  bas: string;
  bit: string;
  kalinanDk: number;
  mevcut: Puan | null;
  kaydediliyor: boolean;
  onKaydet: (p: { stars: number; tags: PuanEtiketi[]; note: string | null }) => Promise<void>;
  onKapat: () => void;
};

/**
 * #45 §5: tamamlanan durağı puanlama alt sayfası — küçük foto, ad, "✓ Tamamlandı · bas–bit · N dk kaldınız"; 5 yıldız;
 * hızlı etiketler (çoklu); kısa not (arkadaşlar görür); "Google'da da yorumla" derin linki; Sonra / Kaydet.
 * "Fotoğraf ekle" v1'de yok (v2: depolama + moderasyon).
 */
export function PuanSayfasi(p: Props) {
  // Her açılışta mevcut puandan başlar (anahtar ile yeniden kurulur, bkz. çağıran).
  const [yildiz, setYildiz] = useState(p.mevcut?.stars ?? 0);
  const [etiketler, setEtiketler] = useState<PuanEtiketi[]>(p.mevcut?.tags ?? []);
  const [not, setNot] = useState(p.mevcut?.note ?? '');
  const [hata, setHata] = useState(false);
  const degistir = (e: PuanEtiketi) => setEtiketler((l) => (l.includes(e) ? l.filter((x) => x !== e) : [...l, e]));
  const kaydet = async () => {
    setHata(false);
    try {
      await p.onKaydet({ stars: yildiz, tags: etiketler, note: not.trim() || null });
      p.onKapat();
    } catch {
      setHata(true);
    }
  };
  return (
    <Modal visible={p.acik} transparent animationType="slide" onRequestClose={p.onKapat}>
      <KeyboardAvoidingView style={s.perde} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={p.onKapat} accessibilityLabel={t('program.puan.sonra')} />
        <View style={s.kutu}>
          <View style={s.ust}>
            {p.foto ? <Image source={{ uri: p.foto }} style={s.foto} contentFit="cover" /> : null}
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={s.ad} numberOfLines={2}>
                {p.ad}
              </Text>
              <Text style={s.alt}>{t('program.puan.tamamlandi', { bas: p.bas, bit: p.bit, dk: p.kalinanDk })}</Text>
            </View>
          </View>

          <Text style={s.baslik}>{t('program.puan.baslik')}</Text>
          <View style={s.yildizlar} accessibilityRole="adjustable">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} accessibilityRole="button" accessibilityLabel={t('program.puan.yildiz', { n })} hitSlop={4} onPress={() => setYildiz(n)}>
                <Text style={[s.yildiz, n <= yildiz && { color: renk.vurgu }]}>{n <= yildiz ? '★' : '☆'}</Text>
              </Pressable>
            ))}
          </View>

          <View style={s.etiketler}>
            {PUAN_ETIKETLERI.map((e) => {
              const secili = etiketler.includes(e);
              return (
                <Pressable key={e} accessibilityRole="checkbox" accessibilityState={{ checked: secili }} onPress={() => degistir(e)} style={[s.etiket, secili && s.etiketSecili]}>
                  <Text style={[s.etiketMetin, secili && { color: renk.zemin }]}>{t(`program.puan.etiket.${e}`)}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={not}
            onChangeText={setNot}
            placeholder={t('program.puan.not')}
            placeholderTextColor={renk.soluk}
            maxLength={280}
            multiline
            style={s.not}
          />

          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(googleYorumLinki(p.placeId))} hitSlop={6}>
            <Text style={s.google}>{t('program.puan.google')} ↗</Text>
          </Pressable>

          {hata ? <Text style={s.hata}>{t('program.puan.hata')}</Text> : null}
          <View style={s.dugmeler}>
            <Pressable accessibilityRole="button" onPress={p.onKapat} style={[s.dugme, s.dugmeGri]}>
              <Text style={s.dugmeMetin}>{t('program.puan.sonra')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: yildiz === 0 || p.kaydediliyor }}
              disabled={yildiz === 0 || p.kaydediliyor}
              onPress={kaydet}
              style={[s.dugme, s.dugmeSiyah, (yildiz === 0 || p.kaydediliyor) && { opacity: 0.4 }]}>
              <Text style={[s.dugmeMetin, { color: renk.zemin }]}>{t('program.puan.kaydet')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(15,15,15,0.35)', justifyContent: 'flex-end' },
  kutu: { backgroundColor: renk.zemin, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, gap: 14 },
  ust: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foto: { width: 56, height: 56, borderRadius: 12, backgroundColor: renk.yuzey },
  ad: { fontFamily: yazi.ekstra, fontSize: 17, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.basari },
  baslik: { fontFamily: yazi.kalin, fontSize: 13, color: renk.ikincil },
  yildizlar: { flexDirection: 'row', gap: 10, marginTop: -6 },
  yildiz: { fontSize: 34, lineHeight: 38, color: renk.ayrac },
  etiketler: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  etiket: { height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  etiketSecili: { backgroundColor: renk.metin },
  etiketMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  not: { minHeight: 64, borderRadius: 14, backgroundColor: renk.yuzey, padding: 12, fontFamily: yazi.normal, fontSize: 14, color: renk.metin, textAlignVertical: 'top' },
  google: { fontFamily: yazi.kalin, fontSize: 13, color: '#2563eb' },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari },
  dugmeler: { flexDirection: 'row', gap: 10 },
  dugme: { flex: 1, height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dugmeGri: { backgroundColor: renk.yuzey },
  dugmeSiyah: { backgroundColor: renk.metin },
  dugmeMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
});
