import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, type PanResponderInstance } from 'react-native';

import { SayfaKaydirmasi, useSayfaKaydirma, useSayfaKilidi } from '@/components/ui/sayfaCekme';
import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { gunUstuMetin, kose, renk, yazi } from '@/theme';

/** #53 §5 → #140 (kanvas 11): listedeki durak satırı. */
export type SiralaSatiri = {
  id: string;
  ad: string;
  /** Saat sütunu — varış "09:51" (yuvarlamasız); atlananda null. */
  saat: string | null;
  /** Adın altı: "Gezilecek · 1 sa · 10:51'e kadar" / "Atlandı". */
  alt: string;
  /** Sıra numarası (atlananda null). */
  numara: number | null;
  tamam?: boolean;
  atlandi?: boolean;
  /** Gezi gününde sıradaki / buradasın durak: Mandalina kare. */
  vurgu?: boolean;
  /** Önceki noktadan bacak: "6 dk · 450 m" hapı (araba Gece dolu); `id` = çift anahtarı (dokununca seçici); yeni çiftte "hesaplanıyor…". */
  bacak?: { metin: string; ikon: 'yurume' | 'araba'; id?: string };
  /** #140 KK1: varıştan önceki boşluk, sebebiyle ("4 dk serbest · 12:00'de açılıyor"). */
  bosluk?: string | null;
};

/** #55 §C8: durak satırı en az 50 px (ad 2 satıra kadar); üstündeki bacak satırı 38 px (30 px hap). */
export const DURAK_EN_AZ = 50;
export const ARA_YUKSEKLIK = 38;
/** Kenara bu kadar yaklaşınca liste kendiliğinden kayar. */
const KENAR_PAYI = 48;
const KAYMA_HIZI = 7;

/** Ölçülen yuva (yürüyüş satırı + durak satırı): içerikteki y ve yükseklik. */
export type Yuva = { y: number; h: number };

/** Sürüklenen satırın bırakılacağı sıra: tutulan yuvanın merkezi + kayma, merkezi en yakın yuva. */
export function hedefSira(baslangic: number, kayma: number, yuvalar: Yuva[]): number {
  const k = yuvalar[baslangic];
  if (!k) return baslangic;
  const merkez = k.y + k.h / 2 + kayma;
  let en = baslangic;
  let fark = Infinity;
  yuvalar.forEach((y, i) => {
    const d = Math.abs(y.y + y.h / 2 - merkez);
    if (d < fark) {
      fark = d;
      en = i;
    }
  });
  return en;
}

/** Bırakma çizgisinin y'si: yukarı taşırken hedefin üstündeki yürüyüş satırında, aşağı taşırken hedefin altında. */
export function birakmaCizgisiY(baslangic: number, hedef: number, yuvalar: Yuva[]): number {
  const y = yuvalar[hedef];
  if (!y) return 0;
  if (hedef > baslangic) {
    const sonraki = yuvalar[hedef + 1];
    return (sonraki ? sonraki.y : y.y + y.h) + ARA_YUKSEKLIK / 2 - 1.5;
  }
  return y.y + ARA_YUKSEKLIK / 2 - 1.5;
}

type Props = {
  satirlar: SiralaSatiri[];
  /** #56: ilk satır (Başlangıç) ve son satır (Bitiş / Otele dönüş). */
  bas: ReactNode;
  son?: ReactNode;
  /** #140: listenin en altı ("Listede, güne atanmamış · N" kutusu). */
  alt?: ReactNode;
  yukseklik: number;
  onTasi: (from: number, to: number) => void;
  onSatirBas: (id: string) => void;
  /** #55 §C10: satıra (≡ dışında) uzun basma. */
  onUzunBas?: (id: string) => void;
  /** #55 §D11: numara dairesi gün renginde. */
  numaraRengi?: string;
  /** #101 KK3: açık bacak (çift anahtarı) ve hapa dokunma; açık bacağın altında seçici içerik (segment). Aynı anda tek bacak. */
  acikBacakId?: string | null;
  onBacakBas?: (id: string) => void;
  bacakSecici?: ReactNode;
};

/**
 * #53 §5 / #55 §C yarı açık panel listesi: "Başlangıç · 09:00", sonra en az 44 px durak satırları (numara · kategori
 * ikonu · ad [2 satır] + "09:00 – 09:45 · 45 dk" · ≡), aralarda 16 px yürüyüş satırı. Satıra uzun bas → menü. Sürükleme yalnız ≡'den: tutulan satır kalkar (turuncu kenar, gölge), bırakılacak yer
 * turuncu 3 px çizgi; kenara yaklaşınca liste kendiliğinden kayar.
 */
export function SiralaListesi({ satirlar, bas, son, alt, yukseklik, onTasi, onSatirBas, onUzunBas, numaraRengi = renk.ana, acikBacakId = null, onBacakBas, bacakSecici }: Props) {
  const [surukle, setSurukle] = useState<{ index: number; hedef: number } | null>(null);
  // Satır yükseklikleri içeriğe göre (ad 2 satır) — yuvalar ölçülür.
  const [yuvalar, setYuvalar] = useState<Yuva[]>([]);
  const sayfaKaydirma = useSayfaKaydirma();
  // #164 KK7: ≡ ile sıralama sayfanın aşağı çekilmesinden önceliklidir — sürüklerken sayfa jesti devreye girmez.
  const sayfaKilidi = useSayfaKilidi();
  const [kayma] = useState(() => new Animated.Value(0));
  const kaydirici = useRef<ScrollView>(null);
  const kabRef = useRef<View>(null);
  const durum = useRef({ kaydirY: 0, baslangicKaydir: 0, dy: 0, pageY: 0, kabUst: 0, kabAlt: 0, index: -1, hedef: -1, hiz: 0, yuvalar: [] as Yuva[], icerikH: 0 });
  useEffect(() => {
    durum.current.yuvalar = yuvalar;
  }, [yuvalar]);
  const zamanlayici = useRef<ReturnType<typeof setInterval> | null>(null);

  const guncelle = () => {
    const d = durum.current;
    if (d.index < 0) return;
    const etkin = d.dy + (d.kaydirY - d.baslangicKaydir);
    kayma.setValue(etkin);
    const hedef = hedefSira(d.index, etkin, d.yuvalar);
    if (hedef !== d.hedef) {
      d.hedef = hedef;
      setSurukle({ index: d.index, hedef });
    }
  };

  const durdur = () => {
    if (zamanlayici.current) clearInterval(zamanlayici.current);
    zamanlayici.current = null;
  };
  useEffect(() => durdur, []);

  const basla = (index: number) => {
    const d = durum.current;
    sayfaKilidi(true);
    d.index = index;
    d.hedef = index;
    d.dy = 0;
    d.baslangicKaydir = d.kaydirY;
    kayma.setValue(0);
    setSurukle({ index, hedef: index });
    kabRef.current?.measureInWindow((_x, y, _w, h) => {
      d.kabUst = y;
      d.kabAlt = y + h;
    });
    durdur();
    // Otomatik kaydırma: parmak kenara yakınken liste kayar, sürüklenen satır parmakta kalır.
    zamanlayici.current = setInterval(() => {
      if (!d.hiz) return;
      const enFazla = Math.max(0, d.icerikH - yukseklik);
      const yeni = Math.max(0, Math.min(enFazla, d.kaydirY + d.hiz));
      if (yeni === d.kaydirY) return;
      d.kaydirY = yeni;
      kaydirici.current?.scrollTo({ y: yeni, animated: false });
      guncelle();
    }, 16);
  };

  const hareket = (dy: number, pageY: number) => {
    const d = durum.current;
    d.dy = dy;
    d.pageY = pageY;
    d.hiz = d.kabAlt > d.kabUst ? (pageY < d.kabUst + KENAR_PAYI ? -KAYMA_HIZI : pageY > d.kabAlt - KENAR_PAYI ? KAYMA_HIZI : 0) : 0;
    guncelle();
  };

  const birak = () => {
    const d = durum.current;
    sayfaKilidi(false);
    durdur();
    const { index, hedef } = d;
    d.index = -1;
    d.hiz = 0;
    setSurukle(null);
    kayma.setValue(0);
    if (index >= 0 && hedef >= 0 && hedef !== index) onTasi(index, hedef);
  };

  // Satır başına tutamaç; işleyiciler en son basla/hareket/birak'ı ref üzerinden çağırır (sürükleme sürerken
  // yeniden kurulmaz — kurulursa jest durumu sıfırlanırdı).
  const islem = useRef({ basla, hareket, birak });
  useEffect(() => {
    islem.current = { basla, hareket, birak };
  });
  const adet = satirlar.length;
  // Ref yalnız jest işleyicilerinin içinde okunur (render sırasında değil); lint kapanışı ayırt edemiyor.
  const tutamaclar = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      Array.from({ length: adet }, (_, i) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => islem.current.basla(i),
          onPanResponderMove: (e, g) => islem.current.hareket(g.dy, e.nativeEvent.pageY),
          onPanResponderRelease: () => islem.current.birak(),
          onPanResponderTerminate: () => islem.current.birak(),
        }),
      ),
    [adet],
  );

  return (
    <View ref={kabRef} style={{ height: yukseklik }} collapsable={false}>
      <SayfaKaydirmasi>
        <ScrollView
          ref={kaydirici}
          scrollEnabled={!surukle}
          scrollEventThrottle={16}
          bounces={false}
          overScrollMode="never"
          onScroll={(e) => {
            durum.current.kaydirY = e.nativeEvent.contentOffset.y;
            sayfaKaydirma(e);
          }}
          onContentSizeChange={(_w, h) => {
            durum.current.icerikH = h;
          }}
          contentContainerStyle={{ paddingBottom: 8 }}>
          {bas}
          {satirlar.map((x, i) => {
            const tutulan = surukle?.index === i;
            return (
              // Tutulan satır sonraki kardeşlerin üstünde çizilsin (zIndex dış kapta).
              <View
                key={x.id}
                style={tutulan ? { zIndex: 10, elevation: 10 } : undefined}
                onLayout={(e) => {
                  const { y, height } = e.nativeEvent.layout;
                  setYuvalar((eski) => {
                    if (eski[i]?.y === y && eski[i]?.h === height) return eski;
                    const yeni = eski.slice(0, satirlar.length);
                    yeni[i] = { y, h: height };
                    return yeni;
                  });
                }}>
                {x.bacak && !tutulan ? (
                  <View>
                    <View style={s.ara}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: !!x.bacak.id && acikBacakId === x.bacak.id }}
                        disabled={!x.bacak.id || !onBacakBas}
                        onPress={() => x.bacak?.id && onBacakBas?.(x.bacak.id)}
                        style={({ pressed }) => [s.araHap, x.bacak?.ikon === 'araba' && s.araHapAraba, pressed && { opacity: 0.8 }]}>
                        <Ikon ad={x.bacak.ikon} boyut={14} renk={x.bacak.ikon === 'araba' ? renk.zemin : renk.ana} kalinlik={2.4} />
                        <Text style={[s.araMetin, x.bacak.ikon === 'araba' && { color: renk.zemin }]}>{x.bacak.metin}</Text>
                      </Pressable>
                    </View>
                    {x.bacak.id && acikBacakId === x.bacak.id && bacakSecici ? <View style={s.araAcik}>{bacakSecici}</View> : null}
                  </View>
                ) : (
                  <View style={s.ara} />
                )}
                {x.bosluk && !tutulan ? (
                  <View style={s.boslukKap}>
                    <Text style={s.bosluk}>{x.bosluk}</Text>
                  </View>
                ) : null}
                <Animated.View style={[tutulan && [s.tutulan, { transform: [{ translateY: kayma }] }]]}>
                  <SiraSatiri
                    satir={x}
                    numaraRengi={numaraRengi}
                    tutamac={tutamaclar[i]}
                    onBas={() => onSatirBas(x.id)}
                    onUzunBas={onUzunBas ? () => onUzunBas(x.id) : undefined}
                  />
                </Animated.View>
              </View>
            );
          })}
          {son ? <View style={{ marginTop: 6 }}>{son}</View> : null}
          {alt ? <View style={{ marginTop: 10 }}>{alt}</View> : null}
          {surukle && surukle.hedef !== surukle.index ? <View pointerEvents="none" style={[s.birakmaCizgisi, { top: birakmaCizgisiY(surukle.index, surukle.hedef, yuvalar) }]} /> : null}
        </ScrollView>
      </SayfaKaydirmasi>
    </View>
  );
}

function SiraSatiri({
  satir,
  numaraRengi,
  tutamac,
  onBas,
  onUzunBas,
}: {
  satir: SiralaSatiri;
  numaraRengi: string;
  tutamac: PanResponderInstance | undefined;
  onBas: () => void;
  onUzunBas?: () => void;
}) {
  return (
    <View style={s.satir}>
      <Pressable accessibilityRole="button" onPress={onBas} onLongPress={onUzunBas} delayLongPress={350} style={s.satirIc}>
        <Text style={[s.saat, satir.atlandi && { color: renk.soluk }]}>{satir.saat ?? '–'}</Text>
        <View
          style={[
            s.numara,
            { backgroundColor: numaraRengi },
            satir.vurgu && { backgroundColor: renk.vurgu },
            satir.tamam && { backgroundColor: renk.basari },
            satir.atlandi && { backgroundColor: renk.ayrac },
          ]}>
          {satir.tamam ? (
            <Ikon ad="tik" boyut={14} renk={renk.zemin} kalinlik={2.8} />
          ) : (
            <Text style={[s.numaraMetin, { color: satir.vurgu ? renk.metin : gunUstuMetin(numaraRengi) }]}>{satir.numara ?? '–'}</Text>
          )}
        </View>
        {/* #55 §C8–9: ad en fazla 2 satır (kesilmez), altında "Kategori · süre · 10:51'e kadar". */}
        <View style={s.adKutu}>
          <Text style={[s.ad, satir.atlandi && s.cizili]} numberOfLines={2}>
            {satir.ad}
          </Text>
          <Text style={s.alt} numberOfLines={1}>
            {satir.alt}
          </Text>
        </View>
      </Pressable>
      <View {...tutamac?.panHandlers} accessibilityRole="adjustable" accessibilityLabel={t('program.surukle')} style={s.tutamac} hitSlop={6}>
        <Ikon ad="tutamac" boyut={20} renk="#b4bbd3" kalinlik={2.4} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // #140 (kanvas 11): bacak hapı saat sütununun sağında (56 px), 30 px; yürüme beyaz + Çizgi kenar, araba Gece dolu.
  ara: { height: ARA_YUKSEKLIK, flexDirection: 'row', alignItems: 'center', paddingLeft: 56 },
  araHap: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingLeft: 6, paddingRight: 10, borderRadius: 999, borderWidth: 1.5, borderColor: renk.ayrac, backgroundColor: renk.zemin },
  araHapAraba: { backgroundColor: renk.ana, borderColor: renk.ana },
  araMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
  araAcik: { paddingLeft: 56, paddingBottom: 6 },
  boslukKap: { paddingLeft: 56, paddingBottom: 6 },
  bosluk: { alignSelf: 'flex-start', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, borderRadius: kose.rozet, backgroundColor: '#fff6e6', fontFamily: yazi.ekstra, fontSize: 12, color: '#8a5a00' },
  satir: { minHeight: DURAK_EN_AZ, flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: renk.zemin },
  satirIc: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  saat: { width: 44, fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  adKutu: { flex: 1, minWidth: 0, gap: 1 },
  numara: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  numaraMetin: { fontFamily: yazi.ekstra, fontSize: 13 },
  ad: { fontFamily: yazi.ekstra, fontSize: 15, lineHeight: 19, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 15, color: renk.ikincil },
  cizili: { textDecorationLine: 'line-through', color: renk.soluk },
  tutamac: { width: 40, minHeight: DURAK_EN_AZ, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  tutulan: {
    zIndex: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: renk.vurgu,
    backgroundColor: renk.zemin,
    shadowColor: renk.metin,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  birakmaCizgisi: { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 1.5, backgroundColor: renk.vurgu },
});
