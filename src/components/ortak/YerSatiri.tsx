// #397 KK5 → #401 KK5–KK6 (`Sayfa_v5_SehirRehberi`, `Ekran07cIlOnerileri`): v5 sade yer satırı — 56 px foto ya da kamera,
// ad (15/700), alt satır (13, ikincil), isteğe bağlı `neden` (en çok 2 satır); sağda 44 px dokunma alanında 32 px ince "+"
// ya da yeşil tik. Seçili satıra çerçeve ya da zemin yok. Bugün sihirbazın il listesi (`AdimIlOnerileri`) satırın tamamını,
// Şehir rehberi `Kamera` ve `InceEkle`'yi kullanır; Yer ekle 2/2b'de bu satıra geçecek.
// #443 inceleme 2: iOS'ta satırın içindeki "+" ayrı odak almaz; ekle/çıkar satırın erişilebilirlik eylemi olarak da sunulur,
// etikete `neden` girer. inceleme 5: dokunulacak bir şey yoksa (place_id ya da konum yok) satır düğme değil, düz metindir.
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Foto } from '@/components/ui/Foto';
import { t } from '@/i18n';
import { anaV5, minDokunma, renk, yazi } from '@/theme';

/** Fotoğraf yoksa (kanvas): düz zemin, ortada 22 px kamera. */
export function Kamera() {
  return (
    <View style={s.fotoYok} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={anaV5.ok} strokeWidth={1.8} strokeLinejoin="round">
        <Path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" />
        <Circle cx={12} cy={13.5} r={3.5} />
      </Svg>
    </View>
  );
}

/** #397 KK5: ince "+" (32 px daire, 1,5 kenar) ↔ tik (satır zemini, yeşil). Etiketler `EkleDugmesi` ile aynı; dokunma alanı 44. */
export function InceEkle({ listede, mesgul, onPress, etiket }: { listede: boolean; mesgul: boolean; onPress: () => void; etiket?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiket ?? (listede ? t('ui.ekle.listede') : t('ui.ekle.ekle'))}
      accessibilityState={{ selected: listede, busy: mesgul }}
      disabled={mesgul}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [s.ince, listede ? s.inceListede : s.inceBos, pressed && { opacity: 0.7 }]}>
      {mesgul ? (
        <ActivityIndicator size="small" color={renk.metin} />
      ) : (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {listede ? <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={renk.basari} strokeWidth={2.8} /> : <Path d="M12 6v12M6 12h12" stroke={renk.metin} strokeWidth={2.2} />}
        </Svg>
      )}
    </Pressable>
  );
}

type Props = {
  ad: string;
  alt: string;
  neden?: string | null;
  foto: string | null | undefined;
  /** Verilmezse sağda düğme yok (seyahat dışı). */
  ekle?: { listede: boolean; mesgul: boolean; onPress: () => void };
  onPress?: () => void;
  /** Altında 1 px ayraç (listenin son satırında yok). */
  ayrac?: boolean;
};

/** Ekran okuyucu etiketi: ad, alt satır ve varsa neden. */
export function yerSatiriEtiketi(ad: string, alt: string, neden?: string | null) {
  return [ad, alt, neden].filter(Boolean).join(', ');
}

export function YerSatiri({ ad, alt, neden, foto, ekle, onPress, ayrac }: Props) {
  const etiket = yerSatiriEtiketi(ad, alt, neden);
  const icerik = (
    <>
      <View style={s.foto}>{foto ? <Foto source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : <Kamera />}</View>
      <View style={s.metin}>
        <Text style={s.ad} numberOfLines={1}>
          {ad}
        </Text>
        {alt ? (
          <Text style={s.alt} numberOfLines={1}>
            {alt}
          </Text>
        ) : null}
        {neden ? (
          <Text style={s.neden} numberOfLines={2}>
            {neden}
          </Text>
        ) : null}
      </View>
      {ekle ? (
        <View style={s.dugmeAlani}>
          <InceEkle listede={ekle.listede} mesgul={ekle.mesgul} onPress={ekle.onPress} etiket={ekle.listede ? t('ilOneri.listende', { ad }) : t('ilOneri.ekle', { ad })} />
        </View>
      ) : null}
    </>
  );
  if (!onPress) {
    // inceleme 5: düğme rolü yok, "+" yok; ekran okuyucu düz metin okur.
    return (
      <View accessible accessibilityLabel={etiket} style={[s.satir, ayrac && s.ayrac]}>
        {icerik}
      </View>
    );
  }
  const eylemler = ekle && !ekle.mesgul ? [{ name: 'ekle', label: ekle.listede ? t('ilOneri.eylemCikar') : t('ilOneri.eylemEkle') }] : undefined;
  const eylem = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'ekle') ekle?.onPress();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiket}
      accessibilityState={ekle ? { selected: ekle.listede, busy: ekle.mesgul } : undefined}
      accessibilityActions={eylemler}
      onAccessibilityAction={eylem}
      onPress={onPress}
      style={({ pressed }) => [s.satir, ayrac && s.ayrac, pressed && { opacity: 0.85 }]}>
      {icerik}
    </Pressable>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  ayrac: { borderBottomWidth: 1, borderBottomColor: anaV5.cizgi },
  foto: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: anaV5.fotoYok },
  fotoYok: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: anaV5.fotoYok, alignItems: 'center', justifyContent: 'center' },
  metin: { flex: 1, minWidth: 0, gap: 2 },
  ad: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  neden: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 13 * 1.35, color: anaV5.nedenMetin },
  dugmeAlani: { width: minDokunma, height: minDokunma, alignItems: 'center', justifyContent: 'center' },
  ince: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  inceBos: { borderWidth: 1.5, borderColor: anaV5.inceKenar },
  inceListede: { backgroundColor: anaV5.satirZemin },
});
