import { Image } from 'expo-image';
import { useMemo, useState, type CSSProperties } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import type { YonetimSehri } from '@/features/yonetim/geziSorgulari';
import { ty } from '@/features/yonetim/metin';
import type { YonetimYeri } from '@/features/yonetim/yerSorgulari';
import type { HafifYer, Merkez } from '@/features/yerler/api';
import { kategoriPini, pinKategorisi } from '@/lib/pinIkonu';
import { yazi } from '@/theme';

import { Hap } from '../Hap';
import { MekanArama } from '../gezi/MekanArama';
import { yRenk } from '../tema';

type Props = {
  yerler: YonetimYeri[];
  sehirler: YonetimSehri[];
  sehirId: string;
  onSehir: (id: string) => void;
  seciliId: string | undefined;
  onSec: (id: string) => void;
  onYeni: (yer: HafifYer) => Promise<void>;
};

// Kanvastaki "Eskişehir ▾" hapı: tarayıcının seçim denetimi, hap görünümünde (34 px, 1,5 #d9d9d4, 12,5 px 800).
const hapSecim: CSSProperties = {
  height: 34,
  padding: '0 14px',
  borderRadius: 999,
  border: `1.5px solid ${yRenk.cerceve}`,
  background: yRenk.zemin,
  color: yRenk.metin,
  fontFamily: yazi.ekstra,
  fontSize: 12.5,
  boxSizing: 'border-box',
  minWidth: 0,
  flexShrink: 1,
};

/** KK1 (kanvas ekran 4 sol sütun, 240 px): "+ Yer" (Google → place_id), şehir seçici, satır: 36 px kapak, ad, kategori · rehber ✓/yok. */
export function YerListesi({ yerler, sehirler, sehirId, onSehir, seciliId, onSec, onYeni }: Props) {
  const [ekle, setEkle] = useState(false);
  const gorunen = useMemo(() => yerler.filter((y) => !sehirId || y.sehir_id === sehirId), [yerler, sehirId]);
  const sehir = sehirler.find((s) => s.id === sehirId);
  const merkez: Merkez | undefined = sehir ? { lat: sehir.lat, lng: sehir.lng, yaricapM: 20000 } : undefined;

  return (
    <View style={s.kap}>
      <View style={s.ust}>
        <Hap tur="birincil" baslik={ty('yer.yeni')} onPress={() => setEkle((a) => !a)} />
        <select aria-label={ty('yer.alan.sehir')} value={sehirId} onChange={(e) => onSehir(e.target.value)} style={hapSecim}>
          <option value="">{ty('yer.tumSehirler')}</option>
          {sehirler.map((sh) => (
            <option key={sh.id} value={sh.id}>
              {`${sh.ad} ▾`}
            </option>
          ))}
        </select>
      </View>
      {ekle ? (
        <View style={s.ekle}>
          <MekanArama
            merkez={merkez}
            etiket={ty('yer.yeniAra')}
            onSec={async (yer) => {
              await onYeni(yer);
              setEkle(false);
            }}
          />
        </View>
      ) : null}
      <ScrollView contentContainerStyle={s.liste}>
        {gorunen.map((y) => {
          const secili = y.id === seciliId;
          const kat = kategoriPini(y.kategori);
          return (
            <Pressable key={y.id} accessibilityRole="button" accessibilityState={{ selected: secili }} onPress={() => onSec(y.id)} style={StyleSheet.flatten([s.satir, secili && s.satirSecili])}>
              <View style={[s.kapak, { backgroundColor: kat.kategoriRenk }]}>
                {y.kapak_url ? <Image source={{ uri: y.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
              <View style={s.metinler}>
                <Text style={s.ad} numberOfLines={1}>
                  {y.ad}
                </Text>
                <View style={s.alt}>
                  <Ikon ad={kat.ikon} boyut={10} renk={kat.kategoriRenk} kalinlik={2.2} />
                  <Text style={s.altMetin} numberOfLines={1}>
                    {ty(y.rehber_md?.trim() ? 'yer.rehberVar' : 'yer.rehberYok', { kategori: pinKategorisi(y.kategori) })}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { width: 240, flexShrink: 0, borderRightWidth: 1, borderRightColor: yRenk.ayrac, paddingVertical: 14, paddingHorizontal: 10, gap: 2 },
  ust: { flexDirection: 'row', gap: 6, paddingHorizontal: 2, paddingBottom: 8 },
  ekle: { paddingHorizontal: 2, paddingBottom: 8 },
  liste: { gap: 2 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  satirSecili: { backgroundColor: yRenk.yuzey },
  kapak: { width: 36, height: 36, borderRadius: 9, overflow: 'hidden' },
  metinler: { flex: 1, minWidth: 0 },
  ad: { fontFamily: yazi.ekstra, fontSize: 12.5, color: yRenk.metin },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  altMetin: { flexShrink: 1, fontFamily: yazi.kalin, fontSize: 10.5, color: yRenk.ikincil },
});
