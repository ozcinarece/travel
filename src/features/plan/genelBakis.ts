// #667 Plan v13 (UX önerileri kanvası `Plan_v13_Genel` · `Plan_v13_Gun`): Plan sekmesinin genel bakışı ve gün detayının saf
// hesapları. Gün kartı "K durak · X / 8 sa" ve dolgu çubuğu (Program'ın tempo hesabından), gün başlığı, gün detayının özet
// satırı ve bacak metni, harita pinleri / çizgileri ve gün lejantı. Google'a istek yok: konumlar DB'den, çizgiler kuş uçuşu
// (genel bakış) ya da önbellekteki rota (gün detayı, `programCizgileri`).
import type { HaritaCizgisi, HaritaPini, Konum } from '@/components/harita/tipler';
import { t } from '@/i18n';
import { konumu } from '@/lib/konum';
import { AYLAR, GUNLER_KISA, haftaGunu, parcala } from '@/lib/takvim';
import type { Durak, Gun, Mekan } from '@/lib/tipler';
import { saatDakika } from '@/schedule/tempo';
import { gunRengi, planV13, rotaRengi } from '@/theme';

import { kmMetni } from './planListesi';

/** KK3: gün kartındaki dolgu çubuğunun ölçüsü — günün süresi / 8 saat (kanvas notu "dolgu = süre / 8 sa"). */
export const GUN_KAPASITE_SA = 8;

export type GunKartiOzeti = {
  gunId: string;
  index: number;
  /** Atlanmamış durak sayısı. */
  durak: number;
  /** Günün süresi (ilk çıkıştan son durağın bitişine), yarım saate yuvarlı. */
  saat: number;
  /** 0–1: `saat / GUN_KAPASITE_SA` (8 saati aşan gün dolu). */
  oran: number;
  /** Günde hiç durak yok: kesik çerçeve + "Boş gün" + "Doldur". */
  bos: boolean;
  /** Durak var ama hepsi atlandı: kart dolu biçimde, alt satır "Hepsi atlandı" (gün detayındaki özetle aynı), çubuk boş. */
  hepsiAtlandi: boolean;
};

/**
 * KK3: gün kartının sayıları. Durak sayısı atlanmamış duraklar (tempo hesabı; gün detayındaki numaralı satırlarla aynı). Süre
 * tempo hesabının başlangıç–bitiş aralığı (yürüyüş ve araç dahil; kanvasta 09:30–14:25 → "5 / 8 sa", çubuk %62). `toplamDurak`
 * atlananlar dahil günün bütün durakları: hiç yoksa boş gün; var ama hepsi atlandıysa "Hepsi atlandı" (boş gün değil).
 */
export function gunKartiOzeti(
  gun: Pick<Gun, 'id' | 'index'>,
  tempo: { durakSayisi: number; baslangic: string; bitis: string } | undefined,
  toplamDurak: number = tempo?.durakSayisi ?? 0,
): GunKartiOzeti {
  const durak = tempo?.durakSayisi ?? 0;
  const temel = { gunId: gun.id, index: gun.index };
  if (!tempo || durak === 0) return { ...temel, durak: 0, saat: 0, oran: 0, bos: toplamDurak === 0, hepsiAtlandi: toplamDurak > 0 };
  const dk = Math.max(0, saatDakika(tempo.bitis) - saatDakika(tempo.baslangic));
  const saat = Math.round(dk / 30) / 2;
  return { ...temel, durak, saat, oran: Math.min(1, saat / GUN_KAPASITE_SA), bos: false, hepsiAtlandi: false };
}

/** "5" · "3,5" (Türkçe ondalık). */
export function saatSayisi(saat: number): string {
  return String(saat).replace('.', ',');
}

/** KK3: "4 durak · 5 / 8 sa". */
export function gunKartiAlt(o: Pick<GunKartiOzeti, 'durak' | 'saat'>): string {
  return t('planV13.kartAlt', { n: o.durak, saat: saatSayisi(o.saat), kapasite: GUN_KAPASITE_SA });
}

/** KK3 · KK4: "1. gün · Per 7 Ocak"; tarihsiz günde "1. gün". */
export function gunBasligiV13(g: Pick<Gun, 'index' | 'date'>): string {
  if (!g.date) return t('planV13.gunNo', { n: g.index });
  const { ay, gun } = parcala(g.date);
  return t('planV13.gunBaslik', { n: g.index, tarih: `${GUNLER_KISA[haftaGunu(g.date)]} ${gun} ${AYLAR[ay - 1]}` });
}

/**
 * KK4: gün detayının özet satırı — "4 durak · 09:30–14:25 · 5,2 km". Durak parçası `durakOzeti` ("Hepsi atlandı" dahil);
 * saat aralığı yalnız atlanmamış durak varsa; km gösterilen bacakların (otelden ilk durağa dahil) toplamı, bacak yoksa yok.
 */
export function gunDetayOzeti(p: { durak: string; aralik: string | null; metre: number }): string {
  return [p.durak, p.aralik, p.metre > 0 ? kmMetni(p.metre) : null].filter(Boolean).join(' · ');
}

/** KK4: bacak metni — yürüyüşte "12 dk · 900 m", araçta "18 dk · 3,2 km araçla"; kestirimde dakikanın önünde "~". */
export function bacakMetniV13(p: { dk: number; m: number; araba: boolean; kestirim: boolean }): string {
  const dk = `${p.kestirim ? '~' : ''}${p.dk}`;
  return t(p.araba ? 'planV13.bacakArac' : 'plan.bacak', { dk, mesafe: kmMetni(p.m) });
}

const sirayla = (a: Durak, b: Durak) => (a.order_key < b.order_key ? -1 : a.order_key > b.order_key ? 1 : 0);

export type GunLejanti = { gunId: string; index: number; renk: string; etiket: string };

/**
 * KK3: genel bakış haritası (kanvas `Plan_v13_Genel`, 230 pt). Her günün atlanmamış durakları gün renginde numarasız nokta;
 * ikiden çok noktalı günde aralarında kuş uçuşu çizgi rota tonunda (`rotaRenkleri`). Lejant yalnız haritada noktası olan
 * günler (boş gün lejantta yok). Koordinatı boşalmış mekan çizilmez (#318).
 */
export function genelHaritaVerisi(p: { gunler: Gun[]; duraklar: Durak[]; mekanlar: Mekan[] }): {
  pinler: HaritaPini[];
  cizgiler: HaritaCizgisi[];
  lejant: GunLejanti[];
  noktalar: Konum[];
} {
  const mekanIle = new Map(p.mekanlar.map((m) => [m.id, m]));
  const pinler: HaritaPini[] = [];
  const cizgiler: HaritaCizgisi[] = [];
  const lejant: GunLejanti[] = [];
  for (const g of [...p.gunler].sort((a, b) => a.index - b.index)) {
    const noktalar: Konum[] = [];
    for (const d of p.duraklar.filter((x) => x.day_id === g.id && !x.skipped).sort(sirayla)) {
      const k = konumu(mekanIle.get(d.place_ref));
      if (!k) continue;
      noktalar.push(k);
      pinler.push({ id: `genel:${d.id}`, tur: 'durak', konum: k, renk: gunRengi(g.index), etiket: '' });
    }
    if (noktalar.length === 0) continue;
    lejant.push({ gunId: g.id, index: g.index, renk: gunRengi(g.index), etiket: t('planV13.gunNo', { n: g.index }) });
    if (noktalar.length > 1) cizgiler.push({ id: `genel:${g.id}`, noktalar, renk: rotaRengi(g.index), ince: true });
  }
  return { pinler, cizgiler, lejant, noktalar: pinler.map((x) => x.konum) };
}

/**
 * KK4: gün detayı haritası — seçili günün çizgilerinden (`programCizgileri`, önbellekteki rota ya da kuş uçuşu) otele giden /
 * otelden gelen bacaklar ve bacak hapları çıkar; kanvasta yalnız duraklar arası çizgi var.
 */
export function gunHaritasiCizgileri(cizgiler: HaritaCizgisi[]): HaritaCizgisi[] {
  return cizgiler.filter((c) => !c.id.includes('stay:')).map((c) => ({ ...c, etiket: undefined, etiketIkon: undefined, etiketRenk: undefined }));
}

/** KK4: satırın sağındaki yüz — durağı ekleyen üye (`places.added_by`); üye listesinde yoksa yüz yok. */
export function ekleyenYuzu<U extends { user_id: string }>(addedBy: string | null, uyeler: U[]): { uye: U; sira: number } | null {
  if (!addedBy) return null;
  const sira = uyeler.findIndex((u) => u.user_id === addedBy);
  return sira < 0 ? null : { uye: uyeler[sira], sira };
}

/** KK3 · KK4: kanvas sırası (E · M · A) — üyenin listedeki sırasına göre yüz zemini ve baş harf rengi; 4. üyeden sonra döner. */
export function yuzRengiV13(sira: number): { zemin: string; harf: string } {
  const n = planV13.yuzler.length;
  return planV13.yuzler[((sira % n) + n) % n];
}
