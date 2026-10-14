import { YakindaEkrani } from '@/components/gezi/YakindaEkrani';
import { t } from '@/i18n';

/** #181 KK3: Harcamalar #183 (C) ile gelir; o zamana kadar "Yakında". */
export default function HarcamaSekmesi() {
  return <YakindaEkrani baslik={t('seyahatMenusu.harcamaBaslik')} ikon="cuzdan" metin={t('seyahatMenusu.harcamaYakinda')} />;
}
