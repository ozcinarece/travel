// #183 KK7: gezi bitti hatırlatması (uygulama içi). Son günün akşamı 20:00'den (seyahat saat dilimi) sonra, açık borcu ya da
// alacağı olan kişiye Gezi ve Harcamalar sayfasında "Kim kime ne borçlu" satırı; borçluya alacaklının IBAN'ı (eklediyse) yazılır.
// Yerel bildirim expo-notifications ister (yerel modül → yeni build); o gelene kadar bu satır bildirimin yerini tutar.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ibanBicimle, sayiBicimi, type HarcamaOzeti } from '@/features/harcama/hesap';
import type { Kisiler } from '@/features/harcama/metin';
import { yonelmeEki } from '@/features/davet/katilim';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

export function HatirlatmaSatiri({ ozet, k, ibanlar, onBakiyeler }: { ozet: HarcamaOzeti; k: Kisiler; ibanlar: Map<string, string> | undefined; onBakiyeler: () => void }) {
  if (ozet.karsilar.length === 0) return null;
  const borclu = ozet.benimNet < 0;
  const satir = ozet.karsilar.map((x) => (borclu ? `${yonelmeEki(k.ad(x.id))} ${sayiBicimi(x.tutar)} ₺` : `${k.ad(x.id)} ${sayiBicimi(x.tutar)} ₺`)).join(' · ');
  const iban = borclu && ozet.karsilar.length === 1 ? ibanlar?.get(ozet.karsilar[0].id) : undefined;
  return (
    <View style={s.kap}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={s.baslik}>{t('harcama.hatirlatma.baslik')}</Text>
        <Text style={s.metin}>{borclu ? t('harcama.hatirlatma.borcun', { liste: satir }) : t('harcama.hatirlatma.alacagin', { liste: satir })}</Text>
        {iban ? (
          <Text style={s.iban} selectable>
            {t('harcama.hatirlatma.iban', { iban: ibanBicimle(iban) })}
          </Text>
        ) : null}
      </View>
      <Pressable accessibilityRole="button" onPress={onBakiyeler} hitSlop={6} style={({ pressed }) => [s.dugme, pressed && { opacity: 0.85 }]}>
        <Text style={s.dugmeMetin}>{t('harcama.bakiyeler')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingRight: 12, paddingLeft: 14, borderRadius: 14, backgroundColor: renk.zemin, borderLeftWidth: 3, borderLeftColor: renk.vurgu },
  baslik: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  metin: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.ikincil },
  iban: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  dugme: { height: 32, paddingHorizontal: 12, borderRadius: 10, backgroundColor: renk.yuzey, justifyContent: 'center' },
  dugmeMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
});
