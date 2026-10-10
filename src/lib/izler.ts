// #85: son tanı izleri (bellek halkası) — Sentry DSN olmasa da hata kartında son 5 iz görünür (kök neden için tek kanıt).
export type Iz = { zaman: number; kategori: string; mesaj: string };

const EN_FAZLA = 20;
const izler: Iz[] = [];

export function izEkle(kategori: string, mesaj: string, zaman = Date.now()) {
  izler.push({ zaman, kategori, mesaj });
  if (izler.length > EN_FAZLA) izler.shift();
}

/** Son `n` iz, en yenisi sonda. */
export function sonIzler(n = 5): Iz[] {
  return izler.slice(-n);
}

/** Testler için. */
export function izleriSifirla() {
  izler.length = 0;
}

/** Hata kartı için kısa özet: ilk satır (≤ 160 karakter) + hata adı. */
export function hataOzeti(hata: unknown): string {
  if (hata instanceof Error) {
    const satir = (hata.message || hata.name || 'Error').split('\n')[0].trim();
    return `${hata.name && hata.name !== 'Error' ? `${hata.name}: ` : ''}${satir}`.slice(0, 160);
  }
  return String(hata).split('\n')[0].slice(0, 160);
}

/** React bileşen yığınından ilk bileşen adı ("in FotoSeridi (created by …)" → "FotoSeridi"). */
export function ilkBilesen(componentStack: string | null | undefined): string | null {
  if (!componentStack) return null;
  const satir = componentStack.split('\n').map((x) => x.trim()).find(Boolean);
  if (!satir) return null;
  const m = /^(?:in|at)\s+([A-Za-z0-9_$.]+)/.exec(satir);
  return m ? m[1] : satir.slice(0, 40);
}
