// PRD 3.7: günün zaman çizelgesi. Sıralı duraklar + yürüyüş bacakları → varış/ayrılış saatleri.
// KK7 (#43): "Tamamlandı" işaretli durakta sonraki saatler completed_at + yürüyüş ile yeniden hesaplanır (ayrılış anı).
// KK8 (#43): dokunulmadıysa planlanan bitiş + 10 dk geçince durak otomatik tamamlanmış sayılır (planlanan bitişle).
// KK10: yürüyüş süresi önbellekte yoksa kestirim kullanılır ve satır `kestirim` olarak işaretlenir.
import type { Konum } from '@/components/harita/tipler';

import { bacakModu, dakikaSaat, kestirimYuruyusSn, saatDakika } from './tempo';

export const UZUN_KALMA_PAYI_DK = 10;

export type ProgramDuragi = {
  id: string;
  /** walk_cache anahtarı (place_id). */
  key: string;
  konum: Konum;
  dakika: number;
  /** #43: tamamlanma anı (seyahat dilimine göre gün başından dakika); yoksa null. */
  tamamlandiDk: number | null;
  skipped: boolean;
};

/** Bacak: `mod` yürüyüş ya da (#33, 40 dk üstü) taksi; sn/m seçilen moda ait. */
export type Yuruyus = { sn: number; m: number; kestirim: boolean; mod: 'yuruyus' | 'taksi' };
/**
 * Önbellekten bacak; yoksa null (kestirime düşülür). Anahtarlar place_id ya da 'hotel'.
 * `taksi`: route-legs'ten araç süresi (yalnız 40 dk üstü bacaklarda gelir); yoksa kestirim.
 */
export type YuruyusKaynagi = (fromKey: string, toKey: string) => { sn: number; m: number; taksi?: { sn: number; m: number } | null } | null;

/** gecildi = tamamlandı (elle ya da otomatik) · buradasin = sıradaki durak, kullanıcı 60 m içinde (konum) · siradaki · bekliyor · atlandi. */
export type DurakDurumu = 'gecildi' | 'buradasin' | 'siradaki' | 'bekliyor' | 'atlandi';

export type ProgramSatiri = {
  durak: ProgramDuragi;
  varisDk: number;
  /** Tamamlanan durakta gerçek tamamlanma anı; diğerlerinde planlanan bitiş. */
  ayrilisDk: number;
  /** Önceki noktadan (otel ya da önceki durak) bu durağa yürüyüş; atlanan durakta null. */
  yuruyus: Yuruyus | null;
  durum: DurakDurumu;
  /** #43 KK8: planlanan bitiş + 10 dk geçtiği için (henüz yazılmamış olsa da) otomatik tamamlanmış sayıldı. */
  otomatik: boolean;
};

export type Program = {
  satirlar: ProgramSatiri[];
  baslangicDk: number;
  /** Son ayrılış + (otel varsa) otele dönüş yürüyüşü. */
  bitisDk: number;
  oteleDonus: Yuruyus | null;
  /** Yalnız yürünen bacaklar. */
  yuruyusSn: number;
  yuruyusM: number;
  /** Araç bacakları (#33). */
  taksiSn: number;
  taksiM: number;
  kestirimVar: boolean;
  /** Tamamlanan (gecildi) / atlanmamış durak sayısı — ilerleme çubuğu (#42). */
  tamamlanan: number;
  toplam: number;
};

export function programHesapla(secenek: {
  baslangic: string;
  duraklar: ProgramDuragi[];
  otel: Konum | null;
  yuruyus: YuruyusKaynagi;
  /** Bugünün programıysa seyahat dilimindeki şu an (dakika); değilse null. */
  simdiDk: number | null;
  /** Konumla: kullanıcının 60 m içinde olduğu durak (#43 KK4); yoksa null. */
  buradaId?: string | null;
}): Program {
  const { duraklar, otel, simdiDk } = secenek;
  const buradaId = secenek.buradaId ?? null;
  const bacak = (aKey: string, aKonum: Konum, bKey: string, bKonum: Konum): Yuruyus => {
    const c = secenek.yuruyus(aKey, bKey);
    const yuruyusSn = c ? c.sn : kestirimYuruyusSn(aKonum, bKonum);
    const m = bacakModu(aKonum, bKonum, { yuruyusSn, taksiSn: c?.taksi?.sn ?? null, kestirim: !c });
    if (m.mod === 'taksi') {
      // Araç mesafesi: gerçek varsa o; yoksa kuş uçuşu × 1,4.
      const metre = c?.taksi?.m ?? Math.round(((m.sn - 180) * 25_000) / 3600);
      return { sn: m.sn, m: Math.max(0, metre), kestirim: m.kestirim, mod: 'taksi' };
    }
    return c ? { sn: c.sn, m: c.m, kestirim: false, mod: 'yuruyus' } : { sn: yuruyusSn, m: Math.round((yuruyusSn * 4500) / 3600 / 1.3), kestirim: true, mod: 'yuruyus' };
  };

  const baslangicDk = saatDakika(secenek.baslangic);
  const satirlar: ProgramSatiri[] = [];
  let oncekiKey = otel ? 'hotel' : null;
  let oncekiKonum = otel;
  let saat = baslangicDk;
  let yuruyusSn = 0;
  let yuruyusM = 0;
  let taksiSn = 0;
  let taksiM = 0;
  let kestirimVar = false;
  const topla = (y: Yuruyus) => {
    if (y.mod === 'taksi') {
      taksiSn += y.sn;
      taksiM += y.m;
    } else {
      yuruyusSn += y.sn;
      yuruyusM += y.m;
    }
    if (y.kestirim) kestirimVar = true;
  };

  let tamamlanan = 0;
  let toplam = 0;
  let siradakiVerildi = false;
  for (const d of duraklar) {
    if (d.skipped) {
      satirlar.push({ durak: d, varisDk: saat, ayrilisDk: saat, yuruyus: null, durum: 'atlandi', otomatik: false });
      continue;
    }
    toplam++;
    let y: Yuruyus | null = null;
    if (oncekiKey && oncekiKonum) {
      y = bacak(oncekiKey, oncekiKonum, d.key, d.konum);
      topla(y);
    }
    const varisDk = saat + (y ? Math.round(y.sn / 60) : 0);
    const planAyrilis = varisDk + d.dakika;
    let ayrilisDk = planAyrilis;
    let durum: DurakDurumu = 'bekliyor';
    let otomatik = false;
    if (d.tamamlandiDk !== null) {
      // KK7: tamamlanma anı ayrılış anıdır; sonrakiler buradan akar. #47 C8: liste her zaman artan — tamamlanma
      // hesaplanan başlangıçtan önceyse (art arda "Bitti") ayrılış başlangıca sabitlenir, saat geriye gitmez.
      ayrilisDk = Math.max(varisDk, d.tamamlandiDk);
      durum = 'gecildi';
    } else if (simdiDk !== null && simdiDk > planAyrilis + UZUN_KALMA_PAYI_DK) {
      // KK8: dokunulmadı, pay da geçti → planlanan bitişle otomatik tamamlanmış sayılır; program plana göre akar.
      durum = 'gecildi';
      otomatik = true;
    } else if (simdiDk !== null && !siradakiVerildi) {
      durum = buradaId === d.id ? 'buradasin' : 'siradaki';
      siradakiVerildi = true;
    }
    if (durum === 'gecildi') tamamlanan++;
    satirlar.push({ durak: d, varisDk, ayrilisDk, yuruyus: y, durum, otomatik });
    saat = ayrilisDk;
    oncekiKey = d.key;
    oncekiKonum = d.konum;
  }

  let oteleDonus: Yuruyus | null = null;
  if (otel && oncekiKey && oncekiKey !== 'hotel' && oncekiKonum) {
    oteleDonus = bacak(oncekiKey, oncekiKonum, 'hotel', otel);
    topla(oteleDonus);
  }
  const bitisDk = saat + (oteleDonus ? Math.round(oteleDonus.sn / 60) : 0);
  return { satirlar, baslangicDk, bitisDk, oteleDonus, yuruyusSn, yuruyusM, taksiSn, taksiM, kestirimVar, tamamlanan, toplam };
}

/** "09:00 – 10:30" gibi. */
export function saatAraligi(varisDk: number, ayrilisDk: number) {
  return `${dakikaSaat(varisDk)} – ${dakikaSaat(ayrilisDk)}`;
}

/** Bacak süresi, dakika (en az 1). Taksi bacağında araç süresi (#33). */
export function yuruyusDk(y: Yuruyus): number {
  return Math.max(1, Math.round(y.sn / 60));
}

/**
 * T7: elle sıralanmış günde yeni durak en ucuz ekleme noktasına girer.
 * Dönen değer: yeni durağın gireceği indeks (0 = en başa).
 */
export function enUcuzEklemeIndeksi(sira: { key: string; konum: Konum }[], yeni: { key: string; konum: Konum }, otel: Konum | null, yuruyus: YuruyusKaynagi): number {
  const maliyet = (a: { key: string; konum: Konum }, b: { key: string; konum: Konum }) => yuruyus(a.key, b.key)?.sn ?? kestirimYuruyusSn(a.konum, b.konum);
  const noktalar = otel ? [{ key: 'hotel', konum: otel }, ...sira] : sira;
  if (noktalar.length === 0) return 0;
  let enIyi = 0;
  let enKisa = Infinity;
  for (let i = 0; i <= sira.length; i++) {
    const once = noktalar[otel ? i : i - 1];
    const sonra = sira[i];
    let ek = 0;
    if (once) ek += maliyet(once, yeni);
    if (sonra) ek += maliyet(yeni, sonra);
    if (once && sonra) ek -= maliyet(once, sonra);
    if (ek < enKisa) {
      enKisa = ek;
      enIyi = i;
    }
  }
  return enIyi;
}
