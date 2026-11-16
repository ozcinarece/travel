// #270: sohbet fotoğrafından konum (GPS) meta verisi yüklemeden önce yalnız JS ile silinir.
// Örnek dosyalar Pillow ile üretildi; içindeki GPS uydurma (41°/29° ve 12°S), kişisel veri değil.
import { describe, expect, it } from "@jest/globals";

import { konumuTemizle } from "../exifTemizle";

const bayt = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));
/** Yön 6, üretici "TestCam", GPS 41°2'3.5" N / 29°1'2" E; II (little-endian). */
const JPEG_LE = bayt(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/4QC8RXhpZgAATU0AKgAAAAgAAwEPAAIAAAAIAAAAMgESAAMAAAABAAYAAIglAAQAAAABAAAAOgAAAABUZXN0Q2FtAAAFAAEAAgAAAAJOAAAAAAIABQAAAAMAAAB8AAMAAgAAAAJFAAAAAAQABQAAAAMAAACUAAYABQAAAAEAAACsAAAAAAAAACkAAAABAAAAAgAAAAEAAAAHAAAAAgAAAB0AAAABAAAAAQAAAAEAAAACAAAAAQAAABkAAAAC/9sAQwAIBgYHBgUIBwcHCQkICgwUDQwLCwwZEhMPFB0aHx4dGhwcICQuJyAiLCMcHCg3KSwwMTQ0NB8nOT04MjwuMzQy/9sAQwEJCQkMCwwYDQ0YMiEcITIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy/8AAEQgAMABAAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A56iiivJP0MKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//Z",
);
/** Yön 3, GPS 12°5'7.25" S; MM (big-endian). */
const JPEG_BE = bayt(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/4QCERXhpZgAATU0AKgAAAAgAAgESAAMAAAABAAMAAIglAAQAAAABAAAAJgAAAAAABAABAAIAAAACUwAAAAACAAUAAAADAAAAXAAFAAEAAAABAAAAAAAGAAUAAAABAAAAdAAAAAAAAAAMAAAAAQAAAAUAAAABAAAAHQAAAAQAAAAHAAAAAv/bAEMACAYGBwYFCAcHBwkJCAoMFA0MCwsMGRITDxQdGh8eHRocHCAkLicgIiwjHBwoNyksMDE0NDQfJzk9ODI8LjM0Mv/bAEMBCQkJDAsMGA0NGDIhHCEyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMv/AABEIADAAQAMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/APAaKKKYgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/9k=",
);
/** PNG + eXIf (GPS'li). */
const PNG = bayt(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAAfGVYSWZNTQAqAAAACAACARIAAwAAAAEAAwAAiCUABAAAAAEAAAAmAAAAAAAEAAEAAgAAAAJTAAAAAAIABQAAAAMAAABcAAUAAQAAAAEAAAAAAAYABQAAAAEAAAB0AAAAAAAAAAwAAAABAAAABQAAAAEAAAAdAAAABAAAAAcAAAACTigthgAAAFRJREFUeF7t0YkJADAQw7A+++9cOoU4sCZI8N7nrsnO5PFfB7QKaBXQKqBVQKuAVgGtAloFtApoFdAqoFVAq4BWAa0CWgW0CmgV0CqgVUCrgFYB7QHGqwBmaDcHeQAAAABJRU5ErkJggg==",
);

const icerir = (b: Uint8Array, aranan: number[]) =>
  Buffer.from(b).indexOf(Buffer.from(aranan)) >= 0;
const metinIcerir = (b: Uint8Array, s: string) =>
  Buffer.from(b).indexOf(Buffer.from(s, "latin1")) >= 0;

/** JPEG'in EXIF bloğundaki IFD0 etiketleri ve değerleri (SHORT/LONG için ilk değer). */
function ifd0(b: Uint8Array): Map<number, number> {
  const buf = Buffer.from(b);
  const app1 = buf.indexOf(Buffer.from("Exif\0\0", "latin1"));
  const t = app1 + 6;
  const le = buf.toString("latin1", t, t + 2) === "II";
  const u16 = (o: number) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o: number) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const ifd = t + u32(t + 4);
  const m = new Map<number, number>();
  for (let e = 0; e < u16(ifd); e++) {
    const g = ifd + 2 + e * 12;
    m.set(u16(g), u16(g + 2) === 3 ? u16(g + 8) : u32(g + 8));
  }
  return m;
}

/** SOS'tan sonrası (sıkıştırılmış görüntü verisi). */
const goruntu = (b: Uint8Array) =>
  Buffer.from(b).subarray(Buffer.from(b).indexOf(Buffer.from([0xff, 0xda])));

describe("konumuTemizle (#270)", () => {
  it("KK2: JPEG (II) — GPS etiketi ve değerleri gider; yön ve diğer EXIF kalır; görüntü verisi aynı", () => {
    expect(ifd0(JPEG_LE).has(0x8825)).toBe(true);
    // 41/1 rasyoneli (little-endian) GPS enleminin ilk değeri.
    const enlem = [41, 0, 0, 0, 1, 0, 0, 0];
    expect(icerir(JPEG_LE, enlem)).toBe(true);
    const c = konumuTemizle(JPEG_LE);
    expect(ifd0(c).has(0x8825)).toBe(false);
    expect(ifd0(c).get(0x0112)).toBe(6);
    expect(metinIcerir(c, "TestCam")).toBe(true);
    expect(icerir(c, enlem)).toBe(false);
    expect(goruntu(c).equals(goruntu(JPEG_LE))).toBe(true);
  });

  it("KK2: JPEG (MM) — big-endian EXIF de temizlenir", () => {
    const enlem = [0, 0, 0, 12, 0, 0, 0, 1];
    expect(icerir(JPEG_BE, enlem)).toBe(true);
    const c = konumuTemizle(JPEG_BE);
    expect(ifd0(c).has(0x8825)).toBe(false);
    expect(ifd0(c).get(0x0112)).toBe(3);
    expect(icerir(c, enlem)).toBe(false);
  });

  it("KK2: XMP bloğu (konum içerebilir) çıkarılır", () => {
    const xmp = Buffer.from(
      'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta exif:GPSLatitude="41,2.05N"/>',
      "latin1",
    );
    const seg = Buffer.concat([
      Buffer.from([0xff, 0xe1, (xmp.length + 2) >> 8, (xmp.length + 2) & 0xff]),
      xmp,
    ]);
    const girdi = new Uint8Array(
      Buffer.concat([
        Buffer.from(JPEG_LE.subarray(0, 2)),
        seg,
        Buffer.from(JPEG_LE.subarray(2)),
      ]),
    );
    expect(metinIcerir(girdi, "GPSLatitude")).toBe(true);
    const c = konumuTemizle(girdi);
    expect(metinIcerir(c, "GPSLatitude")).toBe(false);
    expect(ifd0(c).get(0x0112)).toBe(6);
  });

  it("KK2: PNG — eXIf parçası çıkarılır, diğer parçalar kalır", () => {
    expect(metinIcerir(PNG, "eXIf")).toBe(true);
    const c = konumuTemizle(PNG);
    expect(metinIcerir(c, "eXIf")).toBe(false);
    expect(metinIcerir(c, "IHDR")).toBe(true);
    expect(metinIcerir(c, "IDAT")).toBe(true);
    expect(metinIcerir(c, "IEND")).toBe(true);
  });

  it("iki kez temizlemek aynı sonucu verir", () => {
    const c = konumuTemizle(JPEG_LE);
    expect(Buffer.from(konumuTemizle(c)).equals(Buffer.from(c))).toBe(true);
  });

  it("tanınmayan ya da bozuk dosyaya dokunulmaz", () => {
    const heic = new Uint8Array([
      0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
    ]);
    expect(konumuTemizle(heic)).toBe(heic);
    const kesik = JPEG_LE.subarray(0, 30);
    expect(konumuTemizle(kesik)).toBe(kesik);
  });
});
