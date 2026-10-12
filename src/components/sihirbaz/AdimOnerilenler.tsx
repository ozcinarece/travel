// #98 KK6 · 5. adım "{Şehir}'de görmen gerekenler": çipler + kart listesi; "Listeye ekle" seyahatin mekan havuzuna yazar.
// #121: listede olanlar gizli (üstte "Listende N mekan var"), az önce eklenenler "Listede ✓" ile kalır; karta dokunma → mekan paneli.
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMekanEkle, useMekanSil } from '@/features/mekanlar/sorgular';
import { CIPLER, useOnerilenler, type OnerilenCipi, type OnerilenMekan } from '@/features/sihirbaz/onerilenler';
import { t } from '@/i18n';
import type { Mekan, Sehir, Seyahat } from '@/lib/tipler';
import { bosluk, renk, yazi } from '@/theme';

import { MekanKarti } from './MekanKarti';

type Props = {
  seyahat: Seyahat;
  rehberSehir: Sehir | undefined;
  havuz: Mekan[];
  /** #121 KK4: bu ekranda eklenenler — listede olsa da kart "Listede ✓" ile kalır (gizlenmez). */
  tutulan: Set<string>;
  onTut: (placeId: string) => void;
  onHata: (m: string | null) => void;
  /** #121 KK3: karta dokunma → mekan paneli. */
  onAc: (m: OnerilenMekan) => void;
};

export function AdimOnerilenler({ seyahat, rehberSehir, havuz, tutulan, onTut, onHata, onAc }: Props) {
  const [cip, setCip] = useState<OnerilenCipi>('gormen');
  const havuzIdleri = useMemo(() => new Set(havuz.map((m) => m.place_id)), [havuz]);
  const { liste, yukleniyor, hata } = useOnerilenler(seyahat, rehberSehir, cip, havuzIdleri, tutulan);
  const ekle = useMekanEkle(seyahat.id);
  const sil = useMekanSil(seyahat.id);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const havuzIle = new Map(havuz.map((m) => [m.place_id, m]));
  const cipler = CIPLER.filter((c) => c !== 'rehber' || !!rehberSehir);

  const listeyeEkle = async (m: OnerilenMekan) => {
    onHata(null);
    setMesgul(m.place_id);
    try {
      await ekle.mutateAsync({ place_id: m.place_id, primary_type: m.primary_type, lat: m.lat, lng: m.lng, default_minutes: m.dakika });
      onTut(m.place_id);
    } catch {
      onHata(t('sihirbaz.onerilenler.ekleHata'));
    } finally {
      setMesgul(null);
    }
  };
  const listedenCikar = async (m: OnerilenMekan) => {
    const kayit = havuzIle.get(m.place_id);
    if (!kayit) return;
    onHata(null);
    setMesgul(m.place_id);
    try {
      await sil.mutateAsync(kayit.id);
    } catch {
      onHata(t('sihirbaz.onerilenler.ekleHata'));
    } finally {
      setMesgul(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cipler} keyboardShouldPersistTaps="handled">
        {cipler.map((c) => (
          <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: cip === c }} onPress={() => setCip(c)} style={[s.cip, cip === c && s.cipSecili]}>
            <Text style={[s.cipMetin, cip === c && s.cipMetinSecili]}>{c === 'gormen' && liste.length && cip === c ? `${t('sihirbaz.onerilenler.cip.gormen')} · ${liste.length}` : t(`sihirbaz.onerilenler.cip.${c}`)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {yukleniyor ? (
        <ActivityIndicator color={renk.metin} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={liste}
          keyExtractor={(m) => m.place_id}
          contentContainerStyle={s.liste}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponent={havuz.length > 0 ? <Text style={s.gizliNot}>{t('sihirbaz.onerilenler.gizliNot', { n: havuz.length })}</Text> : null}
          ListEmptyComponent={<Text style={s.bos}>{hata ? t('sihirbaz.onerilenler.hata') : t('sihirbaz.onerilenler.bos')}</Text>}
          renderItem={({ item }) => <MekanKarti mekan={item} listede={havuzIle.has(item.place_id)} mesgul={mesgul === item.place_id} onEkle={() => listeyeEkle(item)} onCikar={() => listedenCikar(item)} onAc={() => onAc(item)} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  cipler: { gap: 8, paddingHorizontal: bosluk.kenar, paddingVertical: 8 },
  cip: { height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  cipSecili: { backgroundColor: renk.metin },
  cipMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  cipMetinSecili: { color: renk.zemin },
  liste: { paddingHorizontal: bosluk.kenar, paddingTop: 6, paddingBottom: 16 },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, textAlign: 'center', paddingVertical: 30 },
  gizliNot: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil, paddingBottom: 10 },
});
