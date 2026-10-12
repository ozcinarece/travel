import { YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { ty } from '@/features/yonetim/metin';

// #106 kabuk: başlık; içerik sonraki backoffice issue'larında (#107–#111).
export default function GenelBakisSayfasi() {
  return <YonetimSayfasi baslik={ty('menu.genel')} />;
}
