// #137 Davetle katılma — saf kurallar (test edilir): /r/{token} ekranının adımı, Türkçe yönelme eki, özet metinleri.
import type { DavetOzeti } from '@/lib/tipler';

export type DavetAdimi = 'yukleniyor' | 'gecersiz' | 'giris' | 'profil' | 'uye' | 'katil';

/**
 * /r/{token} ne göstersin? Özet yoksa geçersiz; oturum yoksa giriş düğmeleri; hesap var ama profil yoksa profil tamamlama;
 * zaten üyeyse doğrudan seyahat; aksi hâlde katılım.
 */
export function davetAdimi(g: { ozet: DavetOzeti | null | undefined; ozetBekliyor: boolean; hazir: boolean; hesapli: boolean; profilVar: boolean | undefined }): DavetAdimi {
  if (g.ozetBekliyor || !g.hazir) return 'yukleniyor';
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
 * iyelik görünümlü (i, ı, u, ü) sonlar n ("Gezisi'ne"), diğerleri y ("Ankara'ya") alır. Son ünlü yoksa "'e".
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
  const kaynastirma = ON.includes(son) ? ('ıiuü'.includes(son) ? 'n' : 'y') : '';
  return `${temiz}'${kaynastirma}${unlu}`;
}

/** "{Davet eden} seni {Seyahat}'e ekledi" gibi başlıklar için seyahat adı (ad yoksa şehir). */
export function davetSeyahatAdi(o: { name: string | null; city_label: string }): string {
  return o.name?.trim() || o.city_label;
}
