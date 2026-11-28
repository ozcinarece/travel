// #578 Profil v12 (UX önerileri kanvası `Profil_v12_Arkadas` · `Profil_v12_Kendi`): kendi profilin ya da birlikte gezdiğin
// kişinin profili. Okuma tek RPC (`profil_ozeti`, security definer): gittiği iller (KK3), gitmek istediği iller (KK4),
// rozetler (KK5), geziler (KK6: arkadaşta yalnız geçmiş). Yazma yalnız kendi `istek_iller` satırların (RLS). Google'a istek yok.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import iller from '../../assets/turkiye-iller.json';
import { profilOzetiAnahtari } from './anahtarlar';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import type { HaritaGizliligi } from '@/lib/tipler';

export { profilOzetiAnahtari };

export type Il = { plaka: number; ad: string; slug: string; d: string };
/** 81 il yolu (turkey-map-react 2.4.6, MIT); plaka sırasıyla. */
export const ILLER = iller as Il[];
const IL_ADI = new Map(ILLER.map((i) => [i.plaka, i.ad]));
export const ilAdi = (plaka: number) => IL_ADI.get(plaka) ?? '';

export type ProfilGezisi = {
  id: string;
  sehir: string;
  ad: string | null;
  start_date: string;
  end_date: string;
  tz: string;
  gun_sayisi: number;
  durak_sayisi: number;
  kisi_sayisi: number;
  bitti: boolean;
  /** İzleyen bu gezinin üyesi mi (arkadaşın gezisinde "Rotayı al" yalnız o zaman). */
  uyesiyim: boolean;
  /** Profil sahibi dışındaki kişiler: baş harf, fotoğraf yalnız izleyenin de birlikte gezdiği kişininki. */
  kisiler: { harf: string; foto: string | null; /** Kişiye bağlı sabit yüz rengi sırası (0–2). */ renk: number }[];
};

export type RozetSayilari = Partial<Record<RozetAdi, number>>;

export type ProfilOzeti = {
  id: string;
  ad: string;
  foto: string | null;
  kendi: boolean;
  /** Yalnız kendi profilinde. */
  gizlilik: HaritaGizliligi | null;
  /** KK6: arkadaş haritayı ve gezileri yalnız sahibi "yalnız ben" seçmediyse görür. */
  harita_acik: boolean;
  gidilen: number[] | null;
  istek: number[];
  /** Arkadaşın profilinde izleyenin istekleri ("İKİNİZ DE"); kendi profilinde null. */
  benim_istek: number[] | null;
  /** Arkadaşın haritası kapalıysa (`me`) null; `istek` boş, `rozetler` boş da döner (#600). */
  yol_arkadasi: number | null;
  rozetler: RozetSayilari;
  geziler: ProfilGezisi[];
};


export function useProfilOzeti(kisi: string | undefined) {
  return useQuery({
    queryKey: profilOzetiAnahtari(kisi),
    enabled: !!kisi,
    staleTime: 30_000,
    queryFn: async (): Promise<ProfilOzeti | null> => {
      const { data, error } = await supabase.rpc('profil_ozeti', { p_kisi: kisi });
      if (error) throw error;
      return (data as ProfilOzeti | null) ?? null;
    },
  });
}

/** KK4: "+ Ekle" il seçicisi — seçili ili ekler ya da çıkarır. Önbellek hemen güncellenir; hata olursa geri döner. */
export function useIstekDegistir(kisi: string | undefined) {
  const qc = useQueryClient();
  const anahtar = profilOzetiAnahtari(kisi);
  return useMutation({
    mutationFn: async ({ plaka, ekle }: { plaka: number; ekle: boolean }) => {
      const { error } = ekle
        ? await supabase.from('istek_iller').insert({ plaka })
        : await supabase.from('istek_iller').delete().eq('user_id', kisi!).eq('plaka', plaka);
      // 23505: başka cihazdan zaten eklenmiş — sonuç aynı.
      if (error && error.code !== '23505') throw error;
    },
    onMutate: async ({ plaka, ekle }) => {
      await qc.cancelQueries({ queryKey: anahtar });
      const onceki = qc.getQueryData<ProfilOzeti | null>(anahtar);
      qc.setQueryData<ProfilOzeti | null>(anahtar, (o) =>
        o ? { ...o, istek: ekle ? [...o.istek.filter((p) => p !== plaka), plaka] : o.istek.filter((p) => p !== plaka) } : o,
      );
      return { onceki };
    },
    onError: (_e, _d, baglam) => {
      if (baglam?.onceki !== undefined) qc.setQueryData(anahtar, baglam.onceki);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: anahtar }),
  });
}

/** KK4: arkadaşın profilinde iki kişinin ortak illeri önce, sonra kendi sırası. */
export function istekSirasi(istek: number[], benim: number[] | null): { plaka: number; ortak: boolean }[] {
  const ben = new Set(benim ?? []);
  const ortak = istek.filter((p) => ben.has(p));
  const diger = istek.filter((p) => !ben.has(p));
  return [...ortak.map((plaka) => ({ plaka, ortak: true })), ...diger.map((plaka) => ({ plaka, ortak: false }))];
}

export type RozetAdi = 'lezzet' | 'doga' | 'kultur' | 'ekip' | 'planci';
/** KK5: tek kelimelik adlar, bu sırayla. */
export const ROZETLER: RozetAdi[] = ['lezzet', 'doga', 'kultur', 'ekip', 'planci'];
export const ROZET_ESIGI = 3;

export type RozetGorunumu = { ad: RozetAdi; kazanildi: boolean; alt: string };

/**
 * KK5: kazanılanlar sırayla, altında gerçek sayı; kazanılmamışlar ("Henüz yok") yalnız kendi profilinde ve en sonda.
 * Arkadaşın kazanmadığı rozetin sayısı sunucudan hiç gelmez.
 */
export function rozetListesi(sayilar: RozetSayilari, kendi: boolean): RozetGorunumu[] {
  const kazanilan: RozetGorunumu[] = [];
  const kalan: RozetGorunumu[] = [];
  for (const ad of ROZETLER) {
    const n = sayilar[ad];
    if (n !== undefined && n >= ROZET_ESIGI) kazanilan.push({ ad, kazanildi: true, alt: t(`profilV12.rozet.${ad}Alt`, { n }) });
    else if (kendi) kalan.push({ ad, kazanildi: false, alt: t('profilV12.rozet.henuzYok') });
  }
  return [...kazanilan, ...kalan];
}
