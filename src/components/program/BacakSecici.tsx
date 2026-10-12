import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import type { SeciciSecenegi } from '@/features/program/bacakSecimi';
import { t } from '@/i18n';
import type { BacakSecimi } from '@/schedule/tempo';
import { renk, yazi } from '@/theme';

type Ortak = { secenekler: SeciciSecenegi[]; onSec: (mod: BacakSecimi) => void };

/** Seçici genişliği (kanvas: 200 px). */
export const SECICI_GENISLIK = 200;

const etiket = (mod: SeciciSecenegi['mod']) => (mod === 'yurume' ? t('program.bacak.yurume') : mod === 'araba' ? t('program.bacak.araba') : t('program.bacak.toplu'));
const sure = (o: SeciciSecenegi) => (o.pasif ? t('program.bacak.yakinda') : o.dk === null ? null : `${o.kestirim ? '~' : ''}${o.dk} dk`);

/**
 * #101 KK2 (kanvas LegMode17 ekran 1): haritada hapın üstünde 200 px seçici — başlık "4 → 5 · SAZOVA → PORSUK KAFE",
 * dikey seçenekler Yürüme · Araba · Toplu taşıma (yakında, soluk); her seçenekte kendi süresi; seçili siyah.
 */
export function BacakSecici({ baslik, secenekler, onSec }: Ortak & { baslik: string }) {
  return (
    <View style={[s.kap, s.golge]}>
      <Text style={s.baslik} numberOfLines={1}>
        {baslik}
      </Text>
      {secenekler.map((o) => (
        <Pressable
          key={o.mod}
          accessibilityRole="button"
          accessibilityState={{ selected: o.secili, disabled: o.pasif }}
          disabled={o.pasif}
          onPress={() => o.mod !== 'toplu' && onSec(o.mod)}
          style={({ pressed }) => [s.satir, o.secili && s.satirSecili, o.pasif && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}>
          <Ikon ad={o.mod === 'yurume' ? 'yurume' : o.mod === 'araba' ? 'araba' : 'grup'} boyut={16} renk={o.secili ? renk.zemin : renk.metin} kalinlik={2.2} />
          <Text style={[s.satirMetin, o.secili && { color: renk.zemin }]}>{etiket(o.mod)}</Text>
          {sure(o) !== null ? <Text style={[s.satirSure, o.secili && { color: 'rgba(255,255,255,0.8)' }]}>{sure(o)}</Text> : <ActivityIndicator size="small" color={o.secili ? renk.zemin : renk.ikincil} />}
        </Pressable>
      ))}
    </View>
  );
}

/**
 * #101 KK3 (kanvas LegMode17 ekran 2): panelde bacak satırı açılınca — "NASIL GİDİLİR · 900 m" + üçlü yatay segment
 * (Yürüme 12 dk · Araba 4 dk · yakında). Seçili siyah.
 */
export function BacakSegmenti({ mesafe, secenekler, onSec }: Ortak & { mesafe: string | null }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.segmentBaslik}>{mesafe ? t('program.bacak.baslik', { mesafe }) : t('program.bacak.baslikKisa')}</Text>
      <View style={s.segment}>
        {secenekler.map((o) => (
          <Pressable
            key={o.mod}
            accessibilityRole="button"
            accessibilityState={{ selected: o.secili, disabled: o.pasif }}
            disabled={o.pasif}
            onPress={() => o.mod !== 'toplu' && onSec(o.mod)}
            style={({ pressed }) => [s.parca, o.secili && s.parcaSecili, o.pasif && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}>
            <Ikon ad={o.mod === 'yurume' ? 'yurume' : o.mod === 'araba' ? 'araba' : 'grup'} boyut={14} renk={o.secili ? renk.zemin : renk.metin} kalinlik={2.2} />
            {sure(o) !== null ? <Text style={[s.parcaMetin, o.secili && { color: renk.zemin }, o.pasif && { color: renk.ikincil }]}>{sure(o)}</Text> : <ActivityIndicator size="small" color={o.secili ? renk.zemin : renk.ikincil} />}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { width: SECICI_GENISLIK, padding: 6, borderRadius: 16, backgroundColor: renk.zemin },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 8 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 10.5, letterSpacing: 0.6, color: renk.ikincil, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 10, borderRadius: 12 },
  satirSecili: { backgroundColor: renk.metin },
  satirMetin: { flex: 1, fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  satirSure: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  segmentBaslik: { fontFamily: yazi.ekstra, fontSize: 11, letterSpacing: 0.4, color: renk.ikincil },
  segment: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 14, backgroundColor: '#f6f6f4' },
  parca: { flex: 1, height: 36, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  parcaSecili: { backgroundColor: renk.metin },
  parcaMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.metin },
});
