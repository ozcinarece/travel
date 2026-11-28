// #387 (#377, KK1–KK3): ✓ ile mekan çıkarma geri alınabilir. Listem'deki 5 sn "Geri al" bandının ortak kancası; Listem,
// hazır gezi, şehir rehberi, Yerler ve Yer ekle aynı kancayı kullanır. Silme ancak bant kapanınca (5 sn, ekrandan çıkış ya da
// uygulamanın arka plana gitmesi) yapılır; "Geri al" basılırsa hiçbir şey silinmez. Aynı anda tek bekleyen; ikinci çıkarma
// öncekini hemen kesinleştirir. Bekleyen silme bir kez çalışır (ref boşaltılıp sonra silinir).
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useDuraklar, useGunler } from '@/features/gunler/sorgular';
import { useMekanSil } from '@/features/mekanlar/sorgular';
import { t } from '@/i18n';
import type { Durak, Gun, Mekan } from '@/lib/tipler';

/** #141 KK4: Çıkar'dan sonra bu kadar "Geri al" süresi; sonra mekan listeden silinir. */
export const GERI_AL_MS = 5000;

export type BekleyenSilme = { mekanId: string; placeId: string; metin: string };

/**
 * KK2: bant metni. Mekan bir güne atanmışsa "{ad} {n}. günden de çıktı"; değilse Listem'deki "{ad} listeden çıktı".
 */
export function cikarMetni(mekanId: string, ad: string, duraklar: readonly Pick<Durak, 'place_ref' | 'day_id'>[] | undefined, gunler: readonly Pick<Gun, 'id' | 'index'>[] | undefined): string {
  const durak = duraklar?.find((d) => d.place_ref === mekanId);
  const gun = durak ? gunler?.find((g) => g.id === durak.day_id) : undefined;
  return gun ? t('listem.gundenCikti', { ad, n: gun.index }) : t('listem.cikti', { ad });
}

/**
 * #580 değişiklik 1: ertelenmiş, geri alınabilir işlemin ortak çekirdeği (Listem'in mekan silmesi ve Gezi'nin "Çıkar"ı).
 * `baslat` bandı açar; işlem ancak bant kapanınca (5 sn, ekrandan çıkış, arka plan, ikinci işlem ya da `kapat`) bir kez çalışır.
 * "Geri al" basılırsa hiçbir şey yazılmaz.
 */
export function useGeriAlinabilirIslem<B extends { metin: string }>(seyahatId: string | undefined, calistir: (b: B) => void) {
  const [bekleyenDurum, setBekleyenDurum] = useState<B | null>(null);
  // #599 değişiklik 1: o anki bant, durumla aynı anda yazılır (zamanlayıcı kapattığında bile çizimi beklemeden okunur).
  const bantRef = useRef<B | null>(null);
  const setBekleyen = useCallback((b: B | null) => {
    bantRef.current = b;
    setBekleyenDurum(b);
  }, []);
  const bekleyen = bekleyenDurum;
  // Seyahat değişince eski bant kalkar (işlem aşağıdaki etkinin temizliğinde yapılır). "Önceki render" deseni.
  const [bantSeyahati, setBantSeyahati] = useState(seyahatId);
  if (bantSeyahati !== seyahatId) {
    setBantSeyahati(seyahatId);
    setBekleyenDurum(null);
  }
  const bekleyenRef = useRef<{ b: B; zaman: ReturnType<typeof setTimeout> } | null>(null);
  const calistirRef = useRef(calistir);
  useEffect(() => {
    calistirRef.current = calistir;
  });

  // Bekleyeni (varsa) çalıştırır. Ref önce boşaltılır: aynı işlem iki kez çalışmaz (KK3).
  const kesinlestir = useCallback(() => {
    const b = bekleyenRef.current;
    if (!b) return;
    clearTimeout(b.zaman);
    bekleyenRef.current = null;
    calistirRef.current(b.b);
  }, []);

  // KK3: ekrandan çıkınca (ya da seyahat değişince) bekleyen çalışır. #621 KK5: o anki bant da boşalır (yukarıdaki
  // `setBekleyenDurum(null)` ref'e dokunmaz; `simdikiBant` eski seyahatin bandını görmesin).
  useEffect(
    () => () => {
      kesinlestir();
      bantRef.current = null;
    },
    [seyahatId, kesinlestir],
  );
  // KK3: uygulama arka plana giderse de.
  useEffect(() => {
    const abonelik = AppState.addEventListener('change', (durum) => {
      if (durum === 'active' || !bekleyenRef.current) return;
      kesinlestir();
      setBekleyen(null);
    });
    return () => abonelik.remove();
  }, [kesinlestir, setBekleyen]);

  const baslat = useCallback(
    (b: B) => {
      kesinlestir();
      const zaman = setTimeout(() => {
        kesinlestir();
        setBekleyen(null);
      }, GERI_AL_MS);
      bekleyenRef.current = { b, zaman };
      setBekleyen(b);
    },
    [kesinlestir, setBekleyen],
  );
  const geriAl = useCallback(() => {
    const b = bekleyenRef.current;
    if (b) clearTimeout(b.zaman);
    bekleyenRef.current = null;
    setBekleyen(null);
  }, [setBekleyen]);

  // #599 KK2: başka bir bant açılacaksa bu bant kapanır; bekleyen işlem hemen kesinleşir (iki bant aynı anda görünmez).
  const kapat = useCallback(() => {
    kesinlestir();
    setBekleyen(null);
  }, [kesinlestir, setBekleyen]);
  /** #599 değişiklik 1: şu an açık bant (çizimi beklemeden). Seyahat değişiminde ekran zaten yenilenir. */
  const simdikiBant = useCallback(() => (bantRef.current && bekleyenRef.current ? bantRef.current : null), []);

  return { bekleyen, baslat, geriAl, kapat, simdikiBant };
}

export function useGeriAlinabilirSil(seyahatId: string | undefined, onHata?: () => void) {
  const sil = useMekanSil(seyahatId ?? '');
  const gunler = useGunler(seyahatId);
  const duraklar = useDuraklar(seyahatId);
  const silMutate = sil.mutate;
  const { bekleyen, baslat, geriAl, kapat, simdikiBant } = useGeriAlinabilirIslem<BekleyenSilme>(seyahatId, (b) => silMutate(b.mekanId, { onError: () => onHata?.() }));

  const duraklarVeri = duraklar.data;
  const gunlerVeri = gunler.data;
  const cikar = useCallback(
    (m: Pick<Mekan, 'id' | 'place_id'>, ad: string) => baslat({ mekanId: m.id, placeId: m.place_id, metin: cikarMetni(m.id, ad, duraklarVeri, gunlerVeri) }),
    [baslat, duraklarVeri, gunlerVeri],
  );

  return { bekleyen, cikar, geriAl, kapat, simdikiBant };
}
