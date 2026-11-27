// #137 Davetle katılma — saf kurallar (test edilir): /r/{token} ekranının adımı, Türkçe yönelme eki, özet metinleri.
import type { DavetOzeti } from '@/lib/tipler';

export type DavetAdimi = 'yukleniyor' | 'ag' | 'gecersiz' | 'giris' | 'profil' | 'uye' | 'katil';

/**
 * /r/{token} ne göstersin? Özet isteği hata verdiyse `ag` (#239: "Bağlanamadık"); istek başarılı ama özet yoksa geçersiz; oturum yoksa giriş düğmeleri; hesap var ama profil yoksa profil tamamlama;
 * zaten üyeyse doğrudan seyahat; aksi hâlde katılım.
 */
export function davetAdimi(g: { ozet: DavetOzeti | null | undefined; ozetBekliyor: boolean; ozetHata?: boolean; hazir: boolean; hesapli: boolean; profilVar: boolean | undefined }): DavetAdimi {
  if (g.ozetBekliyor || !g.hazir) return 'yukleniyor';
  if (g.ozetHata && !g.ozet) return 'ag';
  if (!g.ozet) return 'gecersiz';
  if (!g.hesapli) return 'giris';
  if (g.profilVar === undefined) return 'yukleniyor';
  if (!g.profilVar) return 'profil';
  if (g.ozet.uye) return 'uye';
  return 'katil';
}

const ON = 'aeıioöuü';
const INCE = 'eiöü';

/**
 * "{Ad}'e / 'a / 'ne / 'na / 'ye / 'ya": ünlü uyumu + kaynaştırma. Son ünlü ince → e, kalın → a. Ünlüyle bitiyorsa
 * iyelik ekiyle bitenler n ("Gezisi'ne", "Kuşadası'na", "Roma Turu'na"), diğerleri y ("Ankara'ya", "Denizli'ye", "Baku'ya")
 * alır. Son ünlü yoksa "'e".
 */
export function yonelmeEki(ad: string): string {
  const temiz = ad.trim();
  if (!temiz) return '';
  const kucuk = temiz.toLocaleLowerCase('tr');
  let sonUnlu = '';
  for (let i = kucuk.length - 1; i >= 0; i--) {
    if (ON.includes(kucuk[i])) {
      sonUnlu = kucuk[i];
      break;
    }
  }
  const unlu = sonUnlu && !INCE.includes(sonUnlu) ? 'a' : 'e';
  const son = kucuk[kucuk.length - 1];
  const kaynastirma = ON.includes(son) ? (iyelikliMi(kucuk) ? 'n' : 'y') : '';
  return `${temiz}'${kaynastirma}${unlu}`;
}

/**
 * #573 inceleme 1: iyelik eki (3. tekil) mi? Son kelime ünlü + s + ı/i/u/ü ile bitiyorsa ("gezisi", "rotası", "kuşadası") ya da
 * çok kelimeli adın son kelimesi ı/i/u/ü ile bitiyorsa (tamlama: "Roma Turu", "Salda Gölü"). Tek kelimelik "Denizli", "Bali",
 * "Baku" iyelikli değildir.
 */
function iyelikliMi(kucuk: string): boolean {
  const kelimeler = kucuk.split(/\s+/).filter(Boolean);
  const son = kelimeler[kelimeler.length - 1] ?? '';
  if (!'ıiuü'.includes(son[son.length - 1] ?? '')) return false;
  if (son.length >= 3 && son[son.length - 2] === 's' && ON.includes(son[son.length - 3])) return true;
  return kelimeler.length > 1;
}

/**
 * #181: "{Ad}'de / 'da / 'te / 'ta" (bulunma): ünlü uyumu + ünsüz benzeşmesi (f s t k ç ş h p ile biten → t). "Eskişehir'de",
 * "İstanbul'da", "Paris'te". İyelik görünümlü sonlar ("Gezisi'nde") ayırt edilmez; şehir adları için yeterli.
 */
export function bulunmaEki(ad: string): string {
  const temiz = ad.trim();
  if (!temiz) return '';
  const kucuk = temiz.toLocaleLowerCase('tr');
  let sonUnlu = '';
  for (let i = kucuk.length - 1; i >= 0; i--) {
    if (ON.includes(kucuk[i])) {
      sonUnlu = kucuk[i];
      break;
    }
  }
  const unlu = sonUnlu && !INCE.includes(sonUnlu) ? 'a' : 'e';
  const sert = 'fstkçşhp'.includes(kucuk[kucuk.length - 1]) ? 't' : 'd';
  return `${temiz}'${sert}${unlu}`;
}

/**
 * #277 KK3: "{Ad}'den / 'dan / 'ten / 'tan" (ayrılma): bulunma ekiyle aynı uyum, sonuna "n". "Eskişehir'den", "Bursa'dan",
 * "Muş'tan".
 */
export function ayrilmaEki(ad: string): string {
  const b = bulunmaEki(ad);
  return b ? `${b}n` : '';
}

/** "{Davet eden} seni {Seyahat}'e ekledi" gibi başlıklar için seyahat adı (ad yoksa şehir). */
export function davetSeyahatAdi(o: { name: string | null; city_label: string }): string {
  return o.name?.trim() || o.city_label;
}
