// #111 şehir editörü — saf kurallar: alanlar, rehber bölümleri, yazıdaki mekanlar, foto rolleri ve WebP boyutları. Testli.
import { icerikFotoUrl } from '@/lib/markdown';

import type { IcerikFotosu } from './fotolar';

/** Editörde tutulan şehir alanları (Genel + Fotoğraflar rolleri). */
export type SehirAlanlari = {
  ad: string;
  slug: string;
  lat: number;
  lng: number;
  ozet: string | null;
  yayin: boolean;
  kapak_url: string | null;
  genis_kapak_url: string | null;
};

export type BolumTuru = 'ulasim' | 'yemek' | 'mahalle' | 'ipucu';
/** Uygulamanın rehber sekmeleri (#100); "+ Bölüm" eksik olanı bu sırayla ekler. */
export const BOLUM_TURLERI: BolumTuru[] = ['ulasim', 'yemek', 'mahalle', 'ipucu'];

export type RehberBolumu = { id: string; sehir_id: string; bolum: BolumTuru; baslik: string; ozet: string | null; yazi_md: string | null; sira: number };

/** Henüz olmayan ilk bölüm türü; dördü de varsa null. */
export function eksikBolum(mevcut: readonly { bolum: BolumTuru }[]): BolumTuru | null {
  return BOLUM_TURLERI.find((t) => !mevcut.some((b) => b.bolum === t)) ?? null;
}

const UST_BASLIK = /^#\s+[^\n]*\n*/;

/** Uygulama yazının ilk `# Başlık` satırını atar (#100); editör gövdeyi düzenler, başlık ayrı alanda. */
export function rehberGovdesi(md: string | null | undefined): string {
  return (md ?? '').replace(/\r\n?/g, '\n').replace(UST_BASLIK, '').trim();
}

/** Kayıt: `# Başlık` + gövde (seed ve uygulamayla aynı biçim). */
export function rehberYazisi(baslik: string, govde: string): string {
  const g = govde.trim();
  return `# ${baslik.trim().replace(/\n+/g, ' ')}${g ? `\n\n${g}` : ''}`;
}

export type MekanBagi = { place_id: string; bicim: 'kart' | 'satir'; ad?: string };

const MEKAN_IZI = /\[([^\]]+)\]\(mekan:([A-Za-z0-9_-]{10,255})\)|^::mekan\[([A-Za-z0-9_-]{10,255})\][ \t]*$/gm;

/** Yazıdaki mekanlar, yazı sırasıyla: satır içi `[metin](mekan:id)` (ad = metin) ve kart `::mekan[id]`. */
export function mekanBaglari(md: string | null | undefined): MekanBagi[] {
  return [...(md ?? '').matchAll(MEKAN_IZI)].map((m) => (m[3] ? { place_id: m[3], bicim: 'kart' } : { place_id: m[2], bicim: 'satir', ad: m[1].trim() }));
}

/** Sol listedeki "N mekan": bölümde kart olarak bağlı mekan sayısı. */
export function kartSayisi(md: string | null | undefined): number {
  return mekanBaglari(md).filter((m) => m.bicim === 'kart').length;
}

/** "Kaynak görünümü": yazıdaki ham mekan işaretleri, kimlik kısaltılmış ("ChIJ…h3"). */
export function kaynakIzleri(md: string | null | undefined): string[] {
  const kisa = (id: string) => (id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-2)}` : id);
  return mekanBaglari(md).map((m) => (m.bicim === 'kart' ? `::mekan[${kisa(m.place_id)}]` : `[${m.ad}](mekan:${kisa(m.place_id)})`));
}

// ---------------------------------------------------------------- fotoğraflar

export type FotoRolu = 'karo' | 'genis';

/** Fotoğrafın rolü: `kapak_url` = karo, `genis_kapak_url` = geniş (ikisi de tam adres). */
export function fotoRolu(yol: string, s: Pick<SehirAlanlari, 'kapak_url' | 'genis_kapak_url'>): FotoRolu | null {
  const url = icerikFotoUrl(yol);
  return s.kapak_url === url ? 'karo' : s.genis_kapak_url === url ? 'genis' : null;
}

/** Role atama: rolün sütununa fotoğrafın adresi; aynı foto öbür roldeyse oradan düşmez (iki rol tek foto olabilir). */
export function rolAta(rol: FotoRolu | null, yol: string, s: Pick<SehirAlanlari, 'kapak_url' | 'genis_kapak_url'>): Partial<SehirAlanlari> {
  const url = icerikFotoUrl(yol);
  if (rol === 'karo') return { kapak_url: url };
  if (rol === 'genis') return { genis_kapak_url: url };
  return { ...(s.kapak_url === url ? { kapak_url: null } : {}), ...(s.genis_kapak_url === url ? { genis_kapak_url: null } : {}) };
}

/** Kanvas: yayına almak için karo kapağı zorunlu (uyarı). */
export function yayinEngeli(s: Pick<SehirAlanlari, 'kapak_url'>): 'kapak' | null {
  return s.kapak_url ? null : 'kapak';
}

/** "eskisehir-01.jpg": yolun dosya adı (yükleme öneki atılır). */
export function dosyaAdi(yol: string): string {
  const ad = yol.split('/').pop() ?? yol;
  return ad.replace(/^[0-9a-f]{8}-/, '');
}

/** "2400×1600 · 1,1 MB · Ece · 12 Eki" parçaları (bilinmeyenler atlanır). */
export function fotoBilgisi(f: Pick<IcerikFotosu, 'genislik' | 'yukseklik' | 'bayt' | 'yukleyen' | 'created_at'>, aylar: readonly string[]): string {
  const parca: string[] = [];
  if (f.genislik && f.yukseklik) parca.push(`${f.genislik}×${f.yukseklik}`);
  if (f.bayt) parca.push(`${(Math.round((f.bayt / 1_048_576) * 10) / 10).toString().replace('.', ',')} MB`);
  if (f.yukleyen) {
    // Satırda ilk ad saklanır; eski / adsız hesapta e-postanın ilk parçası.
    const ad = f.yukleyen.includes('@') ? f.yukleyen.split('@')[0].split(/[._]/)[0] : f.yukleyen;
    parca.push(ad.charAt(0).toLocaleUpperCase('tr-TR') + ad.slice(1));
  }
  if (f.created_at) {
    const t = new Date(f.created_at);
    parca.push(`${t.getDate()} ${aylar[t.getMonth()]}`);
  }
  return parca.join(' · ');
}

/** Kanvas kuralı: JPG/PNG/WebP, uzun kenar ≥ 1600 px, ≤ 8 MB. */
export const SEHIR_FOTO = { enAzKenar: 1600, enCokBayt: 8 * 1024 * 1024, turler: ['image/jpeg', 'image/png', 'image/webp'], boyutlar: [2400, 1200, 400] } as const;

export function sehirFotoDenetle(dosya: { type: string; size: number }): 'tur' | 'boyut' | null {
  if (!(SEHIR_FOTO.turler as readonly string[]).includes(dosya.type)) return 'tur';
  if (dosya.size > SEHIR_FOTO.enCokBayt) return 'boyut';
  return null;
}

/** Uzun kenarı `hedef`e indirir (büyütmez); oran korunur. */
export function olcekle(genislik: number, yukseklik: number, hedef: number): { genislik: number; yukseklik: number } {
  const k = Math.min(1, hedef / Math.max(genislik, yukseklik));
  return { genislik: Math.round(genislik * k), yukseklik: Math.round(yukseklik * k) };
}

/** Ana dosya `<ad>.webp`; küçük kopyalar `<ad>@1200.webp`, `<ad>@400.webp` (uygulama ekrana göre seçer). */
export function boyutYolu(yol: string, boyut: number): string {
  return boyut === SEHIR_FOTO.boyutlar[0] ? yol : yol.replace(/\.webp$/, `@${boyut}.webp`);
}

/** Yükleme yolu: `sehirler/<id>/<önek>-<ad>.webp` (ad sadeleşir). */
export function sehirFotoYolu(sehirId: string, dosyaAdi: string, onek: string): string {
  const kok = dosyaAdi
    .replace(/\.[^.]+$/, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `sehirler/${sehirId}/${onek.slice(0, 8)}-${kok || 'foto'}.webp`;
}

/** Yönelme hâli (kanvas "Eskişehir’e git"): son ünlü kalınsa -a, inceyse -e; ünlüyle bitiyorsa kaynaştırma -y-. */
export function yonelme(ad: string): string {
  const harfler = ad.toLocaleLowerCase('tr-TR');
  const unluler = [...harfler].filter((h) => 'aıoueiöü'.includes(h));
  const son = unluler[unluler.length - 1] ?? 'e';
  const ek = 'aıou'.includes(son) ? 'a' : 'e';
  const unluyleBiter = 'aıoueiöü'.includes(harfler.slice(-1));
  return `${ad}’${unluyleBiter ? 'y' : ''}${ek}`;
}
