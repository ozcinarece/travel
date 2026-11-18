import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AltPencere } from '@/components/ui/AltPencere';
import { commonsMu, lisansKisaAdi, tripmateMi, type KapakAtfi as Atif } from '@/features/icerik/kapakAtfi';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

/** Kanvas 29i: kutu kapağın sağ alt köşesinde, sağdan 16, alttan 12. Başlık bu kadar yukarıda durur (üst üste binmez). */
export const ATIF_BASLIK_BOSLUGU = 44;

/**
 * #345 KK4 (kanvas 29i · A/B/C/E): kapak fotoğrafının atfı — 22 px kutu, köşe 8, #0E1430 %62, beyaz Figtree 600 12 px;
 * en çok 220 px, yazar "…" ile kısalır, lisans kesilmez. Commons fotoğrafında dokununca "Fotoğraf hakkında" (E) açılır;
 * "Foto: Tripmate" dokunulmaz. Dokunma alanı 44 pt (görünmez dolgu).
 */
export function KapakAtfi({ atif, stil }: { atif: Atif; stil?: StyleProp<ViewStyle> }) {
  const [acik, setAcik] = useState(false);
  if (tripmateMi(atif)) {
    return (
      <View style={[s.konum, stil]} accessible accessibilityLabel={t('kapak.erisimTripmate')}>
        <View style={s.kutu}>
          <Text style={s.metin} numberOfLines={1}>
            {t('kapak.atifTripmate')}
          </Text>
        </View>
      </View>
    );
  }
  const kisa = lisansKisaAdi(atif.lisans);
  const temel = atif.lisans ? t('kapak.erisim', { yazar: atif.yazar, lisans: atif.lisans }) : t('kapak.erisimLisanssiz', { yazar: atif.yazar });
  const kutu = <AtifKutusu yazar={atif.yazar} ek={kisa ? t('kapak.atifLisans', { lisans: kisa }) : null} />;
  if (!atif.kaynak_url) {
    return (
      <View style={[s.konum, stil]} accessible accessibilityLabel={temel}>
        {kutu}
      </View>
    );
  }
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={t('kapak.erisimKaynak', { atif: temel })} onPress={() => setAcik(true)} hitSlop={{ top: 11, bottom: 11, left: 8, right: 8 }} style={[s.konum, stil]} testID="kapak-atfi">
        {kutu}
      </Pressable>
      <AltPencere acik={acik} onKapat={() => setAcik(false)} kapatEtiketi={t('kapak.kapat')}>
        <View style={{ gap: 10 }}>
          <Text accessibilityRole="header" style={s.pencereBaslik}>
            {t('kapak.pencereBaslik')}
          </Text>
          <Text style={s.pencereMetin}>
            {atif.yazar}
            {atif.lisans ? (
              <>
                {' · '}
                <Text style={{ fontFamily: yazi.kalin }}>{atif.lisans}</Text>
              </>
            ) : null}
            {commonsMu(atif) ? `\n${t('kapak.pencereCommons')}` : null}
          </Text>
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            setAcik(false);
            WebBrowser.openBrowserAsync(atif.kaynak_url!).catch(() => {});
          }}
          style={({ pressed }) => [s.kaynak, pressed && { opacity: 0.85 }]}>
          <Text style={s.kaynakMetin}>{t('kapak.kaynakAc')}</Text>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={renk.ana} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <Path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
          </Svg>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setAcik(false)} style={s.kapat}>
          <Text style={s.kapatMetin}>{t('kapak.kapat')}</Text>
        </Pressable>
      </AltPencere>
    </>
  );
}

/**
 * Google fotoğrafı (yalnız canlı gösterim: mekan paneli, galeri): aynı kutu, "Foto: {yazar} · Google Maps". Dokunulmaz.
 */
export function GoogleFotoAtfi({ yazar, stil }: { yazar: string | null | undefined; stil?: StyleProp<ViewStyle> }) {
  const y = yazar?.trim();
  return (
    <View style={[s.konum, stil]} pointerEvents="none" accessible accessibilityLabel={y ? t('kapak.erisimGoogle', { yazar: y }) : t('kapak.atifGoogleYazarsiz')}>
      {y ? (
        <AtifKutusu yazar={y} ek={t('kapak.atifGoogle')} />
      ) : (
        <View style={s.kutu}>
          <Text style={s.metin} numberOfLines={1}>
            {t('kapak.atifGoogleYazarsiz')}
          </Text>
        </View>
      )}
    </View>
  );
}

function AtifKutusu({ yazar, ek }: { yazar: string; ek: string | null }) {
  return (
    <View style={s.kutu}>
      <Text style={[s.metin, s.yazar]} numberOfLines={1} ellipsizeMode="tail">
        {t('kapak.atif', { yazar })}
      </Text>
      {ek ? <Text style={[s.metin, s.ek]}>{ek}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  konum: { position: 'absolute', right: 16, bottom: 12 },
  kutu: { height: 22, maxWidth: 220, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(14,20,48,0.62)', flexDirection: 'row', alignItems: 'center', gap: 4 },
  metin: { fontFamily: yazi.yari, fontSize: 12, lineHeight: 16, color: renk.zemin },
  yazar: { flexShrink: 1, minWidth: 0 },
  ek: { flexShrink: 0 },
  pencereBaslik: { fontFamily: yazi.ekstra, fontSize: 18, color: renk.metin },
  pencereMetin: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 21, color: '#232b48' },
  kaynak: { height: 48, borderRadius: 14, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  kaynakMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.ana },
  kapat: { height: 44, alignItems: 'center', justifyContent: 'center' },
  kapatMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.ikincil },
});
