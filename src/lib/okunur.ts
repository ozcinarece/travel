/** #562 KK2: ekran okuyucu metninde görünen " · " ayıracı ", " okunur (görünen metin değişmez).
 * Yalnız iki yanı boşluklu ayıraç: yer adındaki boşluksuz "·" (Katalanca "Paral·lel") olduğu gibi kalır. */
export function okunurAyrac(metin: string): string {
  return metin.replace(/\s+·\s+/g, ', ');
}
