// #141 Listem (kanvas 13 · 13b) — saf hesaplar: gruplar (atanmamış + günler), oy sayıları, gün programları ve "Güne ekle"
// için gün seçenekleri (önerilen gün). Mesafe koordinattan, süre önbellekteki yürüyüşten ya da kuş uçuşu tahmininden; istek yok.
import { mesafeM } from '@/components/harita/geo';
import type { Konum } from '@/components/harita/tipler';
import type { GunUcNoktalari } from '@/features/konaklama/plan';
import { saatKisa } from '@/features/program/useProgram';
import { haftaGunu } from '@/lib/takvim';
import type { Durak, Gun, Mekan, Oy, Seyahat } from '@/lib/tipler';
import { googleGunu, type Periyot } from '@/schedule/acilis';
import { enUcuzEklemeIndeksi, programHesapla, type Program, type ProgramDuragi, type YuruyusKaynagi } from '@/schedule/program';

export type ListemSiralama = 'plan' | 'oy';

export type ListemSatiri = {
  mekan: Mekan;
  durak: Durak | null;
  oy: number;
  benimOyum: boolean;
};

export type ListemGunu = { gun: Gun; satirlar: ListemSatiri[] };

export type ListemGruplari = {
  atanmamis: ListemSatiri[];
  gunler: ListemGunu[];
  sayi: { tumu: number; gunlerde: number; atanmamis: number };
};

/** KK2–3: atanmamışlar (eklenme sırası) ve günler (gün içi sıra); "En çok oy" seçiliyse her grup oya göre (eşitlikte asıl sıra). */
export function listemGruplari(p: { mekanlar: Mekan[]; duraklar: Durak[]; gunler: Gun[]; oylar: Oy[]; benId: string | null; siralama: ListemSiralama }): ListemGruplari {
  const oySayisi = new Map<string, number>();
  const benim = new Set<string>();
  for (const o of p.oylar) {
    oySayisi.set(o.mekan, (oySayisi.get(o.mekan) ?? 0) + 1);
    if (o.kullanici === p.benId) benim.add(o.mekan);
  }
  const durakIle = new Map(p.duraklar.map((d) => [d.place_ref, d]));
  const satir = (m: Mekan): ListemSatiri => ({ mekan: m, durak: durakIle.get(m.id) ?? null, oy: oySayisi.get(m.id) ?? 0, benimOyum: benim.has(m.id) });
  const oyaGore = (a: ListemSatiri, b: ListemSatiri) => b.oy - a.oy;
  const sirala = (liste: ListemSatiri[]) => (p.siralama === 'oy' ? [...liste].sort(oyaGore) : liste);

  const atanmamis = sirala(
    p.mekanlar
      .filter((m) => !durakIle.has(m.id))
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
      .map(satir),
  );
  const mekanIle = new Map(p.mekanlar.map((m) => [m.id, m]));
  const gunler = [...p.gunler]
    .sort((a, b) => a.index - b.index)
    .map((g) => ({
      gun: g,
      satirlar: sirala(
        p.duraklar
          .filter((d) => d.day_id === g.id)
          .sort((a, b) => (a.order_key < b.order_key ? -1 : a.order_key > b.order_key ? 1 : 0))
          .map((d) => mekanIle.get(d.place_ref))
          .filter((m): m is Mekan => !!m)
          .map(satir),
      ),
    }));
  const gunlerde = gunler.reduce((t, g) => t + g.satirlar.length, 0);
  return { atanmamis, gunler, sayi: { tumu: atanmamis.length + gunlerde, gunlerde, atanmamis: atanmamis.length } };
}

type GunHesabi = {
  seyahat: Pick<Seyahat, 'day_start'>;
  mekanIle: Map<string, Mekan>;
  gunUclari: Map<string, GunUcNoktalari>;
  yuruyus: YuruyusKaynagi;
  saatler?: Record<string, { periyotlar?: Periyot[] | null }>;
};

const programDuragi = (m: Pick<Mekan, 'place_id' | 'lat' | 'lng'>, id: string, dakika: number): ProgramDuragi => ({
  id,
  key: m.place_id,
  konum: { lat: m.lat, lng: m.lng },
  dakika,
  tamamlandiDk: null,
  skipped: false,
});

function gunProgrami(g: Gun, duraklar: ProgramDuragi[], h: GunHesabi): Program {
  const u = h.gunUclari.get(g.id);
  return programHesapla({
    baslangic: saatKisa(g.start_time, saatKisa(h.seyahat.day_start, '09:00')),
    duraklar,
    otel: u?.baslangic ? { lat: u.baslangic.lat, lng: u.baslangic.lng } : null,
    bitisOtel: u?.bitis ? { lat: u.bitis.lat, lng: u.bitis.lng } : null,
    otelKey: u?.baslangic?.key,
    bitisKey: u?.bitis?.key,
    yuruyus: h.yuruyus,
    simdiDk: null,
    acilis: h.saatler ? (k) => h.saatler?.[k]?.periyotlar : undefined,
    haftaGunu: g.date ? googleGunu(haftaGunu(g.date)) : null,
  });
}

function gunDuraklari(g: Gun, duraklar: Durak[], mekanIle: Map<string, Mekan>): ProgramDuragi[] {
  return duraklar
    .filter((d) => d.day_id === g.id)
    .sort((a, b) => (a.order_key < b.order_key ? -1 : a.order_key > b.order_key ? 1 : 0))
    .map((d) => {
      const m = mekanIle.get(d.place_ref);
      return m ? { ...programDuragi(m, d.id, d.minutes), skipped: d.skipped } : null;
    })
    .filter((x): x is ProgramDuragi => !!x);
}

/** Satırlardaki saatler (varış) için her günün planı — Program'la aynı hesap (önbellekteki yürüyüş, açılış boşluğu). */
export function gunProgramlari(p: GunHesabi & { gunler: Gun[]; duraklar: Durak[] }): Map<string, Program> {
  return new Map(p.gunler.map((g) => [g.id, gunProgrami(g, gunDuraklari(g, p.duraklar, p.mekanIle), p)]));
}

/** "Yakınında" sayılan mesafe (Planı kur bölge eşiğiyle aynı). */
export const YAKIN_M = 1500;

export type GunSecenegi = {
  gun: Gun;
  durakSayisi: number;
  /** En yakın durağa kuş uçuşu (m); boş günde null. */
  enYakinM: number | null;
  /** YAKIN_M içindeki durak sayısı. */
  yakindaki: number;
  /** Bugünkü bitiş ve eklenince bitiş (dakika); boş günde bitiş null. */
  bitisDk: number | null;
  yeniBitisDk: number;
  /** Elle sıralanmış günde en ucuz ekleme sırası (otomatik günde §5.1 yeniden dizer). */
  ekleIndeksi: number;
  onerilen: boolean;
  /** Son gün (dönüş) — boş günde "dönüş günü". */
  sonGun: boolean;
};

/**
 * KK5: "Hangi güne ekleyelim?" — her gün için yakınlık ve bitiş saatinin nasıl değişeceği. Önerilen: durağı olan günler
 * arasında en yakın durağı en yakın olan (eklenince gün `gunSonuDk`'yı aşmayanlar önce); hiç durak yoksa ilk boş gün.
 */
export function gunSecenekleri(p: GunHesabi & { mekan: Mekan; gunler: Gun[]; duraklar: Durak[]; gunSonuDk?: number }): GunSecenegi[] {
  const sonuDk = p.gunSonuDk ?? 20 * 60;
  const konum: Konum = { lat: p.mekan.lat, lng: p.mekan.lng };
  const yeni = programDuragi(p.mekan, `yeni:${p.mekan.id}`, p.mekan.default_minutes);
  const sirali = [...p.gunler].sort((a, b) => a.index - b.index);
  const sonIndex = sirali.length ? sirali[sirali.length - 1].index : 0;
  const secenekler = sirali.map((g): GunSecenegi => {
    const duraklar = gunDuraklari(g, p.duraklar.filter((d) => d.place_ref !== p.mekan.id), p.mekanIle);
    const aktif = duraklar.filter((d) => !d.skipped);
    const mesafeler = aktif.map((d) => mesafeM(konum, d.konum));
    const u = p.gunUclari.get(g.id);
    const otel = u?.baslangic ? { lat: u.baslangic.lat, lng: u.baslangic.lng } : null;
    const ekleIndeksi = enUcuzEklemeIndeksi(
      aktif.map((d) => ({ key: d.key, konum: d.konum })),
      { key: yeni.key, konum: yeni.konum },
      otel,
      p.yuruyus,
      { otelKey: u?.baslangic?.key, bitis: u?.bitis ? { key: u.bitis.key, konum: { lat: u.bitis.lat, lng: u.bitis.lng } } : null },
    );
    // Atlanan duraklar sırada kalır; ekleme indeksi atlanmayanlar arasındaki yere karşılık gelir.
    const once = aktif[ekleIndeksi - 1];
    const yer = once ? duraklar.indexOf(once) + 1 : 0;
    const eklenmis = [...duraklar.slice(0, yer), yeni, ...duraklar.slice(yer)];
    return {
      gun: g,
      durakSayisi: aktif.length,
      enYakinM: mesafeler.length ? Math.min(...mesafeler) : null,
      yakindaki: mesafeler.filter((m) => m <= YAKIN_M).length,
      bitisDk: aktif.length ? gunProgrami(g, duraklar, p).bitisDk : null,
      yeniBitisDk: gunProgrami(g, eklenmis, p).bitisDk,
      ekleIndeksi,
      onerilen: false,
      sonGun: g.index === sonIndex && sirali.length > 1,
    };
  });
  const dolu = secenekler.filter((x) => x.enYakinM !== null);
  const sigan = dolu.filter((x) => x.yeniBitisDk <= sonuDk);
  const aday = [...(sigan.length ? sigan : dolu)].sort((a, b) => a.enYakinM! - b.enYakinM! || a.yeniBitisDk - b.yeniBitisDk)[0] ?? secenekler.find((x) => x.durakSayisi === 0);
  if (aday) aday.onerilen = true;
  // Önerilen en üstte, diğerleri gün sırasıyla.
  return [...secenekler.filter((x) => x.onerilen), ...secenekler.filter((x) => !x.onerilen)];
}
