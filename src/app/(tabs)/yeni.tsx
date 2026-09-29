import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { t } from '@/i18n';
import { renk } from '@/theme';

// İskelet: ekran içeriği Sprint 1'in ilgili PR'ında gelir.
export default function YeniEkrani() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: renk.zemin }}>
      <EkranBasligi baslik={t('yeni.baslik')} />
    </SafeAreaView>
  );
}
