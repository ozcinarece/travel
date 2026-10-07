// #39: Program sekmesinin iki görünümünün (Harita / Çizelge) paylaştığı veri — tek yürüyüş matrisi, seçili günün gerçek
// rota bacakları (#33), gün bazlı tempo (§5.3) ve gün kartları için tempo etiketleri.
import { useMemo } from 'react';

import type { Konum } from '@/components/harita/tipler';
import type { Durak, Gun, Mekan, Seyahat } from '@/lib/tipler';
import type { YuruyusKaynagi } from '@/schedule/program';
import { kestirimYuruyusSn, tempoHesapla, type BacakKaynagi, type TempoEtiketi, type TempoSonucu } from '@/schedule/tempo';

import { bacakKaynagi, bacakListesi, matrisNoktalari, useRotaBacaklari, useYuruyusMatrisi, type MatrisNoktasi, type RotaHaritasi } from './sorgular';

/** Postgres time "09:00:00" → "09:00". */
const saat = (tm: string | null | undefined, varsayilan: string) => (tm ? tm.slice(0, 5) : varsayilan);

export type ProgramVerisi = {
  otel: Konum | null;
  /** Yürüyüş matrisi + gerçek bacaklar (anahtar: place_id | 'hotel'). */
  yuruyus: YuruyusKaynagi;
  matrisYukleniyor: boolean;
  matrisHata: boolean;
  rotalar: RotaHaritasi;
  rotaYukleniyor: boolean;
  rotaHata: boolean;
  /** Konum tabanlı bacak kaynağı (tempo için). */
  bacak: BacakKaynagi;
  /** Gün kimliği → tempo (elle sıralı günde mevcut sıra, değilse §5.1). */
  tempolar: Map<string, TempoSonucu>;
  /** Gün kimliği → kart etiketi; boş günde 'bos'. */
  etiketler: Map<string, TempoEtiketi | 'bos'>;
  /** Seçili günün sıralı mekanları (atlananlar hariç). */
  seciliSira: Mekan[];
  /** otel → seçili sıra → otel (route-legs noktaları). */
  seciliNoktalar: MatrisNoktasi[];
};

export function useProgramVerisi(secenek: { seyahat: Seyahat; gunler: Gun[]; duraklar: Durak[]; mekanlar: Mekan[]; seciliGun: Gun | undefined }): ProgramVerisi {
  const { seyahat, gunler, duraklar, mekanlar, seciliGun } = secenek;
  const otel = useMemo(
    () => (seyahat.hotel_lat !== null && seyahat.hotel_lng !== null ? { lat: seyahat.hotel_lat, lng: seyahat.hotel_lng } : null),
    [seyahat.hotel_lat, seyahat.hotel_lng],
  );
  const mekanIle = useMemo(() => new Map(mekanlar.map((m) => [m.id, m])), [mekanlar]);

  // Tek matris: atanmış duraklar + otel (≤ 25 nokta); gelene kadar kestirim "~".
  const atanmisMekanlar = useMemo(() => {
    const atanan = new Set(duraklar.filter((d) => !d.skipped).map((d) => d.place_ref));
    return mekanlar.filter((m) => atanan.has(m.id)).slice(0, 24);
  }, [duraklar, mekanlar]);
  const matris = useYuruyusMatrisi(seyahat.id, matrisNoktalari(otel, atanmisMekanlar));

  const konumKey = useMemo(() => {
    const k = new Map<string, string>();
    if (otel) k.set(`${otel.lat},${otel.lng}`, 'hotel');
    for (const m of mekanlar) k.set(`${m.lat},${m.lng}`, m.place_id);
    return k;
  }, [mekanlar, otel]);

  // #51: tek sıra kaynağı order_key — liste, pin numaraları ve rota bacakları aynı sırayı kullanır. Otomatik günde
  // order_key zaten §5.1 sırasına yazılır (Program ekranı); ayrı bir yeniden sıralama haritayı listeden ayırıyordu.
  const seciliSira = useMemo(() => {
    if (!seciliGun) return [] as Mekan[];
    return duraklar
      .filter((d) => d.day_id === seciliGun.id && !d.skipped)
      .sort((a, b) => (a.order_key < b.order_key ? -1 : 1))
      .map((d) => mekanIle.get(d.place_ref))
      .filter((m): m is Mekan => !!m);
  }, [seciliGun, duraklar, mekanIle]);
  const seciliNoktalar = useMemo((): MatrisNoktasi[] => {
    const n = seciliSira.map((m) => ({ key: m.place_id, lat: m.lat, lng: m.lng }));
    return otel && n.length > 0 ? [{ key: 'hotel', ...otel }, ...n, { key: 'hotel', ...otel }] : n;
  }, [seciliSira, otel]);
  const rota = useRotaBacaklari(seyahat.id, bacakListesi(seciliNoktalar));

  const yuruyus = useMemo(() => bacakKaynagi(matris.yuruyus, rota.rotalar), [matris.yuruyus, rota.rotalar]);
  const bacak: BacakKaynagi = useMemo(
    () => (a, b) => {
      const c = yuruyus(konumKey.get(`${a.lat},${a.lng}`) ?? '', konumKey.get(`${b.lat},${b.lng}`) ?? '');
      return c ? { yuruyusSn: c.sn, taksiSn: c.taksi?.sn ?? null, kestirim: false } : { yuruyusSn: kestirimYuruyusSn(a, b), taksiSn: null, kestirim: true };
    },
    [yuruyus, konumKey],
  );

  // KK5: her gün için tempo. Gün başlangıcı/bitişi: days.* yoksa trips.day_*. Elle sıralanmış günde mevcut sıra.
  const tempolar = useMemo(() => {
    const sonuc = new Map<string, TempoSonucu>();
    for (const g of gunler) {
      const gunDuraklari = duraklar
        .filter((d) => d.day_id === g.id && !d.skipped)
        .sort((a, b) => (a.order_key < b.order_key ? -1 : 1))
        .map((d) => ({ durak: d, mekan: mekanIle.get(d.place_ref) }))
        .filter((x): x is { durak: Durak; mekan: Mekan } => !!x.mekan);
      sonuc.set(
        g.id,
        tempoHesapla({
          duraklar: gunDuraklari.map(({ durak, mekan }) => ({ id: mekan.id, konum: { lat: mekan.lat, lng: mekan.lng }, dakika: durak.minutes })),
          otel,
          baslangic: saat(g.start_time, saat(seyahat.day_start, '09:00')),
          bitis: saat(g.end_time, saat(seyahat.day_end, '20:00')),
          bacak,
          // #51: sıra hep order_key (otomatik günde order_key §5.1 sırasına yazılır).
          sira: gunDuraklari.map(({ mekan }) => mekan.id),
        }),
      );
    }
    return sonuc;
  }, [gunler, duraklar, mekanIle, otel, seyahat.day_start, seyahat.day_end, bacak]);

  const etiketler = useMemo(() => {
    const e = new Map<string, TempoEtiketi | 'bos'>();
    for (const g of gunler) {
      const tp = tempolar.get(g.id);
      e.set(g.id, tp && tp.durakSayisi > 0 ? tp.etiket : 'bos');
    }
    return e;
  }, [gunler, tempolar]);

  return {
    otel,
    yuruyus,
    matrisYukleniyor: matris.yukleniyor,
    matrisHata: matris.hata,
    rotalar: rota.rotalar,
    rotaYukleniyor: rota.yukleniyor,
    rotaHata: rota.hata,
    bacak,
    tempolar,
    etiketler,
    seciliSira,
    seciliNoktalar,
  };
}
