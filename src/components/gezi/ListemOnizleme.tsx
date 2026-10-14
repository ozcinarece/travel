// #181 KK7 (kanvas 23): Listem önizlemesi — en çok oy alan 3 mekan; güne atanmamışsa turuncu "güne atanmamış", atanmışsa "N.
// gün"; oy düğmesi çalışır (kendi oyun dolu Gece). "Tümü" → Listem. Ad ve fotoğraf istek atılmadan (bilinenMekanlar).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import type { ListemOnizlemeSatiri } from '@/features/gezi/geziOzeti';
import { t } from '@/i18n';
import { bilinenKategori, kategoriEtiketi, sureMetni } from '@/lib/kategori';
import { renk, yazi } from '@/theme';

import { BolumBasligi, FotoKutusu, Kart } from './GeziParcalari';

type Props = {
  toplam: number;
  satirlar: ListemOnizlemeSatiri[];
  /** Ad biliniyorsa ad; değilse null (satır başlığı kategori olur). */
  ad: (placeId: string) => string | null;
  foto: (placeId: string) => string | null;
  onTumu: () => void;
  onOy: (mekanId: string) => void;
  onEkle: () => void;
};

export function ListemOnizleme({ toplam, satirlar, ad, foto, onTumu, onOy, onEkle }: Props) {
  return (
    <View style={{ gap: 10 }}>
      <BolumBasligi baslik={t('geziSayfasi.listem', { n: toplam })} baglanti={t('geziSayfasi.tumu')} onBaglanti={onTumu} />
      {satirlar.length === 0 ? (
        <Kart stil={s.bos}>
          <Text style={s.bosMetin}>{t('geziSayfasi.listemBos')}</Text>
          <Pressable accessibilityRole="button" onPress={onEkle} hitSlop={6}>
            <Text style={s.bosDugme}>{t('geziSayfasi.listemBosDugme')}</Text>
          </Pressable>
        </Kart>
      ) : (
        <>
          <Kart stil={{ padding: 12 }}>
            {satirlar.map((r) => {
              const bilinen = ad(r.mekan.place_id);
              const kategori = kategoriEtiketi(r.mekan.primary_type);
              // Ad bilinmiyorsa başlık kategori; alt satırda tekrar etmez.
              const parcalar = [bilinen && bilinenKategori(r.mekan.primary_type) ? kategori : null, sureMetni(r.mekan.default_minutes)].filter(Boolean).join(' · ');
              return (
                <View key={r.mekan.id} style={s.satir}>
                  <FotoKutusu uri={foto(r.mekan.place_id)} tip={r.mekan.primary_type} boyut={46} kose={12} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.ad} numberOfLines={1}>
                      {bilinen ?? kategori}
                    </Text>
                    <Text style={s.meta} numberOfLines={1}>
                      {parcalar}
                      {' · '}
                      {r.gun ? (
                        t('geziSayfasi.gunu', { n: r.gun.index })
                      ) : (
                        <Text style={s.atanmamis}>{t('geziSayfasi.atanmamis')}</Text>
                      )}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('geziSayfasi.oyVer', { n: r.oy })}
                    accessibilityState={{ selected: r.benimOyum }}
                    onPress={() => onOy(r.mekan.id)}
                    hitSlop={6}
                    style={({ pressed }) => [s.oy, r.benimOyum && { backgroundColor: renk.ana }, pressed && { opacity: 0.8 }]}>
                    <Ikon ad="kalpOy" boyut={14} renk={r.benimOyum ? renk.zemin : renk.ana} kalinlik={2.4} />
                    <Text style={[s.oyMetin, r.benimOyum && { color: renk.zemin }]}>{r.oy}</Text>
                  </Pressable>
                </View>
              );
            })}
          </Kart>
          <Text style={s.not}>{t('geziSayfasi.listemNot')}</Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ad: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  meta: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  atanmamis: { fontFamily: yazi.ekstra, color: '#b4531a' },
  oy: { height: 34, paddingHorizontal: 10, borderRadius: 10, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 5 },
  oyMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  not: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  bos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bosMetin: { flex: 1, fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  bosDugme: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
});
