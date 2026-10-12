import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { geziDurumu } from '@/features/yonetim/gezi';
import type { YonetimGeziOzeti, YonetimSehri } from '@/features/yonetim/geziSorgulari';
import { ty } from '@/features/yonetim/metin';
import { yazi } from '@/theme';

import { DurumRozeti, MetinKutusu, SecimKutusu } from '../Form';
import { Hap } from '../Hap';
import { yRenk } from '../tema';

type Props = {
  geziler: YonetimGeziOzeti[];
  sehirler: YonetimSehri[];
  seciliId: string | undefined;
  onSec: (id: string) => void;
  onYeni: () => void;
  yeniMesgul: boolean;
};

/** KK1 (kanvas ekran 2 sol sütun, 240 px): "+ Yeni gezi" · Filtre (arama + şehir), gezi satırları ve durum rozeti. */
export function GeziListesi({ geziler, sehirler, seciliId, onSec, onYeni, yeniMesgul }: Props) {
  const [filtreAcik, setFiltreAcik] = useState(false);
  const [arama, setArama] = useState('');
  const [sehir, setSehir] = useState('');
  const gorunen = useMemo(() => {
    const a = arama.trim().toLocaleLowerCase('tr-TR');
    return geziler.filter((g) => (!sehir || g.sehir_id === sehir) && (!a || g.baslik.toLocaleLowerCase('tr-TR').includes(a)));
  }, [geziler, arama, sehir]);

  return (
    <View style={s.kap}>
      <View style={s.ust}>
        <Hap tur="birincil" baslik={ty('gezi.yeni')} onPress={onYeni} yukleniyor={yeniMesgul} />
        <Hap baslik={ty('gezi.filtre')} onPress={() => setFiltreAcik((a) => !a)} />
      </View>
      {filtreAcik ? (
        <View style={s.filtre}>
          <MetinKutusu value={arama} onChangeText={setArama} placeholder={ty('gezi.ara')} accessibilityLabel={ty('gezi.ara')} />
          <SecimKutusu
            etiket={ty('gezi.alan.sehir')}
            deger={sehir}
            onDegis={setSehir}
            secenekler={[{ deger: '', etiket: ty('gezi.tumSehirler') }, ...sehirler.map((sh) => ({ deger: sh.id, etiket: sh.ad }))]}
          />
        </View>
      ) : null}
      <ScrollView contentContainerStyle={s.liste}>
        {gorunen.map((g) => {
          const durum = geziDurumu(g);
          const secili = g.id === seciliId;
          return (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              accessibilityState={{ selected: secili }}
              onPress={() => onSec(g.id)}
              style={StyleSheet.flatten([s.satir, secili && s.satirSecili])}>
              <Text style={s.baslik} numberOfLines={2}>
                {g.baslik}
              </Text>
              <View style={s.alt}>
                <Text style={s.altMetin} numberOfLines={1}>
                  {ty('gezi.alt', { sehir: g.sehirler?.ad ?? '', n: g.gun_sayisi })}
                </Text>
                <DurumRozeti durum={durum} etiket={ty(`gezi.durum.${durum}`)} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { width: 240, flexShrink: 0, borderRightWidth: 1, borderRightColor: yRenk.ayrac, paddingVertical: 14, paddingHorizontal: 10, gap: 4 },
  ust: { flexDirection: 'row', gap: 6, paddingHorizontal: 2, paddingBottom: 8 },
  filtre: { gap: 6, paddingHorizontal: 2, paddingBottom: 8 },
  liste: { gap: 4 },
  satir: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, gap: 3 },
  satirSecili: { backgroundColor: yRenk.yuzey },
  baslik: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.metin },
  alt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  altMetin: { flexShrink: 1, fontFamily: yazi.yari, fontSize: 11, color: yRenk.ikincil },
});
