// #361 KK7 (UX önerileri kanvası, `Ana_v5_Var` · `Ana_v5_Yok` · `Ana_v5_Amaclar`): ana sayfanın tek kart türü. Büyük kapak
// (230 px, köşe 16), sağ üstte ♥ (Kaydet); altında başlık, `ozet`, "N gün · N durak · Tripmate rehberi". Kartta düğme yok,
// dokununca gezi sayfası. Kapak yoksa amacın renkli zemini (gri kutu yok).
// KK10: 26 Kasım'da aynı kart kullanıcı gezisiyle "Selin'in gezisi" satırıyla gelecek — `kaynak` satırı bunun için dışarıdan.
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

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
  /** #395 KK4 (Kaydettiklerim): ♥ kaydı doğrudan değiştirmez, ekran çıkarır ve "Geri al" gösterir. */
  onKalp?: () => void;
};

export function AnaGeziKarti({ gezi, ton, onAc, altSatir, onKalp }: Props) {
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
      <KartKalbi geziId={gezi.id} onKalp={onKalp} />
    </View>
  );
}

/**
 * Kapak üstündeki ♥ (kanvas `Ana_v5_Ayrinti` §2): her kartta (fotoğraflıda da) 32 px beyaz daire (%92), içinde 18 px kalp.
 * Boş: Lacivert 2,2 çizgi. Kayıtlı: Mandalina dolgu, #C25200 1,6 kenar. Dokunma alanı 44 px, daireyi ortalar.
 */
function KartKalbi({ geziId, onKalp }: { geziId: string; onKalp?: () => void }) {
  const kayitli = useKayitli('gezi', geziId);
  const kaydet = useKaydet();
  return (
    <Pressable
      // #410 inceleme: Kaydettiklerim'de ♥ kayıttan çıkarır; etiket yer ♥'iyle aynı ("Kaydedilenlerden kaldır").
      accessibilityRole={onKalp ? 'button' : 'togglebutton'}
      accessibilityLabel={onKalp ? t('kaydettiklerim.kaldir') : t('anasayfa.v5.kaydet')}
      accessibilityState={onKalp ? undefined : { checked: kayitli }}
      onPress={onKalp ?? (() => kaydet.mutate({ tur: 'gezi', hedef_id: geziId, kayitli }))}
      style={s.kalp}
      testID="kart-kalp"
    >
      <View style={s.kalpDaire}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill={kayitli ? renk.vurgu : 'none'} stroke={kayitli ? anaV5.kalpKenar : renk.metin} strokeWidth={kayitli ? 1.6 : 2.2} strokeLinejoin="round">
          <Path d={KALP_YOLU} />
        </Svg>
      </View>
    </Pressable>
  );
}

const KALP_YOLU = 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z';

const s = StyleSheet.create({
  kart: { position: 'relative' },
  govde: { gap: 8 },
  basili: { opacity: 0.9 },
  kapak: { height: KAPAK_YUKSEKLIK, borderRadius: 16, overflow: 'hidden', backgroundColor: renk.yuzey },
  metinler: { gap: 1 },
  baslik: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  // Kanvas: daire sağdan ve üstten 8 px; 44 px dokunma alanı daireyi ortalar (8 − (44 − 32) / 2 = 2).
  kalp: { position: 'absolute', right: 2, top: 2, width: minDokunma, height: minDokunma, alignItems: 'center', justifyContent: 'center' },
  kalpDaire: { width: 32, height: 32, borderRadius: 16, backgroundColor: anaV5.kalpDaire, alignItems: 'center', justifyContent: 'center' },
});
