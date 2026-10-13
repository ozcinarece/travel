// Kullanıcı adı alanının durumu (#138: Profil › Düzenle; eski profil kurulum ekranından taşındı).
import { t } from '@/i18n';
import { renk } from '@/theme';

export type KullaniciAdiDurumu = { tur: 'bos' | 'ayni' | 'gecersiz' | 'kontrol' | 'musait' | 'alinmis' | 'hata'; metin?: string; renk?: string };

export function kullaniciAdiDurumu(g: { kullaniciAdi: string; mevcut?: string; guncel: boolean; gecerli: boolean; musait: boolean | undefined; kontrolEdiliyor: boolean; hata: boolean }): KullaniciAdiDurumu {
  if (g.kullaniciAdi.length === 0) return { tur: 'bos' };
  if (g.mevcut && g.kullaniciAdi === g.mevcut) return { tur: 'ayni' };
  if (!g.guncel || g.kontrolEdiliyor) return { tur: 'kontrol', metin: t('profilKur.kontrol'), renk: renk.ikincil };
  if (!g.gecerli) return { tur: 'gecersiz', metin: t('profilKur.kural'), renk: renk.ikincil };
  if (g.musait === true) return { tur: 'musait', metin: t('profilKur.musait'), renk: renk.basariMetin };
  if (g.musait === false) return { tur: 'alinmis', metin: t('profilKur.alinmis'), renk: renk.uyari };
  // İstek hata aldıysa (ağ, eksik migration, yetki) sonsuz "kontrol ediliyor" yerine söyle.
  if (g.hata) return { tur: 'hata', metin: t('profilKur.kontrolHata'), renk: renk.uyari };
  return { tur: 'kontrol', metin: t('profilKur.kontrol'), renk: renk.ikincil };
}
