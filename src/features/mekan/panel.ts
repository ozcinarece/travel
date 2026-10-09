// #80: mekan paneli — saf durum makinesi, CTA metni ve yorum sıralaması (bileşenden bağımsız; test edilir).
import type { TamYer, Yorum } from '@/features/yerler/api';

/** Panel halleri: kapalı · yarı (%55, varsayılan) · tam (yukarı çekince). */
export type PanelHali = 'kapali' | 'yari' | 'tam';
export type PanelSekmesi = 'genel' | 'yorumlar' | 'rehber';
export type PanelDurumu = { hal: PanelHali; sekme: PanelSekmesi };

export type PanelOlayi =
  /** Pine dokunuldu (aynı ya da başka pin). Panel açıksa hal ve sekme korunur, içerik değişir (KK13). */
  | { tur: 'ac' }
  /** ×, haritaya dokunma, seçimin kalkması. */
  | { tur: 'kapat' }
  /** Alt sayfa sürüklemesi: 'katli' = aşağı çekildi → kapanır. */
  | { tur: 'hal'; hal: 'katli' | 'yari' | 'tam' }
  | { tur: 'sekme'; sekme: PanelSekmesi };

export const KAPALI_PANEL: PanelDurumu = { hal: 'kapali', sekme: 'genel' };

export function panelGecis(d: PanelDurumu, olay: PanelOlayi): PanelDurumu {
  switch (olay.tur) {
    case 'ac':
      return d.hal === 'kapali' ? { hal: 'yari', sekme: 'genel' } : d;
    case 'kapat':
      return d.hal === 'kapali' ? d : KAPALI_PANEL;
    case 'hal':
      if (olay.hal === 'katli') return d.hal === 'kapali' ? d : KAPALI_PANEL;
      return d.hal === olay.hal ? d : { ...d, hal: olay.hal };
    case 'sekme':
      return d.sekme === olay.sekme ? d : { ...d, sekme: olay.sekme };
  }
}

/** Alt sayfa yükseklikleri (px): kapalı 0 · yarı %55 · tam = ekran − üst güvenli alan − 8. */
export function panelYukseklikleri(ekranYuksekligi: number, ustGuvenli: number) {
  return { katli: 0, yari: Math.round(ekranYuksekligi * 0.55), tam: Math.max(Math.round(ekranYuksekligi * 0.55), ekranYuksekligi - ustGuvenli - 8) };
}

/** KK3: ana düğme — Keşfet'te listeye ekle / listeden çıkar; Program'da güne ekle / günden çıkar. */
export type CtaAnahtari = 'listeyeEkle' | 'listedenCikar' | 'guneEkle' | 'gundenCikar';
export function ctaAnahtari(baglam: 'kesfet' | 'program', icinde: boolean): CtaAnahtari {
  if (baglam === 'kesfet') return icinde ? 'listedenCikar' : 'listeyeEkle';
  return icinde ? 'gundenCikar' : 'guneEkle';
}

export type YorumSirasi = 'yeni' | 'yuksek' | 'dusuk';

/** KK9: istemcide sıralama — en yeni (yayın tarihi; yoksa Google sırası), en yüksek / en düşük puan (eşitlikte yeni önce). */
export function yorumlariSirala(yorumlar: Yorum[], sira: YorumSirasi): Yorum[] {
  const zaman = (y: Yorum) => (y.yayin ? Date.parse(y.yayin) || 0 : 0);
  const dizi = yorumlar.map((y, i) => ({ y, i }));
  dizi.sort((a, b) => {
    if (sira === 'yeni') return zaman(b.y) - zaman(a.y) || a.i - b.i;
    const fark = sira === 'yuksek' ? (b.y.puan ?? 0) - (a.y.puan ?? 0) : (a.y.puan ?? 0) - (b.y.puan ?? 0);
    return fark || zaman(b.y) - zaman(a.y) || a.i - b.i;
  });
  return dizi.map((x) => x.y);
}

/** KK2/KK7: açık/kapalı durumu — "Açık · 22:00'e kadar" / "Kapalı · yarın 09:00"; bilinmiyorsa null. */
export type AcikDurumu = { acik: true; kapanis: string | null } | { acik: false; acilis: TamYer['acilis'] };
export function acikDurumu(yer: { acik: boolean | null; kapanis?: string | null; acilis?: TamYer['acilis'] } | null | undefined): AcikDurumu | null {
  if (!yer || yer.acik === null || yer.acik === undefined) return null;
  return yer.acik ? { acik: true, kapanis: yer.kapanis ?? null } : { acik: false, acilis: yer.acilis ?? null };
}

/** KK5: fotoğraf şeridinde yalnız görünür (+1 komşu) küçük resimlerin URI'si istenir. */
export function gorunenFotoSayisi(kaydirmaX: number, genislik: number, kareGenisligi: number, bosluk: number): number {
  return Math.floor((kaydirmaX + genislik) / (kareGenisligi + bosluk)) + 2;
}
