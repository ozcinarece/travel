import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Banner } from '@/components/anasayfa/Banner';
import { Raf } from '@/components/anasayfa/Raf';
import { Ikon } from '@/components/ui/Ikon';
import { LogoYazi } from '@/components/ui/Logo';
import { aktifBanner, kesfetRaflari } from '@/features/anasayfa/raflar';
import { useKesfetAkisi } from '@/features/icerik/kesfetAkisi';
import { useSehirler } from '@/features/icerik/sorgular';
import type { TaslakBolum } from '@/features/yonetim/anaSayfa';
import { t } from '@/i18n';
import { gorunenBolumler } from '@/lib/anaSayfa';
import { anaV5, renk, yazi } from '@/theme';

export const ANA_SAYFA_TELEFON = { genislik: 390, yukseklik: 1180 } as const;

const bos = () => {};

/**
 * #406 2/2 KK4 (UX önerileri kanvası, `Ana_v6_Kesfet`): telefon önizlemesi taslakla — uygulamanın Keşfet'i: üst satır,
 * arama, banner, raflar. Banner ve raflar uygulamanın kendi bileşenleri ve kuralları (`aktifBanner`, `kesfetRaflari`);
 * geziler uygulamanın Keşfet akışından (yalnız yayındakiler; uygulama da yalnız onları görür). Taslakta açık ve tarih
 * aralığındaki bölümler gösterilir. Kullanıcıya özel "Planlamaya devam" satırı önizlemede yok.
 */
export function AnaSayfaOnizleme({ bolumler }: { bolumler: readonly TaslakBolum[] }) {
  const akis = useKesfetAkisi();
  const sehirler = useSehirler();
  const gorunen = useMemo(() => gorunenBolumler(bolumler), [bolumler]);
  const geziler = useMemo(() => akis.data ?? [], [akis.data]);
  const raflar = useMemo(() => kesfetRaflari(gorunen, geziler), [gorunen, geziler]);
  const banner = useMemo(() => aktifBanner(gorunen, geziler, sehirler.data ?? [], raflar), [gorunen, geziler, sehirler.data, raflar]);

  return (
    <View style={s.telefon} testID="ana-sayfa-onizleme">
      <ScrollView contentContainerStyle={s.icerik}>
        <View style={s.ust}>
          <LogoYazi boyut={36} />
          <View style={s.ustDugmeler}>
            <View style={s.daire}>
              <Ikon ad="kalp" boyut={22} renk={renk.ana} kalinlik={2.4} />
            </View>
            <View style={s.seyahatDugme}>
              <Text style={s.seyahatArti}>+</Text>
              <Text style={s.seyahatMetin}>{t('anasayfa.v5.seyahat')}</Text>
            </View>
          </View>
        </View>
        <View style={s.arama}>
          <Ikon ad="ara" boyut={18} renk={renk.metin} kalinlik={2.4} />
          <Text style={s.aramaMetin}>{t('anasayfa.v5.ara')}</Text>
        </View>
        {banner ? <Banner banner={banner} onAc={bos} /> : null}
        {akis.isPending ? (
          <ActivityIndicator color={renk.ana} style={s.yukleniyor} />
        ) : (
          <View style={s.raflar}>
            {raflar.map((r) => (
              <Raf key={r.id} raf={r} onKart={bos} onTumu={bos} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Uygulama Keşfet'inin ölçüleri (src/app/(tabs)/(menu)/index.tsx) — aynı görünüm; üst güvenli alan 42 px.
const s = StyleSheet.create({
  telefon: { width: ANA_SAYFA_TELEFON.genislik, height: ANA_SAYFA_TELEFON.yukseklik, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: renk.ayrac, backgroundColor: renk.zemin },
  icerik: { paddingTop: 42, paddingBottom: 28, gap: 16 },
  ust: { paddingHorizontal: 16, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ustDugmeler: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  daire: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  seyahatDugme: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: renk.vurgu, flexDirection: 'row', alignItems: 'center', gap: 4 },
  seyahatArti: { fontFamily: yazi.kalin, fontSize: 18, lineHeight: 20, color: renk.metin },
  seyahatMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  arama: {
    marginHorizontal: 16,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: anaV5.cizgi,
    backgroundColor: renk.zemin,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: renk.metin,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  aramaMetin: { fontFamily: yazi.normal, fontSize: 15, color: anaV5.ikincil },
  raflar: { gap: 16 },
  yukleniyor: { marginTop: 24 },
});
