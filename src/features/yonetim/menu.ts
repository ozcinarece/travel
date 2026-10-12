// #106 KK4: sol menü sırası kanvastaki gibi (Backoffice Main.dc.html). Saf: kabuk ve testler buradan okur.
export type MenuAnahtari = 'genel' | 'geziler' | 'yerler' | 'sehirler' | 'anaSayfa' | 'kullanicilar' | 'ayarlar';

export type MenuOgesi = { anahtar: MenuAnahtari; yol: string };

export const KOK = '/yonetim';
export const GIRIS = '/yonetim/giris';
export const YETKIN_YOK = '/yonetim/yetkin-yok';

export const MENU: readonly MenuOgesi[] = [
  { anahtar: 'genel', yol: KOK },
  { anahtar: 'geziler', yol: '/yonetim/geziler' },
  { anahtar: 'yerler', yol: '/yonetim/yerler' },
  { anahtar: 'sehirler', yol: '/yonetim/sehirler' },
  { anahtar: 'anaSayfa', yol: '/yonetim/ana-sayfa' },
  { anahtar: 'kullanicilar', yol: '/yonetim/kullanicilar' },
  { anahtar: 'ayarlar', yol: '/yonetim/ayarlar' },
];

/** Geniş düzen eşiği (KK4: ≥ 1200 px); altında menü üstte açılır-kapanır. */
export const GENIS_EKRAN = 1200;

/** Yoldaki menü öğesi: Genel bakış yalnız köke; diğerleri alt yollarını da kapsar (/yonetim/geziler/abc). */
export function aktifMenu(yol: string): MenuAnahtari | null {
  const temiz = yol.replace(/\/+$/, '') || '/';
  if (temiz === KOK) return 'genel';
  const oge = MENU.find((m) => m.yol !== KOK && (temiz === m.yol || temiz.startsWith(`${m.yol}/`)));
  return oge?.anahtar ?? null;
}

export type YonetimDurumu = {
  /** İlk oturum okuması bitti mi. */
  hazir: boolean;
  /** Hesaplı (anonim olmayan) oturum var mı. */
  hesapli: boolean;
  /** `is_admin()` sonucu; null = henüz bilinmiyor. */
  admin: boolean | null;
};

/**
 * #106 KK2: kapı kararı — gidilecek yol ya da null (sayfada kal).
 * Oturum yok → giriş; oturum var, admin değil → "Yetkin yok"; admin → giriş/yetkin yok sayfalarından köke.
 */
export function yonetimYonu(durum: YonetimDurumu, yol: string): string | null {
  if (!durum.hazir) return null;
  if (!durum.hesapli) return yol === GIRIS ? null : GIRIS;
  if (durum.admin === null) return null;
  if (!durum.admin) return yol === YETKIN_YOK ? null : YETKIN_YOK;
  return yol === GIRIS || yol === YETKIN_YOK ? KOK : null;
}

/** Menünün altındaki kullanıcı satırı: ad (yoksa e-postanın @ öncesi) ve baş harf. */
export function kullaniciEtiketi(ad: string | undefined, eposta: string | undefined): { ad: string; harf: string } {
  const gorunen = ad?.trim() || eposta?.split('@')[0] || '';
  return { ad: gorunen, harf: gorunen.charAt(0).toLocaleUpperCase('tr-TR') };
}
