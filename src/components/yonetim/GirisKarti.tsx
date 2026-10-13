import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ty } from '@/features/yonetim/metin';
import { yazi } from '@/theme';

import { yRenk } from './tema';

/**
 * Kanvas BekleyenTasarim21 ekran 1–2: #f6f6f4 zemin, ortada 360 px beyaz kart (32 iç boşluk, 20 yarıçap, gölge, 18
 * aralık) — logo + "Yönetim", başlık 22 / 800, açıklama 13 px gri; altında eylemler.
 */
export function GirisKarti({ ust, baslik, aciklama, children }: { ust?: ReactNode; baslik: string; aciklama: ReactNode; children: ReactNode }) {
  return (
    <View style={s.zemin}>
      <View style={s.kart}>
        <View style={s.logo}>
          <View style={s.isaret} />
          <Text style={s.marka}>{ty('marka')}</Text>
        </View>
        {ust}
        <View style={s.metinler}>
          <Text accessibilityRole="header" style={s.baslik}>
            {baslik}
          </Text>
          <Text style={s.aciklama}>{aciklama}</Text>
        </View>
        {children}
      </View>
    </View>
  );
}

/** Siyah 46 px "Google ile giriş" (G harfi beyaz dairede). */
export function GoogleDugmesi({ onPress, yukleniyor }: { onPress: () => void; yukleniyor: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ busy: yukleniyor, disabled: yukleniyor }} disabled={yukleniyor} onPress={onPress} style={({ pressed }) => [s.google, (pressed || yukleniyor) && s.basili]}>
      {yukleniyor ? (
        <ActivityIndicator size="small" color={yRenk.zemin} />
      ) : (
        <View style={s.g}>
          <Text style={s.gHarf}>G</Text>
        </View>
      )}
      <Text style={s.googleMetin}>{ty('giris.google')}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  zemin: { flex: 1, minHeight: '100%', backgroundColor: yRenk.yuzey, alignItems: 'center', justifyContent: 'center', padding: 16 },
  kart: { width: 360, maxWidth: '100%', padding: 32, borderRadius: 20, backgroundColor: yRenk.zemin, boxShadow: '0 10px 30px rgba(14,20,48,0.08)', gap: 18 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  isaret: { width: 30, height: 30, borderRadius: 9, backgroundColor: yRenk.metin },
  marka: { fontFamily: yazi.ekstra, fontSize: 16, letterSpacing: -0.32, color: yRenk.metin },
  metinler: { gap: 6 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 22, letterSpacing: -0.44, color: yRenk.metin },
  aciklama: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18.9, color: yRenk.ikincil },
  google: { height: 46, borderRadius: 999, backgroundColor: yRenk.metin, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  basili: { opacity: 0.7 },
  g: { width: 20, height: 20, borderRadius: 10, backgroundColor: yRenk.zemin, alignItems: 'center', justifyContent: 'center' },
  gHarf: { fontFamily: yazi.ekstra, fontWeight: '900', fontSize: 12, color: yRenk.metin },
  googleMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: yRenk.zemin },
});
