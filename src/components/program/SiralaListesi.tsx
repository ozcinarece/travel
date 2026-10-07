import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, type PanResponderInstance } from 'react-native';

import { Ikon, type IkonAdi } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

/** #53 §5: yarı açık paneldeki satır (durak). */
export type SiralaSatiri = {
  id: string;
  ad: string;
  ikon: IkonAdi;
  ikonRenk: string;
  /** "1 sa 30 dk" */
  sure: string;
  /** Sıra numarası (atlananda null). */
  numara: number | null;
  tamam?: boolean;
  atlandi?: boolean;
  /** Önceki noktadan bacak: "12 dk" + ikon; yoksa satır boş kalır. */
  bacak?: { metin: string; ikon: 'yurume' | 'taksi' };
};

/** Durak satırı 44 px + üstündeki yürüyüş satırı 16 px = bir yuva. */
export const DURAK_YUKSEKLIK = 44;
export const ARA_YUKSEKLIK = 16;
export const YUVA = DURAK_YUKSEKLIK + ARA_YUKSEKLIK;
const BAS_YUKSEKLIK = 32;
/** Kenara bu kadar yaklaşınca liste kendiliğinden kayar. */
const KENAR_PAYI = 48;
const KAYMA_HIZI = 7;

/** Sürüklenen satırın bırakılacağı sıra (0..n-1): başlangıç + yuva cinsinden kayma, sınırlı. */
export function hedefSira(baslangic: number, kayma: number, adet: number): number {
  return Math.max(0, Math.min(adet - 1, baslangic + Math.round(kayma / YUVA)));
}

/** Bırakma çizgisinin listedeki y'si: yukarı taşırken hedefin üstü, aşağı taşırken altı. */
export function birakmaCizgisiY(baslangic: number, hedef: number): number {
  const yuva = hedef > baslangic ? hedef + 1 : hedef;
  return BAS_YUKSEKLIK + yuva * YUVA + ARA_YUKSEKLIK / 2 - 1.5;
}

type Props = {
  satirlar: SiralaSatiri[];
  /** "Otel · 09:00" */
  basSatiri: string;
  basIkon: IkonAdi;
  yukseklik: number;
  onTasi: (from: number, to: number) => void;
  onSatirBas: (id: string) => void;
};

/**
 * #53 §5 yarı açık panel listesi: "Otel · 09:00", sonra 44 px durak satırları (numara · kategori ikonu · ad · süre · ≡),
 * aralarda 16 px yürüyüş satırı. Sürükleme yalnız ≡'den: tutulan satır kalkar (turuncu kenar, gölge), bırakılacak yer
 * turuncu 3 px çizgi; kenara yaklaşınca liste kendiliğinden kayar.
 */
export function SiralaListesi({ satirlar, basSatiri, basIkon, yukseklik, onTasi, onSatirBas }: Props) {
  const [surukle, setSurukle] = useState<{ index: number; hedef: number } | null>(null);
  const [kayma] = useState(() => new Animated.Value(0));
  const kaydirici = useRef<ScrollView>(null);
  const kabRef = useRef<View>(null);
  const durum = useRef({ kaydirY: 0, baslangicKaydir: 0, dy: 0, pageY: 0, kabUst: 0, kabAlt: 0, index: -1, hedef: -1, hiz: 0 });
  const zamanlayici = useRef<ReturnType<typeof setInterval> | null>(null);

  const guncelle = () => {
    const d = durum.current;
    if (d.index < 0) return;
    const etkin = d.dy + (d.kaydirY - d.baslangicKaydir);
    kayma.setValue(etkin);
    const hedef = hedefSira(d.index, etkin, satirlar.length);
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
      const enFazla = Math.max(0, BAS_YUKSEKLIK + satirlar.length * YUVA + 8 - yukseklik);
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
        }}
        contentContainerStyle={{ paddingBottom: 8 }}>
        <View style={s.basSatir}>
          <Ikon ad={basIkon} boyut={16} renk={renk.ikincil} kalinlik={2.2} />
          <Text style={s.basMetin}>{basSatiri}</Text>
        </View>
        {satirlar.map((x, i) => {
          const tutulan = surukle?.index === i;
          return (
            // Tutulan satır sonraki kardeşlerin üstünde çizilsin (zIndex dış kapta).
            <View key={x.id} style={tutulan ? { zIndex: 10, elevation: 10 } : undefined}>
              <View style={s.ara}>
                {x.bacak && !tutulan ? (
                  <>
                    <Ikon ad={x.bacak.ikon} boyut={11} renk={renk.ikincil} kalinlik={2.2} />
                    <Text style={s.araMetin}>{x.bacak.metin}</Text>
                  </>
                ) : null}
              </View>
              <Animated.View style={[tutulan && [s.tutulan, { transform: [{ translateY: kayma }] }]]}>
                <SiraSatiri satir={x} tutamac={tutamaclar[i]} onBas={() => onSatirBas(x.id)} />
              </Animated.View>
            </View>
          );
        })}
        {surukle && surukle.hedef !== surukle.index ? <View pointerEvents="none" style={[s.birakmaCizgisi, { top: birakmaCizgisiY(surukle.index, surukle.hedef) }]} /> : null}
      </ScrollView>
    </View>
  );
}

function SiraSatiri({ satir, tutamac, onBas }: { satir: SiralaSatiri; tutamac: PanResponderInstance | undefined; onBas: () => void }) {
  return (
    <View style={s.satir}>
      <Pressable accessibilityRole="button" onPress={onBas} style={s.satirIc}>
        <View style={[s.numara, satir.tamam && { backgroundColor: renk.basari }, satir.atlandi && { backgroundColor: renk.ayrac }]}>
          {satir.tamam ? <Ikon ad="tik" boyut={14} renk={renk.zemin} kalinlik={2.6} /> : <Text style={s.numaraMetin}>{satir.numara ?? '–'}</Text>}
        </View>
        <Ikon ad={satir.ikon} boyut={18} renk={satir.ikonRenk} kalinlik={2.1} />
        <Text style={[s.ad, satir.atlandi && s.cizili]} numberOfLines={1}>
          {satir.ad}
        </Text>
        <Text style={s.sure}>{satir.sure}</Text>
      </Pressable>
      <View {...tutamac?.panHandlers} accessibilityRole="adjustable" accessibilityLabel={t('program.surukle')} style={s.tutamac} hitSlop={6}>
        <Ikon ad="tutamac" boyut={20} renk={renk.ikincil} kalinlik={2.2} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  basSatir: { height: BAS_YUKSEKLIK, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6 },
  basMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.ikincil },
  ara: { height: ARA_YUKSEKLIK, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 48 },
  araMetin: { fontFamily: yazi.normal, fontSize: 11, lineHeight: 14, color: renk.ikincil },
  satir: { height: DURAK_YUKSEKLIK, flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: renk.zemin },
  satirIc: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 4, height: '100%' },
  numara: { width: 28, height: 28, borderRadius: 14, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  numaraMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.zemin },
  ad: { flex: 1, minWidth: 0, fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  cizili: { textDecorationLine: 'line-through', color: renk.soluk },
  sure: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  tutamac: { width: 44, height: DURAK_YUKSEKLIK, alignItems: 'center', justifyContent: 'center' },
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
