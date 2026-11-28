// #643 KK1 (yalnız web): davet / paylaşım sayfasının HTML'indeki satır içi betik (scripts/web-davet-ozet.mjs) özet RPC'sini
// sayfa JS'i gelmeden başlatır. Özet sorgusu önce buraya bakar: aynı RPC, aynı gövde ve (gerekiyorsa) aynı yetkiyle
// başlatılmış bir istek varsa onun sonucunu bir kez alır; ikinci istek gitmez. Eşleşmezse, istek düşerse ya da yanıt
// JSON değilse (araya giren ağ, `agFetch`) `null` döner ve sorgu isteği her zamanki gibi kendisi atar.
// Native'de bu dosyanın yerine `erkenOzet.native.ts` (hiçbir şey yapmaz) kullanılır.

/** scripts/web-davet-ozet.mjs `GLOBAL`. */
export const ERKEN_OZET = '__tripmateErkenOzet';

type Yanit = { durum: number; tur: string; metin: string } | null;
type ErkenOzet = { rpc: string; govde: string; yetki: string | null; sonuc: Promise<Yanit> };
type Kapsam = { [ERKEN_OZET]?: ErkenOzet };

/**
 * `uygulamaYetkisi`: RPC'nin sonucu oturuma bağlıysa (ör. `davet_ozeti`'nin `uye` alanı) uygulamanın şu anki erişim
 * anahtarı (oturum yoksa `null`); erken istek başka bir yetkiyle atıldıysa kullanılmaz. Oturumdan bağımsız RPC'de verilmez.
 */
export async function erkenOzetiAl(
  rpc: string,
  argumanlar: Record<string, unknown>,
  uygulamaYetkisi?: () => Promise<string | null>,
  kapsam: Kapsam = (typeof window === 'undefined' ? {} : window) as Kapsam,
): Promise<{ data: unknown } | null> {
  const erken = kapsam[ERKEN_OZET];
  if (!erken || erken.rpc !== rpc || erken.govde !== JSON.stringify(argumanlar)) return null;
  // Tek kullanımlık: sonraki yenilemeler (ör. "Tekrar dene") ağa gider.
  delete kapsam[ERKEN_OZET];
  try {
    if (uygulamaYetkisi && (await uygulamaYetkisi()) !== erken.yetki) return null;
    const yanit = await erken.sonuc;
    if (!yanit || yanit.durum < 200 || yanit.durum >= 300 || !yanit.tur.toLowerCase().includes('json')) return null;
    return { data: yanit.metin.trim() === '' ? null : JSON.parse(yanit.metin) };
  } catch {
    return null;
  }
}
