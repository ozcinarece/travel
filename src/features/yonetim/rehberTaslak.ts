// #156 rehber taslağı — saf kurallar: canlı bölümlerden taslak, taslaktan önizleme satırları, bölüm işlemleri. Testli.
import { mekanBaglari, rehberGovdesi, rehberYazisi, type BolumTuru, type RehberBolumu } from './sehir';

/** Taslaktaki bölüm (sehir_rehberi_taslak.bolumler öğesi). `bolum` yalnız eski 4 bölümde dolu. */
export type TaslakBolum = { id: string; baslik: string; ozet: string | null; govde: string; gizli: boolean; bolum: BolumTuru | null };

/**
 * #642 KK2: taslakta saklanan öğe (`sehir_rehberi_taslak.bilinen`): kategori, koordinat ve koordinatın alınma anı. Google'dan gelen
 * ad saklanmaz; eski kayıtta `ad` durabilir (temizlik migration'ı atar).
 */
export type BilinenMekan = { ad?: string; kategori: string | null; lat: number | null; lng: number | null; google_fetched_at?: string | null };

/** Bu oturumda seçilen mekan: ad yalnız bellekte (editörde çizmek ve yayında yeni yerin adı için). */
export type SecilenMekan = { ad: string; kategori: string | null; lat: number | null; lng: number | null; google_fetched_at: string };

export type RehberTaslagi = { bolumler: TaslakBolum[]; bilinen: Record<string, BilinenMekan>; updated_at: string; yayinlandi_at: string | null };

/** #642 KK2: kayda giden öğe — ad atılır, koordinatın damgası kalır. */
export function saklanacakBilinen(secilenler: Readonly<Record<string, SecilenMekan>>): Record<string, BilinenMekan> {
  return Object.fromEntries(
    Object.entries(secilenler).map(([id, m]) => [id, { kategori: m.kategori, lat: m.lat, lng: m.lng, google_fetched_at: m.google_fetched_at }]),
  );
}

/** Editörün ve önizlemenin çizdiği mekanlar: adı bilinenler (eski taslak öğesi ya da bu oturumda seçilen). */
export function gorunenBilinen(
  taslak: Readonly<Record<string, BilinenMekan>> | undefined,
  oturum: Readonly<Record<string, SecilenMekan>>,
): Record<string, { ad: string; kategori: string | null; lat: number | null; lng: number | null }> {
  const sonuc: Record<string, { ad: string; kategori: string | null; lat: number | null; lng: number | null }> = {};
  for (const [id, m] of Object.entries({ ...(taslak ?? {}), ...oturum })) {
    if (m.ad) sonuc[id] = { ad: m.ad, kategori: m.kategori, lat: m.lat, lng: m.lng };
  }
  return sonuc;
}

/**
 * #642: yayında yeni yerin adı (`rehber_yayinla.p_adlar`): yazıdaki mekanlardan adı bu oturumda bilinenler. `ad`: önbellekteki
 * ad (Google'a sorulmaz). Saklanmaz; sunucu yalnız yeni açılan yerin adı için kullanır.
 */
export function yayinAdlari(bolumler: readonly TaslakBolum[], ad: (placeId: string) => string | null | undefined): Record<string, string> {
  const sonuc: Record<string, string> = {};
  for (const b of bolumler) {
    for (const m of mekanBaglari(b.govde)) {
      const a = ad(m.place_id)?.trim();
      if (a && !sonuc[m.place_id]) sonuc[m.place_id] = a;
    }
  }
  return sonuc;
}

export type CanliBolum = RehberBolumu & { gizli?: boolean };

/** Taslak yoksa canlı bölümlerden başlanır (aynı kimlik, başlıksız gövde). */
export function canlidanTaslak(canli: readonly CanliBolum[]): TaslakBolum[] {
  return [...canli]
    .sort((a, b) => a.sira - b.sira)
    .map((b) => ({ id: b.id, baslik: b.baslik, ozet: b.ozet, govde: rehberGovdesi(b.yazi_md), gizli: !!b.gizli, bolum: b.bolum ?? null }));
}

/** "Taslak değişiklik var": taslak yayından sonra değişti (hiç yayınlanmadıysa taslak varsa). */
export function taslakDegisti(t: Pick<RehberTaslagi, 'updated_at' | 'yayinlandi_at'> | null | undefined): boolean {
  if (!t) return false;
  return !t.yayinlandi_at || new Date(t.updated_at).getTime() > new Date(t.yayinlandi_at).getTime();
}

/** Önizleme (uygulamanın `SehirRehberi`ne verilen satırlar): gizli bölümler uygulamada yok; yazı `# Başlık` + gövde. */
export function onizlemeSatirlari(sehirId: string, bolumler: readonly TaslakBolum[], yalniz?: string): RehberBolumu[] {
  return bolumler
    .filter((b) => !b.gizli || b.id === yalniz)
    .filter((b) => !yalniz || b.id === yalniz)
    .map((b, i) => ({ id: b.id, sehir_id: sehirId, bolum: b.bolum, baslik: b.baslik, ozet: b.ozet, yazi_md: rehberYazisi(b.baslik, b.govde), sira: i + 1 }));
}

/** Bölümdeki mekan kartı sayısı (sol listedeki "3 mekan"). */
export function bolumKartSayisi(b: Pick<TaslakBolum, 'govde'>): number {
  return mekanBaglari(b.govde).filter((m) => m.bicim === 'kart').length;
}

/** "Rehberdeki mekanlar · N": gizli olmayan bölümlerdeki tekil mekanlar (kart + satır içi; uygulamadaki sayı). */
export function rehberMekanSayisi(bolumler: readonly TaslakBolum[]): number {
  return new Set(bolumler.filter((b) => !b.gizli).flatMap((b) => mekanBaglari(b.govde).map((m) => m.place_id))).size;
}

/** Mekan başka bölümde de varsa o bölüm ("02 · Ne yenir"); yoksa null. */
export function mekanBaskaBolumde(placeId: string, bolumler: readonly TaslakBolum[], seciliId: string | undefined): { no: string; baslik: string } | null {
  const i = bolumler.findIndex((b) => b.id !== seciliId && mekanBaglari(b.govde).some((m) => m.place_id === placeId));
  return i < 0 ? null : { no: String(i + 1).padStart(2, '0'), baslik: bolumler[i].baslik };
}

export function yeniBolum(id: string, baslik: string): TaslakBolum {
  return { id, baslik, ozet: null, govde: '', gizli: false, bolum: null };
}

/** Çoğalt: hemen altına "(kopya)" adlı, türsüz kopya (eski türün tekilliği bozulmasın). */
export function bolumCogalt(bolumler: readonly TaslakBolum[], id: string, yeniId: string, ek: string): TaslakBolum[] {
  const i = bolumler.findIndex((b) => b.id === id);
  if (i < 0) return [...bolumler];
  const kopya = { ...bolumler[i], id: yeniId, baslik: `${bolumler[i].baslik} ${ek}`.slice(0, 120), bolum: null };
  return [...bolumler.slice(0, i + 1), kopya, ...bolumler.slice(i + 1)];
}

export function bolumTasi(bolumler: readonly TaslakBolum[], id: string, yon: -1 | 1): TaslakBolum[] {
  const i = bolumler.findIndex((b) => b.id === id);
  const j = i + yon;
  if (i < 0 || j < 0 || j >= bolumler.length) return [...bolumler];
  const yeni = [...bolumler];
  [yeni[i], yeni[j]] = [yeni[j], yeni[i]];
  return yeni;
}

/** Silinen bölüm ve yeri (Geri al aynı yere koyar). */
export function bolumSil(bolumler: readonly TaslakBolum[], id: string): { kalan: TaslakBolum[]; silinen: { bolum: TaslakBolum; indeks: number } | null } {
  const i = bolumler.findIndex((b) => b.id === id);
  if (i < 0) return { kalan: [...bolumler], silinen: null };
  return { kalan: bolumler.filter((b) => b.id !== id), silinen: { bolum: bolumler[i], indeks: i } };
}

export function bolumGeriAl(bolumler: readonly TaslakBolum[], silinen: { bolum: TaslakBolum; indeks: number }): TaslakBolum[] {
  if (bolumler.some((b) => b.id === silinen.bolum.id)) return [...bolumler];
  const yeni = [...bolumler];
  yeni.splice(Math.min(silinen.indeks, yeni.length), 0, silinen.bolum);
  return yeni;
}
