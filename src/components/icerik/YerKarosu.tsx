// #97 A KK5–7 (kanvas Home13): gezilecek yer karosu — foto mozaiği (150/190 px dönüşümlü), ad + şehir + ★ puan · yorum,
// sağ üstte beyaz "+" (listede ise ✓). Foto yoksa kategori renginde düz zemin.
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { kategoriPini, yorumKisa } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import { renk, yazi } from '@/theme';

type Props = {
  ad: string;
  sehir: string | null;
  kategori: string | null;
  fotoUri: string | null;
  puan: number | null;
  yorum: number | null;
  yukseklik: 150 | 190;
  listede: boolean;
  mesgul?: boolean;
  onEkle: () => void;
  onAc: () => void;
};

export function YerKarosu({ ad, sehir, kategori, fotoUri, puan, yorum, yukseklik, listede, mesgul, onEkle, onAc }: Props) {
  const p = puanMetni(puan);
  const y = yorumKisa(yorum);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={ad} onPress={onAc} style={({ pressed }) => [s.karo, { height: yukseklik, backgroundColor: kategoriPini(kategori).kategoriRenk }, pressed && { opacity: 0.9 }]}>
      {fotoUri ? <Image source={{ uri: fotoUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
      <View style={s.golgelik} />
      <Pressable accessibilityRole="button" accessibilityLabel={listede ? t('anasayfa.listede') : t('anasayfa.ekle')} disabled={listede || !!mesgul} onPress={onEkle} hitSlop={6} style={s.arti}>
        {mesgul ? <ActivityIndicator color={renk.metin} /> : listede ? <Ikon ad="tik" boyut={14} renk={renk.metin} kalinlik={2.6} /> : <Text style={s.artiMetin}>+</Text>}
      </Pressable>
      <View style={s.metinler}>
        <Text style={s.ad} numberOfLines={2}>
          {ad}
        </Text>
        <Text style={s.alt} numberOfLines={1}>
          {[sehir, p ? `★ ${p}${y ? ` · ${y}` : ''}` : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  karo: { borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end' },
  golgelik: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,15,15,0.22)' },
  arti: { position: 'absolute', right: 10, top: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  artiMetin: { fontFamily: yazi.kalin, fontSize: 18, lineHeight: 20, color: renk.metin },
  metinler: { padding: 12, gap: 2 },
  ad: { fontFamily: yazi.ekstra, fontSize: 14, lineHeight: 18, color: renk.zemin },
  alt: { fontFamily: yazi.normal, fontSize: 11, color: 'rgba(255,255,255,0.85)' },
});
