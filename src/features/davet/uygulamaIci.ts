// #573 Uygulama içi davet: Davetler kutusu (UX önerileri kanvası, "Uygulama içi davet (#573)"; not `nDavet1`).
// Sunucu: `supabase/migrations/20261214100000_seyahat_davetleri.sql`. Yazma yalnız `security definer` fonksiyonlarla (istemci
// tabloya doğrudan yazamaz); gelen kutusu `davetlerim()`, davet edenin durum listesi tablodan (RLS: yalnız kendi satırları).
// Bildirim yok (KK6): davet yalnız uygulama açılınca (ya da yenileyince) görünür.
// Google'a istek yok.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { router } from 'expo-router';
import { AppState } from 'react-native';

import { olayYaz } from '@/features/icerik/sorgular';
import { t } from '@/i18n';
import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import { tarihAraligi } from '@/lib/takvim';
import type { DavetKatilim } from '@/lib/tipler';

import { davetSeyahatAdi, yonelmeEki } from './katilim';

/** Seyahatin bir üyesi; kullanıcı kimliği yerine sıra numarası (yalnız liste anahtarı). */
export type DavetKisi = { sira: number; ad: string | null; foto: string | null };

/** `davetlerim()` satırı: bana gelen bekleyen davet. */
export type GelenDavet = {
  id: string;
  trip_id: string;
  davet_eden_ad: string | null;
  davet_eden_foto: string | null;
  ad: string | null;
  sehir: string;
  start_date: string | null;
  end_date: string | null;
  gun_sayisi: number;
  /** Seyahatin üyeleri; davet eden önde, sonra katılış sırası. Ad ilk kelime. */
  kisiler: DavetKisi[];
  olusturuldu: string;
};

export type DavetDurumu = 'bekliyor' | 'katildi' | 'reddetti';

export const DAVETLERIM = ['davetlerim'] as const;
/** KK5: Davet eden taraf (gönderildi çekmecesi) kişi durumları. */
export const gonderilenAnahtari = (tripId: string | undefined) => ['davetler', 'gonderilen', tripId] as const;

/** KK4: "Hayır"dan sonra "Geri al" süresi; sonra `daveti_reddet` çağrılır. */
export const GERI_CEVIR_MS = 5000;

// ---------------------------------------------------------------- saf kurallar (test edilir)

/**
 * KK2 başlığı için şehir: "Urla" → "Urla'ya". KK3 başlığı için gezinin tam adı: son kelime küçük harfle başlıyorsa (cins
 * isim) kesme işareti yok ("Urla bağ rotası" → "Urla bağ rotasına"); özel adda var ("Kapadokya Gezisi" → "Gezisi'ne").
 */
export function adaYonelme(ad: string): string {
  const temiz = ad.trim();
  const son = temiz.split(/\s+/).pop() ?? '';
  const ilk = son.charAt(0);
  if (temiz.includes(' ') && ilk && ilk === ilk.toLocaleLowerCase('tr') && ilk !== ilk.toLocaleUpperCase('tr')) return yonelmeEki(temiz).replace("'", '');
  return yonelmeEki(temiz);
}

/** Ad yoksa "Bir arkadaşın". */
function davetEden(d: Pick<GelenDavet, 'davet_eden_ad'>): string {
  return d.davet_eden_ad?.trim() || t('davet.biri');
}

/** KK2: "{Ad} seni {şehir}'e çağırıyor". */
export function anaSayfaBasligi(d: Pick<GelenDavet, 'davet_eden_ad' | 'sehir'>): string {
  return t('davet.kutu.baslik', { ad: davetEden(d), yerEk: adaYonelme(d.sehir) });
}

/** KK3: başlıkta gezinin tam adı (ad yoksa şehir). */
export function gezilerimBasligi(d: Pick<GelenDavet, 'davet_eden_ad' | 'ad' | 'sehir'>): string {
  return t('davet.kutu.baslik', { ad: davetEden(d), yerEk: adaYonelme(davetSeyahatAdi({ name: d.ad, city_label: d.sehir })) });
}

/** KK8: ekran okuyucu "Davet: {görünen başlık}" — ana sayfada "Davet: {Ad} seni {şehir}'e çağırıyor". */
export function davetEtiketi(d: Pick<GelenDavet, 'davet_eden_ad' | 'sehir'>, baslik: string = anaSayfaBasligi(d)): string {
  return t('davet.kutu.etiket', { baslik });
}

/** #573 inceleme 9: Hayır / Katıl düğmelerinin bağlamı (şehir). */
export function dugmeIpuclari(d: Pick<GelenDavet, 'sehir'>): { hayir: string; katil: string } {
  return { hayir: t('davet.kutu.hayirIpucu', { sehir: d.sehir }), katil: t('davet.kutu.katilIpucu', { sehir: d.sehir }) };
}

/** KK2: "{tarih} · {n} gün"; tarih yoksa yalnız gün. Gün sayısı yoksa (0) yalnız tarih; ikisi de yoksa boş. */
export function davetAlt(d: Pick<GelenDavet, 'start_date' | 'end_date' | 'gun_sayisi'>): string {
  const parcalar: string[] = [];
  if (d.start_date && d.end_date) parcalar.push(tarihAraligi(d.start_date, d.end_date));
  if (d.gun_sayisi > 0) parcalar.push(t('seyahatlerim.gun', { n: d.gun_sayisi }));
  return parcalar.join(' · ');
}

/** "de / da" bağlacı: son ünlü kalınsa "da" ("Can da"), inceyse "de" ("Mert de"). */
export function deBaglaci(ad: string): string {
  const kucuk = ad.trim().toLocaleLowerCase('tr');
  for (let i = kucuk.length - 1; i >= 0; i--) {
    if ('aıou'.includes(kucuk[i])) return 'da';
    if ('eiöü'.includes(kucuk[i])) return 'de';
  }
  return 'de';
}

/**
 * KK3 alt satırı (kanvas `Davet_v1_Gezilerim`): "{tarih} · {n} gün · Mert de geliyor". Davet edenden başka katılan yoksa
 * kişi parçası yok; iki kişide "Mert ve Deniz de geliyor"; daha çoğunda "Mert ve 2 kişi daha geliyor".
 */
export function gezilerimAlt(d: Pick<GelenDavet, 'start_date' | 'end_date' | 'gun_sayisi' | 'kisiler'>): string {
  const digerleri = d.kisiler.slice(1).map((k) => k.ad?.trim()).filter((a): a is string => !!a);
  const parcalar = [davetAlt(d)].filter(Boolean);
  if (digerleri.length === 1) parcalar.push(t('davet.kutu.geliyorBir', { ad: digerleri[0], de: deBaglaci(digerleri[0]) }));
  else if (digerleri.length === 2) parcalar.push(t('davet.kutu.geliyorIki', { ad: digerleri[0], ad2: digerleri[1], de: deBaglaci(digerleri[1]) }));
  else if (digerleri.length > 2) parcalar.push(t('davet.kutu.geliyorCok', { ad: digerleri[0], n: digerleri.length - 1 }));
  return parcalar.join(' · ');
}

/** KK5: "Mert ve Deniz'e davet gitti." — adlar "," ve "ve" ile; yönelme eki sondakine. */
export function gittiMetni(adlar: readonly string[]): string {
  const temiz = adlar.map((a) => a.trim()).filter(Boolean);
  if (temiz.length === 0) return '';
  const son = yonelmeEki(temiz[temiz.length - 1]);
  const bas = temiz.slice(0, -1);
  const liste = bas.length === 0 ? son : `${bas.join(', ')} ${t('davet.gonderildi.ve')} ${son}`;
  return t('davet.gonderildi.gitti', { adlar: liste });
}

/**
 * KK5: kişi durumu. Davet linkiyle katılmış kişi (üye) davet satırı hâlâ `bekliyor` olsa da "Katıldı" sayılır.
 */
export function kisiDurumu(durum: DavetDurumu | undefined, uye: boolean): DavetDurumu {
  if (uye || durum === 'katildi') return 'katildi';
  return durum ?? 'bekliyor';
}

export function durumMetni(d: DavetDurumu): string {
  return t(`davet.gonderildi.durum.${d}`);
}

// ---------------------------------------------------------------- sorgular

/** KK2 · KK3: bekleyen davetlerim. Misafir oturumda sorulmaz (sunucu da boş döner). */
export function useDavetlerim() {
  const { hesapli } = useOturum();
  const qc = useQueryClient();
  // KK6: bildirim yok; uygulama arka plandan dönünce kutu yeniden okunur (yeni davet görünür).
  useEffect(() => {
    if (!hesapli) return;
    const abonelik = AppState.addEventListener('change', (durum) => {
      if (durum === 'active') qc.invalidateQueries({ queryKey: DAVETLERIM });
    });
    return () => abonelik.remove();
  }, [hesapli, qc]);
  return useQuery({
    queryKey: DAVETLERIM,
    enabled: hesapli,
    staleTime: 60_000,
    queryFn: async (): Promise<GelenDavet[]> => {
      const { data, error } = await supabase.rpc('davetlerim');
      if (error) throw error;
      return (data as GelenDavet[] | null) ?? [];
    },
  });
}

/**
 * KK1: davet oluşturma — #574 "Geziyi oluştur" sonrası seçilen kişiler için çağırır. Sunucu yalnız birlikte gezilen,
 * misafir olmayan, henüz üye olmayan kişilere yazar; aynı kişiye ikinci bekleyen davet yazmaz. Dönen: yazılan davet sayısı.
 */
export function useDavetGonder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, kisiler }: { tripId: string; kisiler: string[] }) => {
      const { data, error } = await supabase.rpc('davet_gonder', { p_trip: tripId, p_kisiler: kisiler });
      if (error) throw error;
      return (data as number | null) ?? 0;
    },
    onSuccess: (_n, { tripId }) => qc.invalidateQueries({ queryKey: gonderilenAnahtari(tripId) }),
  });
}

/** KK5: davet edenin gönderdiği davetlerin durumu (kişi → durum; en yeni satır). RLS: yalnız kendi gönderdiklerim. */
export function useGonderilenDavetler(tripId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: gonderilenAnahtari(tripId),
    enabled: !!session && !!tripId,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, DavetDurumu>> => {
      const { data, error } = await supabase
        .from('seyahat_davetleri')
        .select('davet_edilen, durum, created_at')
        .eq('trip_id', tripId!)
        .eq('davet_eden', session!.user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const harita = new Map<string, DavetDurumu>();
      for (const r of (data ?? []) as { davet_edilen: string; durum: DavetDurumu }[]) harita.set(r.davet_edilen, r.durum);
      return harita;
    },
  });
}

/**
 * KK4 · Katıl: davet linkiyle katılmanın üyelik yolu (`davetle_katil`, sunucuda `davete_katil` içinden); `davet_katildi`
 * olayı (kanal app, kaynak uygulama içi). Seyahat listesi ve kutu yenilenir.
 */
export function useDaveteKatil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (davetId: string) => {
      const { data, error } = await supabase.rpc('davete_katil', { p_davet: davetId });
      if (error) throw error;
      const sonuc = data as DavetKatilim;
      if (!sonuc.zaten_uye) await olayYaz('davet_katildi', sonuc.trip_id, { kanal: 'app', kaynak: 'uygulama_ici' });
      return sonuc;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['seyahatler'] });
      qc.invalidateQueries({ queryKey: DAVETLERIM });
    },
  });
}

// #573 inceleme 10: reddi bekleyen davet kimlikleri ekranlar arası ortak (modül düzeyi). Ana sayfada "Hayır"a basılıp 5 sn
// içinde Gezilerim'de kutu yeniden okunsa da satır orada da görünmez.
let reddiBekleyenler: readonly string[] = [];
const dinleyiciler = new Set<() => void>();
function reddiBekleyenleriDegistir(f: (eski: readonly string[]) => readonly string[]) {
  reddiBekleyenler = f(reddiBekleyenler);
  dinleyiciler.forEach((d) => d());
}
function abone(d: () => void) {
  dinleyiciler.add(d);
  return () => {
    dinleyiciler.delete(d);
  };
}
/** Reddi bekleyen (Geri al süresindeki) davet kimlikleri; bütün ekranlar aynı listeyi görür. */
export function useReddiBekleyenler(): readonly string[] {
  return useSyncExternalStore(abone, () => reddiBekleyenler, () => reddiBekleyenler);
}

/**
 * KK4 · Hayır: satır hemen kalkar (kutu önbelleğinden çıkar ve ortak "reddi bekleyen" listesine girer; ana sayfa ve Gezilerim
 * ikisi de görür), altta 5 sn "Daveti geri çevirdin · Geri al". "Geri al" satırı geri koyar, sunucuya bir şey gitmez. Bant
 * kapanınca (5 sn, ekrandan çıkış ya da uygulama arka plana gidince) `daveti_reddet` çağrılır; davet edene bildirim gitmez. Aynı
 * anda tek bekleyen; ikinci "Hayır" öncekini hemen kesinleştirir. Hata olursa kutu yeniden okunur (davet geri gelir) ve bir kez
 * `onHata` (ekranın kısa bildirimi).
 */
export function useDavetGeriCevir(onHata?: () => void) {
  const qc = useQueryClient();
  const [bekleyen, setBekleyen] = useState<GelenDavet | null>(null);
  const ref = useRef<{ davet: GelenDavet; zaman: ReturnType<typeof setTimeout> } | null>(null);
  const onHataRef = useRef(onHata);
  useEffect(() => {
    onHataRef.current = onHata;
  });

  const kesinlestir = useCallback(() => {
    const b = ref.current;
    if (!b) return;
    clearTimeout(b.zaman);
    ref.current = null;
    setBekleyen(null);
    // Bant sürerken kutu yeniden okunduysa satır önbelleğe geri gelmiş olabilir: kesinleşince yine çıkar.
    qc.setQueryData<GelenDavet[]>(DAVETLERIM, (eski) => eski?.filter((d) => d.id !== b.davet.id));
    const bitti = (hata: boolean) => {
      reddiBekleyenleriDegistir((l) => l.filter((id) => id !== b.davet.id));
      if (hata) {
        qc.invalidateQueries({ queryKey: DAVETLERIM });
        onHataRef.current?.();
      }
    };
    supabase.rpc('daveti_reddet', { p_davet: b.davet.id }).then(
      ({ error }) => bitti(!!error),
      () => bitti(true),
    );
  }, [qc]);

  const reddet = useCallback(
    (davet: GelenDavet) => {
      kesinlestir();
      reddiBekleyenleriDegistir((l) => [...l.filter((id) => id !== davet.id), davet.id]);
      qc.setQueryData<GelenDavet[]>(DAVETLERIM, (eski) => eski?.filter((d) => d.id !== davet.id));
      ref.current = { davet, zaman: setTimeout(kesinlestir, GERI_CEVIR_MS) };
      setBekleyen(davet);
    },
    [kesinlestir, qc],
  );

  const geriAl = useCallback(() => {
    const b = ref.current;
    if (!b) return;
    clearTimeout(b.zaman);
    ref.current = null;
    setBekleyen(null);
    reddiBekleyenleriDegistir((l) => l.filter((id) => id !== b.davet.id));
    qc.setQueryData<GelenDavet[]>(DAVETLERIM, (eski) => {
      const liste = (eski ?? []).filter((d) => d.id !== b.davet.id);
      return [...liste, b.davet].sort((x, y) => y.olusturuldu.localeCompare(x.olusturuldu));
    });
  }, [qc]);

  useEffect(() => () => kesinlestir(), [kesinlestir]);
  useEffect(() => {
    const abonelik = AppState.addEventListener('change', (durum) => {
      if (durum !== 'active') kesinlestir();
    });
    return () => abonelik.remove();
  }, [kesinlestir]);

  return { bekleyen, reddet, geriAl };
}

/**
 * KK2 · KK3 · KK4: ana sayfa ve Gezilerim'in ortak davet eylemleri. `davetler` geri alınabilir "Hayır" bekleyenini içermez
 * (bu sürede kutu yeniden okunsa da satır geri gelmez). Katıl: üyelik, sonra seyahatin içi (Gezi) 3c "Katıldın" çekmecesiyle
 * (`katildin: '1'`, davet linkiyle aynı; başlıktaki ad davet edenin adı: `davetEden`). Davet artık geçerli değilse (P0002) satır kalkar ve kısa bildirim; ağ hatasında
 * #137'nin hata metni.
 */
export function useDavetEylemleri(onBildirim: (metin: string) => void) {
  const liste = useDavetlerim();
  const katil = useDaveteKatil();
  const geriCevir = useDavetGeriCevir(() => onBildirim(t('kesfetAkisi.guncellenemedi')));
  const reddiBekleyenler = useReddiBekleyenler();
  const [katilan, setKatilan] = useState<string | null>(null);
  const davetler = (liste.data ?? []).filter((d) => !reddiBekleyenler.includes(d.id));
  const katilVer = useCallback(
    async (d: GelenDavet) => {
      if (katilan) return;
      setKatilan(d.id);
      try {
        const sonuc = await katil.mutateAsync(d.id);
        router.push({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: sonuc.trip_id, katildin: '1', davetEden: d.davet_eden_ad ?? '' } });
      } catch (e) {
        onBildirim((e as { code?: string } | null)?.code === 'P0002' ? t('davet.kutu.gecersiz') : t('davet.hata'));
      } finally {
        setKatilan(null);
      }
    },
    [katil, katilan, onBildirim],
  );
  return { davetler, yenile: liste.refetch, katil: katilVer, katilan, reddet: geriCevir.reddet, geriAl: geriCevir.geriAl, bekleyen: geriCevir.bekleyen };
}
