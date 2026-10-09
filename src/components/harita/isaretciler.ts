// #71: harita işaretçi planı — hangi pin hangi işaretçilerle (PNG daire / iğne, ad etiketi, görünüm) ve HANGİ ANAHTARLA çizilir.
// Anahtar görünüm durumunu içerir (PNG adı, seçili): react-native-maps Android'de `image` / `anchor` yerinde güncellenirken eski
// işaretçi kalabiliyordu (çift pin, hayalet ad); durum değişince işaretçi yeniden kurulur (bitmap yakalaması yok, ucuz) ve
// eskisi kaldırılır. Aynı place_id için en fazla bir pin + bir ad (KK1).
import type { ImageRequireSource } from 'react-native';

import { detayGoster, type GizliEtiketler } from './geo';
import { pinGorselAdi, pinGorseli } from './PinIcerigi';
import type { HaritaPini } from './tipler';

export type Isaretci =
  | { tur: 'png'; anahtar: string; pin: HaritaPini; gorsel: ImageRequireSource; detay: boolean }
  | { tur: 'ad'; anahtar: string; pin: HaritaPini; detay: boolean }
  | { tur: 'gorunum'; anahtar: string; pin: HaritaPini; detay: boolean; etiketGizli: boolean };

export function isaretciPlani(gorunen: HaritaPini[], gizli: GizliEtiketler, zoom: number, gorsellerHazir: boolean): Isaretci[] {
  const plan: Isaretci[] = [];
  const gorulen = new Set<string>();
  for (const p of gorunen) {
    // KK1: aynı kimlik iki kez gelirse (üst katman hatası) ikincisi çizilmez.
    if (gorulen.has(p.id)) continue;
    gorulen.add(p.id);
    const detay = detayGoster(p, zoom) && !gizli.detay.has(p.id);
    const etiketGizli = gizli.etiket.has(p.id);
    const gorsel = pinGorseli(p);
    if (!gorsel) {
      plan.push({ tur: 'gorunum', anahtar: `${p.id}|g`, pin: p, detay, etiketGizli });
      continue;
    }
    // PNG işaretçileri görseller belleğe alınmadan hiç çizilmez (#61 §6).
    if (!gorsellerHazir) continue;
    plan.push({ tur: 'png', anahtar: `${p.id}|${pinGorselAdi(p)}|${p.secili ? 's' : ''}`, pin: p, gorsel, detay });
    if (p.ad && !etiketGizli) plan.push({ tur: 'ad', anahtar: `${p.id}|ad|${p.secili ? 's' : ''}`, pin: p, detay });
  }
  return plan;
}

/**
 * #71 KK2: bu pinin işaretçisi (PNG, görünüm ya da yalnız-ad) dokunuşu `onPinBas`'a iletir mi? Rota hapı ve kullanıcı konumu
 * hariç hepsi. Android `MapMarker`'da `tappable` olmadığından pinin üstündeki ad işaretçisi de iletmek ZORUNDA — yoksa
 * dokunuş onda biter (Google Maps alttaki işaretçiye düşürmez).
 */
export function dokunusuIletir(p: HaritaPini): boolean {
  return p.tur !== 'etiket' && p.tur !== 'konum';
}
