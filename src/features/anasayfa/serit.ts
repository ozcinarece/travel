// #276 2b (kanvas 29b · 29c · 29f): ana ekrandaki seyahat şeridinin ve "gezi bitti" kartının verisi. Hepsi bizim veritabanımız;
// Google isteği yok (otel için yalnız `stays` satırı var mı diye bakılır, ad doldurulmaz).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';

import { geziModu, gunTarihi } from '@/features/gezi/geziOzeti';
import { siradakiAdim, type SiradakiAdim } from '@/features/gezi/siradakiAdim';
import { useDuraklar, useGunler } from '@/features/gunler/sorgular';
import { harcamaOzeti } from '@/features/harcama/hesap';
import { kisiler as kisiKaynagi, type Kisiler } from '@/features/harcama/metin';
import { useHarcamalar, useOdesmeler } from '@/features/harcama/sorgular';
import { OTEL_SERIT_ONEKI } from '@/features/konaklama/otelSeridi';
import { useKonaklamaSatirlari } from '@/features/konaklama/sorgular';
import { useMekanlar, useUyeler } from '@/features/mekanlar/sorgular';
import { saatKisa } from '@/features/program/useProgram';
import type { Siniflar } from '@/features/seyahatler/siniflandir';
import { t } from '@/i18n';
import { useOturum } from '@/lib/oturum';
import type { SeyahatOzet } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';

/**
 * KK4: "Gezini paylaş" kartı (29c, 2. kart) paylaşım akışı gelene kadar hiç gösterilmez (26 Kas işi açar). Kapalıyken 29c'de
 * yalnız "Harcamaları kapat" kartı olabilir.
 */
export const GEZI_PAYLAS_KARTI = false;

export type KesfetDurumu =
  /** 29b: altta sabit şerit. `sinif` rozeti seçer (planlanan seyahatte rozet yok). */
  | { tur: 'serit'; seyahat: SeyahatOzet; sinif: 'aktif' | 'yaklasan' | 'planlanan' }
  /** 29c: üstte "gezi bitti" kartları; şerit yok, altta yüzen "+ Yeni seyahat". */
  | { tur: 'geziBitti'; seyahat: SeyahatOzet }
  | null;

/**
 * KK3 · KK-ek4 (Ürün cevabı 17 Kas): Keşfet'te ne gösterilir. Öncelik aktif > yaklaşan (en yakın) > yeniBiten (yalnız
 * gösterecek bir 29c kartı varken) > planlanan. yeniBiten'de şerit yok; kart yoksa sıradaki duruma (planlanan şeridi) geçilir.
 */
export function kesfetDurumu(s: Siniflar, yeniBitenKartiVar: boolean): KesfetDurumu {
  if (s.aktif[0]) return { tur: 'serit', seyahat: s.aktif[0], sinif: 'aktif' };
  if (s.yaklasan[0]) return { tur: 'serit', seyahat: s.yaklasan[0], sinif: 'yaklasan' };
  if (s.yeniBiten[0] && yeniBitenKartiVar) return { tur: 'geziBitti', seyahat: s.yeniBiten[0] };
  if (s.planlanan[0]) return { tur: 'serit', seyahat: s.planlanan[0], sinif: 'planlanan' };
  return null;
}

/** Şeritteki tek satır: "Sıradaki adım: 2 mekanı güne dağıt" (kanvas 29b). */
export function seritAdimMetni(a: SiradakiAdim): string {
  const adim = (() => {
    if (a.tur === 'planKur') return t('serit.adim.planKur');
    if (a.tur === 'dagit') return t('serit.adim.dagit', { n: a.mekanIdleri.length });
    if (a.tur === 'otel') return t('serit.adim.otel');
    if (a.tur === 'davet') return t('serit.adim.davet');
    if (a.tur === 'yemek') return t('serit.adim.yemek', { gun: gunTarihi(a.gun) });
    if (a.tur === 'harcamaKapat') return t('serit.adim.harcamaKapat');
    if (a.tur === 'paylas') return t('serit.adim.paylas');
    return t('serit.adim.yarin', { saat: a.cikis });
  })();
  return t('serit.siradaki', { adim });
}

/**
 * KK3: şeritteki Sıradaki adım, Gezi sayfasındakiyle aynı hesap (`siradakiAdim.ts`). Veri gelene kadar `undefined`; adım yoksa
 * (gezi günü ya da her şey tamam) ya da sorgulardan biri hata verdiyse `null` (#290 KK4: şerit o zaman tarih satırını gösterir).
 * #290 KK5: Keşfet'te otel satırı yok; Gezi sayfasındaki `['otel']` burada geçmez, otel yoksa "otel seç" önerilir.
 */
export function useSeritAdimi(sy: SeyahatOzet | null): SiradakiAdim | null | undefined {
  const id = sy?.id;
  const gunler = useGunler(id);
  const duraklar = useDuraklar(id);
  const mekanlar = useMekanlar(id);
  const oteller = useKonaklamaSatirlari(id);
  const uyeler = useUyeler(id);
  const [otelErtelendi, setOtelErtelendi] = useState(false);
  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(OTEL_SERIT_ONEKI + id)
      .then((v) => setOtelErtelendi(v === '1'))
      .catch(() => undefined);
  }, [id]);
  const hata = gunler.isError || duraklar.isError || mekanlar.isError || oteller.isError || uyeler.isError;
  return useMemo(() => {
    if (sy && hata) return null;
    if (!sy || !gunler.data || !duraklar.data || !mekanlar.data || !oteller.data || !uyeler.data) return undefined;
    const an = new Date();
    const mod = geziModu(sy, an);
    const sirali = [...gunler.data].sort((a, b) => a.index - b.index);
    return siradakiAdim({
      mod,
      gunler: gunler.data,
      duraklar: duraklar.data,
      mekanlar: mekanlar.data,
      otelVar: oteller.data.length > 0,
      otelErtelendi,
      uyeSayisi: uyeler.data.length || 1,
      bugun: yerelTarih(an, sy.tz),
      baslangic: sy.start_date,
      ilkGunCikis: saatKisa(sirali[0]?.start_time, '09:00'),
      ekranda: [],
    });
  }, [sy, hata, gunler.data, duraklar.data, mekanlar.data, oteller.data, uyeler.data, otelErtelendi]);
}

export type AcikBorc = {
  /** Sadeleştirilmiş açık transfer sayısı (> 0 ise "Harcamaları kapat" kartı görünür; `siradakiAdim.ts` 8. adım mantığı). */
  transfer: number;
  /** Benim net bakiyem (kuruş): artıysa bana borçlular var. */
  benimNet: number;
  /** Benimle karşılıklı açık transferler (kişi, tutar). */
  karsilar: { id: string; tutar: number }[];
  kisiler: Kisiler;
};

/**
 * #289 inceleme 3: "Harcamaları kapat" kartı yalnız benim dahil olduğum açık transfer varken (net bakiyem sıfır değil).
 * Başka iki kişi arasındaki açık borç bana kart çıkarmaz.
 */
export function banaAcikBorc(b: AcikBorc | null | undefined): boolean {
  return !!b && b.benimNet !== 0;
}

/** #290 KK9: zayıf ağda alt bölüm ≈7 sn boş kalmasın; bu üç sorgu yalnız bir kez yeniden dener. */
const BORC_SORGU = { retry: 1 } as const;

/**
 * KK4: yeni biten seyahatin açık borcu. Veri gelene kadar `undefined`; seyahat yoksa, oturum yoksa (#290 KK11) ya da sorgulardan
 * biri hata verirse `null`.
 */
export function useAcikBorc(sy: SeyahatOzet | null): AcikBorc | null | undefined {
  const id = sy?.id;
  const { session } = useOturum();
  const benId = session?.user.id ?? null;
  const harcamalar = useHarcamalar(id, BORC_SORGU);
  const odesmeler = useOdesmeler(id, BORC_SORGU);
  const uyeler = useUyeler(id, BORC_SORGU);
  const oturumVar = !!session;
  return useMemo(() => {
    if (!sy || !oturumVar) return null;
    // Sorgu hata verirse beklemede kalınmaz: kart yokmuş gibi sıradaki duruma geçilir (ekran boş kalmasın).
    if (harcamalar.isError || odesmeler.isError || uyeler.isError) return null;
    if (!harcamalar.data || !odesmeler.data || !uyeler.data) return undefined;
    const bugun = yerelTarih(new Date(), sy.tz);
    const o = harcamaOzeti({ harcamalar: harcamalar.data, odesmeler: odesmeler.data, benId, bugun, gununTarihi: (iso) => yerelTarih(new Date(iso), sy.tz) });
    return { transfer: o.transferler.length, benimNet: o.benimNet, karsilar: o.karsilar, kisiler: kisiKaynagi(uyeler.data) };
  }, [sy, oturumVar, harcamalar.data, odesmeler.data, uyeler.data, harcamalar.isError, odesmeler.isError, uyeler.isError, benId]);
}
