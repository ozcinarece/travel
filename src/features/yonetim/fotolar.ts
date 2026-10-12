// #107 / #108: içerik fotoğrafları (Storage `icerik/<geziler|yerler>/<id>/` + `icerik_fotolari` altyazı/sıra). Gezi ve yer ortak.
// #111 şehir: tarayıcıda WebP + 2400 / 1200 / 400 kopyalar, ölçü, boyut, kaynak ve yükleyen satırda.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { supabase } from '@/lib/supabase';

import { fotoDenetle, fotoYolu } from './gezi';
import { hataVer } from './geziSorgulari';
import { boyutYolu, SEHIR_FOTO, sehirFotoDenetle, sehirFotoYolu } from './sehir';
import { webpUret } from './webp';

export type SahipTuru = 'gezi' | 'yer' | 'sehir';
export type FotoKaynagi = 'kendi' | 'telifsiz' | 'izinli';
export type IcerikFotosu = {
  yol: string;
  sahip_tur: SahipTuru;
  sahip_id: string;
  altyazi: string | null;
  sira: number;
  kaynak?: FotoKaynagi | null;
  genislik?: number | null;
  yukseklik?: number | null;
  bayt?: number | null;
  yukleyen?: string | null;
  created_at?: string;
};

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
  const yukleSehir = (dosya: File, sira: number): Promise<string> => {
    const sorun = sehirFotoDenetle(dosya);
    if (sorun) return Promise.reject(new Error(`foto_${sorun}`));
    const yol = sehirFotoYolu(sahipId, dosya.name, globalThis.crypto.randomUUID());
    return yap(async () => {
      const w = await webpUret(dosya);
      for (const k of w.kopyalar) {
        const { error } = await supabase.storage.from('icerik').upload(boyutYolu(yol, k.boyut), k.blob, { contentType: 'image/webp', upsert: false });
        if (error) throw error;
      }
      const bayt = w.kopyalar[0].blob.size;
      await hataVer(supabase.from('icerik_fotolari').insert({ yol, sahip_tur: tur, sahip_id: sahipId, sira, genislik: w.genislik, yukseklik: w.yukseklik, bayt }));
      return yol;
    });
  };
  return {
    yukle: (dosya: File, sira: number): Promise<string> => {
      if (tur === 'sehir') return yukleSehir(dosya, sira);
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
    kaynak: (yol: string, kaynak: FotoKaynagi) => yap(() => hataVer(supabase.from('icerik_fotolari').update({ kaynak }).eq('yol', yol))),
    sirala: (yollar: string[]) => yap(() => Promise.all(yollar.map((yol, i) => hataVer(supabase.from('icerik_fotolari').update({ sira: i + 1 }).eq('yol', yol))))),
    sil: (yol: string) =>
      yap(async () => {
        await hataVer(supabase.from('icerik_fotolari').delete().eq('yol', yol));
        const { error } = await supabase.storage.from('icerik').remove(tur === 'sehir' ? SEHIR_FOTO.boyutlar.map((b) => boyutYolu(yol, b)) : [yol]);
        if (error) throw error;
      }),
  };
}

/** Yükleme hatası → kullanıcı metni anahtarı. */
export function fotoHataAnahtari(e: unknown): 'tur' | 'boyut' | 'kucuk' | 'yukleme' {
  const kod = (e as Error | undefined)?.message;
  return kod === 'foto_tur' ? 'tur' : kod === 'foto_boyut' ? 'boyut' : kod === 'foto_kucuk' ? 'kucuk' : 'yukleme';
}
