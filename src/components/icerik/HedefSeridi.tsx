// #589 (#587 küçükleri): "Seyahatime al" → HANGİ SEYAHATE? çip şeridi. SeyahatimeAl.tsx'ten ayrıldı; görünüm aynı (kanvas 19).
// KK1: açılışta seçili çip görünür alana kaydırılır ("Yeni seyahat" seçiliyse şeridin sonuna); çiplerin sırası değişmez.
// KK2: her hedef çipin açık ekran okuyucu etiketi var; "·" ayırıcıları okunmaz.
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, type LayoutChangeEvent } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { hedefCipEtiketi, SERIT_KENAR, seritKaydirma, type SeritOlcusu } from '@/features/icerik/hedefSeridi';
import { farkliSehir } from '@/features/icerik/yerEkle';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { tarihAraligi } from '@/lib/takvim';
import type { SeyahatOzet } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

type Props = {
  seyahatler: SeyahatOzet[];
  /** Seçili seyahat; null → "Yeni seyahat". */
  hedefId: string | null;
  /** İçeriğin şehri ("Farklı şehir" eki için). */
  sehirAdi: string | null | undefined;
  onSec: (id: string | null) => void;
};

export function HedefSeridi({ seyahatler, hedefId, sehirAdi, onSec }: Props) {
  const ref = useRef<ScrollView>(null);
  // Yalnız açılışta bir kez kaydırılır; kullanıcı çipe dokunduktan ya da kaydırdıktan sonra şerit kendi kendine oynamaz.
  const bitti = useRef(false);
  const olcu = useRef<SeritOlcusu>({ genislik: null, cip: null, icerikHazir: false });

  const dene = () => {
    if (bitti.current) return;
    const k = seritKaydirma(hedefId == null, olcu.current);
    if (k.tur === 'bekle') return;
    bitti.current = true;
    if (k.tur === 'son') ref.current?.scrollToEnd({ animated: false });
    else if (k.tur === 'x') ref.current?.scrollTo({ x: k.x, animated: false });
  };
  const sec = (id: string | null) => {
    bitti.current = true;
    onSec(id);
  };

  return (
    <ScrollView
      ref={ref}
      testID="hedef-seridi"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.cipler}
      style={s.ciplerSerit}
      onScrollBeginDrag={() => {
        bitti.current = true;
      }}
      onLayout={(e: LayoutChangeEvent) => {
        olcu.current.genislik = e.nativeEvent.layout.width;
        dene();
      }}
      onContentSizeChange={() => {
        olcu.current.icerikHazir = true;
        dene();
      }}>
      {seyahatler.map((sy) => {
        const secili = hedefId === sy.id;
        const tarih = sy.start_date && sy.end_date ? tarihAraligi(sy.start_date, sy.end_date) : null;
        const farkli = farkliSehir(sy, sehirAdi);
        return (
          <Pressable
            key={sy.id}
            accessibilityRole="button"
            accessibilityLabel={hedefCipEtiketi(seyahatAdi(sy), tarih, farkli)}
            accessibilityState={{ selected: secili }}
            onPress={() => sec(sy.id)}
            onLayout={
              secili
                ? (e: LayoutChangeEvent) => {
                    olcu.current.cip = { x: e.nativeEvent.layout.x, genislik: e.nativeEvent.layout.width };
                    dene();
                  }
                : undefined
            }
            style={[s.cip, secili && s.cipSecili]}>
            {/* #587 inceleme: ad ve tarih kısalır, "Farklı şehir" kesilmez. */}
            <Text style={[s.cipMetin, s.cipAd, secili && s.cipMetinSecili]} numberOfLines={1}>
              {`${seyahatAdi(sy)}${tarih ? ` · ${tarih}` : ''}`}
            </Text>
            {farkli ? (
              <Text testID="farkli-sehir" style={[s.cipMetin, s.cipEk, secili && s.cipMetinSecili]} numberOfLines={1}>
                {` · ${t('gezi.farkliSehir')}`}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      <Pressable accessibilityRole="button" accessibilityState={{ selected: hedefId == null }} onPress={() => sec(null)} style={[s.cip, s.cipYeni, hedefId == null && s.cipSecili]}>
        <Ikon ad="arti" boyut={14} renk={hedefId == null ? renk.zemin : renk.ana} kalinlik={3} />
        <Text style={[s.cipMetin, hedefId == null && s.cipMetinSecili]}>{t('gezi.yeniSeyahat')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  ciplerSerit: { marginHorizontal: -SERIT_KENAR, flexGrow: 0 },
  cipler: { gap: 8, paddingHorizontal: SERIT_KENAR },
  cip: { height: 44, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1.5, borderColor: renk.ayrac, backgroundColor: renk.zemin, flexDirection: 'row', alignItems: 'center', maxWidth: 280 },
  cipAd: { flexShrink: 1 },
  cipEk: { flexShrink: 0 },
  cipYeni: { gap: 5 },
  cipSecili: { backgroundColor: renk.ana, borderColor: renk.ana },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  cipMetinSecili: { color: renk.zemin },
});
