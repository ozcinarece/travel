import { YakindaEkrani } from '@/components/gezi/YakindaEkrani';
import { t } from '@/i18n';

/** #181 KK3: Sohbet #184 (D) ile gelir; o zamana kadar "Yakında". */
export default function SohbetSekmesi() {
  return <YakindaEkrani baslik={t('seyahatMenusu.sohbet')} ikon="sohbet" metin={t('seyahatMenusu.sohbetYakinda')} />;
}
