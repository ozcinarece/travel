// #142 KK4–5: şehir rehberi sekmesi — saf hesaplar: yazılardaki mekanlar, okunan bölüm ve okuma ilerlemesi (test edilir).
import { markdownAyristir } from '@/lib/markdown';

/** Bölüm yazılarındaki mekanlar (kart `::mekan[id]` + satır içi `[ad](mekan:id)`), ilk görülme sırasıyla tekil. */
export function rehberMekanIdleri(yazilar: (string | null | undefined)[]): string[] {
  const gorulen = new Set<string>();
  for (const md of yazilar) {
    for (const b of markdownAyristir(md)) {
      if (b.tur === 'mekan') gorulen.add(b.place_id);
      else if ('mekanlar' in b && b.mekanlar) for (const m of b.mekanlar) gorulen.add(m.place_id);
    }
  }
  return [...gorulen];
}

/**
 * Okunan bölüm: üstü yapışkan başlığın altına (`pay`) gelmiş son bölüm; hiçbiri gelmediyse ilk bölüm. Konumlar bölüm
 * sırasıyla içerikteki y (ölçülmemiş = undefined, atlanır).
 */
export function aktifBolum(kaydirmaY: number, konumlar: (number | undefined)[], pay: number): number {
  let aktif = 0;
  konumlar.forEach((y, i) => {
    if (y !== undefined && y <= kaydirmaY + pay + 1) aktif = i;
  });
  return aktif;
}

/** Turuncu okuma çizgisi: kaydırılan / kaydırılabilir (0–1). */
export function okumaOrani(kaydirmaY: number, icerikYukseklik: number, gorunenYukseklik: number): number {
  const kaydirilabilir = icerikYukseklik - gorunenYukseklik;
  if (kaydirilabilir <= 0) return 1;
  return Math.min(1, Math.max(0, kaydirmaY / kaydirilabilir));
}

/** Bölüm yazısının ilk `#` başlığı bölüm başlığıyla çizildiği için düşer. */
export function bolumYazisi(md: string | null | undefined): string {
  return (md ?? '').replace(/^#\s+[^\n]*\n+/, '');
}
