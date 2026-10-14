// #181 KK8 (kanvas 23): "Rehberden öneriler" — şehrin yayınlı öne çıkan yerlerinden listede olmayanlar (en çok 6), bizim veriden
// (ad, kategori, kapak); Google'a gidilmez. Kartta "Listeye ekle". KK10: altta Rehber kartı ve şehrin önerilen gezisi.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { bulunmaEki } from '@/features/davet/katilim';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni, varsayilanDakika } from '@/lib/kategori';
import type { Gezi, Yer } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

import { BolumBasligi, FotoKutusu } from './GeziParcalari';

type Props = {
  sehir: string;
  yerler: (Yer & { place_id: string })[];
  eklenenler: Set<string>;
  onEkle: (y: Yer & { place_id: string }) => void;
  onKesfet: () => void;
};

export function RehberOnerileri({ sehir, yerler, eklenenler, onEkle, onKesfet }: Props) {
  return (
    <View style={{ gap: 10 }}>
      <BolumBasligi baslik={t('geziSayfasi.rehberden')} baglanti={t('geziSayfasi.kesfet')} onBaglanti={onKesfet} />
      <Text style={s.alt}>{t('geziSayfasi.rehberdenAlt', { sehirde: bulunmaEki(sehir) })}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.serit} contentContainerStyle={s.seritIc}>
        {yerler.map((y) => {
          const eklendi = eklenenler.has(y.place_id);
          return (
            <View key={y.id} style={s.kart}>
              <FotoKutusu uri={y.kapak_url} tip={y.kategori} kose={0} stil={{ height: 84 }} />
              <View style={s.govde}>
                <Text style={s.ad} numberOfLines={2}>
                  {y.ad}
                </Text>
                <Text style={s.meta} numberOfLines={1}>
                  {`${kategoriEtiketi(y.kategori)} · ${sureMetni(varsayilanDakika(y.kategori))}`}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={eklendi}
                  onPress={() => onEkle(y)}
                  style={({ pressed }) => [s.ekle, eklendi && { backgroundColor: renk.basariZemin }, pressed && { opacity: 0.85 }]}>
                  <Ikon ad={eklendi ? 'tik' : 'arti'} boyut={13} renk={eklendi ? renk.basariMetin : renk.metin} kalinlik={3} />
                  <Text style={[s.ekleMetin, eklendi && { color: renk.basariMetin }]}>{eklendi ? t('geziSayfasi.listede') : t('geziSayfasi.listeyeEkle')}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** KK10: Rehber kartı (şehrin rehberi varsa) ve şehrin önerilen gezisi "Seyahatime al". */
export function RehberKartlari({ sehir, kapak, rehberVar, gezi, onRehber, onGezi, onGeziAl }: { sehir: string; kapak: string | null; rehberVar: boolean; gezi: Gezi | null; onRehber: () => void; onGezi: () => void; onGeziAl: () => void }) {
  if (!rehberVar && !gezi) return null;
  return (
    <View style={{ gap: 10 }}>
      <BolumBasligi baslik={t('geziSayfasi.rehber')} />
      {rehberVar ? (
        <Pressable accessibilityRole="button" onPress={onRehber} style={({ pressed }) => [s.rehber, pressed && { opacity: 0.85 }]}>
          <FotoKutusu uri={kapak} tip="tourist_attraction" boyut={56} kose={14} stil={{ backgroundColor: '#dce6ff' }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.rehberBaslik} numberOfLines={1}>
              {t('geziSayfasi.sehirRehberi', { sehir })}
            </Text>
            <Text style={s.rehberAlt} numberOfLines={1}>
              {t('geziSayfasi.rehberBolumleri')}
            </Text>
          </View>
          <Ikon ad="ileri" boyut={18} renk={renk.ana} kalinlik={2.8} />
        </Pressable>
      ) : null}
      {gezi ? (
        <Pressable accessibilityRole="button" onPress={onGezi} style={({ pressed }) => [s.gezi, pressed && { opacity: 0.9 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.geziEtiket}>{t('geziSayfasi.onerilenGezi')}</Text>
            <Text style={s.geziBaslik} numberOfLines={2}>
              {gezi.baslik}
            </Text>
            <Text style={s.geziMeta} numberOfLines={1}>
              {[t('geziSayfasi.geziGun', { n: gezi.gun_sayisi }), t('geziSayfasi.geziDurak', { n: gezi.mekan_sayisi }), gezi.yazar_ad].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onGeziAl} hitSlop={6} style={({ pressed }) => [s.geziAl, pressed && { opacity: 0.85 }]}>
            <Text style={s.geziAlMetin}>{t('geziSayfasi.seyahatimeAl')}</Text>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  alt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, marginTop: -4 },
  serit: { marginHorizontal: -20 },
  seritIc: { paddingHorizontal: 20, gap: 10 },
  kart: { width: 150, borderRadius: 16, backgroundColor: renk.zemin, overflow: 'hidden' },
  govde: { padding: 10, gap: 6, flex: 1 },
  ad: { fontFamily: yazi.ekstra, fontSize: 13, lineHeight: 16, color: renk.metin },
  meta: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  ekle: { marginTop: 'auto', height: 34, paddingHorizontal: 10, borderRadius: 10, backgroundColor: renk.vurgu, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  ekleMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.metin },
  rehber: { padding: 14, borderRadius: 20, backgroundColor: renk.zemin, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rehberBaslik: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  rehberAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil, marginTop: 2 },
  gezi: { padding: 14, borderRadius: 20, backgroundColor: renk.ana, flexDirection: 'row', alignItems: 'center', gap: 12 },
  geziEtiket: { fontFamily: yazi.ekstra, fontSize: 11, letterSpacing: 0.66, color: renk.anaAcik },
  geziBaslik: { fontFamily: yazi.baslik, fontSize: 16, letterSpacing: -0.32, color: renk.zemin, marginTop: 3 },
  geziMeta: { fontFamily: yazi.normal, fontSize: 12, color: renk.anaAcik, marginTop: 2 },
  geziAl: { height: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: renk.vurgu, justifyContent: 'center', flexShrink: 0 },
  geziAlMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
});
