// #401 KK5 (Marka kimliği kanvası, `Ekran07cIlOnerileri` A–B): ilin yayında listesi varsa sihirbazın 3. adımı. Üstte
// altı çizili kategori sekmeleri (Hepsi + dolu kategoriler), altında 132 px mini harita; liste ve harita seçili sekmeye göre
// birlikte süzülür, sıra her zaman `sira`. Satır v5 sade yer satırı ("Kategori · İlçe · N km" + neden). En altta kapalı
// "Yakındaki diğer yerler": dokununca o sekmenin Google yakın araması çalışır (kapalıyken 0 istek), satırlarda ★ puan kalır.
// Listede olanlar gizlenmez (✓ ile kalır); karta dokunma mekan panelini açar.
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { KategoriSekmeleri } from '@/components/ortak/KategoriSekmeleri';
import { YerSatiri } from '@/components/ortak/YerSatiri';
import {
  doluKategoriler,
  googleAltSatiri,
  ilYeriAltSatiri,
  ilYeriMekani,
  sekmeyeGore,
  useIlFotolari,
  YAKIN_CIP,
  yakindakiDigerleri,
  type IlSekmesi,
  type IlYeri,
} from '@/features/icerik/ilOnerileri';
import { useMekanEkle, useMekanSil } from '@/features/mekanlar/sorgular';
import { googleMekani, useGoogleListesi, type OnerilenMekan } from '@/features/sihirbaz/onerilenler';
import { t } from '@/i18n';
import { haritaMerkezi, konumu, konumVar } from '@/lib/konum';
import type { Mekan, Seyahat } from '@/lib/tipler';
import { anaV5, minDokunma, renk, yazi } from '@/theme';

import { SecimHaritasi, type HaritaNoktasi } from './SecimHaritasi';

/** Fotoğraf ilk bu kadar satır için istenir; kaydırdıkça bu kadar büyür (Pro foto maskesi). */
export const FOTO_PARCASI = 20;
const KENAR = 16;

type Props = {
  seyahat: Seyahat;
  yerler: IlYeri[];
  havuz: Mekan[];
  onTut: (placeId: string) => void;
  onHata: (m: string | null) => void;
  onAc: (m: OnerilenMekan) => void;
};

export function AdimIlOnerileri({ seyahat, yerler, havuz, onTut, onHata, onAc }: Props) {
  const [sekme, setSekme] = useState<IlSekmesi>(null);
  const [odakId, setOdakId] = useState<string | null>(null);
  const [yakinAcik, setYakinAcik] = useState(false);
  const [fotoSiniri, setFotoSiniri] = useState(FOTO_PARCASI);
  const kategoriler = useMemo(() => doluKategoriler(yerler), [yerler]);
  const gorunen = useMemo(() => sekmeyeGore(yerler, sekme), [yerler, sekme]);
  const fotoIdleri = useMemo(() => gorunen.slice(0, fotoSiniri).flatMap((y) => (y.place_id ? [y.place_id] : [])), [gorunen, fotoSiniri]);
  const fotolar = useIlFotolari(fotoIdleri);
  const havuzIle = useMemo(() => new Map(havuz.map((m) => [m.place_id, m])), [havuz]);
  const ilIdleri = useMemo(() => new Set(yerler.flatMap((y) => (y.place_id ? [y.place_id] : []))), [yerler]);

  // Yakındaki diğer yerler: yalnız açıkken istek (sekmenin kümesi; 24 sa önbellek).
  const merkez = konumu(seyahat);
  const google = useGoogleListesi(seyahat.id, YAKIN_CIP[sekme ?? 'hepsi'], merkez, yakinAcik);
  const digerleri = useMemo(() => yakindakiDigerleri(google.data ?? [], ilIdleri), [google.data, ilIdleri]);

  const ekle = useMekanEkle(seyahat.id);
  const sil = useMekanSil(seyahat.id);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const degistir = async (m: OnerilenMekan) => {
    onHata(null);
    setMesgul(m.place_id);
    setOdakId(m.place_id);
    try {
      const kayit = havuzIle.get(m.place_id);
      if (kayit) await sil.mutateAsync(kayit.id);
      else {
        await ekle.mutateAsync({ place_id: m.place_id, primary_type: m.primary_type, lat: m.lat, lng: m.lng, default_minutes: m.dakika });
        onTut(m.place_id);
      }
    } catch {
      onHata(t('sihirbaz.onerilenler.ekleHata'));
    } finally {
      setMesgul(null);
    }
  };

  // Harita: seçilenler (havuz) + seçili sekmenin listede olmayan yerleri.
  const secilenler = useMemo<HaritaNoktasi[]>(
    () => havuz.filter(konumVar).map((m) => ({ id: m.place_id, lat: m.lat, lng: m.lng, ad: yerler.find((y) => y.place_id === m.place_id)?.ad ?? '', primary_type: m.primary_type })),
    [havuz, yerler],
  );
  const haritadakiler = useMemo<HaritaNoktasi[]>(
    () => gorunen.flatMap((y) => (y.place_id && konumVar(y) && !havuzIle.has(y.place_id) ? [{ id: y.place_id, lat: y.lat, lng: y.lng, ad: y.ad, primary_type: y.primary_type }] : [])),
    [gorunen, havuzIle],
  );

  const ust = (
    <View style={s.ust}>
      <View style={s.tamGenislik}>
        <KategoriSekmeleri kategoriler={kategoriler} secili={sekme} onSec={setSekme} />
      </View>
      <View style={s.harita}>
        <SecimHaritasi kisa secilenler={secilenler} digerleri={haritadakiler} odakId={odakId && havuzIle.has(odakId) ? odakId : null} merkez={haritaMerkezi(seyahat, secilenler[0], haritadakiler[0])} baslik={seyahat.name ?? seyahat.city_label} />
      </View>
    </View>
  );

  const alt = (
    <View style={s.yakin}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: yakinAcik }} onPress={() => setYakinAcik((a) => !a)} style={({ pressed }) => [s.yakinBaslik, pressed && { opacity: 0.8 }]}>
        <Text style={s.yakinMetin}>{t('ilOneri.yakindaki')}</Text>
        <Text style={s.atif}>{t('ilOneri.googleAtif')}</Text>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={renk.metin} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <Path d={yakinAcik ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
        </Svg>
      </Pressable>
      {yakinAcik ? (
        google.isPending ? (
          <ActivityIndicator color={renk.ana} style={{ marginVertical: 16 }} />
        ) : google.isError || digerleri.length === 0 ? (
          <Text style={s.bos}>{google.isError ? t('sihirbaz.onerilenler.hata') : t('sihirbaz.onerilenler.bos')}</Text>
        ) : (
          digerleri.map((y, i) => {
            const m = googleMekani(y, false);
            return (
              <YerSatiri
                key={y.place_id}
                ad={y.ad}
                alt={googleAltSatiri(y, merkez)}
                foto={y.foto_uri}
                ayrac={i < digerleri.length - 1}
                ekle={{ listede: havuzIle.has(y.place_id), mesgul: mesgul === y.place_id, onPress: () => degistir(m) }}
                onPress={() => {
                  setOdakId(y.place_id);
                  onAc(m);
                }}
              />
            );
          })
        )
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={gorunen}
      keyExtractor={(y) => y.id}
      contentContainerStyle={s.liste}
      ListHeaderComponent={ust}
      ListFooterComponent={alt}
      ListEmptyComponent={<Text style={s.bos}>{t('sihirbaz.onerilenler.bos')}</Text>}
      keyboardShouldPersistTaps="handled"
      onEndReachedThreshold={0.5}
      onEndReached={() => setFotoSiniri((n) => (n < gorunen.length ? n + FOTO_PARCASI : n))}
      renderItem={({ item, index }) => {
        const m = ilYeriMekani(item, item.place_id ? fotolar.data?.[item.place_id] : null);
        return (
          <YerSatiri
            ad={item.ad}
            alt={ilYeriAltSatiri(item)}
            neden={item.neden}
            foto={m?.foto_uri}
            ayrac={index < gorunen.length - 1}
            ekle={m ? { listede: havuzIle.has(m.place_id), mesgul: mesgul === m.place_id, onPress: () => degistir(m) } : undefined}
            onPress={
              m
                ? () => {
                    setOdakId(m.place_id);
                    onAc(m);
                  }
                : undefined
            }
          />
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  liste: { paddingHorizontal: KENAR, paddingBottom: 16 },
  ust: { paddingBottom: 4 },
  tamGenislik: { marginHorizontal: -KENAR },
  harita: { marginTop: 12 },
  yakin: { marginTop: 14, paddingTop: 12, borderTopWidth: 6, borderTopColor: anaV5.satirZemin },
  yakinBaslik: { minHeight: minDokunma, flexDirection: 'row', alignItems: 'center', gap: 10 },
  yakinMetin: { flex: 1, fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  atif: { fontFamily: yazi.normal, fontSize: 11, color: renk.soluk },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil, textAlign: 'center', paddingVertical: 24 },
});
