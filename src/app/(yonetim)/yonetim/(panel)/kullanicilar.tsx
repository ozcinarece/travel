import { YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { ty } from '@/features/yonetim/metin';

// #106 kabuk: başlık; içerik sonraki backoffice issue'larında (#107–#111).
export default function KullanicilarSayfasi() {
  return <YonetimSayfasi baslik={ty('menu.kullanicilar')} />;
}
