// #361 KK7 (UX önerileri kanvası, `Ana_v5_Var` · `Ana_v5_Yok` · `Ana_v5_Amaclar`): ana sayfanın tek kart türü. Büyük kapak
// (230 px, köşe 16), sağ üstte ♥ (Kaydet); altında başlık, `ozet`, "N gün · N durak · Tripmate rehberi". Kartta düğme yok,
// dokununca gezi sayfası. Kapak yoksa amacın renkli zemini (gri kutu yok).
// KK10: 26 Kasım'da aynı kart kullanıcı gezisiyle "Selin'in gezisi" satırıyla gelecek — `kaynak` satırı bunun için dışarıdan.
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Ikon } from '@/components/ui/Ikon';
import { kartAltSatiri } from '@/features/anasayfa/v5';
import { useKayitli } from '@/components/icerik/Kalp';
import { useKaydet } from '@/features/icerik/sorgular';
import { t } from '@/i18n';
import type { Gezi } from '@/lib/tipler';
import { anaV5, minDokunma, renk, yazi, type AmacTonu } from '@/theme';

import { AmacKapagi } from './AmacKapagi';

export const KAPAK_YUKSEKLIK = 230;

type Props = {
  gezi: Pick<Gezi, 'id' | 'baslik' | 'ozet' | 'kapak_url' | 'gun_sayisi' | 'mekan_sayisi'> & { gunDuraklari?: readonly number[] };
  /** Kapak yoksa zeminin tonu (`kapakTonu`). */
  ton: AmacTonu;
  onAc: () => void;
  /** KK10: alt satırın yerine geçecek kaynak satırı (kullanıcı gezisi); verilmezse "… · Tripmate rehberi". */
  altSatir?: string;
};

export function AnaGeziKarti({ gezi, ton, onAc, altSatir }: Props) {
  const alt = altSatir ?? kartAltSatiri(gezi);
  return (
    <View style={s.kart}>
      <Pressable accessibilityRole="button" accessibilityLabel={[gezi.baslik, gezi.ozet, alt].filter(Boolean).join(', ')} onPress={onAc} style={({ pressed }) => [s.govde, pressed && s.basili]}>
        <View style={s.kapak}>
          {gezi.kapak_url ? (
            <Image source={{ uri: gezi.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
          ) : (
            <AmacKapagi ton={ton} yukseklik={KAPAK_YUKSEKLIK} />
          )}
        </View>
        <View style={s.metinler}>
          <Text style={s.baslik} numberOfLines={2}>
            {gezi.baslik}
          </Text>
          {gezi.ozet ? (
            <Text style={s.alt} numberOfLines={1}>
              {gezi.ozet}
            </Text>
          ) : null}
          <Text style={s.alt} numberOfLines={1}>
            {alt}
          </Text>
        </View>
      </Pressable>
      <KartKalbi geziId={gezi.id} />
    </View>
  );
}

/** Kapak üstündeki ♥: 22 px beyaz çizgi, yarı saydam dolgu (kanvas); kayıtlıysa dolu Mandalina kalp. Dokunma alanı 44 px. */
function KartKalbi({ geziId }: { geziId: string }) {
  const kayitli = useKayitli('gezi', geziId);
  const kaydet = useKaydet();
  return (
    <Pressable
      accessibilityRole="togglebutton"
      accessibilityLabel={t('anasayfa.v5.kaydet')}
      accessibilityState={{ checked: kayitli }}
      onPress={() => kaydet.mutate({ tur: 'gezi', hedef_id: geziId, kayitli })}
      style={s.kalp}
    >
      {kayitli ? (
        <Ikon ad="kalpDolu" boyut={22} renk={renk.vurgu} kalinlik={2} />
      ) : (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="rgba(14,20,48,0.25)" stroke={renk.zemin} strokeWidth={2} strokeLinejoin="round">
          <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </Svg>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  kart: { position: 'relative' },
  govde: { gap: 8 },
  basili: { opacity: 0.9 },
  kapak: { height: KAPAK_YUKSEKLIK, borderRadius: 16, overflow: 'hidden', backgroundColor: renk.yuzey },
  metinler: { gap: 1 },
  baslik: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  // Kanvas: ikon sağdan ve üstten 12 px; 44 px dokunma alanı ikonu ortalar (12 − (44 − 22) / 2 = 1).
  kalp: { position: 'absolute', right: 1, top: 1, width: minDokunma, height: minDokunma, alignItems: 'center', justifyContent: 'center' },
});
