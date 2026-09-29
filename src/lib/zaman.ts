// Seyahat saat dilimi yardımcıları (PRD v0.2 §8 trips.tz, 3.7 KK5).
// "Bugün" cihazın değil seyahat şehrinin takvimine göredir.

/** `YYYY-MM-DD` biçiminde, verilen IANA diliminde takvim günü. */
export function yerelTarih(an: Date, tz: string): string {
  const parcalar = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(an);
  const al = (tip: string) => parcalar.find((p) => p.type === tip)?.value ?? '';
  return `${al('year')}-${al('month')}-${al('day')}`;
}

type Tarihli = { start_date: string | null; end_date: string | null; tz: string };

/** PRD 3.1 KK1: bugün ∈ [gidiş, dönüş] ise seyahat aktiftir. Tarihsiz seyahat hiç aktif olmaz. */
export function aktifMi(seyahat: Tarihli, an: Date = new Date()): boolean {
  if (!seyahat.start_date || !seyahat.end_date) return false;
  const bugun = yerelTarih(an, seyahat.tz);
  return seyahat.start_date <= bugun && bugun <= seyahat.end_date;
}

/** Gidiş–dönüş arası gün sayısı (iki uç dahil). Tarihsiz seyahat 1 günle başlar (PRD 3.2 KK2). */
export function gunSayisi(start: string | null, end: string | null): number {
  if (!start || !end) return 1;
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** Aktif seyahatte kaçıncı gün (1'den başlar); aralık dışındaysa null. */
export function kacinciGun(seyahat: Tarihli, an: Date = new Date()): number | null {
  if (!aktifMi(seyahat, an)) return null;
  return gunSayisi(seyahat.start_date, yerelTarih(an, seyahat.tz));
}
