// #580 (kanvas `Dalga1_DurakCekmecesi` · `Dalga1_GecikmeBandi`): çekmece metinleri, son gün, sıradaki durak, gecikme eşiği ve
// Plan'la ortak kaydırma yazımı.
import { describe, expect, it } from '@jest/globals';

import { simdiHedefi } from '@/features/gezi/seyahatV7';
import { geriKalmaHesapla, kaydirmaYazimi } from '@/features/program/geriKalma';
import type { GunProgrami } from '@/features/program/useProgram';
import { gezilmediMi, programHesapla, type ProgramDuragi } from '@/schedule/program';
import { yerelAn } from '@/lib/zaman';

import { cekmeceAltSatiri, GECIKME_BANDI_ESIGI_DK, gecikmeBandiGorunur, gecikmeliSimdiAlti, gecikmeMetni, gezdimDugmesi, gezdimEylemi, yarinAltSatiri, yarinHedefi, yolAltSatiri } from '../durakCekmecesi';

const IST = 'Europe/Istanbul';
const otel = { lat: 41.9, lng: 12.5 };
const d = (id: string, dakika: number, ek: Partial<ProgramDuragi> = {}): ProgramDuragi => ({
  id,
  key: `k-${id}`,
  konum: { lat: 41.9, lng: 12.5 },
  dakika,
  tamamlandiDk: null,
  skipped: false,
  ...ek,
});
const sabit = () => ({ sn: 600, m: 800 });

describe('#580 KK1 çekmece metinleri', () => {
  it('başlık alt satırı: şimdiki durakta "Şimdi · 14:10 · 45 dk", değilse yalnız saat ve süre', () => {
    expect(cekmeceAltSatiri({ varisDk: 14 * 60 + 10, dakika: 45 }, true)).toBe('Şimdi · 14:10 · 45 dk');
    expect(cekmeceAltSatiri({ varisDk: 14 * 60 + 10, dakika: 45 }, false)).toBe('14:10 · 45 dk');
    expect(cekmeceAltSatiri({ varisDk: null, dakika: 90 }, false)).toBe('1 sa 30 dk');
  });

  it('Yol tarifi alt satırı: "12 dk yürüme" / araçla; süre bilinmiyorsa yok', () => {
    expect(yolAltSatiri(12, false)).toBe('12 dk yürüme');
    expect(yolAltSatiri(7, true)).toBe('7 dk araçla');
    expect(yolAltSatiri(null, false)).toBeNull();
  });
});

describe('#580 KK1 · KK3 Yarına taşı', () => {
  // 2026-11-25 Çarşamba, 26 Perşembe, 27 Cuma.
  const gunler = [
    { id: 'g1', index: 1, date: '2026-11-25' },
    { id: 'g2', index: 2, date: '2026-11-26' },
    { id: 'g3', index: 3, date: '2026-11-27' },
  ];

  it('hedef bir sonraki gün; alt satır "Perşembe, günün sonuna"', () => {
    const hedef = yarinHedefi(gunler, gunler[0]);
    expect(hedef?.id).toBe('g2');
    expect(yarinAltSatiri(hedef)).toBe('Perşembe, günün sonuna');
  });

  it('son günde hedef yok, alt satır "Son gün"', () => {
    expect(yarinHedefi(gunler, gunler[2])).toBeNull();
    expect(yarinAltSatiri(null)).toBe('Son gün');
    expect(yarinHedefi(gunler, undefined)).toBeNull();
  });

  it('tarihsiz hedef günde gün numarası', () => {
    expect(yarinAltSatiri({ index: 3, date: null })).toBe('3. gün, günün sonuna');
  });
});

describe('#580 KK2 Gezdim', () => {
  it('düğme: gezilmemişte "Gezdim", gezildi kaydedilmişte "Gezilmedi say"', () => {
    expect(gezdimDugmesi(false)).toEqual({ metin: 'Gezdim', geriAl: false });
    expect(gezdimDugmesi(true)).toEqual({
      metin: 'Gezilmedi say',
      geriAl: true,
    });
  });

  it('Gezdim yazılınca (tamamlandı) sıradaki durak Şimdi olur', () => {
    // 09:00 otel → d1 09:10–10:40 → d2 10:50–11:50 → d3 12:00–13:00; şu an 10:00.
    const once = programHesapla({
      baslangic: '09:00',
      duraklar: [d('d1', 90), d('d2', 60), d('d3', 60)],
      otel,
      yuruyus: sabit,
      simdiDk: 600,
    });
    const hedef = (p: typeof once) => simdiHedefi(p.satirlar.find((x) => x.durum === 'siradaki') ?? null, null)?.durak.id;
    expect(hedef(once)).toBe('d1');
    const sonra = programHesapla({
      baslangic: '09:00',
      duraklar: [d('d1', 90, { tamamlandiDk: 600 }), d('d2', 60), d('d3', 60)],
      otel,
      yuruyus: sabit,
      simdiDk: 600,
    });
    expect(hedef(sonra)).toBe('d2');
    // Gezilmedi say (tamamlanma kalkar) → yine d1.
    expect(
      hedef(
        programHesapla({
          baslangic: '09:00',
          duraklar: [d('d1', 90), d('d2', 60), d('d3', 60)],
          otel,
          yuruyus: sabit,
          simdiDk: 600,
        }),
      ),
    ).toBe('d1');
  });
});

describe('#580 değişiklik 2: gezdimEylemi', () => {
  const an = new Date('2026-11-25T10:00:00Z');
  const p = { an, benId: 'ben' };
  const GEZILMEDI = { completed_at: null, completed_by: null, auto_completed: true };
  it('elle gezildi kaydı → "Gezilmedi say" (✓\'siz) + açık gezilmedi kaydı (inceleme N3: vakti sürerken de kalıcı)', () => {
    const e = gezdimEylemi({ durakId: 'd2', tamamlandi: true, durum: 'gecildi' }, p);
    expect(e.metin).toBe('Gezilmedi say');
    expect(e.geriAl).toBe(true);
    expect(e.yazim).toEqual({ id: 'd2', ...GEZILMEDI });
  });
  it('kendiliğinden geçilmiş (kayıt yok, satırda ✓) → "Gezilmedi say" (✓\'siz) + açık gezilmedi kaydı', () => {
    const e = gezdimEylemi({ durakId: 'd1', tamamlandi: false, durum: 'gecildi' }, p);
    expect(e.metin).toBe('Gezilmedi say');
    expect(e.geriAl).toBe(true);
    expect(e.yazim).toEqual({ id: 'd1', ...GEZILMEDI });
    expect(gezilmediMi(e.yazim)).toBe(true);
  });
  it('gezilmemiş → "Gezdim" (✓), şimdinin anı', () => {
    const e = gezdimEylemi({ durakId: 'd2', tamamlandi: false, durum: 'siradaki' }, p);
    expect(e.metin).toBe('Gezdim');
    expect(e.geriAl).toBe(false);
    expect(e.yazim).toEqual({ id: 'd2', completed_at: an.toISOString(), completed_by: 'ben', auto_completed: false });
    expect(gezilmediMi(e.yazim)).toBe(false);
  });
});

describe('#580 değişiklik 2: açık "gezilmedi" kaydı programda', () => {
  // 09:00 otel → d1 09:10–10:10 → d2 10:20–11:20 → d3 11:30–14:30.
  const duraklar = (ek: Partial<ProgramDuragi>) => [d('d1', 60, ek), d('d2', 60), d('d3', 180)];
  const prog = (ek: Partial<ProgramDuragi>, simdiDk: number) => programHesapla({ baslangic: '09:00', duraklar: duraklar(ek), otel, yuruyus: sabit, simdiDk });
  const durumlar = (ek: Partial<ProgramDuragi>, simdiDk: number) => prog(ek, simdiDk).satirlar.map((x) => x.durum);
  it('kayıt yoksa pay geçince kendiliğinden geçildi', () => {
    expect(durumlar({}, 720)).toEqual(['gecildi', 'gecildi', 'siradaki']);
  });
  it('inceleme D1: vakti geçmiş gezilmedi durak ✓\'siz (bekliyor) ama sıradaki olmaz; Şimdi d3, gecikme d1\'i hedeflemez', () => {
    // 12:00'de d1'e "Gezilmedi say".
    expect(durumlar({ gezilmedi: true }, 720)).toEqual(['bekliyor', 'gecildi', 'siradaki']);
    const p = prog({ gezilmedi: true }, 720);
    const plan = programHesapla({ baslangic: '09:00', duraklar: duraklar({ gezilmedi: true }), otel, yuruyus: sabit, simdiDk: null });
    const g = geriKalmaHesapla({
      prog: { gun: { id: 'g1' } as GunProgrami['gun'], bugun: true, simdiDk: 720, plan, canli: p, cubuk: null, otel, bitisOtel: otel },
      konum: otel,
      gunDurak: [],
      buradaId: null,
      tz: IST,
    });
    // d3 11:30'da planlı; 12:00'de aynı noktada → 30 dk geride, hedef d3, önceki d2 (d1 değil, gün başlangıcı yazılmaz).
    expect(g?.hedefId).toBe('d3');
    expect(g?.oncekiId).toBe('d2');
    expect(g!.dk).toBeLessThan(60);
  });
  it('inceleme N3: vakti sürerken gezilmedi durak olağan sıradaki (buradasın da olur)', () => {
    // 09:30 — d1'in vakti sürüyor.
    expect(durumlar({ gezilmedi: true }, 570)).toEqual(['siradaki', 'bekliyor', 'bekliyor']);
    expect(programHesapla({ baslangic: '09:00', duraklar: duraklar({ gezilmedi: true }), otel, yuruyus: sabit, simdiDk: 570, buradaId: 'd1' }).satirlar[0].durum).toBe('buradasin');
    // Vakti geçince ✓ almaz (bekliyor), Şimdi bir sonrakine geçer.
    expect(durumlar({ gezilmedi: true }, 640)).toEqual(['bekliyor', 'siradaki', 'bekliyor']);
  });
  it('kaydın tanımı: completed_at boş + auto_completed', () => {
    expect(gezilmediMi({ completed_at: null, auto_completed: true })).toBe(true);
    expect(gezilmediMi({ completed_at: null, auto_completed: false })).toBe(false);
    expect(gezilmediMi({ completed_at: '2026-11-25T08:00:00Z', auto_completed: true })).toBe(false);
  });
});

describe('#580 KK4 · KK5 gecikme bandı', () => {
  it("eşik: 15 dk'yı GEÇİNCE görünür", () => {
    expect(GECIKME_BANDI_ESIGI_DK).toBe(15);
    expect(gecikmeBandiGorunur(15)).toBe(false);
    expect(gecikmeBandiGorunur(16)).toBe(true);
    expect(gecikmeBandiGorunur(null)).toBe(false);
    expect(gecikmeBandiGorunur(undefined)).toBe(false);
  });

  it('metinler: "25 dk gerideyiz", "Planda 14:10 · şimdi 14:35\'te varırsın"', () => {
    expect(gecikmeMetni(25)).toBe('25 dk gerideyiz');
    expect(gecikmeliSimdiAlti(14 * 60 + 10, 25)).toBe("Planda 14:10 · şimdi 14:35'te varırsın");
    expect(gecikmeliSimdiAlti(14 * 60 + 10, 20)).toBe("Planda 14:10 · şimdi 14:30'da varırsın");
  });

  // d1 09:10–10:40 tamamlandı (10:40), d2 planda 10:50; şu an 11:05, d2'ye ~10 dk yol → ~25 dk geride.
  const programi = (simdiDk: number, tamam = 640): GunProgrami => {
    const duraklar = [d('d1', 90, { tamamlandiDk: tamam, konum: otel }), d('d2', 60, { konum: { lat: 41.95, lng: 12.5 } })];
    const canli = programHesapla({
      baslangic: '09:00',
      duraklar,
      otel,
      yuruyus: sabit,
      simdiDk,
    });
    const plan = programHesapla({
      baslangic: '09:00',
      duraklar,
      otel,
      yuruyus: sabit,
      simdiDk: null,
    });
    return {
      gun: { id: 'g1' } as GunProgrami['gun'],
      bugun: true,
      simdiDk,
      plan,
      canli,
      cubuk: null,
      otel,
      bitisOtel: otel,
    };
  };

  it("Plan'daki hesap: konum yoksa gecikme yok; yoldaysan şu an + kalan yol", () => {
    expect(
      geriKalmaHesapla({
        prog: programi(665),
        konum: null,
        gunDurak: [],
        buradaId: null,
        tz: IST,
      }),
    ).toBeNull();
    const g = geriKalmaHesapla({
      prog: programi(665),
      konum: otel,
      gunDurak: [],
      buradaId: null,
      tz: IST,
    });
    expect(g?.hedefId).toBe('d2');
    expect(g?.oncekiId).toBe('d1');
    expect(g!.dk).toBeGreaterThan(GECIKME_BANDI_ESIGI_DK);
    expect(g?.burada).toBe(false);
  });

  it('Saatleri kaydır: önceki durağın tamamlanması yeni ayrılışa (trips.tz) çekilir; ilk durakta günün başlangıcı', () => {
    const yazim = kaydirmaYazimi({ dk: 25, hedefId: 'd2', oncekiId: 'd1', yeniAyrilisDk: 655 }, { id: 'g1', date: '2026-11-25' }, IST, 'ben');
    expect(yazim).toEqual({
      tur: 'durak',
      id: 'd1',
      completed_at: yerelAn('2026-11-25', 655, IST).toISOString(),
      completed_by: 'ben',
      auto_completed: false,
    });
    expect(yazim.tur === 'durak' && yazim.completed_at).toBe('2026-11-25T07:55:00.000Z');
    expect(kaydirmaYazimi({ dk: 30, hedefId: 'd1', oncekiId: null, yeniAyrilisDk: 570 }, { id: 'g1', date: '2026-11-25' }, IST, 'ben')).toEqual({ tur: 'gun', id: 'g1', start_time: '09:30:00' });
  });

  it('kaydırma yazılınca (önceki durak yeni ayrılışla) gecikme kalkar', () => {
    const g = geriKalmaHesapla({
      prog: programi(665),
      konum: otel,
      gunDurak: [],
      buradaId: null,
      tz: IST,
    })!;
    const kaydirilmis = programi(665, Math.round(g.yeniAyrilisDk));
    const sonra = geriKalmaHesapla({
      prog: kaydirilmis,
      konum: otel,
      gunDurak: [],
      buradaId: null,
      tz: IST,
    });
    expect(gecikmeBandiGorunur(sonra?.dk)).toBe(false);
  });
});
