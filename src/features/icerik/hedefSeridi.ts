// #589 (#587 küçükleri): "Seyahatime al" hedef çip şeridi — açılışta seçili çip görünür alana gelir, çipler ekran okuyucuya
// "·" ayırıcısız okunur.
import { t } from '@/i18n';

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
  if (yeniSecili) return o.icerikHazir ? { tur: 'son' } : { tur: 'bekle' };
  if (o.genislik == null || !o.cip) return { tur: 'bekle' };
  const sag = o.cip.x + o.cip.genislik + SERIT_KENAR;
  return sag > o.genislik ? { tur: 'x', x: sag - o.genislik } : { tur: 'gerekmez' };
}

/** KK2: hedef çipin ekran okuyucu etiketi — "{ad}, {tarih}, farklı şehir"; tarih ve "farklı şehir" yalnız varsa. */
export function hedefCipEtiketi(ad: string, tarih: string | null, farkli: boolean): string {
  if (tarih && farkli) return t('gezi.hedefCipOkunur.tam', { ad, tarih });
  if (tarih) return t('gezi.hedefCipOkunur.tarihli', { ad, tarih });
  if (farkli) return t('gezi.hedefCipOkunur.farkli', { ad });
  return ad;
}
