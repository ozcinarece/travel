// #97 B KK2 (kanvas Home13 ekran 3): plan sayfası — gün çipleri, seçili günün mini haritası, numaralı duraklar
// (foto 44 px, ad, kategori · süre, "+"). Altta "Geziyi seyahatime al" (ekran verir).
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EkleDugmesi } from '@/components/ui/EkleDugmesi';
import type { IcerikCanli } from '@/features/icerik/fotolar';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni } from '@/lib/kategori';
import { kategoriPini } from '@/lib/pinIkonu';
import type { GeziDetay, GeziDuragi } from '@/lib/tipler';
import { gunRengi, gunUstuMetin, minDokunma, renk, yazi } from '@/theme';

import { MiniHarita } from './MiniHarita';

type Props = { gezi: GeziDetay; canli: Map<string, IcerikCanli> | undefined; onDurakEkle: (d: GeziDuragi) => void; listede: (d: GeziDuragi) => boolean; mesgulId: string | null };

export function GeziPlani({ gezi, canli, onDurakEkle, listede, mesgulId }: Props) {
  const [gunSira, setGunSira] = useState(0);
  const gun = gezi.gezi_gunleri[gunSira] ?? gezi.gezi_gunleri[0];
  if (!gun) return null;
  const rengi = gunRengi(gun.sira);
  return (
    <View style={s.kap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cipler}>
        {gezi.gezi_gunleri.map((g, i) => (
          <Pressable key={g.id} accessibilityRole="button" accessibilityState={{ selected: i === gunSira }} onPress={() => setGunSira(i)} style={[s.cip, i === gunSira && s.cipSecili]}>
            <View style={[s.cipNokta, { backgroundColor: gunRengi(g.sira) }]} />
            <Text style={[s.cipMetin, i === gunSira && s.cipMetinSecili]}>{`${t('gezi.gunCip', { n: g.sira })}${g.baslik ? ` · ${g.baslik}` : ''}`}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <MiniHarita duraklar={gun.gezi_duraklari} gunIndex={gun.sira} baslik={`${t('gezi.gunCip', { n: gun.sira })}${gun.baslik ? ` · ${gun.baslik}` : ''}`} />
      <View>
        {gun.gezi_duraklari.map((d, i) => {
          const c = canli?.get(d.id);
          const icinde = listede(d);
          return (
            <View key={d.id} style={s.satir}>
              <View style={[s.numara, { backgroundColor: rengi }]}>
                <Text style={[s.numaraMetin, { color: gunUstuMetin(rengi) }]}>{i + 1}</Text>
              </View>
              <View style={[s.foto, { backgroundColor: kategoriPini(d.kategori).kategoriRenk }]}>{c?.foto_uri ? <Image source={{ uri: c.foto_uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : null}</View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.ad} numberOfLines={1}>
                  {d.ad}
                </Text>
                <Text style={s.meta} numberOfLines={1}>
                  {kategoriEtiketi(d.kategori)} · {sureMetni(d.sure_dk)}
                </Text>
              </View>
              <EkleDugmesi listede={icinde} mesgul={mesgulId === d.id} onPress={() => onDurakEkle(d)} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 12 },
  cipler: { gap: 8, paddingVertical: 2 },
  cip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.yuzey },
  cipSecili: { backgroundColor: renk.metin },
  cipNokta: { width: 8, height: 8, borderRadius: 4 },
  cipMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  cipMetinSecili: { color: renk.zemin },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, minHeight: 60, borderTopWidth: 1, borderTopColor: renk.ayrac },
  numara: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numaraMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.zemin },
  foto: { width: 44, height: 44, borderRadius: 12, overflow: 'hidden' },
  ad: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  meta: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  _: { minHeight: minDokunma },
});
