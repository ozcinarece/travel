import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ty } from '@/features/yonetim/metin';
import type { YonetimSehirDetayi } from '@/features/yonetim/sehirSorgulari';
import { hafifYerler, useOneriler, yeniOturumJetonu, type HafifYer } from '@/features/yerler/api';
import { yazi } from '@/theme';

import { MetinKutusu } from '../Form';
import { Hap } from '../Hap';
import { yRenk } from '../tema';
import { GorselYaDaGradyan } from './Gradyan';

type Props = {
  sehirler: YonetimSehirDetayi[];
  seciliId: string | undefined;
  onSec: (id: string) => void;
  onYeni: (yer: HafifYer) => Promise<void>;
};

/**
 * KK1 (kanvas Sehir19 sol sütun, 240 px): "+ Şehir" (Google şehir araması), "Ara" (ada göre süzer), satır: 36 px kapak
 * (karo; yoksa gradyan), ad 12,5 px 800, "N gezi · yayında / taslak" 10,5 px 700 gri; seçili satır #f6f6f4.
 */
export function SehirListesi({ sehirler, seciliId, onSec, onYeni }: Props) {
  const [mod, setMod] = useState<'yeni' | 'ara' | null>(null);
  const [suzgec, setSuzgec] = useState('');
  const gorunen = useMemo(() => {
    const q = suzgec.trim().toLocaleLowerCase('tr-TR');
    return q ? sehirler.filter((s) => s.ad.toLocaleLowerCase('tr-TR').includes(q) || s.slug.includes(q)) : sehirler;
  }, [sehirler, suzgec]);

  return (
    <View style={s.kap}>
      <View style={s.ust}>
        <Hap tur="birincil" baslik={ty('sehir.yeni')} onPress={() => setMod((m) => (m === 'yeni' ? null : 'yeni'))} />
        <Hap baslik={ty('sehir.ara')} onPress={() => setMod((m) => (m === 'ara' ? null : 'ara'))} />
      </View>
      {mod === 'ara' ? (
        <View style={s.alt}>
          <MetinKutusu autoFocus value={suzgec} onChangeText={setSuzgec} placeholder={ty('sehir.araYer')} accessibilityLabel={ty('sehir.araYer')} />
        </View>
      ) : null}
      {mod === 'yeni' ? (
        <View style={s.alt}>
          <SehirArama
            onSec={async (y) => {
              await onYeni(y);
              setMod(null);
            }}
          />
        </View>
      ) : null}
      <ScrollView contentContainerStyle={s.liste}>
        {gorunen.map((sh) => {
          const secili = sh.id === seciliId;
          const gezi = sh.geziler?.[0]?.count ?? 0;
          return (
            <Pressable key={sh.id} accessibilityRole="button" accessibilityState={{ selected: secili }} onPress={() => onSec(sh.id)} style={StyleSheet.flatten([s.satir, secili && s.satirSecili])}>
              <GorselYaDaGradyan uri={sh.kapak_url} anahtar={sh.id} style={s.kapak} />
              <View style={s.metinler}>
                <Text style={s.ad} numberOfLines={1}>
                  {sh.ad}
                </Text>
                <Text style={s.altMetin} numberOfLines={1}>
                  {ty(sh.yayin ? 'sehir.satirYayinda' : 'sehir.satirTaslak', { n: gezi })}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** "+ Şehir": Google Autocomplete (yalnız şehirler), seçimde konum (places-light, şehir maskesi). Satırlar MekanArama stiliyle. */
function SehirArama({ onSec }: { onSec: (yer: HafifYer) => Promise<void> }) {
  const [girdi, setGirdi] = useState('');
  const [oturum, setOturum] = useState(yeniOturumJetonu);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState(false);
  const oneriler = useOneriler('yonetim-sehir', girdi, oturum, 'cities');
  const sec = async (placeId: string) => {
    setMesgul(true);
    setHata(false);
    try {
      const [yer] = await hafifYerler([placeId], { sehir: true, oturum });
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
  return (
    <View style={s.arama}>
      <View style={s.kutu}>
        <TextInput autoFocus value={girdi} onChangeText={setGirdi} placeholder={ty('sehir.yeniAra')} placeholderTextColor={yRenk.ikincil} accessibilityLabel={ty('sehir.yeniAra')} style={s.girdi} />
        {mesgul || oneriler.isFetching ? <ActivityIndicator size="small" color={yRenk.ikincil} /> : null}
      </View>
      {hata ? <Text style={s.hata}>{ty('sehir.eklenemedi')}</Text> : null}
      {(oneriler.data ?? []).map((o) => (
        <Pressable key={o.place_id} accessibilityRole="button" disabled={mesgul} onPress={() => sec(o.place_id)} style={s.sonuc}>
          <Text style={s.sonucAd} numberOfLines={1}>
            {o.ana}
            {o.ikincil ? <Text style={s.sonucAlt}>{` · ${o.ikincil}`}</Text> : null}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { width: 240, flexShrink: 0, borderRightWidth: 1, borderRightColor: yRenk.ayrac, paddingVertical: 14, paddingHorizontal: 10, gap: 2 },
  ust: { flexDirection: 'row', gap: 6, paddingHorizontal: 2, paddingBottom: 8 },
  alt: { paddingHorizontal: 2, paddingBottom: 8 },
  liste: { gap: 2 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  satirSecili: { backgroundColor: yRenk.yuzey },
  kapak: { width: 36, height: 36, borderRadius: 9 },
  metinler: { flex: 1, minWidth: 0 },
  ad: { fontFamily: yazi.ekstra, fontSize: 12.5, color: yRenk.metin },
  altMetin: { fontFamily: yazi.kalin, fontSize: 10.5, color: yRenk.ikincil },
  arama: { gap: 6 },
  kutu: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: yRenk.cerceve },
  girdi: { flex: 1, minWidth: 0, fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.metin },
  hata: { fontFamily: yazi.yari, fontSize: 11, color: '#ff5a1f' },
  sonuc: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: yRenk.ayrac },
  sonucAd: { fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.metin },
  sonucAlt: { fontFamily: yazi.yari, fontSize: 11, color: yRenk.ikincil },
});
