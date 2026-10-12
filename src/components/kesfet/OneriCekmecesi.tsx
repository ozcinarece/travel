// #98 B (kanvas TripWizard14 ekran 6–7): Keşfet öneri çekmecesi — üç hal: küçük (tutamaç + "Bu bölgede önerilen · N") →
// yarım (satırlar: foto 46, ad, kategori · süre · ★, "+") → tam ekran (çipler + büyük kartlar, "Haritaya dön").
import { Image } from 'expo-image';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MekanKarti } from '@/components/sihirbaz/MekanKarti';
import { Ikon } from '@/components/ui/Ikon';
import type { SayfaHali } from '@/components/harita/AltSayfa';
import { googleMekani, type OnerilenMekan } from '@/features/sihirbaz/onerilenler';
import type { HafifYer } from '@/features/yerler/api';
import { CEKMECE_CIPLERI, type CekmeceCipi } from '@/features/yerler/cekmece';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni, varsayilanDakika } from '@/lib/kategori';
import { kategoriPini, yorumKisa } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import { bosluk, minDokunma, renk, yazi } from '@/theme';

type Ortak = {
  havuz: Set<string>;
  oneCikan: Set<string>;
  fotolar: Map<string, string | null>;
  mesgulId: string | null;
  onEkle: (y: HafifYer) => void;
  onCikar: (placeId: string) => void;
  onAc: (placeId: string) => void;
};

/** Üst şerit: tutamaç + başlık (hal'e göre); tam halde sağda "Haritaya dön". */
export function CekmeceSeridi({ hal, sayi, onHal }: { hal: SayfaHali; sayi: number; onHal: (h: SayfaHali) => void }) {
  return (
    <View style={s.serit}>
      <Pressable accessibilityRole="button" accessibilityLabel={t(hal === 'katli' ? 'kesfet.cekmece.ac' : 'kesfet.cekmece.kapat')} onPress={() => onHal(hal === 'katli' ? 'yari' : 'katli')} hitSlop={8} style={s.tutamakDokunma}>
        <View style={s.tutamak} />
      </Pressable>
      {hal === 'katli' ? (
        <Pressable accessibilityRole="button" onPress={() => onHal('yari')} style={s.seritSatir}>
          <Text style={s.kucukMetin}>{t('kesfet.cekmece.kucuk', { n: sayi })}</Text>
          <Ikon ad="yukari" boyut={18} renk={renk.metin} kalinlik={2.2} />
        </Pressable>
      ) : (
        <View style={s.seritSatir}>
          <View style={{ flex: 1 }}>
            <Text style={s.baslik}>{t('kesfet.cekmece.baslik')}</Text>
            <Text style={s.alt}>{hal === 'tam' ? t('kesfet.cekmece.tamAlt') : sayi > 0 ? t('kesfet.cekmece.alt', { n: sayi }) : t('kesfet.cekmece.altBos')}</Text>
          </View>
          {hal === 'tam' ? (
            <Pressable accessibilityRole="button" onPress={() => onHal('katli')} style={s.haritayaDon}>
              <Text style={s.haritayaDonMetin}>{t('kesfet.cekmece.haritayaDon')}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** Yarım hal: satır listesi. */
export function CekmeceSatirlari({ liste, yukseklik, ...o }: Ortak & { liste: HafifYer[]; yukseklik: number }) {
  return (
    <FlatList
      data={liste}
      keyExtractor={(y) => y.place_id}
      style={{ height: yukseklik }}
      contentContainerStyle={s.satirlar}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={<Text style={s.bos}>{t('kesfet.cekmece.altBos')}</Text>}
      renderItem={({ item: y }) => {
        const listede = o.havuz.has(y.place_id);
        const puan = puanMetni(y.puan);
        const yorum = yorumKisa(y.puan_sayisi);
        const meta = [kategoriEtiketi(y.primary_type), sureMetni(varsayilanDakika(y.primary_type)), puan ? `★ ${puan}${yorum ? ` · ${yorum}` : ''}` : null].filter(Boolean).join(' · ');
        const foto = o.fotolar.get(y.place_id);
        return (
          <Pressable accessibilityRole="button" onPress={() => o.onAc(y.place_id)} style={({ pressed }) => [s.satir, pressed && { opacity: 0.8 }]}>
            <View style={[s.foto, { backgroundColor: kategoriPini(y.primary_type).kategoriRenk }]}>{foto ? <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : null}</View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.ad} numberOfLines={1}>
                {y.ad}
              </Text>
              <Text style={s.meta} numberOfLines={1}>
                {meta}
              </Text>
            </View>
            {listede ? (
              <Text style={s.listede}>{t('kesfet.cekmece.listede')}</Text>
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel={t('kesfet.cekmece.ekle')} disabled={o.mesgulId === y.place_id} onPress={() => o.onEkle(y)} hitSlop={6} style={s.arti}>
                {o.mesgulId === y.place_id ? <ActivityIndicator color={renk.zemin} /> : <Text style={s.artiMetin}>+</Text>}
              </Pressable>
            )}
          </Pressable>
        );
      }}
    />
  );
}

/** Tam hal: çipler + büyük kartlar (5. adımla aynı düzen). `rehber` yalnız "Rehberden" çipi için. */
export function CekmeceKartlari({ liste, cip, onCip, rehber, rehberVar, yukseklik, bolgeSayisi, ...o }: Ortak & { liste: HafifYer[]; cip: CekmeceCipi; onCip: (c: CekmeceCipi) => void; rehber: OnerilenMekan[]; rehberVar: boolean; yukseklik: number; bolgeSayisi: number }) {
  const kartlar: OnerilenMekan[] = cip === 'rehber' ? rehber.filter((m) => !o.havuz.has(m.place_id) || true) : liste.map((y) => googleMekani({ ...y, foto_uri: o.fotolar.get(y.place_id) ?? null }, o.oneCikan.has(y.place_id)));
  const cipler = CEKMECE_CIPLERI.filter((c) => c !== 'rehber' || rehberVar);
  const etiket = (c: CekmeceCipi) => (c === 'bolge' ? t('kesfet.cekmece.buBolgede', { n: bolgeSayisi }) : t(`sihirbaz.onerilenler.cip.${c}`));
  return (
    <View style={{ height: yukseklik }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cipler} keyboardShouldPersistTaps="handled">
        {cipler.map((c) => (
          <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: cip === c }} onPress={() => onCip(c)} style={[s.cip, cip === c && s.cipSecili]}>
            <Text style={[s.cipMetin, cip === c && s.cipMetinSecili]}>{etiket(c)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={kartlar}
        keyExtractor={(m) => m.place_id}
        contentContainerStyle={s.kartlar}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={<Text style={s.bos}>{t('kesfet.cekmece.altBos')}</Text>}
        renderItem={({ item }) => (
          <MekanKarti
            mekan={item}
            listede={o.havuz.has(item.place_id)}
            mesgul={o.mesgulId === item.place_id}
            onEkle={() => o.onEkle({ place_id: item.place_id, ad: item.ad, lat: item.lat, lng: item.lng, primary_type: item.primary_type, tz: null, puan: item.puan, puan_sayisi: item.puan_sayisi, acik: null, ulke_kodu: null })}
            onCikar={() => o.onCikar(item.place_id)}
            onAc={() => o.onAc(item.place_id)}
          />
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  serit: { paddingHorizontal: bosluk.kenar, paddingBottom: 8 },
  tutamakDokunma: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 30 },
  tutamak: { width: 36, height: 4, borderRadius: 2, backgroundColor: renk.ayrac },
  seritSatir: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  kucukMetin: { flex: 1, fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  baslik: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  haritayaDon: { height: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  haritayaDonMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  satirlar: { paddingHorizontal: bosluk.kenar, paddingBottom: 16 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 62, borderTopWidth: 1, borderTopColor: renk.ayrac },
  foto: { width: 46, height: 46, borderRadius: 12, overflow: 'hidden' },
  ad: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  meta: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  arti: { width: 36, height: 36, borderRadius: 18, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  artiMetin: { fontFamily: yazi.kalin, fontSize: 20, lineHeight: 22, color: renk.zemin },
  listede: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil, minHeight: minDokunma, textAlignVertical: 'center' },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, textAlign: 'center', paddingVertical: 24 },
  cipler: { gap: 8, paddingHorizontal: bosluk.kenar, paddingBottom: 8 },
  cip: { height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  cipSecili: { backgroundColor: renk.metin },
  cipMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  cipMetinSecili: { color: renk.zemin },
  kartlar: { paddingHorizontal: bosluk.kenar, paddingBottom: 16 },
});
