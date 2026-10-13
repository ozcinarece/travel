import { Image } from 'expo-image';
import { useEffect, useMemo, useRef } from 'react';
import { FlatList, PanResponder, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { KART_ADIM, KART_ARALIK, KART_GENISLIK, kartDugmeleri, kartIndeksi, type DurakKarti } from '@/features/program/durakKarti';
import { useOnizleme } from '@/features/yerler/api';
import { t } from '@/i18n';
import { kategoriPini } from '@/lib/pinIkonu';
import { bosluk, gunUstuMetin, renk, yazi } from '@/theme';

type Props = {
  kartlar: DurakKarti[];
  /** Açık kartın durağı; dışarıdan değişince (pine dokunma) şerit o karta kayar. */
  seciliDurakId: string;
  /** Gün rengi: sıra numarası dairesi. */
  gunRenk: string;
  /** Gezi sırasında (bugün) ilk düğme "Vardık" (KK4). */
  bugun: boolean;
  onSec: (durakId: string) => void;
  onDetay: (kart: DurakKarti) => void;
  onYolTarifi: (kart: DurakKarti) => void;
  onVardik: (kart: DurakKarti) => void;
  onMenu: (kart: DurakKarti) => void;
  onKapat: () => void;
};

/**
 * #99 (kanvas PlaceSwipe15): Program haritasında seçili günün durağına dokununca alttaki kart şeridi — 350 px kart, sayfalı
 * yatay kaydırma. Kart yerleşince `onSec` (ekran pini iğneye çevirir, kamera pine kayar). Kapanma: aşağı çekme ya da haritaya
 * dokunma (ekran). Kart görselleri `useOnizleme` (24 sa önbellek; yalnız görünür ve komşu kartlar ister).
 */
export function DurakKartlari({ kartlar, seciliDurakId, gunRenk, bugun, onSec, onDetay, onYolTarifi, onVardik, onMenu, onKapat }: Props) {
  const liste = useRef<FlatList<DurakKarti>>(null);
  const indeks = Math.max(0, kartlar.findIndex((k) => k.durakId === seciliDurakId));
  const sonKaydirilan = useRef<number>(-1);
  // Dışarıdan seçim (pine dokunma) → şerit o karta kayar; kaydırmayla gelen seçim zaten yerinde.
  useEffect(() => {
    if (sonKaydirilan.current === indeks) return;
    sonKaydirilan.current = indeks;
    liste.current?.scrollToOffset({ offset: indeks * KART_ADIM, animated: true });
  }, [indeks]);
  const kaydirmaBitti = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = kartIndeksi(e.nativeEvent.contentOffset.x, kartlar.length);
    sonKaydirilan.current = i;
    const k = kartlar[i];
    if (k && k.durakId !== seciliDurakId) onSec(k.durakId);
  };
  // KK3: aşağı çekme kapatır (yatay kaydırma FlatList'te kalır; yalnız belirgin dikey hareket yakalanır).
  const cekme = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 40) onKapat();
        },
      }),
    [onKapat],
  );
  return (
    <View style={s.kap} pointerEvents="box-none" {...cekme.panHandlers}>
      <FlatList
        ref={liste}
        horizontal
        data={kartlar}
        keyExtractor={(k) => k.durakId}
        showsHorizontalScrollIndicator={false}
        snapToInterval={KART_ADIM}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: bosluk.kenar, gap: KART_ARALIK }}
        getItemLayout={(_d, i) => ({ length: KART_ADIM, offset: KART_ADIM * i, index: i })}
        initialScrollIndex={indeks}
        onMomentumScrollEnd={kaydirmaBitti}
        onScrollEndDrag={(e) => {
          // Momentum olmadan bırakılan kısa çekişlerde de yerleşen kartı seç.
          if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) kaydirmaBitti(e);
        }}
        accessibilityLabel={t('program.kart.kaydir')}
        renderItem={({ item, index }) => (
          <Kart kart={item} toplam={kartlar.length} gunRenk={gunRenk} bugun={bugun} fotoIste={Math.abs(index - indeks) <= 1} onDetay={onDetay} onYolTarifi={onYolTarifi} onVardik={onVardik} onMenu={onMenu} />
        )}
      />
      <View style={s.noktalar} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: kartlar.length, now: indeks + 1 }}>
        {kartlar.map((k, i) => (
          <View key={k.durakId} style={[s.nokta, i === indeks && s.noktaAktif]} />
        ))}
      </View>
    </View>
  );
}

function Kart({ kart, toplam, gunRenk, bugun, fotoIste, onDetay, onYolTarifi, onVardik, onMenu }: { kart: DurakKarti; toplam: number; gunRenk: string; bugun: boolean; fotoIste: boolean } & Pick<Props, 'onDetay' | 'onYolTarifi' | 'onVardik' | 'onMenu'>) {
  const onizleme = useOnizleme(fotoIste ? kart.placeId : undefined);
  const foto = onizleme.data?.foto_uri ?? null;
  const dugmeler = kartDugmeleri(kart, bugun);
  const { kategoriRenk } = kategoriPini(onizleme.data?.primary_type ?? null);
  const metin = (tur: (typeof dugmeler)[number]) => (tur === 'vardik' ? t('program.kart.vardik') : tur === 'detay' ? t('program.detay') : t('program.yolTarifi'));
  const bas = (tur: (typeof dugmeler)[number]) => (tur === 'vardik' ? onVardik(kart) : tur === 'detay' ? onDetay(kart) : onYolTarifi(kart));
  return (
    <View style={[s.kart, s.golge]}>
      <View style={[s.foto, { backgroundColor: kategoriRenk }]}>
        {foto ? <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
        <View style={s.fotoGolge} />
        <View style={s.rozet}>
          <Text style={s.rozetMetin}>{t('program.kart.sayac', { n: kart.sira, toplam })}</Text>
        </View>
      </View>
      <View style={s.govde}>
        <View style={s.baslikSatir}>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={s.ad} numberOfLines={1}>
              {kart.ad}
            </Text>
            <Text style={s.alt} numberOfLines={1}>
              {kart.durum === 'atlandi' ? `${t('program.kart.atlandi')} · ` : ''}
              {kart.altSatir}
              {kart.puan !== null ? (
                <>
                  {' · '}
                  <Text style={{ color: renk.vurgu }}>★</Text>
                  {` ${kart.puan.toFixed(1).replace('.', ',')}`}
                  {kart.yorum ? ` · ${kart.yorum}` : ''}
                </>
              ) : null}
            </Text>
          </View>
          <View style={[s.numara, { backgroundColor: kart.tamamlandi ? renk.basari : gunRenk }]}>
            {kart.tamamlandi ? <Ikon ad="tik" boyut={14} renk={renk.zemin} kalinlik={2.6} /> : <Text style={[s.numaraMetin, { color: gunUstuMetin(gunRenk) }]}>{kart.sira}</Text>}
          </View>
        </View>
        <View style={s.dugmeler}>
          {dugmeler.map((tur, i) => (
            <Pressable key={tur} accessibilityRole="button" onPress={() => bas(tur)} style={({ pressed }) => [s.dugme, i === 0 ? s.dugmeSiyah : s.dugmeAcik, pressed && { opacity: 0.85 }]}>
              <Text style={[s.dugmeMetin, i === 0 && { color: renk.zemin }]}>{metin(tur)}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel={t('program.diger')} onPress={() => onMenu(kart)} style={({ pressed }) => [s.yuvarlak, pressed && { opacity: 0.85 }]}>
            <Ikon ad="daha" boyut={18} renk={renk.metin} kalinlik={2.2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { position: 'absolute', left: 0, right: 0, bottom: 14, gap: 8 },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 15, elevation: 8 },
  kart: { width: KART_GENISLIK, borderRadius: 20, backgroundColor: renk.zemin, overflow: 'hidden' },
  // #120 KK1: foto 100 → 72, iç boşluk 12 → 10, düğme 40 → 36 (toplam ≈ 200 px; harita görünür kalır).
  foto: { height: 72, width: '100%' },
  fotoGolge: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60, backgroundColor: 'rgba(0,0,0,0.12)' },
  rozet: { position: 'absolute', left: 10, top: 10, height: 22, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(15,15,15,0.75)', justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 10.5, color: renk.zemin },
  govde: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, gap: 8 },
  baslikSatir: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ad: { fontFamily: yazi.ekstra, fontSize: 17, letterSpacing: -0.3, color: renk.metin },
  alt: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  numara: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  numaraMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.zemin },
  dugmeler: { flexDirection: 'row', gap: 8 },
  dugme: { flex: 1, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dugmeSiyah: { backgroundColor: renk.metin },
  dugmeAcik: { backgroundColor: '#f6f6f4' },
  dugmeMetin: { fontFamily: yazi.ekstra, fontSize: 12.5, color: renk.metin },
  yuvarlak: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f6f6f4', alignItems: 'center', justifyContent: 'center' },
  noktalar: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  nokta: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(15,15,15,0.25)' },
  noktaAktif: { width: 16, backgroundColor: renk.metin },
});
