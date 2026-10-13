import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ty } from '@/features/yonetim/metin';
import { hafifYerler, linkCoz, linkGibiMi, useOneriler, yeniOturumJetonu, type HafifYer, type Merkez, type Oneri } from '@/features/yerler/api';
import { kategoriEtiketi } from '@/lib/kategori';
import { kategoriPini } from '@/lib/pinIkonu';
import { yazi } from '@/theme';

import { Hap } from '../Hap';
import { yRenk } from '../tema';

export type MekanBicimi = 'satir' | 'kart';

type Props = {
  merkez: Merkez | undefined;
  /** Seçili metin varsa varsayılan satır içi; yoksa kart (kanvas kuralı). */
  varsayilan: MekanBicimi;
  /** "Değiştir": yalnız kart (biçim sorulmaz). */
  yalnizKart?: boolean;
  onEkle: (yer: HafifYer, bicim: MekanBicimi) => void;
  onVazgec: () => void;
};

/**
 * #111 (kanvas RehberEditor22 "Mekan aracı"): 360 px açılır kutu — arama (Google, şehre yanlı; link de yapıştırılabilir),
 * sonuç satırları (34 px kategori karesi, ad, "kategori · semt"), "NASIL EKLENSİN?" (Satır içi bağlantı / Mekan kartı),
 * Vazgeç · Ekle.
 */
export function MekanSecici({ merkez, varsayilan, yalnizKart, onEkle, onVazgec }: Props) {
  const [girdi, setGirdi] = useState('');
  const [oturum] = useState(yeniOturumJetonu);
  const [secili, setSecili] = useState<Oneri | null>(null);
  const [bicim, setBicim] = useState<MekanBicimi>(yalnizKart ? 'kart' : varsayilan);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState(false);
  const link = linkGibiMi(girdi);
  const oneriler = useOneriler('yonetim-rehber-mekan', girdi, oturum, undefined, merkez, !link);

  const ekle = async () => {
    setMesgul(true);
    setHata(false);
    try {
      const yer = link ? (await linkCoz(girdi.trim(), merkez)).yer : secili ? (await hafifYerler([secili.place_id], { oturum }))[0] : undefined;
      if (!yer) throw new Error('bos');
      onEkle(yer, bicim);
    } catch {
      setHata(true);
    } finally {
      setMesgul(false);
    }
  };

  return (
    <View style={s.kutu}>
      <View style={s.ara}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={yRenk.metin} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <Circle cx="11" cy="11" r="6.5" />
          <Path d="M20 20l-4.2-4.2" />
        </Svg>
        <TextInput
          autoFocus
          value={girdi}
          onChangeText={(m) => {
            setGirdi(m);
            setSecili(null);
            setHata(false);
          }}
          onSubmitEditing={() => (link || secili) && ekle()}
          placeholder={ty('rehber.mekanAra')}
          placeholderTextColor={yRenk.ikincil}
          accessibilityLabel={ty('rehber.mekanAra')}
          style={s.girdi}
        />
        {mesgul || oneriler.isFetching ? <ActivityIndicator size="small" color={yRenk.ikincil} /> : null}
      </View>
      {!link
        ? (oneriler.data ?? []).slice(0, 5).map((o) => {
            const tip = o.tipler[0];
            return (
              <Pressable
                key={o.place_id}
                accessibilityRole="button"
                accessibilityState={{ selected: secili?.place_id === o.place_id }}
                onPress={() => setSecili(o)}
                style={StyleSheet.flatten([s.sonuc, secili?.place_id === o.place_id && s.sonucSecili])}>
                <View style={[s.kare, { backgroundColor: kategoriPini(tip).kategoriRenk }]} />
                <View style={s.sonucMetin}>
                  <Text style={s.sonucAd} numberOfLines={1}>
                    {o.ana}
                  </Text>
                  <Text style={s.sonucAlt} numberOfLines={1}>
                    {[tip ? kategoriEtiketi(tip) : null, o.ikincil.split(',')[0]].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Pressable>
            );
          })
        : null}
      {hata ? <Text style={s.hata}>{ty('gezi.araHata')}</Text> : null}
      {yalnizKart ? null : (
        <>
          <Text style={s.soru}>{ty('rehber.nasil')}</Text>
          <View style={s.secenekler}>
            {(['satir', 'kart'] as const).map((b) => (
              <Pressable key={b} accessibilityRole="radio" accessibilityState={{ checked: bicim === b }} onPress={() => setBicim(b)} style={StyleSheet.flatten([s.secenek, bicim === b && s.secenekSecili])}>
                <Text style={s.secenekAd}>{`${ty(`rehber.bicim.${b}`)}${bicim === b ? ' ✓' : ''}`}</Text>
                <Text style={s.secenekAlt}>{ty(`rehber.bicimAlt.${b}`)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      <View style={s.eylemler}>
        <Hap kucuk baslik={ty('rehber.vazgec')} onPress={onVazgec} />
        <Hap kucuk tur="birincil" baslik={ty('rehber.ekle')} yukleniyor={mesgul} onPress={() => (link || secili) && ekle()} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kutu: { width: 360, padding: 10, borderRadius: 14, backgroundColor: yRenk.zemin, gap: 8, boxShadow: '0 14px 40px rgba(14,20,48,0.2)' },
  ara: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, borderColor: yRenk.metin },
  girdi: { flex: 1, minWidth: 0, fontFamily: yazi.kalin, fontSize: 13, color: yRenk.metin },
  sonuc: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8 },
  sonucSecili: { backgroundColor: yRenk.yuzey },
  kare: { width: 34, height: 34, borderRadius: 8 },
  sonucMetin: { flex: 1, minWidth: 0 },
  sonucAd: { fontFamily: yazi.ekstra, fontSize: 12.5, color: yRenk.metin },
  sonucAlt: { fontFamily: yazi.yari, fontSize: 11, color: yRenk.ikincil },
  hata: { fontFamily: yazi.yari, fontSize: 11, color: yRenk.hata },
  soru: { fontFamily: yazi.ekstra, fontSize: 10.5, color: yRenk.ikincil, paddingTop: 4, paddingHorizontal: 2 },
  secenekler: { flexDirection: 'row', gap: 6 },
  secenek: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, borderColor: yRenk.cerceve, gap: 2 },
  secenekSecili: { borderColor: yRenk.metin, backgroundColor: yRenk.yuzey },
  secenekAd: { fontFamily: yazi.ekstra, fontSize: 12, color: yRenk.metin },
  secenekAlt: { fontFamily: yazi.yari, fontSize: 10.5, color: yRenk.ikincil },
  eylemler: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
});
