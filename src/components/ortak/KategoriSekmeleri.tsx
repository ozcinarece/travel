// #401 KK5–KK6 (`Ekran07cIlOnerileri`): il listesinin kategori satırı — v5 altı çizili sekme (Ana sayfa ve Şehir rehberiyle
// aynı: seçili 700 ve Mürekkep alt çizgi, diğerleri 500 gri), 15 px, 22 aralık; yatayda kayar, dokunma alanı 44 px.
// Sıra: Hepsi + yalnız dolu kategoriler (BO `SUZGEC_SIRASI`). Bugün yalnız sihirbazın il listesi kullanır (listenin dışında,
// başlığın altında sabit); Yer ekle ve Şehir rehberi 2/2b'de aynı bileşene geçecek.
import { ScrollView, StyleSheet, View } from 'react-native';

import { Sekme } from '@/components/ortak/Sekme';
import { kategoriAdi, type IlSekmesi } from '@/features/icerik/ilOnerileri';
import type { IlKategori } from '@/features/yonetim/ilOneri';
import { t } from '@/i18n';
import { anaV5 } from '@/theme';

type Props = { kategoriler: readonly IlKategori[]; secili: IlSekmesi; onSec: (k: IlSekmesi) => void };

export function KategoriSekmeleri({ kategoriler, secili, onSec }: Props) {
  return (
    <View style={s.kap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.satir} accessibilityRole="tablist" accessibilityLabel={t('ilOneri.kategoriEtiketi')} keyboardShouldPersistTaps="handled">
        <Sekme baslik={t('ilOneri.hepsi')} boyut={15} secili={secili === null} onPress={() => onSec(null)} />
        {kategoriler.map((k) => (
          <Sekme key={k} baslik={kategoriAdi(k)} boyut={15} secili={secili === k} onPress={() => onSec(k)} />
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { borderBottomWidth: 1, borderBottomColor: anaV5.cizgi },
  satir: { paddingHorizontal: 16, gap: 22 },
});
