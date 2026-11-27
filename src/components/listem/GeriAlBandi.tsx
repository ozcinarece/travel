// #141 KK4 → #387 KK1 · KK4 (kanvas 21, Listem "Çıkar · Geri al"): ekranın altında Gece bant; metin ve Mandalina "Geri al".
// `onGeriAl` yoksa yalnız bilgi bandı (dokunulmaz). Ekran okuyucu: iki platformda da `announceForAccessibility` (#387 inceleme:
// Android'de `accessibilityLiveRegion` yeni açılan görünümde çoğu zaman okunmuyordu; çift okunmasın diye canlı bölge kalktı).
// #410 inceleme: `olay` (ör. bekleyen silme nesnesi) değişince aynı metin de yeniden duyurulur; art arda iki çıkarma iki duyuru.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { useOlayDuyurusu } from '@/lib/duyuru';
import { renk, seyahatV7, yazi } from '@/theme';

type Props = {
  metin: string;
  onGeriAl?: () => void;
  alt?: number;
  olay?: unknown;
  /**
   * #579 KK3 (kanvas `Dalga1_BuguneEkle`): gezi sırasında "bugüne eklendi" bildirimi — 52 pt, 14 pt yarı kalın metin, "Geri al"
   * dolu düğme değil açık Mandalina yazı düğmesi (44 pt).
   */
  yazili?: boolean;
  /**
   * #579 inceleme 3 (yalnız `yazili`): metnin kısaltılabilen baş kısmı (yer adı). Uzun adda yalnız o kesilir, ek ("bugüne
   * eklendi") sabit kalır.
   */
  kesilen?: string;
};

export function GeriAlBandi({ metin, onGeriAl, alt = 16, olay, yazili, kesilen }: Props) {
  const duyuru = onGeriAl ? `${metin}. ${t('listem.geriAl')}` : metin;
  useOlayDuyurusu(duyuru, olay);
  return (
    <View style={[s.bant, yazili && s.bantYazili, { bottom: alt }]} pointerEvents={onGeriAl ? 'auto' : 'none'} testID="geri-al-bandi">
      {yazili && kesilen && metin.startsWith(kesilen) ? (
        <View style={s.parcali} accessible accessibilityLabel={metin}>
          <Text style={[s.metin, s.metinYazili, s.kesilen]} numberOfLines={1}>
            {kesilen}
          </Text>
          <Text style={[s.metin, s.metinYazili, s.sabit]} numberOfLines={1}>
            {metin.slice(kesilen.length)}
          </Text>
        </View>
      ) : (
        <Text style={[s.metin, yazili && s.metinYazili]} numberOfLines={onGeriAl ? 1 : undefined}>
          {metin}
        </Text>
      )}
      {onGeriAl ? (
        <Pressable accessibilityRole="button" onPress={onGeriAl} hitSlop={yazili ? 4 : 8} style={yazili ? s.dugmeYazili : s.dugme}>
          <Text style={yazili ? s.dugmeYaziliMetin : s.dugmeMetin}>{t('listem.geriAl')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  bant: { position: 'absolute', left: 16, right: 16, minHeight: 48, paddingLeft: 16, paddingRight: 8, borderRadius: 14, backgroundColor: renk.ana, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: renk.metin, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  metin: { flex: 1, fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin, paddingVertical: 12 },
  dugme: { height: 34, paddingHorizontal: 12, borderRadius: 10, backgroundColor: renk.vurgu, justifyContent: 'center' },
  dugmeMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  // #579 (kanvas `Dalga1_BuguneEkle`): min 52, sol 16 / sağ 6, gölge 0 6 18 %24.
  bantYazili: { minHeight: 52, paddingRight: 6, shadowRadius: 18, shadowOpacity: 0.24 },
  metinYazili: { fontFamily: yazi.yari, fontSize: 14, paddingVertical: 14 },
  parcali: { flex: 1, flexDirection: 'row', minWidth: 0 },
  kesilen: { flex: 0, flexShrink: 1 },
  sabit: { flex: 0, flexShrink: 0 },
  dugmeYazili: { height: 44, paddingHorizontal: 12, justifyContent: 'center' },
  dugmeYaziliMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: seyahatV7.geriAl },
});
