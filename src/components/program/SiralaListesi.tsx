import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, type PanResponderInstance } from 'react-native';

import { useSayfaKaydirma } from '@/components/harita/AltSayfa';
import { Ikon, type IkonAdi } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

/** #53 §5: yarı açık paneldeki satır (durak). */
export type SiralaSatiri = {
  id: string;
  ad: string;
  ikon: IkonAdi;
  ikonRenk: string;
  /** #55 §C9: adın altında "09:00 – 09:45 · 45 dk". */
  saat: string;
  /** Sıra numarası (atlananda null). */
  numara: number | null;
  tamam?: boolean;
  atlandi?: boolean;
  /** Önceki noktadan bacak: "12 dk" + ikon; yoksa satır boş kalır. */
  bacak?: { metin: string; ikon: 'yurume' | 'taksi' };
};

/** #55 §C8: durak satırı en az 44 px (ad 2 satıra kadar); üstündeki yürüyüş satırı 16 px. */
export const DURAK_EN_AZ = 44;
export const ARA_YUKSEKLIK = 16;
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
  yukseklik: number;
  onTasi: (from: number, to: number) => void;
  onSatirBas: (id: string) => void;
  /** #55 §C10: satıra (≡ dışında) uzun basma. */
  onUzunBas?: (id: string) => void;
  /** #55 §D11: numara dairesi gün renginde. */
  numaraRengi?: string;
};

/**
 * #53 §5 / #55 §C yarı açık panel listesi: "Başlangıç · 09:00", sonra en az 44 px durak satırları (numara · kategori
 * ikonu · ad [2 satır] + "09:00 – 09:45 · 45 dk" · ≡), aralarda 16 px yürüyüş satırı. Satıra uzun bas → menü. Sürükleme yalnız ≡'den: tutulan satır kalkar (turuncu kenar, gölge), bırakılacak yer
 * turuncu 3 px çizgi; kenara yaklaşınca liste kendiliğinden kayar.
 */
export function SiralaListesi({ satirlar, bas, son, yukseklik, onTasi, onSatirBas, onUzunBas, numaraRengi = renk.metin }: Props) {
  const [surukle, setSurukle] = useState<{ index: number; hedef: number } | null>(null);
  // Satır yükseklikleri içeriğe göre (ad 2 satır) — yuvalar ölçülür.
  const [yuvalar, setYuvalar] = useState<Yuva[]>([]);
  const sayfaKaydirma = useSayfaKaydirma();
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
      <ScrollView
        ref={kaydirici}
        scrollEnabled={!surukle}
        scrollEventThrottle={16}
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
              <View style={s.ara}>
                {x.bacak && !tutulan ? (
                  <>
                    <Ikon ad={x.bacak.ikon} boyut={11} renk={renk.ikincil} kalinlik={2.2} />
                    <Text style={s.araMetin}>{x.bacak.metin}</Text>
                  </>
                ) : null}
              </View>
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
        {surukle && surukle.hedef !== surukle.index ? <View pointerEvents="none" style={[s.birakmaCizgisi, { top: birakmaCizgisiY(surukle.index, surukle.hedef, yuvalar) }]} /> : null}
      </ScrollView>
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
        <View style={[s.numara, { backgroundColor: numaraRengi }, satir.tamam && { backgroundColor: renk.basari }, satir.atlandi && { backgroundColor: renk.ayrac }]}>
          {satir.tamam ? <Ikon ad="tik" boyut={14} renk={renk.zemin} kalinlik={2.6} /> : <Text style={s.numaraMetin}>{satir.numara ?? '–'}</Text>}
        </View>
        <Ikon ad={satir.ikon} boyut={18} renk={satir.ikonRenk} kalinlik={2.1} />
        {/* #55 §C8–9: ad en fazla 2 satır (kesilmez), altında saat aralığı + süre. */}
        <View style={s.adKutu}>
          <Text style={[s.ad, satir.atlandi && s.cizili]} numberOfLines={2}>
            {satir.ad}
          </Text>
          <Text style={s.saat} numberOfLines={1}>
            {satir.saat}
          </Text>
        </View>
      </Pressable>
      <View {...tutamac?.panHandlers} accessibilityRole="adjustable" accessibilityLabel={t('program.surukle')} style={s.tutamac} hitSlop={6}>
        <Ikon ad="tutamac" boyut={20} renk={renk.ikincil} kalinlik={2.2} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ara: { height: ARA_YUKSEKLIK, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 48 },
  araMetin: { fontFamily: yazi.normal, fontSize: 11, lineHeight: 14, color: renk.ikincil },
  satir: { minHeight: DURAK_EN_AZ, flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: renk.zemin },
  satirIc: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 4, paddingVertical: 4 },
  adKutu: { flex: 1, minWidth: 0 },
  numara: { width: 28, height: 28, borderRadius: 14, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  numaraMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.zemin },
  ad: { fontFamily: yazi.kalin, fontSize: 14, lineHeight: 18, color: renk.metin },
  saat: { fontFamily: yazi.normal, fontSize: 11, lineHeight: 14, color: renk.ikincil },
  cizili: { textDecorationLine: 'line-through', color: renk.soluk },
  tutamac: { width: 44, minHeight: DURAK_EN_AZ, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
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
