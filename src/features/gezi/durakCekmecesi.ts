// #580 (kanvas UX önerileri › `Dalga1_DurakCekmecesi` · `Dalga1_GecikmeBandi`): Gezi sayfasındaki durak çekmecesi ve gecikme
// bandının metinleri ve kararları. Saf hesaplar; saatler canlı programdan (dakika, `trips.tz` ile hesaplanmış).
import { t } from '@/i18n';
import { sureMetni } from '@/lib/kategori';
import type { Gun } from '@/lib/tipler';
import { saatEkli } from '@/lib/zaman';
import { UZUN_KALMA_PAYI_DK } from '@/schedule/program';
import { dakikaSaat } from '@/schedule/tempo';

import { gezildiMi, gunAdi } from './seyahatV7';

/** KK4: gecikme bu kadar dakikayı GEÇİNCE (> 15) Gezi sayfasında bant çıkar. */
export const GECIKME_BANDI_ESIGI_DK = 15;

export function gecikmeBandiGorunur(dk: number | null | undefined): dk is number {
  return typeof dk === 'number' && dk > GECIKME_BANDI_ESIGI_DK;
}

/** KK1: çekmece başlığının alt satırı — "Şimdi · 14:10 · 45 dk"; şimdiki durak değilse "14:10 · 45 dk". */
export function cekmeceAltSatiri(k: { varisDk: number | null; dakika: number }, simdi: boolean): string {
  return [simdi ? t('durakCekmecesi.simdi') : null, k.varisDk !== null ? dakikaSaat(k.varisDk) : null, sureMetni(k.dakika)].filter(Boolean).join(' · ');
}

/** KK1: "Yol tarifi" alt satırı — "12 dk yürüme" (araçla bacakta "12 dk araçla"); süre bilinmiyorsa null. */
export function yolAltSatiri(dk: number | null | undefined, taksi: boolean): string | null {
  if (dk === null || dk === undefined) return null;
  return t(taksi ? 'durakCekmecesi.yolTaksi' : 'durakCekmecesi.yolYuruyus', {
    dk,
  });
}

/** KK1 · KK3: "Yarına taşı"nın hedefi — bugünden sonraki gün (index + 1); son gündeyse null. */
export function yarinHedefi<G extends Pick<Gun, 'id' | 'index'>>(gunler: G[], bugun: Pick<Gun, 'index'> | null | undefined): G | null {
  if (!bugun) return null;
  return gunler.find((g) => g.index === bugun.index + 1) ?? null;
}

/** KK1 · KK3: "Perşembe, günün sonuna"; tarihsiz günde "3. gün, günün sonuna"; hedef yoksa "Son gün". */
export function yarinAltSatiri(hedef: Pick<Gun, 'index' | 'date'> | null): string {
  if (!hedef) return t('durakCekmecesi.sonGun');
  return t('durakCekmecesi.yarinAlt', {
    gun: gunAdi(hedef.date) ?? t('geziSayfasi.gunNo', { n: hedef.index }),
  });
}

/**
 * KK2: birincil düğme. Gezildi görünen durakta (Gezdim, yazılmış otomatik tamamlanma ya da programın kendiliğinden geçildi
 * sayması) "Gezilmedi say" (✓'siz); değilse "Gezdim" (✓).
 */
export function gezdimDugmesi(gezildi: boolean): {
  metin: string;
  geriAl: boolean;
} {
  return gezildi ? { metin: t('durakCekmecesi.gezilmediSay'), geriAl: true } : { metin: t('durakCekmecesi.gezdim'), geriAl: false };
}

export type GezdimYazimi = { id: string; completed_at: string | null; completed_by: string | null; auto_completed: boolean };

/**
 * KK2 (#580 değişiklik 2): çekmece düğmesinin kararı ve yazımı — satırla aynı tanım (`gezildiMi`).
 * - Gezildi görünüyor → "Gezilmedi say": tamamlanma silinir. Durağın vakti (planlanan bitiş + pay) geçtiyse program onu yine
 *   kendiliğinden geçildi sayacağından açık "gezilmedi" kaydı da yazılır (`auto_completed = true`, `gezilmediMi`).
 * - Gezilmemiş → "Gezdim", şimdinin anı.
 */
export function gezdimEylemi(
  k: { durakId: string; tamamlandi: boolean; durum: string | null; varisDk: number | null; dakika: number },
  p: { simdiDk: number | null; an: Date; benId: string | null },
): { metin: string; geriAl: boolean; yazim: GezdimYazimi } {
  if (gezildiMi(k)) {
    const vaktiGecti = !k.tamamlandi || (p.simdiDk !== null && k.varisDk !== null && p.simdiDk > k.varisDk + k.dakika + UZUN_KALMA_PAYI_DK);
    return { ...gezdimDugmesi(true), yazim: { id: k.durakId, completed_at: null, completed_by: null, auto_completed: vaktiGecti } };
  }
  return { ...gezdimDugmesi(false), yazim: { id: k.durakId, completed_at: p.an.toISOString(), completed_by: p.benId, auto_completed: false } };
}

/** KK4: "25 dk gerideyiz". */
export function gecikmeMetni(dk: number): string {
  return t('durakCekmecesi.gerideyiz', { dk });
}

/** KK5: gecikmedeyken Şimdi alt satırı — "Planda 14:10 · şimdi 14:35'te varırsın". */
export function gecikmeliSimdiAlti(varisDk: number, dk: number): string {
  return t('durakCekmecesi.plandaVarirsin', {
    plan: dakikaSaat(varisDk),
    simdi: saatEkli(dakikaSaat(varisDk + dk), 'bulunma'),
  });
}
