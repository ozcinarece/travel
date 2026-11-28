// #580 değişiklik 1: durak çekmecesinin "Çıkar"ı yalnız günden çıkarır — Plan'daki "Günden çıkar" ile aynı mutasyon
// (`useDurakKaldir`, `stops` satırı silinir; mekan herkesin listesinde kalır). Listem'deki 5 sn "Geri al" bandının ortak
// çekirdeğiyle ertelenir: Geri al'a basılırsa hiçbir şey yazılmaz. Kesinleşince durak önbellekten hemen düşer (bant kapanıp
// yenileme gelene kadar satır geri görünmesin); hata olursa yenilemeyle geri gelir.
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useDurakKaldir } from '@/features/gunler/sorgular';
import { useGeriAlinabilirIslem } from '@/features/mekanlar/geriAlinabilirSil';
import { t } from '@/i18n';
import type { Durak } from '@/lib/tipler';

export type BekleyenKaldirma = { durakId: string; metin: string };

/** Bant metni: "{ad} bugünden çıktı" (yanında "Geri al"). */
export function bugundenCiktiMetni(ad: string): string {
  return t('durakCekmecesi.bugundenCikti', { ad });
}

export function useGeriAlinabilirDurakKaldir(seyahatId: string | undefined, onHata?: () => void) {
  const qc = useQueryClient();
  const kaldir = useDurakKaldir(seyahatId ?? '');
  const kaldirMutate = kaldir.mutate;
  const { bekleyen, baslat, geriAl, kapat, simdikiBant } = useGeriAlinabilirIslem<BekleyenKaldirma>(seyahatId, (b) => {
    qc.setQueryData<Durak[]>(['duraklar', seyahatId], (eski) => eski?.filter((d) => d.id !== b.durakId));
    kaldirMutate(b.durakId, { onError: () => onHata?.() });
  });
  const cikar = useCallback((durakId: string, ad: string) => baslat({ durakId, metin: bugundenCiktiMetni(ad) }), [baslat]);
  return { bekleyen, cikar, geriAl, kapat, simdikiBant };
}
