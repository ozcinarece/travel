// #98 KK4 · 3. adım "Nerede kalıyorsun?": "Bütün gecelerde aynı otel" anahtarı (varsayılan açık) → tek seçim; kapalıyken her
// gece satırı "+ Otel ekle". Seçimler anında yazılır (atlanan gece sonra Program'dan tamamlanır).
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import type { Konaklama } from '@/features/konaklama/plan';
import { useGeceOteliKaydet, useTumGunlereOtel, type OtelSecimiVeyaKayitli } from '@/features/konaklama/sorgular';
import { gecePlani, geceler, geceninOteli, type Gece } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import type { Gun, Seyahat } from '@/lib/tipler';
import { minDokunma, renk, yazi } from '@/theme';

import { OtelSecSayfasi } from './OtelSecSayfasi';

type Props = { seyahat: Seyahat; gunler: Gun[]; konaklamalar: Konaklama[]; onHata: (m: string | null) => void };

export function AdimOteller({ seyahat, gunler, konaklamalar, onHata }: Props) {
  const liste = geceler(gunler);
  const otelAdi = (id: string | null) => (id ? (konaklamalar.find((k) => k.id === id)?.label ?? t('otel.adsiz')) : null);
  const farkli = new Set(liste.map(geceninOteli).filter(Boolean));
  const [hepsiAyni, setHepsiAyni] = useState(farkli.size <= 1);
  const [secilen, setSecilen] = useState<Gece | 'hepsi' | null>(null);
  const hepsine = useTumGunlereOtel(seyahat.id);
  const geceye = useGeceOteliKaydet(seyahat.id);
  const ilkOtel = liste.length > 0 ? geceninOteli(liste[0]) : (gunler[0]?.start_stay_id ?? null);
  const mesgul = hepsine.isPending || geceye.isPending;

  const sec = async (otel: OtelSecimiVeyaKayitli) => {
    const hedef = secilen;
    setSecilen(null);
    onHata(null);
    try {
      if (hedef === 'hepsi') {
        const o = otel && 'stayId' in otel ? konaklamalar.find((k) => k.id === otel.stayId) : otel;
        await hepsine.mutateAsync(o ? { place_id: o.place_id, ad: 'label' in o ? (o.label ?? t('otel.adsiz')) : o.ad, lat: o.lat, lng: o.lng } : null);
      } else if (hedef) {
        await geceye.mutateAsync({ konaklamalar, otel, guncellemeler: (id) => gecePlani(hedef, id) });
      }
    } catch {
      onHata(t('sihirbaz.oteller.kaydetHata'));
    }
  };

  return (
    <View style={s.kap}>
      <View style={s.anahtar}>
        <Text style={s.anahtarMetin}>{t('sihirbaz.oteller.hepsiAyni')}</Text>
        <Switch accessibilityLabel={t('sihirbaz.oteller.hepsiAyni')} value={hepsiAyni} onValueChange={setHepsiAyni} trackColor={{ true: renk.metin, false: renk.ayrac }} />
      </View>
      {hepsiAyni ? (
        <OtelSatiri etiket={null} ad={otelAdi(ilkOtel)} ekleMetni={t('sihirbaz.oteller.otelSec')} pasif={mesgul} onPress={() => setSecilen('hepsi')} />
      ) : (
        liste.map((g) => <OtelSatiri key={g.sira} etiket={g.etiket} ad={otelAdi(geceninOteli(g))} ekleMetni={t('sihirbaz.oteller.otelEkle')} pasif={mesgul} onPress={() => setSecilen(g)} />)
      )}
      <Text style={s.not}>{t('sihirbaz.oteller.not')}</Text>
      <OtelSecSayfasi
        acik={secilen !== null}
        baslik={secilen && secilen !== 'hepsi' ? t('sihirbaz.oteller.secBaslikGece', { gece: secilen.etiket }) : t('sihirbaz.oteller.secBaslik')}
        seyahat={seyahat}
        konaklamalar={konaklamalar}
        onKapat={() => setSecilen(null)}
        onSec={sec}
      />
    </View>
  );
}

function OtelSatiri({ etiket, ad, ekleMetni, pasif, onPress }: { etiket: string | null; ad: string | null; ekleMetni: string; pasif: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={pasif} onPress={onPress} style={({ pressed }) => [s.satir, !ad && s.satirBos, pressed && { opacity: 0.8 }]}>
      <View style={[s.ikon, !ad && s.ikonBos]}>{ad ? <Ikon ad="ev" boyut={16} renk={renk.zemin} kalinlik={2.2} /> : <Text style={s.arti}>+</Text>}</View>
      <View style={{ flex: 1, gap: 2 }}>
        {etiket ? <Text style={s.etiket}>{etiket}</Text> : null}
        <Text style={[s.ad, !ad && { color: renk.ikincil }]} numberOfLines={1}>
          {ad ?? ekleMetni}
        </Text>
      </View>
      <Text style={s.degistir}>{ad ? t('sihirbaz.oteller.degistir') : ''}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  kap: { gap: 10 },
  anahtar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, minHeight: minDokunma },
  anahtarMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: renk.yuzey, minHeight: 60 },
  satirBos: { backgroundColor: renk.zemin, borderWidth: 1, borderStyle: 'dashed', borderColor: '#c4c4c4' },
  ikon: { width: 36, height: 36, borderRadius: 10, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  ikonBos: { backgroundColor: renk.yuzey },
  arti: { fontFamily: yazi.kalin, fontSize: 20, lineHeight: 22, color: renk.metin },
  etiket: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  ad: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  degistir: { fontFamily: yazi.kalin, fontSize: 12, color: renk.vurgu },
  not: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 17, color: renk.ikincil, paddingTop: 4 },
});
