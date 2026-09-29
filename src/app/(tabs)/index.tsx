import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { t } from '@/i18n';
import { renk } from '@/theme';

// İskelet: ekran içeriği Sprint 1'in ilgili PR'ında gelir.
export default function SeyahatlerEkrani() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: renk.zemin }}>
      <EkranBasligi baslik={t('seyahatler.baslik')} alt={t('seyahatler.bos')} />
    </SafeAreaView>
  );
}
