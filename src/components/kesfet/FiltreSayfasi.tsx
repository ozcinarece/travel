import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ikon } from '@/components/ui/Ikon';
import { BOS_FILTRE, KATEGORILER, kategoriDegistir, PUAN_ESIKLERI, YORUM_ESIKLERI, type Filtre, type PuanEsigi, type YorumEsigi } from '@/features/yerler/filtre';
import { t } from '@/i18n';
import { KATEGORI_PIN, type PinKategorisi } from '@/lib/pinIkonu';
import { renk, yazi } from '@/theme';

type Props = {
  acik: boolean;
  filtre: Filtre;
  /** Hızlı filtrelerle aynı durum (#69 KK9): her dokunuş anında uygulanır. */
  onFiltre: (f: Filtre) => void;
  /** "N mekanı göster" canlı sayısı. */
  sayi: number;
  onKapat: () => void;
};

/**
 * #69 §C (kanvas KesfetFilter8): filtre alt sayfası — Göster (Hepsi / ★ Öne çıkanlar) · Kategori (8, çoklu, kategori renginde
 * dolu çip + ikon) · Puan (Hepsi / 4,0+ / 4,5+) · Yorum sayısı (Hepsi / 500+ / 1K+ / 5K+); altta "N mekanı göster", üstte Temizle.
 * "Şimdi açık" filtresi yok.
 */
export function FiltreSayfasi({ acik, filtre, onFiltre, sayi, onKapat }: Props) {
  const kenar = useSafeAreaInsets();
  const puanMetni = (p: PuanEsigi) => (p === 0 ? t('kesfet.filtre.hepsi') : t('kesfet.filtre.puanArti', { p: p === 4 ? '4,0' : '4,5' }));
  const yorumMetni = (y: YorumEsigi) => (y === 0 ? t('kesfet.filtre.hepsi') : t('kesfet.filtre.yorumArti', { n: y >= 1000 ? `${y / 1000}K` : String(y) }));
  return (
    <Modal visible={acik} transparent animationType="slide" onRequestClose={onKapat}>
      <View style={s.perde}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onKapat} accessibilityLabel={t('kesfet.filtre.kapat')} />
        <View style={[s.sayfa, { paddingBottom: Math.max(kenar.bottom, 16) }]}>
          <View style={s.tutamac} />
          <View style={s.baslikSatir}>
            <Text style={s.baslik}>{t('kesfet.filtre.baslik')}</Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => onFiltre(BOS_FILTRE)}>
              <Text style={s.temizle}>{t('kesfet.filtre.temizle')}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.govde} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Bolum baslik={t('kesfet.filtre.goster')} not={t('kesfet.filtre.oneCikanNot')}>
              <Hap metin={t('kesfet.filtre.hepsi')} secili={!filtre.oneCikan} onPress={() => onFiltre({ ...filtre, oneCikan: false })} />
              <Hap metin={`★ ${t('kesfet.filtre.oneCikanlar')}`} secili={filtre.oneCikan} onPress={() => onFiltre({ ...filtre, oneCikan: true })} />
            </Bolum>
            <Bolum baslik={t('kesfet.filtre.kategori')}>
              {KATEGORILER.map((k) => (
                <KategoriHapi key={k} kategori={k} secili={filtre.kategoriler.includes(k)} onPress={() => onFiltre(kategoriDegistir(filtre, k))} />
              ))}
            </Bolum>
            <Bolum baslik={t('kesfet.filtre.puan')} not={t('kesfet.filtre.puanNot')}>
              {PUAN_ESIKLERI.map((p) => (
                <Hap key={p} metin={puanMetni(p)} secili={filtre.puan === p} onPress={() => onFiltre({ ...filtre, puan: p })} />
              ))}
            </Bolum>
            <Bolum baslik={t('kesfet.filtre.yorum')}>
              {YORUM_ESIKLERI.map((y) => (
                <Hap key={y} metin={yorumMetni(y)} secili={filtre.yorum === y} onPress={() => onFiltre({ ...filtre, yorum: y })} />
              ))}
            </Bolum>
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onKapat} style={({ pressed }) => [s.goster, pressed && { opacity: 0.85 }]}>
            <Text style={s.gosterMetin}>{t('kesfet.filtre.goster_n', { n: sayi })}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Bolum({ baslik, not, children }: { baslik: string; not?: string; children: ReactNode }) {
  return (
    <View style={s.bolum}>
      <Text style={s.bolumBaslik}>{baslik}</Text>
      <View style={s.haplar}>{children}</View>
      {not ? <Text style={s.not}>{not}</Text> : null}
    </View>
  );
}

function Hap({ metin, secili, onPress }: { metin: string; secili: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: secili }} onPress={onPress} hitSlop={4} style={[s.hap, secili && s.hapSecili]}>
      <Text style={[s.hapMetin, secili && s.hapMetinSecili]}>{metin}</Text>
    </Pressable>
  );
}

/** Kategori çipi: seçiliyken kategori renginde dolu, beyaz ikon dairesi %20; değilken gri yüzey + beyaz ikon dairesi. */
function KategoriHapi({ kategori, secili, onPress }: { kategori: PinKategorisi; secili: boolean; onPress: () => void }) {
  const k = KATEGORI_PIN[kategori];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: secili }}
      onPress={onPress}
      hitSlop={4}
      style={[s.hap, s.kategoriHap, secili && { backgroundColor: k.renk }]}>
      <View style={[s.kategoriIkon, secili && s.kategoriIkonSecili]}>
        <Ikon ad={k.ikon} boyut={12} renk={secili ? renk.zemin : k.renk} kalinlik={2.4} />
      </View>
      <Text style={[s.hapMetin, secili && s.hapMetinSecili]}>{t(`kesfet.filtre.kategoriler.${kategori}`)}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(15,15,15,0.25)', justifyContent: 'flex-end' },
  sayfa: { maxHeight: '86%', backgroundColor: renk.zemin, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8, paddingHorizontal: 20, gap: 18, shadowColor: renk.metin, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 12 },
  tutamac: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0' },
  baslikSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baslik: { fontFamily: yazi.ekstra, fontSize: 20, letterSpacing: -0.4, color: renk.metin },
  temizle: { fontFamily: yazi.kalin, fontSize: 13, color: renk.ikincil, paddingVertical: 6 },
  govde: { gap: 18, paddingBottom: 6 },
  bolum: { gap: 8 },
  bolumBaslik: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  haplar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  not: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  hap: { height: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  hapSecili: { backgroundColor: renk.metin },
  hapMetin: { fontFamily: yazi.kalin, fontSize: 12.5, color: renk.metin },
  hapMetinSecili: { color: renk.zemin },
  kategoriHap: { paddingLeft: 6 },
  kategoriIkon: { width: 22, height: 22, borderRadius: 11, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  kategoriIkonSecili: { backgroundColor: 'rgba(255,255,255,0.2)' },
  goster: { height: 52, borderRadius: 999, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  gosterMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.zemin },
});
