// #98 KK6 / B KK1 (kanvas TripWizard14 adım 5 ve çekmece tam ekran): büyük mekan kartı — foto 150 px, neden rozeti
// (★ Öne çıkan / ★ Rehberde), ad, "kategori · süre · ★ puan · yorum", "Listeye ekle" ↔ "Listede".
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import type { OnerilenMekan } from '@/features/sihirbaz/onerilenler';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni } from '@/lib/kategori';
import { kategoriPini, yorumKisa } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import { renk, yazi } from '@/theme';

type Props = { mekan: OnerilenMekan; listede: boolean; mesgul?: boolean; onEkle: () => void; onCikar?: () => void; onAc?: () => void };

export function MekanKarti({ mekan, listede, mesgul, onEkle, onCikar, onAc }: Props) {
  const puan = puanMetni(mekan.puan);
  const yorum = yorumKisa(mekan.puan_sayisi);
  const meta = [kategoriEtiketi(mekan.primary_type), sureMetni(mekan.dakika), puan ? `★ ${puan}${yorum ? ` · ${yorum}` : ''}` : null].filter(Boolean).join(' · ');
  const { kategoriRenk } = kategoriPini(mekan.primary_type);
  return (
    <Pressable accessibilityRole={onAc ? 'button' : undefined} onPress={onAc} disabled={!onAc} style={s.kart}>
      <View style={[s.foto, { backgroundColor: kategoriRenk }]}>
        {mekan.foto_uri ? <Image source={{ uri: mekan.foto_uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
        {mekan.neden ? (
          <View style={s.rozet}>
            <Ikon ad="yildiz" boyut={10} renk={renk.vurgu} />
            <Text style={s.rozetMetin}>{t(mekan.neden === 'oneCikan' ? 'sihirbaz.onerilenler.oneCikan' : 'sihirbaz.onerilenler.rehberde')}</Text>
          </View>
        ) : null}
      </View>
      <View style={s.govde}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.ad} numberOfLines={1}>
            {mekan.ad}
          </Text>
          <Text style={s.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: listede, busy: !!mesgul }}
          disabled={!!mesgul || (listede && !onCikar)}
          onPress={listede ? onCikar : onEkle}
          style={[s.dugme, listede && s.dugmeListede]}>
          {mesgul ? <ActivityIndicator color={listede ? renk.metin : renk.zemin} /> : <Text style={[s.dugmeMetin, listede && s.dugmeMetinListede]}>{listede ? t('sihirbaz.onerilenler.listede') : t('sihirbaz.onerilenler.ekle')}</Text>}
        </Pressable>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  kart: { borderRadius: 18, backgroundColor: renk.zemin, borderWidth: 1, borderColor: renk.ayrac, overflow: 'hidden' },
  foto: { height: 150, justifyContent: 'flex-end' },
  rozet: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 9, borderRadius: 999, backgroundColor: renk.zemin },
  rozetMetin: { fontFamily: yazi.kalin, fontSize: 11, color: renk.metin },
  govde: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  ad: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  meta: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  dugme: { height: 36, minWidth: 104, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  dugmeListede: { backgroundColor: renk.yuzey },
  dugmeMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.zemin },
  dugmeMetinListede: { color: renk.metin },
});
