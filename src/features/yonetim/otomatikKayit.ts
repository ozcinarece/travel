// #107 / #108 KK7: editör alanları yerel taslakta; son değişiklikten 2 sn sonra yalnız farklar tabloya yazılır.
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { kayitFarki } from './gezi';

export type KayitDurumu = { kaydedildi: Date | null; kaydediliyor: boolean; hata: 'tekil' | 'kayit' | null };

/**
 * Editör kayıt kimliğiyle anahtarlanır (her kayıtta yeni kanca); ayrılırken bekleyen kayıt hemen yazılır.
 * `degistir` işlev alırsa en güncel taslağa uygulanır (yükleme sürerken yazılanlar kaybolmaz). 23505 → 'tekil'.
 */
export function useOtomatikKayit<T extends object>({
  tablo,
  id,
  ilk,
  yenilenecek,
  bekleme = 2000,
  onKaydedildi,
}: {
  tablo: 'geziler' | 'yerler' | 'sehirler' | 'sehir_rehberi';
  id: string;
  ilk: T;
  yenilenecek: QueryKey[];
  bekleme?: number;
  /** #111: kayıttan sonra (ör. yazıdaki mekanları `icerik_mekanlari`na yaz); hata kayıt hatası sayılır. */
  onKaydedildi?: (alanlar: T, fark: Partial<T>) => Promise<void>;
}) {
  const qc = useQueryClient();
  const [taslak, setTaslak] = useState<T>(ilk);
  const [durum, setDurum] = useState<KayitDurumu>({ kaydedildi: null, kaydediliyor: false, hata: null });
  const sunucu = useRef<T>(ilk);
  const son = useRef<T>(ilk);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anahtarlar = useRef(yenilenecek);
  const sonra = useRef(onKaydedildi);
  useEffect(() => {
    sonra.current = onKaydedildi;
  });

  const yaz = useCallback(async () => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = null;
    const alanlar = son.current;
    const fark = kayitFarki(sunucu.current, alanlar);
    if (!fark) return;
    setDurum((d) => ({ ...d, kaydediliyor: true, hata: null }));
    const { error } = await supabase.from(tablo).update(fark as Record<string, unknown>).eq('id', id);
    if (error) {
      setDurum((d) => ({ ...d, kaydediliyor: false, hata: (error as { code?: string }).code === '23505' ? 'tekil' : 'kayit' }));
      return;
    }
    sunucu.current = alanlar;
    try {
      await sonra.current?.(alanlar, fark as Partial<T>);
    } catch {
      setDurum((d) => ({ ...d, kaydediliyor: false, hata: 'kayit' }));
      return;
    }
    setDurum({ kaydedildi: new Date(), kaydediliyor: false, hata: null });
    await Promise.all(anahtarlar.current.map((queryKey) => qc.invalidateQueries({ queryKey })));
  }, [qc, tablo, id]);

  useEffect(() => () => void yaz(), [yaz]);

  const degistir = useCallback(
    (alanlar: Partial<T> | ((t: T) => Partial<T>), hemen = false) => {
      const yeni = { ...son.current, ...(typeof alanlar === 'function' ? alanlar(son.current) : alanlar) };
      son.current = yeni;
      setTaslak(yeni);
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
      zamanlayici.current = setTimeout(() => void yaz(), hemen ? 0 : bekleme);
    },
    [yaz, bekleme],
  );

  return { taslak, degistir, durum, simdiKaydet: yaz };
}
