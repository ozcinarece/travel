// #111 şehir fotoğrafları: tarayıcıda WebP'ye çevirme ve 2400 / 1200 / 400 kopyalar (ek servis yok). Yalnız panel (web).
import { olcekle, SEHIR_FOTO } from './sehir';

export type WebpKopyalari = { genislik: number; yukseklik: number; kopyalar: { boyut: number; blob: Blob }[] };

/** Uzun kenar 1600 px'ten kısaysa `foto_kucuk`. Ana kopyanın ölçüsü döner (≤ 2400). */
export async function webpUret(dosya: Blob, kalite = 0.86): Promise<WebpKopyalari> {
  const resim = await createImageBitmap(dosya);
  try {
    if (Math.max(resim.width, resim.height) < SEHIR_FOTO.enAzKenar) throw new Error('foto_kucuk');
    const kopyalar: WebpKopyalari['kopyalar'] = [];
    for (const boyut of SEHIR_FOTO.boyutlar) {
      const o = olcekle(resim.width, resim.height, boyut);
      const tuval = document.createElement('canvas');
      tuval.width = o.genislik;
      tuval.height = o.yukseklik;
      tuval.getContext('2d')!.drawImage(resim, 0, 0, o.genislik, o.yukseklik);
      const blob = await new Promise<Blob | null>((coz) => tuval.toBlob(coz, 'image/webp', kalite));
      if (!blob) throw new Error('foto_cevirme');
      kopyalar.push({ boyut, blob });
    }
    const ana = olcekle(resim.width, resim.height, SEHIR_FOTO.boyutlar[0]);
    return { genislik: ana.genislik, yukseklik: ana.yukseklik, kopyalar };
  } finally {
    resim.close();
  }
}
