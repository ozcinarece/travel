// #580 (kanvas UX önerileri › `Dalga1_DurakCekmecesi` · `Dalga1_GecikmeBandi`): Gezi sayfasındaki durak çekmecesi ve gecikme
// bandının metinleri ve kararları. Saf hesaplar; saatler canlı programdan (dakika, `trips.tz` ile hesaplanmış).
import { t } from '@/i18n';
import { sureMetni } from '@/lib/kategori';
import type { Gun } from '@/lib/tipler';
import { saatEkli } from '@/lib/zaman';
import { dakikaSaat } from '@/schedule/tempo';

import { gunAdi } from './seyahatV7';

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
 * KK2: birincil düğme. Gezildi diye kaydedilmiş durakta (Gezdim ya da otomatik tamamlanma yazıldı) "Gezilmedi say";
 * değilse "Gezdim".
 */
export function gezdimDugmesi(tamamlandi: boolean): {
  metin: string;
  geriAl: boolean;
} {
  return tamamlandi ? { metin: t('durakCekmecesi.gezilmediSay'), geriAl: true } : { metin: t('durakCekmecesi.gezdim'), geriAl: false };
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
