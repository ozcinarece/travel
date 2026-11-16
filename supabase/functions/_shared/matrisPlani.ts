// #253: route-matrix için Google istek planı. Google matrisi eleman başına faturalar (kaynak × hedef), bu yüzden önbellekte
// olmayan çiftler en az elemanla istenir:
//   A) tek dikdörtgen: eksik kaynaklar × eksik hedefler (ilk hesapta, yani hiçbir çift önbellekte yokken en iyisi);
//   B) iki istek: (yeni noktalar × bütün noktalar) + (eski noktalar × yeni noktalar).
// Hangisi daha az eleman tutuyorsa o seçilir (eşitlikte tek istek). Örnek: 24 noktası önbellekte olan güne 1 nokta → A 625,
// B 2 × 25 − 1 = 49 eleman. Bu modül içe aktarım yapmaz; Jest'te birim testlenir.

export type MatrisIstegi = { kaynaklar: string[]; hedefler: string[] };
export type MatrisPlani = { istekler: MatrisIstegi[]; eleman: number };

/** `anahtarlar` (tekrarsız, sıralı) için önbellekte olmayan çiftleri (`onbellekte(a, b)` false) kapsayan en ucuz plan. */
export function matrisPlani(anahtarlar: string[], onbellekte: (a: string, b: string) => boolean): MatrisPlani {
  const eksikKaynak = new Set<string>();
  const eksikHedef = new Set<string>();
  for (const a of anahtarlar) {
    for (const b of anahtarlar) {
      if (a !== b && !onbellekte(a, b)) {
        eksikKaynak.add(a);
        eksikHedef.add(b);
      }
    }
  }
  if (eksikKaynak.size === 0) return { istekler: [], eleman: 0 };

  // A) tek dikdörtgen.
  const dikdortgen: MatrisPlani = {
    istekler: [{ kaynaklar: anahtarlar.filter((a) => eksikKaynak.has(a)), hedefler: anahtarlar.filter((a) => eksikHedef.has(a)) }],
    eleman: eksikKaynak.size * eksikHedef.size,
  };

  // B) yeni × hepsi + eski × yeni. "Yeni" kümesi her eksik çiftin en az bir ucunu içermeli (örtü): önce hiç önbellek çifti
  // olmayan noktalar (gerçekten yeni duraklar), sonra kalan eksik çiftlerin (eski noktalar arasındaki boşluklar) kaynağı.
  const yeniKume = new Set<string>();
  for (const a of anahtarlar) {
    if (anahtarlar.every((b) => a === b || (!onbellekte(a, b) && !onbellekte(b, a)))) yeniKume.add(a);
  }
  for (const a of anahtarlar) {
    for (const b of anahtarlar) {
      if (a !== b && !onbellekte(a, b) && !yeniKume.has(a) && !yeniKume.has(b)) yeniKume.add(a);
    }
  }
  const yeni = anahtarlar.filter((a) => yeniKume.has(a));
  const eski = anahtarlar.filter((a) => !yeniKume.has(a));
  const istekler: MatrisIstegi[] = [{ kaynaklar: yeni, hedefler: anahtarlar }];
  if (eski.length > 0) istekler.push({ kaynaklar: eski, hedefler: yeni });
  const bolunmus: MatrisPlani = { istekler, eleman: yeni.length * anahtarlar.length + eski.length * yeni.length };

  return bolunmus.eleman < dikdortgen.eleman ? bolunmus : dikdortgen;
}
