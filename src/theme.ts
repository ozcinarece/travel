// Tasarım kanvasındaki sistem: beyaz zemin, Plus Jakarta Sans, siyah + tek vurgu turuncu.

export const renk = {
  zemin: '#ffffff',
  metin: '#0f0f0f',
  ikincil: '#6e6e6e',
  soluk: '#9a9a9a',
  yuzey: '#f4f4f2',
  ayrac: '#ebebeb',
  vurgu: '#ff5a1f',
  uyariZemin: '#ffe9e1',
  uyari: '#c2410c',
  basari: '#1f8a4c',
} as const;

// PRD 3.5 KK3: gün renkleri sabit; 4. günden sonra palet döner.
export const gunRenkleri = ['#0f0f0f', '#ff5a1f', '#4c6ef5', '#1f8a4c', '#8a5cf6', '#0ea5a5'] as const;

export function gunRengi(gunIndex: number): string {
  return gunRenkleri[(gunIndex - 1) % gunRenkleri.length];
}

export const yazi = {
  normal: 'PlusJakartaSans_400Regular',
  orta: 'PlusJakartaSans_500Medium',
  yari: 'PlusJakartaSans_600SemiBold',
  kalin: 'PlusJakartaSans_700Bold',
  ekstra: 'PlusJakartaSans_800ExtraBold',
} as const;

export const bosluk = { kenar: 20, arasi: 12 } as const;

// PRD §11: dokunma hedefleri ≥ 44 pt.
export const minDokunma = 44;
