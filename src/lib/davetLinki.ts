// PRD 3.10 KK1: https://{domain}/r/{token}, token 8 karakter base62.
const YOL = /\/r\/([0-9A-Za-z]{8})(?=$|[/?#])/;
const CIPLAK = /^([0-9A-Za-z]{8})$/;

/** Yapıştırılan metinden davet token'ını çıkarır; link ya da çıplak kod kabul edilir. */
export function davetTokeni(metin: string): string | null {
  const m = metin.trim();
  return YOL.exec(m)?.[1] ?? CIPLAK.exec(m)?.[1] ?? null;
}
