// #107 / #108: içerik fotoğrafları (Storage `icerik/<geziler|yerler>/<id>/` + `icerik_fotolari` altyazı/sıra). Gezi ve yer ortak.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { supabase } from '@/lib/supabase';

import { fotoDenetle, fotoYolu } from './gezi';
import { hataVer } from './geziSorgulari';

export type SahipTuru = 'gezi' | 'yer';
export type IcerikFotosu = { yol: string; sahip_tur: SahipTuru; sahip_id: string; altyazi: string | null; sira: number };

const anahtar = (tur: SahipTuru, sahipId: string | undefined) => ['yonetim', 'fotolar', tur, sahipId] as const;

export function useIcerikFotolari(tur: SahipTuru, sahipId: string | undefined) {
  return useQuery({
    queryKey: anahtar(tur, sahipId),
    enabled: !!sahipId,
    queryFn: async () => {
      const { data, error } = await supabase.from('icerik_fotolari').select('*').eq('sahip_tur', tur).eq('sahip_id', sahipId!).order('sira').order('created_at');
      if (error) throw error;
      return data as IcerikFotosu[];
    },
  });
}

/** KK5: yükle (kova kuralıyla aynı denetim), altyazı, sıra, sil; her işlemden sonra liste yenilenir. */
export function useFotoIslemleri(tur: SahipTuru, sahipId: string) {
  const qc = useQueryClient();
  const yenile = useCallback(() => qc.invalidateQueries({ queryKey: anahtar(tur, sahipId) }), [qc, tur, sahipId]);
  const yap = useCallback(
    async <T,>(is: () => Promise<T>): Promise<T> => {
      try {
        return await is();
      } finally {
        await yenile();
      }
    },
    [yenile],
  );
  const klasor = tur === 'gezi' ? 'geziler' : 'yerler';
  return {
    yukle: (dosya: File, sira: number): Promise<string> => {
      const sorun = fotoDenetle(dosya);
      if (sorun) return Promise.reject(new Error(`foto_${sorun}`));
      const yol = fotoYolu(klasor, sahipId, dosya.name, globalThis.crypto.randomUUID());
      return yap(async () => {
        const { error } = await supabase.storage.from('icerik').upload(yol, dosya, { contentType: dosya.type, upsert: false });
        if (error) throw error;
        await hataVer(supabase.from('icerik_fotolari').insert({ yol, sahip_tur: tur, sahip_id: sahipId, sira }));
        return yol;
      });
    },
    altyazi: (yol: string, altyazi: string) => yap(() => hataVer(supabase.from('icerik_fotolari').update({ altyazi: altyazi.trim() || null }).eq('yol', yol))),
    sirala: (yollar: string[]) => yap(() => Promise.all(yollar.map((yol, i) => hataVer(supabase.from('icerik_fotolari').update({ sira: i + 1 }).eq('yol', yol))))),
    sil: (yol: string) =>
      yap(async () => {
        await hataVer(supabase.from('icerik_fotolari').delete().eq('yol', yol));
        const { error } = await supabase.storage.from('icerik').remove([yol]);
        if (error) throw error;
      }),
  };
}

/** Yükleme hatası → kullanıcı metni anahtarı. */
export function fotoHataAnahtari(e: unknown): 'tur' | 'boyut' | 'yukleme' {
  const kod = (e as Error | undefined)?.message;
  return kod === 'foto_tur' ? 'tur' : kod === 'foto_boyut' ? 'boyut' : 'yukleme';
}
