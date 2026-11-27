/** #562 KK2: ekran okuyucu metninde görünen " · " ayıracı ", " okunur (görünen metin değişmez). */
export function okunurAyrac(metin: string): string {
  return metin.replace(/\s*·\s*/g, ', ');
}
