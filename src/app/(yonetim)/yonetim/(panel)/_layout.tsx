import { Redirect, Slot, usePathname, type Href } from 'expo-router';

import { useYonetimDurumu } from '@/features/yonetim/admin';
import { yonetimYonu } from '@/features/yonetim/menu';

// #106 KK2: korunan panel sayfaları. Oturum yoksa giriş, admin değilse "Yetkin yok" (ikisi de bu grubun dışında,
// böylece yönlendirme bu gezgini söker ve hedefi üst Slot'ta açar). Admin doğrulanana kadar sayfa çizilmez.
export default function PanelLayout() {
  const durum = useYonetimDurumu();
  const yon = yonetimYonu(durum, usePathname());
  if (yon) return <Redirect href={yon as Href} />;
  return durum.admin === true ? <Slot /> : null;
}
