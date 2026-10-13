// #144 KK3 (kanvas 21b): Kaydettiklerim · Yerler şehirlere göre gruplu ("Eskişehir · 5"). Gruplar ve grup içi yerler kaydetme
// sırasıyla (en son kalp bırakılan önce); şehri olmayan yer "Diğer" grubunda (sonda).
export type SehirliYer = { id: string; sehir_id: string; sehirler: { ad: string } | null };

export type YerGrubu<Y> = { sehirId: string; sehirAd: string; yerler: Y[] };

export function yerGruplari<Y extends SehirliYer>(yerler: Y[], sira: Map<string, number>, digerAd: string): YerGrubu<Y>[] {
  const sirali = [...yerler].sort((a, b) => (sira.get(a.id) ?? Infinity) - (sira.get(b.id) ?? Infinity));
  const gruplar = new Map<string, YerGrubu<Y>>();
  for (const y of sirali) {
    const anahtar = y.sehirler ? y.sehir_id : '';
    const g = gruplar.get(anahtar) ?? { sehirId: anahtar, sehirAd: y.sehirler?.ad ?? digerAd, yerler: [] };
    g.yerler.push(y);
    gruplar.set(anahtar, g);
  }
  const liste = [...gruplar.values()];
  return [...liste.filter((g) => g.sehirId), ...liste.filter((g) => !g.sehirId)];
}
