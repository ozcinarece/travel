// #276 2b · KK3 (kanvas 29b · 29f): Keşfet'te altta sabit seyahat şeridi + [+] (alt menü yok) ve şeridin ilk görünüşünde bir kez
// "Seyahatin burada" ipucu. Şeride dokununca seyahat açılır; ipucu Tamam'a ya da şeride dokununca kapanır, bir daha çıkmaz.
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/i18n';
import { baslikStili, renk, yazi } from '@/theme';

type Props = {
  /** "4 GÜN SONRA" · "BUGÜN" · "ŞU AN SEYAHATTE"; planlanan seyahatte yok (yalnız şehir adı). */
  rozet: string | null;
  ad: string;
  /** "Sıradaki adım: …" ya da (adım yoksa) tarih satırı. */
  alt: string | null;
  ipucu: boolean;
  onAc: () => void;
  onYeni: () => void;
  onIpucuKapat: () => void;
  /** Ekranın altından uzaklık (kanvas 24; ana çubuk varsa onun 8 px üstü). */
  alttan: number;
  /**
   * #290 KK3 · KK6: şeridin ölçülen yüksekliği (büyük yazıda 64'ten uzun olabilir) ve açıksa ipucunun üst kenarının ekranın altına
   * uzaklığı; liste boşluğu ve kısa bildirim bunlara göre yerleşir.
   */
  onOlcu?: (o: { serit: number; ipucuUst: number | null }) => void;
};

/** Şerit + [+] en az yüksekliği; içerik ve kısa bildirim buna göre aşağıdan boşluk bırakır (büyük yazıda şerit uzar). */
export const SERIT_YUKSEKLIK = 64;
/** 29f: ipucu balonu şeridin 14 px üstünde biter (64 + 14 = 78). */
const IPUCU_ARALIK = 14;

export function SeyahatSeridi({ rozet, ad, alt, ipucu, onAc, onYeni, onIpucuKapat, alttan, onOlcu }: Props) {
  const [seritH, setSeritH] = useState(SERIT_YUKSEKLIK);
  const [ipucuH, setIpucuH] = useState<number | null>(null);
  const ipucuAlt = alttan + seritH + IPUCU_ARALIK;
  // #290 KK6: ölçüler tek yerden, en güncel değerlerle bildirilir (iki onLayout aynı geçişte hangi sırayla gelirse gelsin).
  // İpucu kapanınca kısa bildirim yeniden şeridin üstüne iner.
  useEffect(() => {
    onOlcu?.({ serit: seritH, ipucuUst: ipucu && ipucuH !== null ? alttan + seritH + IPUCU_ARALIK + ipucuH : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seritH, ipucuH, ipucu, alttan]);
  const ac = () => {
    if (ipucu) onIpucuKapat();
    onAc();
  };
  return (
    <>
      {ipucu ? (
        // 29f: şeridin üstünde, sağda [+] payı (86) bırakan balon; altında şeridin sol tarafını gösteren ok.
        // #290 KK7: balon tek öğe olarak okunur (başlık + metin); iOS'ta açıkken arkası okunmaz; "Tamam" ayrı düğme.
        <View
          testID="serit-ipucu"
          accessibilityViewIsModal={Platform.OS === 'ios'}
          onLayout={(e) => {
            setIpucuH(e.nativeEvent.layout.height);
          }}
          style={[s.ipucu, { bottom: ipucuAlt }]}>
          <View accessible accessibilityRole="alert" accessibilityLabel={`${t('serit.ipucuBaslik')}. ${t('serit.ipucuMetin')}`} style={s.ipucuMetinler}>
            <Text style={s.ipucuBaslik}>{t('serit.ipucuBaslik')}</Text>
            <Text style={s.ipucuMetin}>{t('serit.ipucuMetin')}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onIpucuKapat} style={({ pressed }) => [s.tamam, pressed && s.basili]}>
            <Text style={s.tamamMetin}>{t('serit.tamam')}</Text>
          </Pressable>
          <View style={s.ok} />
        </View>
      ) : null}
      <View
        testID="serit-kap"
        style={[s.kap, { bottom: alttan }]}
        pointerEvents="box-none"
        onLayout={(e) => {
          setSeritH(Math.max(SERIT_YUKSEKLIK, e.nativeEvent.layout.height));
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[rozet, ad, alt].filter(Boolean).join(', ')}
          accessibilityHint={t('serit.acIpucu')}
          onPress={ac}
          style={({ pressed }) => [s.serit, pressed && s.basili]}>
          <View style={s.gorsel}>
            <Svg width={48} height={48} viewBox="0 0 48 48">
              <Path d="M0 48 L0 30 L12 21 L23 31 L35 14 L48 25 L48 48 Z" fill={renk.vurgu} />
              <Path d="M0 48 L0 40 Q24 34 48 40 L48 48 Z" fill={renk.ana} />
            </Svg>
          </View>
          <View style={s.metinler}>
            <View style={s.ustSatir}>
              {rozet ? (
                <View style={s.rozet}>
                  <Text style={s.rozetMetin} maxFontSizeMultiplier={1.3}>
                    {rozet}
                  </Text>
                </View>
              ) : null}
              <Text style={s.ad} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {ad}
              </Text>
            </View>
            {alt ? (
              <Text style={s.alt} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {alt}
              </Text>
            ) : null}
          </View>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M9 5l7 7-7 7" stroke={renk.zemin} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.yeniSeyahat')} onPress={onYeni} style={({ pressed }) => [s.arti, pressed && s.basili]}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={renk.metin} strokeWidth={3} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>
    </>
  );
}

const golge = { shadowColor: renk.metin, shadowOffset: { width: 0, height: 8 }, shadowRadius: 12, elevation: 8 } as const;

const s = StyleSheet.create({
  kap: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  serit: {
    flex: 1,
    minWidth: 0,
    // #290 KK3 (29g · C notu): büyük yazıda içerikle büyür.
    minHeight: SERIT_YUKSEKLIK,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 20,
    backgroundColor: renk.ana,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...golge,
    shadowOpacity: 0.25,
  },
  // Ürün cevabı (17 Kas) 2: fotoğraf yok, dağ çizimi sabit; zemin her zaman #FFE2CC.
  gorsel: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#FFE2CC', overflow: 'hidden' },
  metinler: { flex: 1, minWidth: 0, gap: 3 },
  ustSatir: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rozet: { minHeight: 20, paddingHorizontal: 7, borderRadius: 6, backgroundColor: renk.vurgu, justifyContent: 'center', flexShrink: 0 },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 10, color: renk.metin },
  ad: { flexShrink: 1, ...baslikStili(16), color: renk.zemin },
  alt: { fontFamily: yazi.yari, fontSize: 12, color: renk.anaAcik },
  arti: { width: 64, height: 64, borderRadius: 20, backgroundColor: renk.vurgu, alignItems: 'center', justifyContent: 'center', ...golge, shadowOpacity: 0.22 },
  basili: { opacity: 0.85 },
  ipucu: {
    position: 'absolute',
    left: 12,
    right: 86,
    paddingTop: 14,
    paddingRight: 14,
    paddingBottom: 12,
    paddingLeft: 16,
    borderRadius: 18,
    backgroundColor: renk.zemin,
    borderWidth: 1.5,
    borderColor: renk.ana,
    gap: 10,
    shadowColor: renk.metin,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 14,
    shadowOpacity: 0.22,
    elevation: 10,
  },
  ipucuMetinler: { gap: 3 },
  ipucuBaslik: { ...baslikStili(16), color: renk.metin },
  ipucuMetin: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.ikincil },
  tamam: { alignSelf: 'flex-end', minHeight: 44, paddingHorizontal: 18, borderRadius: 12, backgroundColor: renk.yuzey, justifyContent: 'center' },
  tamamMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  ok: {
    position: 'absolute',
    left: 30,
    bottom: -8,
    width: 14,
    height: 14,
    backgroundColor: renk.zemin,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: renk.ana,
    transform: [{ rotate: '45deg' }],
  },
});
