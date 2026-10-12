// #97 B KK3 / #100 KK4: kalp — her yerde aynı (gezi sayfası, kart, mekan paneli); kaydedilenler'e yazar.
import { Pressable, StyleSheet } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { useKaydedilenler, useKaydet } from '@/features/icerik/sorgular';
import { t } from '@/i18n';
import type { KaydedilenTuru } from '@/lib/tipler';
import { renk } from '@/theme';

export function useKayitli(tur: KaydedilenTuru, hedefId: string | undefined): boolean {
  const k = useKaydedilenler();
  return !!hedefId && !!k.data?.some((x) => x.tur === tur && x.hedef_id === hedefId);
}

export function Kalp({ tur, hedefId, koyu, boyut = 36, arkaPlan }: { tur: KaydedilenTuru; hedefId: string; koyu?: boolean; boyut?: number; /** Açık zeminde (beyaz panel) daire rengi. */ arkaPlan?: string }) {
  const kayitli = useKayitli(tur, hedefId);
  const kaydet = useKaydet();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={kayitli ? t('gezi.kaydedildi') : t('gezi.kaydet')}
      accessibilityState={{ selected: kayitli }}
      onPress={() => kaydet.mutate({ tur, hedef_id: hedefId, kayitli })}
      hitSlop={6}
      style={[s.dugme, { width: boyut, height: boyut, borderRadius: boyut / 2 }, koyu ? s.koyu : s.acik, arkaPlan ? { backgroundColor: arkaPlan } : null]}>
      <Ikon ad={kayitli ? 'kalpDolu' : 'kalp'} boyut={Math.round(boyut * 0.5)} renk={kayitli ? renk.vurgu : koyu ? renk.zemin : renk.metin} kalinlik={2.2} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  dugme: { alignItems: 'center', justifyContent: 'center' },
  acik: { backgroundColor: renk.zemin },
  koyu: { backgroundColor: 'rgba(15,15,15,0.45)' },
});
