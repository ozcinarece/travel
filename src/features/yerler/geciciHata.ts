// #317 (inceleme 1): Yer ekle hata kutusu kendiliğinden kaybolur. Ekleme hatası ve öneri hatası (429 dahil) 5 sn sonra ya da
// panel kapanınca gizlenir; "Bağlantı yok" bu kancayı kullanmaz, bağlantı dönünce kalkar.
import { useCallback, useEffect, useState } from 'react';

export const HATA_SURESI_MS = 5000;

/**
 * `aktif` doğru olduğu sürece en çok `ms` görünür; `kapat()` hemen gizler. `aktif` yanlışa dönünce sıfırlanır, bir sonraki
 * hata yeniden görünür. `anahtar` değişirse (başka bir hata metni) süre baştan başlar.
 */
export function useGeciciGorunur(aktif: boolean, anahtar: string | null = null, ms = HATA_SURESI_MS): [boolean, () => void] {
  // Her yeni hata (yanlış → doğru ya da metin değişti) yeni bir "nesil"; gizlenen nesil görünmez.
  const [onceki, setOnceki] = useState({ aktif, anahtar });
  const [nesil, setNesil] = useState(0);
  const [gizliNesil, setGizliNesil] = useState(-1);
  if (onceki.aktif !== aktif || onceki.anahtar !== anahtar) {
    setOnceki({ aktif, anahtar });
    if (aktif) setNesil((n) => n + 1);
  }
  useEffect(() => {
    if (!aktif) return;
    const id = setTimeout(() => setGizliNesil(nesil), ms);
    return () => clearTimeout(id);
  }, [aktif, nesil, ms]);
  const kapat = useCallback(() => setGizliNesil(nesil), [nesil]);
  return [aktif && gizliNesil !== nesil, kapat];
}
