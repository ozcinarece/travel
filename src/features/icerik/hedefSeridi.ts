// #589 (#587 küçükleri): "Seyahatime al" hedef çip şeridi — açılışta seçili çip görünür alana gelir, çipler ekran okuyucuya
// "·" ayırıcısız okunur.
import { t } from '@/i18n';
import { AYLAR, parcala, type Tarih } from '@/lib/takvim';

/** Şeritte çipten sonra bırakılan boşluk (şeridin `paddingHorizontal`'ı ile aynı). */
export const SERIT_KENAR = 20;

export type SeritOlcusu = {
  /** Şeridin görünen genişliği; henüz ölçülmediyse null. */
  genislik: number | null;
  /** Seçili seyahat çipinin içerikteki yeri; henüz ölçülmediyse null. */
  cip: { x: number; genislik: number } | null;
  /** İçerik ölçüldü mü (son çipe kaydırmak için). */
  icerikHazir: boolean;
};

export type SeritKaydirma = { tur: 'son' } | { tur: 'x'; x: number } | { tur: 'gerekmez' } | { tur: 'bekle' };

/**
 * KK1: açılışta yapılacak kaydırma. "Yeni seyahat" seçiliyse (şeridin sonu) sona; seçili seyahat çipi görünen alanın dışına
 * taşıyorsa sağ kenarı (boşluğuyla) görünecek kadar; zaten görünüyorsa hiç. Ölçü eksikse bekle.
 */
export function seritKaydirma(yeniSecili: boolean, o: SeritOlcusu): SeritKaydirma {
  // İçerik ölçülmeden kaydırılırsa (Android) `scrollTo` eski içerik genişliğine kırpılabilir; her iki yol da içeriği bekler.
  if (!o.icerikHazir || o.genislik == null) return { tur: 'bekle' };
  // #620 KK2: "son" da şerit genişliği ölçülünce verilir (çip yoluyla tutarlı).
  if (yeniSecili) return { tur: 'son' };
  if (!o.cip) return { tur: 'bekle' };
  const sag = o.cip.x + o.cip.genislik + SERIT_KENAR;
  return sag > o.genislik ? { tur: 'x', x: sag - o.genislik } : { tur: 'gerekmez' };
}

/**
 * #620 KK1: hedef çip etiketindeki tarih, ekran okuyucuya "–" ve ay kısaltması olmadan: aynı ay "12 ile 14 Aralık arası",
 * farklı ay "28 Aralık ile 2 Ocak arası", tek gün "12 Aralık". Çipte görünen metin (`tarihAraligi`) değişmez.
 */
export function hedefCipTarihi(start: Tarih, end: Tarih): string {
  const b = parcala(start);
  const s = parcala(end);
  const bitis = `${s.gun} ${AYLAR[s.ay - 1]}`;
  if (start === end) return bitis;
  const bas = b.yil === s.yil && b.ay === s.ay ? String(b.gun) : `${b.gun} ${AYLAR[b.ay - 1]}`;
  return t('gezi.hedefCipOkunur.aralik', { bas, bit: bitis });
}

/** KK2: hedef çipin ekran okuyucu etiketi — "{ad}, {tarih}, farklı şehir"; tarih ve "farklı şehir" yalnız varsa. */
export function hedefCipEtiketi(ad: string, tarih: string | null, farkli: boolean): string {
  if (tarih && farkli) return t('gezi.hedefCipOkunur.tam', { ad, tarih });
  if (tarih) return t('gezi.hedefCipOkunur.tarihli', { ad, tarih });
  if (farkli) return t('gezi.hedefCipOkunur.farkli', { ad });
  return ad;
}
