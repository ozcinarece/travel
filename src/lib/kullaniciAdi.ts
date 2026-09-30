// Kullanıcı adı kuralı veritabanındakiyle aynı: profiles.username ~ '^[a-z0-9_.]{3,24}$'

export const KULLANICI_ADI_DESENI = /^[a-z0-9_.]{3,24}$/;

const TURKCE: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** Yazılanı izin verilen alfabeye indirger: küçük harf, Türkçe karakterler sadeleşir, boşluk → nokta. */
export function temizle(girdi: string): string {
  return girdi
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]/g, (h) => TURKCE[h] ?? '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 24);
}

export function gecerliKullaniciAdi(aday: string): boolean {
  return KULLANICI_ADI_DESENI.test(aday);
}

/** "Ece Özçınar" → "ece.ozcinar": kurulumda ilk öneri. */
export function addanOner(ad: string): string {
  return temizle(ad.trim())
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');
}
