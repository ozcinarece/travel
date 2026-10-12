import { useEffect, useEffectEvent, type RefObject } from 'react';

// #107 web sürükle-bırak: react-native-web görünümü bir DOM öğesidir; tarayıcının yerel sürükleme olayları kullanılır
// (yeni bağımlılık yok). Yalnız panelde (web) çağrılır.

type Ogesi = RefObject<unknown>;
const dom = (ref: Ogesi) => ref.current as HTMLElement | null;

/** Liste öğesi: `grup` içinde sürüklenir; bırakılınca onBirak(kaynakIndeks, buIndeks). */
export function useSuruklenen(ref: Ogesi, grup: string, indeks: number, onBirak: (kaynak: number, hedef: number) => void) {
  const tur = `application/x-yonetim-${grup}`;
  const birak = useEffectEvent((kaynak: number) => onBirak(kaynak, indeks));
  const bas = useEffectEvent((e: DragEvent) => e.dataTransfer?.setData(tur, String(indeks)));
  useEffect(() => {
    const el = dom(ref);
    if (!el || typeof el.addEventListener !== 'function') return;
    el.setAttribute('draggable', 'true');
    const ustunde = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(tur)) e.preventDefault();
    };
    const bitti = (e: DragEvent) => {
      const veri = e.dataTransfer?.getData(tur);
      if (!veri) return;
      e.preventDefault();
      birak(Number(veri));
    };
    el.addEventListener('dragstart', bas);
    el.addEventListener('dragover', ustunde);
    el.addEventListener('drop', bitti);
    return () => {
      el.removeEventListener('dragstart', bas);
      el.removeEventListener('dragover', ustunde);
      el.removeEventListener('drop', bitti);
    };
  }, [ref, tur]);
}

/** #111: yalnız bırakma hedefi (sürüklenmez): `grup`tan gelen öğe bu indekse bırakılır (ör. mekan kartı paragraf altına). */
export function useBirakmaHedefi(ref: Ogesi, grup: string, indeks: number, onBirak: (kaynak: number, hedef: number) => void) {
  const tur = `application/x-yonetim-${grup}`;
  const birak = useEffectEvent((kaynak: number) => onBirak(kaynak, indeks));
  useEffect(() => {
    const el = dom(ref);
    if (!el || typeof el.addEventListener !== 'function') return;
    const ustunde = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(tur)) e.preventDefault();
    };
    const bitti = (e: DragEvent) => {
      const veri = e.dataTransfer?.getData(tur);
      if (!veri) return;
      e.preventDefault();
      birak(Number(veri));
    };
    el.addEventListener('dragover', ustunde);
    el.addEventListener('drop', bitti);
    return () => {
      el.removeEventListener('dragover', ustunde);
      el.removeEventListener('drop', bitti);
    };
  }, [ref, tur]);
}

/** Dosya bırakma alanı (KK5): bilgisayardan sürüklenen görseller. */
export function useDosyaBirakma(ref: Ogesi, onDosyalar: (dosyalar: File[]) => void) {
  const al = useEffectEvent((d: File[]) => onDosyalar(d));
  useEffect(() => {
    const el = dom(ref);
    if (!el || typeof el.addEventListener !== 'function') return;
    const ustunde = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const bitti = (e: DragEvent) => {
      const dosyalar = Array.from(e.dataTransfer?.files ?? []);
      if (!dosyalar.length) return;
      e.preventDefault();
      al(dosyalar);
    };
    el.addEventListener('dragover', ustunde);
    el.addEventListener('drop', bitti);
    return () => {
      el.removeEventListener('dragover', ustunde);
      el.removeEventListener('drop', bitti);
    };
  }, [ref]);
}

/** Tarayıcının dosya seçme penceresi (görsel türleri). */
export function dosyaSec(coklu: boolean, onDosyalar: (dosyalar: File[]) => void) {
  const girdi = document.createElement('input');
  girdi.type = 'file';
  girdi.accept = 'image/jpeg,image/png,image/webp';
  girdi.multiple = coklu;
  girdi.onchange = () => onDosyalar(Array.from(girdi.files ?? []));
  girdi.click();
}
