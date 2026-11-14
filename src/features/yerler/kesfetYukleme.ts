// #189 Ek 2 (#66 karo yükleyicisinin yerine): Keşfet öneri yükleyicisi. Şehir istekleri (şehir merkezi + çip) oturumda bir kez
// atılır ve sunucuda 24 sa önbellekte kalır (aynı şehre bakan ikinci kullanıcı yeni istek doğurmaz); harita kaydırılıp
// yakınlaştırılınca istek yok; "Bu alanda ara" tek istek (+ az sonuçta bir genişletme). Birikim ve aranan alanlar seyahate göre
// ayrı, oturum boyu modül belleğinde (ekran yeniden açılsa da yerinde). Oturum başına istek sayacı (tanı şeridi + Sentry izi).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { HaritaBolgesi, Konum } from '@/components/harita/tipler';
import { izBirak } from '@/lib/hataRaporu';
import { konaklamaMi } from '@/lib/pinIkonu';

import { kesfetYerleri, type HafifYer, type OneriCipi } from './api';
import { birikimeEkle, birikimListesi, genisAlan, genisletilmeli, gorunumAlani, VARSAYILAN_SEHIR_YARICAPI_M, type Alan } from './sehirListesi';

type Durum = 'yolda' | 'tamam';
/** `cip|lat,lng` (şehir isteği) → durum. Hatalı istek silinir: sıradaki çip / filtre değişiminde yeniden denenir. */
const sehirIstekleri = new Map<string, Durum>();
/** Şehir merkezi → sunucunun kullandığı yarıçap. */
const sehirYaricaplari = new Map<string, number>();
type Birikim = { yerler: Map<string, HafifYer>; surum: number; arananlar: Alan[] };
const birikimler = new Map<string, Birikim>();
/** Oturum başına Nearby isteği sayısı (KK10 ölçümü, tanı şeridi). */
export const kesfetSayaci = { istek: 0, hata: 0 };

/** Testler için: önbellek, birikim ve sayaç sıfırlanır. */
export function kesfetBelleginiSifirla() {
  sehirIstekleri.clear();
  sehirYaricaplari.clear();
  birikimler.clear();
  kesfetSayaci.istek = 0;
  kesfetSayaci.hata = 0;
}

export function birikimiAl(seyahatId: string): Birikim {
  let b = birikimler.get(seyahatId);
  if (!b) {
    b = { yerler: new Map(), surum: 0, arananlar: [] };
    birikimler.set(seyahatId, b);
  }
  return b;
}

const merkezAnahtari = (m: Konum) => `${m.lat.toFixed(4)},${m.lng.toFixed(4)}`;

/** Bir Nearby isteği; konaklama birincil tipli sonuç süzülür (#164 KK2), birikime eklenir. Gelen (süzgeçten geçen) sayıyı döner. */
async function iste(seyahatId: string, cip: OneriCipi, merkez: Konum & { yaricapM?: number }, sehir: boolean): Promise<{ gelen: number; yaricapM: number }> {
  kesfetSayaci.istek += 1;
  try {
    const { yerler, yaricapM } = await kesfetYerleri({ cip, merkez, sehir });
    const b = birikimiAl(seyahatId);
    const uygun = yerler.filter((y) => !konaklamaMi(y.primary_type));
    if (birikimeEkle(b.yerler, uygun) > 0) b.surum += 1;
    return { gelen: uygun.length, yaricapM };
  } catch (e) {
    kesfetSayaci.hata += 1;
    throw e;
  }
}

/** KK7: şehir listesi — bu şehir için henüz istenmemiş çipler (paralel). Hata olursa false. */
export async function sehirListesiniYukle(seyahatId: string, merkez: Konum, cipler: OneriCipi[]): Promise<{ istenen: number; hata: boolean }> {
  const eksik = cipler.filter((c) => !sehirIstekleri.has(`${c}|${merkezAnahtari(merkez)}`));
  for (const c of eksik) sehirIstekleri.set(`${c}|${merkezAnahtari(merkez)}`, 'yolda');
  const sonuclar = await Promise.allSettled(
    eksik.map(async (c) => {
      const anahtar = `${c}|${merkezAnahtari(merkez)}`;
      try {
        const { yaricapM } = await iste(seyahatId, c, merkez, true);
        sehirIstekleri.set(anahtar, 'tamam');
        if (yaricapM > 0) sehirYaricaplari.set(merkezAnahtari(merkez), yaricapM);
      } catch (e) {
        sehirIstekleri.delete(anahtar);
        throw e;
      }
    }),
  );
  const hata = sonuclar.some((s) => s.status === 'rejected');
  if (eksik.length) izBirak('kesfet.sehir', `${eksik.join('+')} ${eksik.length} istek${hata ? ', hata var' : ''} (oturum ${kesfetSayaci.istek})`, hata ? 'error' : 'info');
  return { istenen: eksik.length, hata };
}

export type AlanSonucu = { istek: number; genisletildi: boolean; alan: Alan; hata: boolean };

/**
 * KK9: "Bu alanda ara" — görünüm için tek istek (merkez = görünüm merkezi, yarıçap = yarı köşegen). Süzgeçten 5'ten az yer
 * geçerse bir kez 3 kat yarıçapla yeniden istenir (en çok 2 istek). Aranan alan(lar) kaydedilir: aynı alan için hap çıkmaz.
 */
export async function alandaAra(seyahatId: string, bolge: HaritaBolgesi, cip: OneriCipi): Promise<AlanSonucu> {
  const b = birikimiAl(seyahatId);
  let alan = gorunumAlani(bolge);
  let istek = 0;
  try {
    istek += 1;
    const ilk = await iste(seyahatId, cip, { ...alan.merkez, yaricapM: alan.yaricapM }, false);
    b.arananlar.push(alan);
    if (!genisletilmeli(ilk.gelen)) return { istek, genisletildi: false, alan, hata: false };
    alan = genisAlan(alan);
    istek += 1;
    await iste(seyahatId, cip, { ...alan.merkez, yaricapM: alan.yaricapM }, false);
    b.arananlar.push(alan);
    return { istek, genisletildi: true, alan, hata: false };
  } catch {
    return { istek, genisletildi: false, alan, hata: true };
  } finally {
    izBirak('kesfet.alan', `${cip} ${istek} istek (oturum ${kesfetSayaci.istek})`);
  }
}

export type KesfetOnerileri = {
  yerler: HafifYer[];
  yukleniyor: boolean;
  hata: boolean;
  /** Şehir dairesi (merkez + sunucunun yarıçapı); şehir merkezi yoksa null. */
  sehirAlani: Alan | null;
  /** Bu seyahatte "Bu alanda ara" ile aranmış alanlar. */
  arananlar: Alan[];
  /** Son "Bu alanda ara" genişletildiyse onun alanı (çekmece satırı); değilse null. */
  genisAlan: Alan | null;
  /** "Bu alanda ara" isteği yolda. */
  alanAraniyor: boolean;
  alandaAra: (bolge: HaritaBolgesi, cip: OneriCipi) => void;
};

/**
 * KK7–KK9: `merkez` gelince (ve `cipler` değişince) bu şehrin eksik çip istekleri atılır — çip seçmek istek doğurur, kaydırmak
 * ve yakınlaştırmak doğurmaz. `alandaAra` yalnız kullanıcı dokunuşuyla.
 */
export function useKesfetOnerileri(seyahatId: string, merkez: Konum | null, cipler: OneriCipi[]): KesfetOnerileri {
  const [surum, setSurum] = useState(() => birikimiAl(seyahatId).surum);
  const [yolda, setYolda] = useState(0);
  const [hata, setHata] = useState(false);
  const [yaricap, setYaricap] = useState<number | null>(() => (merkez ? (sehirYaricaplari.get(merkezAnahtari(merkez)) ?? null) : null));
  const [genis, setGenis] = useState<Alan | null>(null);
  const [alanYolda, setAlanYolda] = useState(0);
  const canli = useRef(true);
  useEffect(() => {
    canli.current = true;
    return () => {
      canli.current = false;
    };
  }, []);

  const yukle = useCallback(
    (m: Konum, c: OneriCipi[]) => {
      // Hepsi istenmişse (oturum belleği) bekleme durumu da açılmaz. Bekleme durumu istek başlarken (etkinin gövdesinde değil) açılır.
      if (!c.some((x) => !sehirIstekleri.has(`${x}|${merkezAnahtari(m)}`))) return;
      Promise.resolve()
        .then(() => {
          if (canli.current) setYolda((n) => n + 1);
          return sehirListesiniYukle(seyahatId, m, c);
        })
        .then((s) => {
          if (!canli.current) return;
          setHata(s.hata);
          setYaricap(sehirYaricaplari.get(merkezAnahtari(m)) ?? null);
          setSurum(birikimiAl(seyahatId).surum);
        })
        .finally(() => {
          if (canli.current) setYolda((n) => n - 1);
        });
    },
    [seyahatId],
  );
  const ciplerAnahtari = cipler.join('+');
  const lat = merkez?.lat;
  const lng = merkez?.lng;
  useEffect(() => {
    if (lat == null || lng == null) return;
    yukle({ lat, lng }, ciplerAnahtari.split('+') as OneriCipi[]);
  }, [yukle, lat, lng, ciplerAnahtari]);

  const ara = useCallback(
    (bolge: HaritaBolgesi, cip: OneriCipi) => {
      setAlanYolda((n) => n + 1);
      alandaAra(seyahatId, bolge, cip)
        .then((s) => {
          if (!canli.current) return;
          setHata(s.hata);
          setGenis(s.genisletildi ? s.alan : null);
          setSurum(birikimiAl(seyahatId).surum);
        })
        .finally(() => {
          if (canli.current) setAlanYolda((n) => n - 1);
        });
    },
    [seyahatId],
  );

  // Liste yalnız sürüm değişince yeniden sıralanır (#68 🔴2). Aranan alanlar da sürümle (ve yükleme bitince) tazelenir.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const yerler = useMemo(() => birikimListesi(birikimiAl(seyahatId).yerler), [seyahatId, surum]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const arananlar = useMemo(() => [...birikimiAl(seyahatId).arananlar], [seyahatId, surum, alanYolda]);
  const sehirAlani = useMemo(() => (lat == null || lng == null ? null : { merkez: { lat, lng }, yaricapM: yaricap ?? VARSAYILAN_SEHIR_YARICAPI_M }), [lat, lng, yaricap]);
  return { yerler, yukleniyor: yolda > 0 || alanYolda > 0, hata, sehirAlani, arananlar, genisAlan: genis, alanAraniyor: alanYolda > 0, alandaAra: ara };
}
