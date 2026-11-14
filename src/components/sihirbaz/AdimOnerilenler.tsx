// #98 KK6 → #139 (kanvas 7): 3. adım "Neleri görmek istersin?" — üstte mini harita (seçilenler Gece kare, seçilmeyenler beyaz
// nokta, yakın bölgeler halkalı), çipler, altta kompakt kartlar (EkleDugmesi). "Listeye ekle" seyahatin mekan havuzuna yazar.
// #121: listede olanlar gizli (üstte "Listende N mekan var"), az önce eklenenler ✓ ile kalır; karta dokunma → odak + mekan paneli.
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMekanEkle, useMekanSil } from '@/features/mekanlar/sorgular';
import { CIPLER, useOnerilenler, type OnerilenCipi, type OnerilenMekan } from '@/features/sihirbaz/onerilenler';
import { useHafifYerler } from '@/features/yerler/api';
import { t } from '@/i18n';
import type { Mekan, Sehir, Seyahat } from '@/lib/tipler';
import { bosluk, kose, renk, yazi } from '@/theme';

import { SecimHaritasi, type HaritaNoktasi } from './SecimHaritasi';
import { SecimKarti } from './SecimKarti';

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
  const [odakId, setOdakId] = useState<string | null>(null);
  const havuzIdleri = useMemo(() => new Set(havuz.map((m) => m.place_id)), [havuz]);
  const { liste, yukleniyor, hata } = useOnerilenler(seyahat, rehberSehir, cip, havuzIdleri, tutulan);
  const ekle = useMekanEkle(seyahat.id);
  const sil = useMekanSil(seyahat.id);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const havuzIle = new Map(havuz.map((m) => [m.place_id, m]));
  const cipler = CIPLER.filter((c) => c !== 'rehber' || !!rehberSehir);
  // Harita: seçilenlerin adı listede yoksa (önceden eklenmiş) hafif veriden.
  // #172 KK3: listedeki mekanların yalnız adı (harita etiketi) — Pro maske.
  const adlar = useHafifYerler(havuz.map((m) => m.place_id), { puan: false });
  const secilenler = useMemo<HaritaNoktasi[]>(
    () => havuz.map((m) => ({ id: m.place_id, lat: m.lat, lng: m.lng, ad: liste.find((x) => x.place_id === m.place_id)?.ad ?? adlar.data?.[m.place_id]?.ad ?? '', primary_type: m.primary_type })),
    [havuz, liste, adlar.data],
  );
  const digerleri = useMemo<HaritaNoktasi[]>(() => liste.filter((m) => !havuzIdleri.has(m.place_id)).map((m) => ({ id: m.place_id, lat: m.lat, lng: m.lng, ad: m.ad, primary_type: m.primary_type })), [liste, havuzIdleri]);

  const listeyeEkle = async (m: OnerilenMekan) => {
    onHata(null);
    setMesgul(m.place_id);
    setOdakId(m.place_id);
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

  const ust = (
    <View style={s.ust}>
      <SecimHaritasi secilenler={secilenler} digerleri={digerleri} odakId={odakId && havuzIdleri.has(odakId) ? odakId : null} merkez={{ lat: seyahat.lat, lng: seyahat.lng }} baslik={seyahat.name ?? seyahat.city_label} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cipler} style={s.ciplerKap} keyboardShouldPersistTaps="handled">
        {cipler.map((c) => (
          <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: cip === c }} onPress={() => setCip(c)} style={[s.cip, cip === c && s.cipSecili]}>
            <Text style={[s.cipMetin, cip === c && s.cipMetinSecili]}>{c === 'gormen' && liste.length && cip === c ? `${t('sihirbaz.onerilenler.cip.gormen')} · ${liste.length}` : t(`sihirbaz.onerilenler.cip.${c}`)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {havuz.length > 0 ? <Text style={s.gizliNot}>{t('sihirbaz.onerilenler.gizliNot', { n: havuz.length })}</Text> : null}
    </View>
  );

  return (
    <FlatList
      data={yukleniyor ? [] : liste}
      keyExtractor={(m) => m.place_id}
      contentContainerStyle={s.liste}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListHeaderComponent={ust}
      ListEmptyComponent={yukleniyor ? <ActivityIndicator color={renk.ana} style={{ marginTop: 30 }} /> : <Text style={s.bos}>{hata ? t('sihirbaz.onerilenler.hata') : t('sihirbaz.onerilenler.bos')}</Text>}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <SecimKarti
          mekan={item}
          listede={havuzIle.has(item.place_id)}
          mesgul={mesgul === item.place_id}
          odak={odakId === item.place_id}
          onEkle={() => listeyeEkle(item)}
          onCikar={() => listedenCikar(item)}
          onAc={() => {
            setOdakId(item.place_id);
            onAc(item);
          }}
        />
      )}
    />
  );
}

const s = StyleSheet.create({
  ust: { gap: 10, paddingBottom: 10 },
  ciplerKap: { marginHorizontal: -bosluk.kenar },
  cipler: { gap: 8, paddingHorizontal: bosluk.kenar, paddingTop: 4 },
  cip: { height: 34, paddingHorizontal: 14, borderRadius: kose.cip, backgroundColor: renk.zemin, borderWidth: 1.5, borderColor: renk.ayrac, justifyContent: 'center' },
  cipSecili: { backgroundColor: renk.ana, borderColor: renk.ana },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  cipMetinSecili: { color: renk.zemin },
  liste: { paddingHorizontal: bosluk.kenar, paddingTop: 14, paddingBottom: 16 },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, textAlign: 'center', paddingVertical: 30 },
  gizliNot: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
});
