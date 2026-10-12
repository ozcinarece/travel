import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ty } from '@/features/yonetim/metin';
import { hafifYerler, linkCoz, linkGibiMi, useOneriler, yeniOturumJetonu, type HafifYer, type Merkez } from '@/features/yerler/api';
import { yazi } from '@/theme';

import { yRenk } from '../tema';

/**
 * KK4: "Mekan ara (Google) ya da link yapıştır" — kanvastaki kesikli kutu. Arama mevcut places-autocomplete (şehre yanlı,
 * 300 ms, ≥ 2 harf), seçimde places-light (oturumu kapatır); Google Maps linki resolve-link ile. Sonuç satırları kanvasta
 * yok (tasarım bekliyor): durak satırı stiliyle.
 */
export function MekanArama({ merkez, onSec, etiket = ty('gezi.mekanAra') }: { merkez: Merkez | undefined; onSec: (yer: HafifYer) => Promise<void> | void; etiket?: string }) {
  const [girdi, setGirdi] = useState('');
  const [oturum, setOturum] = useState(yeniOturumJetonu);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState(false);
  const link = linkGibiMi(girdi);
  const oneriler = useOneriler('yonetim-mekan', girdi, oturum, undefined, merkez, !link);

  const sec = async (yerAl: () => Promise<HafifYer | undefined>) => {
    setHata(false);
    setMesgul(true);
    try {
      const yer = await yerAl();
      if (!yer) throw new Error('bos');
      await onSec(yer);
      setGirdi('');
      setOturum(yeniOturumJetonu());
    } catch {
      setHata(true);
    } finally {
      setMesgul(false);
    }
  };
  const linkiCoz = () => link && sec(async () => (await linkCoz(girdi.trim(), merkez)).yer);

  return (
    <View style={s.kap}>
      <View style={s.kutu}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={yRenk.ikincil} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <Circle cx="11" cy="11" r="6.5" />
          <Path d="M20 20l-4.2-4.2" />
        </Svg>
        <TextInput
          value={girdi}
          onChangeText={(m) => {
            setGirdi(m);
            setHata(false);
          }}
          onSubmitEditing={linkiCoz}
          placeholder={etiket}
          placeholderTextColor={yRenk.ikincil}
          accessibilityLabel={etiket}
          style={s.girdi}
        />
        {mesgul || oneriler.isFetching ? <ActivityIndicator size="small" color={yRenk.ikincil} /> : null}
      </View>
      {hata ? <Text style={s.hata}>{ty('gezi.araHata')}</Text> : null}
      {link && girdi.trim() ? (
        <Pressable accessibilityRole="button" onPress={linkiCoz} disabled={mesgul} style={s.sonuc}>
          <Text style={s.sonucAd} numberOfLines={1}>
            {girdi.trim()}
          </Text>
        </Pressable>
      ) : (
        (oneriler.data ?? []).map((o) => (
          <Pressable key={o.place_id} accessibilityRole="button" disabled={mesgul} onPress={() => sec(async () => (await hafifYerler([o.place_id], { oturum }))[0])} style={s.sonuc}>
            <Text style={s.sonucAd} numberOfLines={1}>
              {o.ana}
              {o.ikincil ? <Text style={s.sonucAlt}>{` · ${o.ikincil}`}</Text> : null}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 6 },
  kutu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: yRenk.cerceve,
  },
  girdi: { flex: 1, minWidth: 0, fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.metin },
  sonuc: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: yRenk.ayrac },
  sonucAd: { fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.metin },
  sonucAlt: { fontFamily: yazi.yari, fontSize: 11, color: yRenk.ikincil },
  hata: { fontFamily: yazi.yari, fontSize: 11, color: '#ff5a1f' },
});
