// #550: profil özeti sorgu anahtarı ayrı ve bağımlılıksız: `sorgular.ts` (web davet girişine de girer) 81 ilin sınır
// verisini (`turkiye-iller.json`, profilV12) yüklemeden kullanabilsin.
export const profilOzetiAnahtari = (kisi: string | undefined) => ['profil_ozeti', kisi] as const;
