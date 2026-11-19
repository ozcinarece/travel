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

export function useGeriAlinabilirSil(seyahatId: string | undefined, onHata?: () => void) {
  const sil = useMekanSil(seyahatId ?? '');
  const gunler = useGunler(seyahatId);
  const duraklar = useDuraklar(seyahatId);
  const [bekleyen, setBekleyen] = useState<BekleyenSilme | null>(null);
  // Seyahat değişince eski bant kalkar (silme aşağıdaki etkinin temizliğinde yapılır). "Önceki render" deseni.
  const [bantSeyahati, setBantSeyahati] = useState(seyahatId);
  if (bantSeyahati !== seyahatId) {
    setBantSeyahati(seyahatId);
    setBekleyen(null);
  }
  const bekleyenRef = useRef<{ id: string; zaman: ReturnType<typeof setTimeout> } | null>(null);
  const silMutate = sil.mutate;
  const silRef = useRef(silMutate);
  const onHataRef = useRef(onHata);
  useEffect(() => {
    silRef.current = silMutate;
    onHataRef.current = onHata;
  });

  // Bekleyeni (varsa) siler. Ref önce boşaltılır: aynı silme iki kez çalışmaz (KK3).
  const kesinlestir = useCallback(() => {
    const b = bekleyenRef.current;
    if (!b) return;
    clearTimeout(b.zaman);
    bekleyenRef.current = null;
    silRef.current(b.id, { onError: () => onHataRef.current?.() });
  }, []);

  // KK3: ekrandan çıkınca (ya da seyahat değişince) bekleyen silinir.
  useEffect(() => () => kesinlestir(), [seyahatId, kesinlestir]);
  // KK3: uygulama arka plana giderse de.
  useEffect(() => {
    const abonelik = AppState.addEventListener('change', (durum) => {
      if (durum === 'active' || !bekleyenRef.current) return;
      kesinlestir();
      setBekleyen(null);
    });
    return () => abonelik.remove();
  }, [kesinlestir]);

  const duraklarVeri = duraklar.data;
  const gunlerVeri = gunler.data;
  const cikar = useCallback(
    (m: Pick<Mekan, 'id' | 'place_id'>, ad: string) => {
      kesinlestir();
      const zaman = setTimeout(() => {
        kesinlestir();
        setBekleyen(null);
      }, GERI_AL_MS);
      bekleyenRef.current = { id: m.id, zaman };
      setBekleyen({ mekanId: m.id, placeId: m.place_id, metin: cikarMetni(m.id, ad, duraklarVeri, gunlerVeri) });
    },
    [kesinlestir, duraklarVeri, gunlerVeri],
  );
  const geriAl = useCallback(() => {
    const b = bekleyenRef.current;
    if (b) clearTimeout(b.zaman);
    bekleyenRef.current = null;
    setBekleyen(null);
  }, []);

  return { bekleyen, cikar, geriAl };
}
