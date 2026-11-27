// #537: Depolaması kapalı tarayıcılar (bazı uygulama içi WebView'lar) — `localStorage` `null` döner ya da
// erişimde `SecurityError` verir. Oturum o durumda sayfa açık kaldıkça bellekte tutulur; davet sayfası yine açılır.

export type Depolama = {
  getItem(anahtar: string): string | null;
  setItem(anahtar: string, deger: string): void;
  removeItem(anahtar: string): void;
};

export function bellekDepolama(): Depolama {
  const kayit = new Map<string, string>();
  return {
    getItem: (a) => kayit.get(a) ?? null,
    setItem: (a, d) => {
      kayit.set(a, d);
    },
    removeItem: (a) => {
      kayit.delete(a);
    },
  };
}

/** Yazılabilir `localStorage` varsa onu, yoksa bellek içi depoyu döndürür. Hiçbir durumda hata fırlatmaz. */
export function webDepolama(kapsam: { localStorage?: Storage | null } = globalThis as never): Depolama {
  try {
    const ls = kapsam.localStorage;
    if (!ls) return bellekDepolama();
    const deneme = `gezi-ds-${Math.random()}`;
    ls.setItem(deneme, '1');
    ls.removeItem(deneme);
    return ls;
  } catch {
    return bellekDepolama();
  }
}
