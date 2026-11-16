/**
 * #270: sohbete yüklenen fotoğraftan konum meta verisini yalnız JS ile siler (yeni paket yok).
 * - JPEG: EXIF içindeki GPS IFD'si sıfırlanır (girdiler ve işaret ettikleri veri); yön (orientation) gibi diğer
 *   alanlar kalır, fotoğraf yan dönmez. XMP (APP1, Adobe) ve IPTC (APP13) blokları tamamen çıkarılır.
 * - PNG: `eXIf` parçası çıkarılır.
 * - Başka biçim ya da tanınmayan yapı: bayt dizisi olduğu gibi döner (bozmaktansa dokunmamak).
 */
export function konumuTemizle(girdi: Uint8Array): Uint8Array {
  if (jpegMi(girdi)) return jpegTemizle(girdi);
  if (pngMi(girdi)) return pngTemizle(girdi);
  return girdi;
}

const jpegMi = (b: Uint8Array) =>
  b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
const PNG_IMZA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const pngMi = (b: Uint8Array) =>
  b.length > 8 && PNG_IMZA.every((x, i) => b[i] === x);

function ascii(b: Uint8Array, bas: number, uzunluk: number): string {
  let s = "";
  for (let i = 0; i < uzunluk && bas + i < b.length; i++)
    s += String.fromCharCode(b[bas + i]);
  return s;
}

function jpegTemizle(girdi: Uint8Array): Uint8Array {
  const b = girdi.slice();
  const parcalar: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return girdi; // beklenmeyen yapı
    let j = i;
    while (j < b.length && b[j] === 0xff) j++; // dolgu baytları
    const isaret = b[j];
    if (isaret === undefined) return girdi;
    // SOS (görüntü verisi) ya da EOI: geri kalan olduğu gibi kopyalanır.
    if (isaret === 0xda || isaret === 0xd9) {
      parcalar.push(b.subarray(i));
      break;
    }
    // Uzunluksuz işaretler (RSTn, TEM).
    if ((isaret >= 0xd0 && isaret <= 0xd7) || isaret === 0x01) {
      parcalar.push(b.subarray(i, j + 1));
      i = j + 1;
      continue;
    }
    if (j + 2 >= b.length) return girdi;
    const uzunluk = (b[j + 1] << 8) | b[j + 2];
    const son = j + 1 + uzunluk;
    if (uzunluk < 2 || son > b.length) return girdi;
    const veri = j + 3;
    if (isaret === 0xe1 && ascii(b, veri, 6) === "Exif\0\0") {
      if (!gpsSifirla(b, veri + 6, son)) return girdi;
      parcalar.push(b.subarray(i, son));
    } else if (isaret === 0xe1 || isaret === 0xed) {
      // XMP (konum içerebilir) ve IPTC: atılır.
    } else {
      parcalar.push(b.subarray(i, son));
    }
    i = son;
  }
  return birlestir(parcalar);
}

const TUR_BOYU: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
};

/** TIFF başlığı `t`'de, blok `son`'da biter. GPS IFD'sini yerinde sıfırlar; yapı bozuksa false. */
function gpsSifirla(b: Uint8Array, t: number, son: number): boolean {
  const kucuk = ascii(b, t, 2) === "II";
  if (!kucuk && ascii(b, t, 2) !== "MM") return false;
  const u16 = (o: number) =>
    kucuk ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1];
  const u32 = (o: number) =>
    (kucuk
      ? b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)
      : (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const icinde = (o: number, n: number) => o >= t && o + n <= son;
  const ifd0 = t + u32(t + 4);
  if (!icinde(ifd0, 2)) return false;
  const adet = u16(ifd0);
  for (let e = 0; e < adet; e++) {
    const g = ifd0 + 2 + e * 12;
    if (!icinde(g, 12)) return false;
    if (u16(g) !== 0x8825) continue;
    const gps = t + u32(g + 8);
    if (icinde(gps, 2)) {
      const gAdet = u16(gps);
      for (let k = 0; k < gAdet; k++) {
        const ge = gps + 2 + k * 12;
        if (!icinde(ge, 12)) break;
        const boy = (TUR_BOYU[u16(ge + 2)] ?? 1) * u32(ge + 4);
        if (boy > 4) {
          const veri = t + u32(ge + 8);
          if (icinde(veri, boy)) b.fill(0, veri, veri + boy);
        }
        b.fill(0, ge, ge + 12);
      }
      b.fill(0, gps, gps + 2); // girdi sayısı 0
    }
    // IFD0'dan GPSInfo girdisi çıkarılır: sonraki girdiler ve sonraki-IFD işaretçisi 12 bayt yukarı kayar.
    const sonuc = ifd0 + 2 + adet * 12 + 4;
    if (!icinde(ifd0, sonuc - ifd0)) return false;
    b.copyWithin(g, g + 12, sonuc);
    b.fill(0, sonuc - 12, sonuc);
    if (kucuk) {
      b[ifd0] = (adet - 1) & 0xff;
      b[ifd0 + 1] = (adet - 1) >> 8;
    } else {
      b[ifd0] = (adet - 1) >> 8;
      b[ifd0 + 1] = (adet - 1) & 0xff;
    }
    return true;
  }
  return true;
}

function pngTemizle(girdi: Uint8Array): Uint8Array {
  const parcalar: Uint8Array[] = [girdi.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= girdi.length) {
    const uzunluk =
      ((girdi[i] << 24) |
        (girdi[i + 1] << 16) |
        (girdi[i + 2] << 8) |
        girdi[i + 3]) >>>
      0;
    const son = i + 12 + uzunluk;
    if (son > girdi.length) return girdi;
    if (ascii(girdi, i + 4, 4) !== "eXIf")
      parcalar.push(girdi.subarray(i, son));
    i = son;
  }
  if (i !== girdi.length) return girdi;
  return birlestir(parcalar);
}

function birlestir(parcalar: Uint8Array[]): Uint8Array {
  const cikti = new Uint8Array(parcalar.reduce((t, p) => t + p.length, 0));
  let k = 0;
  for (const p of parcalar) {
    cikti.set(p, k);
    k += p.length;
  }
  return cikti;
}
