import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SehirRehberi } from '@/components/icerik/SehirRehberi';
import { Aciklama, YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { NeredeGorunur } from '@/components/yonetim/sehir/NeredeGorunur';
import { yRenk } from '@/components/yonetim/tema';
import { ty } from '@/features/yonetim/metin';
import { sehirAlanlari, useYonetimSehir } from '@/features/yonetim/sehirSorgulari';

// #111 / #156 "Önizle" (yeni sekme): canlı rehber, uygulamanın kendi `SehirRehberi`yle telefon boyutunda (yayınlanmış bölümler;
// taslak editördeki önizlemede) + görsellerin göründüğü yerler.
export default function SehirOnizlemeSayfasi() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const sehir = useYonetimSehir(id);
  // Uygulamanın önbelleği panelinkinden ayrı (uygulama sorgu anahtarları paneldekilerle çakışmasın).
  const [istemci] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  if (!sehir.data) {
    return (
      <YonetimSayfasi baslik={ty('sehir.onizleme')}>
        <Aciklama>{ty(sehir.isError ? 'sehir.yuklenemedi' : 'genel.yukleniyor')}</Aciklama>
      </YonetimSayfasi>
    );
  }
  const d = sehir.data;
  return (
    <YonetimSayfasi baslik={ty('sehir.onizlemeBaslik', { ad: d.ad })}>
      <View style={s.satir}>
        <View style={s.telefon}>
          <QueryClientProvider client={istemci}>
            <SehirRehberi sehir={{ id: d.id, ad: d.ad, slug: d.slug, kapak_url: d.kapak_url, lat: d.lat, lng: d.lng, ozet: d.ozet }} sehirlerYukleniyor={false} onGeri={() => {}} />
          </QueryClientProvider>
        </View>
        <NeredeGorunur id={d.id} taslak={sehirAlanlari(d)} gezi={d.geziler?.[0]?.count ?? 0} komsu={undefined} />
      </View>
    </YonetimSayfasi>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  telefon: { width: 390, height: 844, borderRadius: 32, borderWidth: 8, borderColor: yRenk.metin, overflow: 'hidden', backgroundColor: yRenk.zemin },
});
