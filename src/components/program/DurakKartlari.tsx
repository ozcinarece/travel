import { Image } from 'expo-image';
import { useEffect, useMemo, useRef } from 'react';
import { FlatList, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { mesafeM } from '@/components/harita/geo';
import type { Konum } from '@/components/harita/tipler';
import { Ikon } from '@/components/ui/Ikon';
import { useYerRehberi } from '@/features/icerik/sorgular';
import { KART_ARALIK, KART_KENAR, kartAdimi, kartGenisligi, kartIndeksi, kartSaati, sonrakiKart, type DurakKarti } from '@/features/program/durakKarti';
import { useOnizleme } from '@/features/yerler/api';
import { t } from '@/i18n';
import { sureMetni } from '@/lib/kategori';
import { mesafeMetni } from '@/lib/mesafe';
import { kategoriPini } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import { saatEkli, yerelSaatDk } from '@/lib/zaman';
import { dakikaSaat, kestirimTaksiSn, kestirimYuruyusSn } from '@/schedule/tempo';
import { kose, renk, yazi } from '@/theme';

type Props = {
  kartlar: DurakKarti[];
  /** Açık kartın durağı; dışarıdan değişince (pine dokunma, "Sonra:") şerit o karta kayar. */
  seciliDurakId: string;
  /** #140 KK5: gezi modu (seyahat günü) — durum etiketi, ilerleme parçaları, "Sonra:" satırı. */
  gezi: boolean;
  /** Seyahat saat dilimi (varış anı "11:05'te geldin"). */
  tz: string;
  /** #140 KK9: konum (yalnız gezi gününde, izin varsa) — "4 dk kaldı · 300 m". */
  konum: Konum | null;
  onSec: (durakId: string) => void;
  onRehber: (kart: DurakKarti) => void;
  onYolTarifi: (kart: DurakKarti) => void;
  onMenu: (kart: DurakKarti) => void;
  onKapat: () => void;
};

/**
 * #99 → #140 (kanvas 10 · 12 · 12b): Program haritasının altındaki durak kartı şeridi — ekran genişliğinde kart, sola / sağa
 * kaydırınca sonraki / önceki durak. Plan modunda foto 92 + saat (Mandalina) + "Müze · 45 dk · ★ 4,7" + geliş satırı;
 * gezi modunda "SIRADAKİ · 2 / 3" + ilerleme parçaları, kalan yol ya da "11:05'te geldin ✓", rehberden ipucu ve "Sonra:".
 * Düğmeler iki modda da [Yol tarifi] [Mekan rehberi] [···] ("Vardık" kalktı); buradayken Mekan rehberi birincil.
 */
export function DurakKartlari({ kartlar, seciliDurakId, gezi, tz, konum, onSec, onRehber, onYolTarifi, onMenu, onKapat }: Props) {
  const ekran = useWindowDimensions();
  const genislik = kartGenisligi(ekran.width);
  const adim = kartAdimi(ekran.width);
  const liste = useRef<FlatList<DurakKarti>>(null);
  const indeks = Math.max(0, kartlar.findIndex((k) => k.durakId === seciliDurakId));
  const sonKaydirilan = useRef<number>(-1);
  useEffect(() => {
    if (sonKaydirilan.current === indeks) return;
    sonKaydirilan.current = indeks;
    liste.current?.scrollToOffset({ offset: indeks * adim, animated: true });
  }, [indeks, adim]);
  const kaydirmaBitti = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = kartIndeksi(e.nativeEvent.contentOffset.x, kartlar.length, adim);
    sonKaydirilan.current = i;
    const k = kartlar[i];
    if (k && k.durakId !== seciliDurakId) onSec(k.durakId);
  };
  // Aşağı çekme kapatır (yatay kaydırma FlatList'te kalır; yalnız belirgin dikey hareket yakalanır).
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
        snapToInterval={adim}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: KART_KENAR, gap: KART_ARALIK, alignItems: 'flex-end' }}
        getItemLayout={(_d, i) => ({ length: adim, offset: adim * i, index: i })}
        initialScrollIndex={indeks}
        onMomentumScrollEnd={kaydirmaBitti}
        onScrollEndDrag={(e) => {
          // Momentum olmadan bırakılan kısa çekişlerde de yerleşen kartı seç.
          if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) kaydirmaBitti(e);
        }}
        accessibilityLabel={t('program.kart.kaydir')}
        renderItem={({ item, index }) => (
          <Kart
            kart={item}
            kartlar={kartlar}
            genislik={genislik}
            gezi={gezi}
            tz={tz}
            konum={konum}
            aktif={index === indeks}
            fotoIste={Math.abs(index - indeks) <= 1}
            onSec={onSec}
            onRehber={onRehber}
            onYolTarifi={onYolTarifi}
            onMenu={onMenu}
          />
        )}
      />
    </View>
  );
}

/** Rehber yazısından kısa ipucu: başlıksız ilk paragraf, en çok ~220 karakter. */
export function rehberIpucu(md: string | null | undefined): string | null {
  if (!md) return null;
  const paragraf = md
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split('\n')
        .filter((l) => !/^\s*(#|!\[)/.test(l))
        .map((l) =>
          l
            .replace(/^\s*[-*]\s+/, '')
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            .replace(/[*_`>]/g, '')
            .trim(),
        )
        .filter(Boolean)
        .join(' '),
    )
    .find((p) => p.length > 0);
  if (!paragraf) return null;
  return paragraf.length > 220 ? `${paragraf.slice(0, 217).trimEnd()}…` : paragraf;
}

type KartProps = Pick<Props, 'kartlar' | 'gezi' | 'tz' | 'konum' | 'onSec' | 'onRehber' | 'onYolTarifi' | 'onMenu'> & { kart: DurakKarti; genislik: number; aktif: boolean; fotoIste: boolean };

function Kart({ kart, kartlar, genislik, gezi, tz, konum, aktif, fotoIste, onSec, onRehber, onYolTarifi, onMenu }: KartProps) {
  const onizleme = useOnizleme(fotoIste ? kart.placeId : undefined);
  const foto = onizleme.data?.foto_uri ?? null;
  const { kategoriRenk } = kategoriPini(onizleme.data?.primary_type ?? null);
  const burada = gezi && kart.durum === 'buradasin';
  const rehber = useYerRehberi(burada && aktif ? kart.placeId : undefined);
  const ipucu = burada ? rehberIpucu(rehber.data?.rehber_md) : null;
  const saat = kartSaati(kart);
  const puan = puanMetni(kart.puan);
  const ozet = `${t('program.kart.ozet', { kategori: kart.kategori, sure: sureMetni(kart.dakika) })}${puan ? ` · ★ ${puan}` : ''}`;
  const toplam = kartlar.length;
  const sonraki = gezi ? sonrakiKart(kartlar, kart.durakId) : null;

  const modIkonu = (mod: 'yuruyus' | 'taksi' | undefined) => (mod === 'taksi' ? 'araba' : 'yurume');
  const gelisSatiri = kart.gelis ? (
    <View style={s.gelis}>
      <Ikon ad={modIkonu(kart.gelis.mod)} boyut={14} renk={renk.ana} kalinlik={2.4} />
      <Text style={s.gelisMetin} numberOfLines={1}>
        {kart.gelis.metin}
      </Text>
    </View>
  ) : null;

  // Gezi modu durum satırı: buradaysan varış anı; sıradakiyse (konum varsa) kalan yol; yoksa geliş.
  let durumSatiri = gelisSatiri;
  if (burada) {
    const varis = kart.varildi ? dakikaSaat(yerelSaatDk(new Date(kart.varildi), tz)) : null;
    durumSatiri = (
      <Text style={[s.gelisMetin, { color: renk.basariMetin }]} numberOfLines={1}>
        {varis ? t('program.kart.geldin', { saat: saatEkli(varis, 'bulunma'), sure: sureMetni(kart.dakika) }) : `✓ · ${sureMetni(kart.dakika)}`}
      </Text>
    );
  } else if (gezi && kart.durum === 'siradaki' && konum) {
    const m = mesafeM(konum, kart.konum);
    const sn = kart.gelis?.mod === 'taksi' ? kestirimTaksiSn(konum, kart.konum) : kestirimYuruyusSn(konum, kart.konum);
    durumSatiri = (
      <View style={s.gelis}>
        <Ikon ad={modIkonu(kart.gelis?.mod)} boyut={14} renk={renk.ana} kalinlik={2.4} />
        <Text style={s.gelisMetin} numberOfLines={1}>
          {t('program.kart.kalan', { dk: Math.max(1, Math.ceil(sn / 60)), mesafe: mesafeMetni(Math.round(m / 10) * 10) })}
        </Text>
      </View>
    );
  }

  const fotoKutusu = (boyut: number, rozet: boolean) => (
    <View style={[s.foto, { width: boyut, height: boyut, backgroundColor: kategoriRenk + '33' }]}>
      {foto ? <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
      {rozet ? (
        <View style={s.rozet}>
          <Text style={s.rozetMetin}>{t('program.kart.sayac', { n: kart.sira, toplam })}</Text>
        </View>
      ) : null}
    </View>
  );

  const dugmeler = (
    <View style={s.dugmeler}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onYolTarifi(kart)}
        style={({ pressed }) => [s.dugme, { flex: 1 }, burada ? s.dugmeIkincil : s.dugmeBirincil, gezi && s.dugmeGezi, pressed && { opacity: 0.85 }]}>
        <Ikon ad="kesfet" boyut={18} renk={burada ? renk.ana : renk.zemin} kalinlik={2.3} />
        <Text style={[s.dugmeMetin, { color: burada ? renk.ana : renk.zemin }]}>{t('program.yolTarifi')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => onRehber(kart)}
        style={({ pressed }) => [s.dugme, { flex: 1.15 }, burada ? s.dugmeBirincil : s.dugmeIkincil, gezi && s.dugmeGezi, pressed && { opacity: 0.85 }]}>
        <Ikon ad="kitap" boyut={18} renk={burada ? renk.zemin : renk.ana} kalinlik={2.3} />
        <Text style={[s.dugmeMetin, { color: burada ? renk.zemin : renk.ana }]}>{t('program.kart.mekanRehberi')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('program.kart.diger')} onPress={() => onMenu(kart)} style={({ pressed }) => [s.dahaDugme, gezi && s.dahaGezi, pressed && { opacity: 0.85 }]}>
        <Ikon ad="daha" boyut={18} renk={renk.ana} kalinlik={2.4} />
      </Pressable>
    </View>
  );

  if (!gezi) {
    return (
      <View style={[s.kart, s.golge, { width: genislik }]}>
        <View style={s.ustSatir}>
          {fotoKutusu(92, true)}
          <View style={s.bilgi}>
            {saat ? <Text style={s.saat}>{saat}</Text> : <Text style={[s.saat, { color: renk.ikincil }]}>{t('program.kart.atlandi')}</Text>}
            <Text style={s.ad} numberOfLines={2}>
              {kart.ad}
            </Text>
            <Text style={s.ozet} numberOfLines={1}>
              {ozet}
            </Text>
            {gelisSatiri}
          </View>
        </View>
        {dugmeler}
        <View style={s.noktalar} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: toplam, now: kart.sira }}>
          {kartlar.map((k) => (
            <View key={k.durakId} style={[s.nokta, k.durakId === kart.durakId && s.noktaAktif]} />
          ))}
        </View>
      </View>
    );
  }

  const etiket =
    kart.durum === 'buradasin'
      ? 'program.kart.buradasin'
      : kart.durum === 'siradaki'
        ? 'program.kart.siradaki'
        : kart.durum === 'gecildi'
          ? 'program.kart.gecildi'
          : kart.durum === 'atlandi'
            ? 'program.kart.atlandiUst'
            : 'program.kart.bekliyor';
  const parca = Math.max(8, Math.min(22, 150 / Math.max(1, toplam)));
  return (
    <View style={[s.kart, s.kartGezi, s.golge, { width: genislik }]}>
      <View style={s.durumSatir}>
        <Text style={s.durumEtiket}>{t(etiket, { n: kart.sira, toplam })}</Text>
        <View style={s.parcalar}>
          {kartlar.map((k) => (
            <View
              key={k.durakId}
              style={[
                s.parca,
                { width: parca },
                k.durum === 'gecildi' ? { backgroundColor: renk.basari } : k.durakId === kart.durakId ? { backgroundColor: renk.vurgu } : null,
              ]}
            />
          ))}
        </View>
      </View>
      <View style={[s.ustSatir, { alignItems: 'center' }]}>
        {fotoKutusu(64, false)}
        <View style={[s.bilgi, { gap: 3, paddingTop: 0 }]}>
          <Text style={s.ad} numberOfLines={2}>
            {kart.ad}
          </Text>
          {durumSatiri}
          {saat ? (
            <Text style={s.planMetin} numberOfLines={1}>
              {t('program.kart.plan', { saat, kategori: kart.kategori })}
            </Text>
          ) : null}
        </View>
      </View>
      {dugmeler}
      {ipucu ? (
        <View style={s.ipucu}>
          <Text style={s.ipucuBaslik}>{t('program.kart.ipucu')}</Text>
          <Text style={s.ipucuMetin}>{ipucu}</Text>
        </View>
      ) : null}
      {sonraki ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('program.kart.sonrakiKart')} onPress={() => onSec(sonraki.durakId)} style={({ pressed }) => [s.sonra, pressed && { opacity: 0.7 }]}>
          <Text style={s.sonraMetin} numberOfLines={1}>
            <Text style={s.sonraEtiket}>{`${t('program.kart.sonra')} `}</Text>
            {sonraki.varisDk !== null ? t('program.kart.sonraMetin', { ad: sonraki.ad, saat: dakikaSaat(sonraki.varisDk) }) : sonraki.ad}
          </Text>
          {sonraki.gelis ? (
            <View style={s.sonraSag}>
              <Ikon ad={modIkonu(sonraki.gelis.mod)} boyut={14} renk={renk.ana} kalinlik={2.3} />
              <Text style={s.sonraDk}>{`${sonraki.gelis.dk} dk`}</Text>
            </View>
          ) : null}
          <View style={s.ileri}>
            <Ikon ad="geri" boyut={16} renk={renk.ana} kalinlik={2.8} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { position: 'absolute', left: 0, right: 0, bottom: 12 },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 15, elevation: 10 },
  kart: { borderRadius: kose.kart, backgroundColor: renk.zemin, padding: 12, gap: 12 },
  kartGezi: { padding: 14 },
  ustSatir: { flexDirection: 'row', gap: 12 },
  foto: { borderRadius: 16, overflow: 'hidden' },
  rozet: { position: 'absolute', left: 6, bottom: 6, height: 22, paddingHorizontal: 7, borderRadius: 7, backgroundColor: renk.zemin, justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.metin },
  bilgi: { flex: 1, minWidth: 0, gap: 4, paddingTop: 2 },
  saat: { fontFamily: yazi.ekstra, fontSize: 13, letterSpacing: 0.26, color: renk.vurgu },
  ad: { fontFamily: yazi.baslik, fontSize: 19, lineHeight: 22, letterSpacing: -0.38, color: renk.metin },
  ozet: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  gelis: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gelisMetin: { flexShrink: 1, fontFamily: yazi.ekstra, fontSize: 12.5, color: renk.ana },
  planMetin: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  dugmeler: { flexDirection: 'row', gap: 8 },
  dugme: { height: 46, borderRadius: kose.dugme, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dugmeGezi: { height: 50 },
  dugmeBirincil: { backgroundColor: renk.ana },
  dugmeIkincil: { backgroundColor: renk.yuzey },
  dugmeMetin: { fontFamily: yazi.ekstra, fontSize: 15 },
  dahaDugme: { width: 46, height: 46, borderRadius: kose.dugme, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  dahaGezi: { width: 50, height: 50 },
  noktalar: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: -2 },
  nokta: { width: 6, height: 6, borderRadius: 3, backgroundColor: renk.ayrac },
  noktaAktif: { width: 18, backgroundColor: renk.ana },
  durumSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  durumEtiket: { flexShrink: 1, fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.72, color: renk.ikincil },
  parcalar: { flexDirection: 'row', gap: 4 },
  parca: { height: 6, borderRadius: 3, backgroundColor: renk.ayrac },
  ipucu: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#fff6e6', gap: 4 },
  ipucuBaslik: { fontFamily: yazi.ekstra, fontSize: 11, letterSpacing: 0.66, color: '#8a5a00' },
  ipucuMetin: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 20, color: renk.metin },
  sonra: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: renk.ayrac, minHeight: 40 },
  sonraMetin: { flex: 1, fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  sonraEtiket: { fontFamily: yazi.ekstra, color: renk.metin },
  sonraSag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sonraDk: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  ileri: { transform: [{ rotate: '180deg' }] },
});
