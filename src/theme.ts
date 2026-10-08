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

// PRD 3.5 KK3 / #55 §D: gün renkleri sabit; 7. günden sonra palet döner. Siyah gün rengi değil (seçim/eylem rengi).
export const gunRenkleri = ['#2f6fed', '#f2783f', '#12a37a', '#8a4fd6', '#e0457b', '#0ea5e9'] as const;

export function gunRengi(gunIndex: number): string {
  return gunRenkleri[(gunIndex - 1) % gunRenkleri.length];
}

/** #59 §C (RouteSpec5): rota çizgisi gün renginin ~%20 koyusu; pinler gün renginde kalır. */
export const rotaRenkleri = ['#1f4fc2', '#cf5a22', '#0b7d5d', '#6e3fab', '#b83762', '#0b84ba'] as const;

export function rotaRengi(gunIndex: number): string {
  return rotaRenkleri[(gunIndex - 1) % rotaRenkleri.length];
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
