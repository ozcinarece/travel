// #142 KK4–5 → #397: şehir rehberi — saf hesaplar: yazılardaki mekanlar ve sekme olacak (içi dolu) bölümler (test edilir).
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

/** #172 KK8: yalnız kartlar (`::mekan[id]`) — fotoğraf yalnız kartta gösterilir; satır içi bağlantı fotoğrafsızdır. */
export function rehberKartIdleri(yazilar: (string | null | undefined)[]): string[] {
  const gorulen = new Set<string>();
  for (const md of yazilar) for (const b of markdownAyristir(md)) if (b.tur === 'mekan') gorulen.add(b.place_id);
  return [...gorulen];
}

/** Bölüm yazısının ilk `#` başlığı bölüm başlığıyla çizildiği için düşer. */
export function bolumYazisi(md: string | null | undefined): string {
  // Gövdesi boş bölümde yazı yalnız `# Başlık` (satır sonu yok).
  return (md ?? '').replace(/^#\s+[^\n]*(\n+|$)/, '');
}

/** #397 KK4: yalnız içi dolu bölüm sekme olur (başlığı düştükten sonra yazısı boş olan bölüm gösterilmez). */
export function doluBolumler<T extends { yazi_md: string | null | undefined }>(bolumler: readonly T[]): T[] {
  return bolumler.filter((b) => bolumYazisi(b.yazi_md).trim().length > 0);
}
