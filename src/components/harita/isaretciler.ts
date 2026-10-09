// #71: harita işaretçi planı — hangi pin hangi işaretçilerle (PNG daire / iğne, ad etiketi, görünüm) ve HANGİ ANAHTARLA çizilir.
// Anahtar görünüm durumunu içerir (PNG adı, seçili): react-native-maps Android'de `image` / `anchor` yerinde güncellenirken eski
// işaretçi kalabiliyordu (çift pin, hayalet ad); durum değişince işaretçi yeniden kurulur (bitmap yakalaması yok, ucuz) ve
// eskisi kaldırılır. Aynı place_id için en fazla bir pin + bir ad (KK1).
import type { ImageRequireSource } from 'react-native';

import { detayGoster, isaretciImzasi, type GizliEtiketler } from './geo';
import { pinGorselAdi, pinGorseli } from './PinIcerigi';
import type { HaritaPini } from './tipler';

export type Isaretci =
  | { tur: 'png'; anahtar: string; pin: HaritaPini; gorsel: ImageRequireSource; detay: boolean }
  | { tur: 'ad'; anahtar: string; pin: HaritaPini; detay: boolean }
  | { tur: 'gorunum'; anahtar: string; pin: HaritaPini; detay: boolean; etiketGizli: boolean };

/**
 * `seciliId` (#75): seçim pin listesinden ayrı gelir — listede ve `gizli` hesabında seçili yoktur; burada yalnız o pine
 * `secili` işlenir (adı hep görünür, ★ satırı açık). Böylece seçim değişince yalnız eski + yeni seçilinin anahtarları değişir.
 */
export function isaretciPlani(gorunen: HaritaPini[], gizli: GizliEtiketler, zoom: number, gorsellerHazir: boolean, seciliId: string | null = null): Isaretci[] {
  const plan: Isaretci[] = [];
  const gorulen = new Set<string>();
  for (const ham of gorunen) {
    // KK1: aynı kimlik iki kez gelirse (üst katman hatası) ikincisi çizilmez.
    if (gorulen.has(ham.id)) continue;
    gorulen.add(ham.id);
    const p = seciliId !== null && ham.id === seciliId && !ham.secili ? { ...ham, secili: true } : ham;
    const detay = detayGoster(p, zoom) && !gizli.detay.has(p.id);
    const etiketGizli = gizli.etiket.has(p.id) && !p.secili;
    const gorsel = pinGorseli(p);
    if (!gorsel) {
      // #77: görünümlü işaretçinin anahtarı görünüm imzasını taşır (numara, renk, seçili, ad, puan…): görünüm değişince
      // işaretçi yeniden kurulur, eskisi kaldırılır — Android'de yerinde ikon güncellemesi eski bitmap'i bırakıyordu
      // (diğer güne geçince numaralı pin, seçilince altında kalan daire, çift ad).
      plan.push({ tur: 'gorunum', anahtar: `${p.id}|g|${isaretciImzasi(p, etiketGizli, detay)}`, pin: p, detay, etiketGizli });
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

/**
 * #75 KK2: iki plan arasında yeniden kurulan / kaldırılan / eklenen işaretçi sayısı — anahtarı değişen (pin, tür) yuvaları
 * (eski seçilinin pini ve adı, yeni seçilinin pini ve adı → en çok 4). Anahtarı aynı kalan işaretçiye dokunulmaz.
 */
export function planFarki(onceki: Isaretci[], yeni: Isaretci[]): number {
  const a = new Set(onceki.map((i) => i.anahtar));
  const b = new Set(yeni.map((i) => i.anahtar));
  const yuvalar = new Set<string>();
  for (const i of onceki) if (!b.has(i.anahtar)) yuvalar.add(`${i.pin.id}|${i.tur}`);
  for (const i of yeni) if (!a.has(i.anahtar)) yuvalar.add(`${i.pin.id}|${i.tur}`);
  return yuvalar.size;
}
