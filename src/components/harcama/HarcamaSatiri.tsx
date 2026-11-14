// #183 KK2 (kanvas 25): harcama satırı — 40 px kategori kutusu, açıklama, "X ödedi · bölüşüm özeti", sağda tutar ve "payın";
// döviz harcamasında tutarın altında orijinal tutar.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { paraMetni, type Harcama } from '@/features/harcama/hesap';
import { harcamaBasligi, satirAltMetni, type Kisiler } from '@/features/harcama/metin';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

import { KATEGORI_GORUNUMU } from './kategori';

export function KategoriKutusu({ kategori, boyut = 40 }: { kategori: Harcama['kategori']; boyut?: number }) {
  const g = KATEGORI_GORUNUMU[kategori];
  return (
    <View style={[s.kutu, { width: boyut, height: boyut, borderRadius: Math.round(boyut * 0.3), backgroundColor: g.zemin }]}>
      <Ikon ad={g.ikon} boyut={Math.round(boyut * 0.45)} renk={g.renk} kalinlik={2.3} />
    </View>
  );
}

export function HarcamaSatiri({ h, benId, k, onPress }: { h: Harcama; benId: string | null; k: Kisiler; onPress: () => void }) {
  const benim = h.harcama_paylari.find((p) => p.user_id === benId)?.pay_kurus ?? 0;
  const doviz = h.para_birimi !== 'TRY';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.satir, pressed && { opacity: 0.85 }]}>
      <KategoriKutusu kategori={h.kategori} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.ad} numberOfLines={1}>
          {harcamaBasligi(h)}
        </Text>
        <Text style={s.alt} numberOfLines={1}>
          {satirAltMetni(h, benId, k)}
        </Text>
      </View>
      <View style={s.sag}>
        <Text style={s.tutar}>{paraMetni(h.tl_kurus)}</Text>
        <Text style={s.alt}>{doviz ? paraMetni(h.tutar_kurus, h.para_birimi) : benim ? t('harcama.payin', { tutar: paraMetni(benim) }) : t('harcama.payinYok')}</Text>
        {doviz ? <Text style={s.alt}>{benim ? t('harcama.payin', { tutar: paraMetni(benim) }) : t('harcama.payinYok')}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  kutu: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: renk.zemin },
  ad: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  sag: { alignItems: 'flex-end', flexShrink: 0 },
  tutar: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
});
