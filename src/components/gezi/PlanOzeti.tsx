// #181 KK6 (kanvas 23): Plan özeti — yatay kaydırılan gün kartları (gün rengi, gün adı, tema, durak sayısı, saat aralığı; boş
// günde "Mekan ekle"). Karta dokun → Plan sekmesi o gün. Altında otel satırı (yoksa "Otel seçilmedi · Seç").
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import type { GunKarti } from '@/features/gezi/geziOzeti';
import { t } from '@/i18n';
import { gunUstuMetin, renk, yazi } from '@/theme';

import { BolumBasligi, BuzDugme } from './GeziParcalari';

type Props = {
  kartlar: GunKarti[];
  /** Otel satırı: etiket (stays.label) ve gece sayısı; otel yoksa null. */
  otel: { etiket: string; gece: number } | null;
  onPlan: () => void;
  onGun: (k: GunKarti) => void;
  onMekanEkle: () => void;
  onOtel: () => void;
};

export function PlanOzeti({ kartlar, otel, onPlan, onGun, onMekanEkle, onOtel }: Props) {
  return (
    <View style={{ gap: 10 }}>
      <BolumBasligi baslik={t('geziSayfasi.plan')} baglanti={t('geziSayfasi.planiAc')} onBaglanti={onPlan} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.serit} contentContainerStyle={s.seritIc}>
        {kartlar.map((k) => (
          <Pressable
            key={k.gun.id}
            accessibilityRole="button"
            accessibilityLabel={`${k.etiket}, ${k.tema ?? t('geziSayfasi.durakYok')}`}
            onPress={() => (k.durakSayisi === 0 ? onMekanEkle() : onGun(k))}
            style={({ pressed }) => [s.kart, pressed && { opacity: 0.85 }]}>
            <View style={s.kartUst}>
              <View style={[s.no, { backgroundColor: k.renk }]}>
                <Text style={[s.noMetin, { color: gunUstuMetin(k.renk) }]}>{k.gun.index}</Text>
              </View>
              <Text style={s.etiket}>{k.etiket}</Text>
            </View>
            {k.durakSayisi > 0 ? (
              <>
                <Text style={s.tema} numberOfLines={2}>
                  {k.tema}
                </Text>
                <Text style={s.meta} numberOfLines={1}>
                  {k.saat ? t('geziSayfasi.gunMeta', { n: k.durakSayisi, saat: k.saat }) : t('geziSayfasi.gunMetaSaatsiz', { n: k.durakSayisi })}
                </Text>
              </>
            ) : (
              <>
                <Text style={s.bos}>{t('geziSayfasi.durakYok')}</Text>
                <View style={s.ekle}>
                  <Ikon ad="arti" boyut={14} renk={renk.ana} kalinlik={3} />
                  <Text style={s.ekleMetin}>{t('geziSayfasi.mekanEkle')}</Text>
                </View>
              </>
            )}
          </Pressable>
        ))}
      </ScrollView>
      <View style={s.otel}>
        <Ikon ad="yatak" boyut={18} renk={renk.ana} kalinlik={2.3} />
        <Text style={s.otelMetin} numberOfLines={1}>
          {otel ? (
            <>
              <Text style={s.kalin}>{otel.etiket}</Text>
              <Text style={{ color: renk.ikincil }}>{` · ${t('geziSayfasi.gece', { n: otel.gece })}`}</Text>
            </>
          ) : (
            <>
              <Text style={s.kalin}>{t('geziSayfasi.otelYok')}</Text>
              <Text style={{ color: renk.ikincil }}>{` · ${t('geziSayfasi.otelYokAlt')}`}</Text>
            </>
          )}
        </Text>
        <BuzDugme metin={otel ? t('geziSayfasi.degistir') : t('geziSayfasi.sec')} onPress={onOtel} kucuk />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  serit: { marginHorizontal: -20 },
  seritIc: { paddingHorizontal: 20, gap: 10 },
  kart: { width: 150, padding: 12, borderRadius: 16, backgroundColor: renk.zemin, gap: 6 },
  kartUst: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  no: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  noMetin: { fontFamily: yazi.ekstra, fontSize: 12 },
  etiket: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  tema: { fontFamily: yazi.ekstra, fontSize: 13, lineHeight: 16, color: renk.metin },
  meta: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  bos: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.ikincil },
  ekle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ekleMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  otel: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: renk.zemin },
  otelMetin: { flex: 1, fontFamily: yazi.normal, fontSize: 13, color: renk.metin },
  kalin: { fontFamily: yazi.ekstra },
});
