import { Image } from 'expo-image';
import { useEffect, useMemo, useRef } from 'react';
import { FlatList, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import type { Konum } from '@/components/harita/tipler';
import { Ikon } from '@/components/ui/Ikon';
import { useYerRehberi } from '@/features/icerik/sorgular';
import {
  ilerlemeParcalari,
  KART_ARALIK,
  KART_KENAR,
  KART_SAG,
  kartAdimi,
  kartGenisligi,
  kartIndeksi,
  kartSaati,
  kartSekmesi,
  sonrakiKart,
  yolTarifiBirincil,
  type DurakKarti,
  type IlerlemeParcasi,
} from '@/features/program/durakKarti';
import { useOnizleme } from '@/features/yerler/api';
import { t } from '@/i18n';
import { sureMetni } from '@/lib/kategori';
import { kategoriPini } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import { dakikaSaat } from '@/schedule/tempo';
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
  /** #168 KK2: seçili günün rengi — ilerleme çizgisinde bu durağın parçası. */
  gunRenk: string;
  onSec: (durakId: string) => void;
  onRehber: (kart: DurakKarti) => void;
  onYolTarifi: (kart: DurakKarti) => void;
  onMenu: (kart: DurakKarti) => void;
  onKapat: () => void;
};

/**
 * #99 → #140 → #168 (kanvas 10 · 12 · 12b): Program haritasının altındaki durak kartı şeridi — sola / sağa kaydırınca
 * sonraki / önceki durak; sonraki kart sağ kenardan görünür. Üç halde aynı yapı: sol üstte sekme (geliş · kalan yol ·
 * "Buradasın"), günün durakları kadar ilerleme parçası, numara + saat şeridi + ad + "Cami · ★ 4,7 · Açık" + 60 px foto,
 * 40 px düğmeler. Birincil düğme planda ve buradayken Mekan rehberi, sıradaki durağa giderken Yol tarifi. Gezi modunda
 * buradayken rehberden ipucu; gezi modunda altta "Sonra:".
 */
export function DurakKartlari({ kartlar, seciliDurakId, gezi, tz, konum, gunRenk, onSec, onRehber, onYolTarifi, onMenu, onKapat }: Props) {
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
        contentContainerStyle={{ paddingLeft: KART_KENAR, paddingRight: KART_SAG, gap: KART_ARALIK, alignItems: 'flex-end' }}
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
            gunRenk={gunRenk}
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

/** Rehber yazısından kısa ipucu: varsa alıntı bloğu (mekan rehberindeki İPUCU, #142), yoksa başlıksız ilk paragraf; ~220 karakter. */
export function rehberIpucu(md: string | null | undefined): string | null {
  if (!md) return null;
  const alinti = md
    .split('\n')
    .filter((l) => /^\s*>/.test(l))
    .map((l) => l.replace(/^\s*>\s?/, '').trim())
    .filter(Boolean)
    .join(' ');
  const paragraf = (alinti ? [alinti] : md.split(/\n\s*\n/))
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

type KartProps = Pick<Props, 'kartlar' | 'gezi' | 'tz' | 'konum' | 'gunRenk' | 'onSec' | 'onRehber' | 'onYolTarifi' | 'onMenu'> & {
  kart: DurakKarti;
  genislik: number;
  aktif: boolean;
  fotoIste: boolean;
};

const modIkonu = (mod: 'yuruyus' | 'taksi' | undefined) => (mod === 'taksi' ? 'araba' : 'yurume');

function Kart({ kart, kartlar, genislik, gezi, tz, konum, gunRenk, aktif, fotoIste, onSec, onRehber, onYolTarifi, onMenu }: KartProps) {
  const onizleme = useOnizleme(fotoIste ? kart.placeId : undefined);
  const foto = onizleme.data?.foto_uri ?? null;
  const { kategoriRenk } = kategoriPini(onizleme.data?.primary_type ?? null);
  const burada = gezi && kart.durum === 'buradasin';
  const rehber = useYerRehberi(burada && aktif ? kart.placeId : undefined);
  const ipucu = burada ? rehberIpucu(rehber.data?.rehber_md) : null;
  const saat = kartSaati(kart);
  const puan = puanMetni(kart.puan);
  const sekme = kartSekmesi(kart, { gezi, konum, tz });
  const parcalar = ilerlemeParcalari(kartlar, kart.durakId, gezi);
  const sonraki = gezi ? sonrakiKart(kartlar, kart.durakId) : null;
  const yolBirincil = yolTarifiBirincil(kart, gezi);

  const sekmeRengi = sekme.ton === 'burada' || sekme.ton === 'gezildi' ? renk.basariMetin : sekme.ton === 'soluk' ? renk.ikincil : renk.ana;
  const parcaRengi = (p: IlerlemeParcasi) => (p === 'bu' ? gunRenk : p === 'sonra' ? renk.yuzey : gezi ? renk.basari : renk.anaAcik);

  // KK5: 40 px düğme; ikon kendi 16 px kutusunda, metnin satır yüksekliği 16 — ikisi dikey ortalı. Birincil solda.
  const dugme = (tur: 'yol' | 'rehber') => {
    const birincil = tur === 'yol' ? yolBirincil : !yolBirincil;
    const yazi = birincil ? renk.zemin : renk.ana;
    return (
      <Pressable
        key={tur}
        accessibilityRole="button"
        onPress={() => (tur === 'yol' ? onYolTarifi(kart) : onRehber(kart))}
        style={({ pressed }) => [s.dugme, { flex: tur === 'rehber' ? 1.15 : 1 }, birincil ? s.dugmeBirincil : s.dugmeIkincil, pressed && { opacity: 0.85 }]}>
        <View style={s.dugmeIkon}>
          <Ikon ad={tur === 'yol' ? 'pusula' : 'kitap'} boyut={16} renk={yazi} kalinlik={2.3} />
        </View>
        <Text style={[s.dugmeMetin, { color: yazi }]} numberOfLines={1}>
          {tur === 'yol' ? t('program.yolTarifi') : t('program.kart.mekanRehberi')}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ width: genislik }}>
      {/* KK1: kartın sol üstüne yapışık sekme. */}
      <View style={[s.sekme, s.golge, sekme.ton === 'burada' && { backgroundColor: renk.basariZemin }]}>
        {sekme.ikon ? (
          <View style={s.sekmeIkon}>
            <Ikon ad={sekme.ikon} boyut={14} renk={sekmeRengi} kalinlik={sekme.ikon === 'tik' ? 3 : 2.4} />
          </View>
        ) : null}
        <Text style={[s.sekmeMetin, { color: sekmeRengi }]} numberOfLines={1}>
          {sekme.metin}
        </Text>
      </View>
      <View style={[s.kart, s.golge]}>
        {/* KK2: günün durakları kadar 4 px parça. */}
        <View
          style={s.ilerleme}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('program.kart.ilerleme', { n: kart.sira, toplam: kartlar.length })}
          accessibilityValue={{ min: 1, max: kartlar.length, now: kart.sira }}>
          {kartlar.map((k, i) => (
            <View key={k.durakId} style={[s.parca, { backgroundColor: parcaRengi(parcalar[i]) }]} />
          ))}
        </View>
        {/* KK3: numara (seçili pin görünümü) · saat şeridi, ad, özet · küçük foto. */}
        <View style={s.ustSatir}>
          <View style={[s.numara, kart.numara === null && s.numaraAtlandi]}>
            <Text style={[s.numaraMetin, kart.numara === null && { color: renk.ikincil }]}>{kart.numara ?? '–'}</Text>
          </View>
          <View style={s.bilgi}>
            <View style={s.saatSatir}>
              <Text style={[s.saat, !saat && { color: renk.ikincil }]} numberOfLines={1}>
                {saat ?? t('program.kart.atlandi')}
              </Text>
              <Text style={s.sure} numberOfLines={1}>
                {gezi ? t('program.kart.planli', { sure: sureMetni(kart.dakika) }) : sureMetni(kart.dakika)}
              </Text>
            </View>
            <Text style={s.ad} numberOfLines={2}>
              {kart.ad}
            </Text>
            <Text style={s.ozet} numberOfLines={1}>
              {kart.kategori}
              {puan ? ` · ★ ${puan}` : ''}
              {kart.acik !== null ? ' · ' : ''}
              {kart.acik !== null ? <Text style={[s.acik, !kart.acik && { color: renk.uyari }]}>{t(kart.acik ? 'program.kart.acik' : 'program.kart.kapali')}</Text> : null}
            </Text>
          </View>
          <View style={[s.foto, { backgroundColor: kategoriRenk + '33' }]}>
            {foto ? <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
          </View>
        </View>
        <View style={s.dugmeler}>
          {yolBirincil ? [dugme('yol'), dugme('rehber')] : [dugme('rehber'), dugme('yol')]}
          <Pressable accessibilityRole="button" accessibilityLabel={t('program.kart.diger')} onPress={() => onMenu(kart)} style={({ pressed }) => [s.dahaDugme, pressed && { opacity: 0.85 }]}>
            <Ikon ad="daha" boyut={16} renk={renk.ana} kalinlik={2.4} />
          </Pressable>
        </View>
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
              <Ikon ad="geri" boyut={14} renk={renk.ana} kalinlik={2.8} />
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { position: 'absolute', left: 0, right: 0, bottom: 12 },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 15, elevation: 10 },
  sekme: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    height: 30,
    marginLeft: 14,
    paddingHorizontal: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: renk.zemin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sekmeIkon: { width: 14, height: 14 },
  sekmeMetin: { flexShrink: 1, fontFamily: yazi.ekstra, fontSize: 12, lineHeight: 14 },
  kart: { borderRadius: kose.kart, backgroundColor: renk.zemin, padding: 14, gap: 12 },
  ilerleme: { flexDirection: 'row', gap: 4 },
  parca: { flex: 1, height: 4, borderRadius: 2 },
  ustSatir: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  numara: { width: 34, height: 34, borderRadius: 10, borderWidth: 2.5, borderColor: renk.ana, backgroundColor: renk.vurgu, alignItems: 'center', justifyContent: 'center' },
  numaraAtlandi: { borderColor: renk.ayrac, backgroundColor: renk.yuzey },
  numaraMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  bilgi: { flex: 1, minWidth: 0, gap: 3 },
  saatSatir: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  saat: { flexShrink: 1, fontFamily: yazi.baslik, fontSize: 17, color: renk.metin },
  sure: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ikincil },
  ad: { fontFamily: yazi.baslik, fontSize: 21, lineHeight: 23, letterSpacing: -0.42, color: renk.metin },
  ozet: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  acik: { fontFamily: yazi.ekstra, color: renk.basariMetin },
  foto: { width: 60, height: 60, borderRadius: 14, overflow: 'hidden' },
  dugmeler: { flexDirection: 'row', gap: 8 },
  dugme: { height: 40, paddingHorizontal: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dugmeBirincil: { backgroundColor: renk.ana },
  dugmeIkincil: { backgroundColor: renk.yuzey },
  dugmeIkon: { width: 16, height: 16 },
  dugmeMetin: { flexShrink: 1, fontFamily: yazi.ekstra, fontSize: 14, lineHeight: 16 },
  dahaDugme: { width: 40, height: 40, borderRadius: 12, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
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
