import { describe, expect, it } from '@jest/globals';

import {
  bolusumOzeti,
  gunGruplari,
  ibanBicimle,
  ibanGecerli,
  kategoriOzeti,
  kurAyristir,
  netBakiyeler,
  paraMetni,
  paylariHesapla,
  sadelestir,
  sayiYonelme,
  tlKarsiligi,
  tlyeCevir,
  tutarAyristir,
  tutarMetni,
  type Transfer,
} from '../hesap';

const nesne = (m: Map<string, number> | null) => (m ? Object.fromEntries(m) : null);
const toplami = (m: Map<string, number> | null) => [...(m?.values() ?? [])].reduce((a, b) => a + b, 0);

describe('#183 KK4 bölüşüm: paylar toplamı harcamaya eşit, yuvarlama farkı ödeyene', () => {
  const kisiler = [
    { id: 'ece', secili: true },
    { id: 'ayse', secili: true },
    { id: 'mert', secili: true },
  ];

  it('eşit: 550 ₺ üçe → 183,34 ödeyene, 183,33 diğerlerine', () => {
    const p = paylariHesapla(55000, 'esit', kisiler, 'ece');
    expect(nesne(p)).toEqual({ ece: 18334, ayse: 18333, mert: 18333 });
    expect(toplami(p)).toBe(55000);
  });

  it('eşit: ödeyen bölüşümde değilse kalan ilk kişiye; seçili olmayan pay almaz', () => {
    const p = paylariHesapla(10000, 'esit', [{ id: 'ece', secili: false }, ...kisiler.slice(1)], 'ece');
    expect(nesne(p)).toEqual({ ayse: 5000, mert: 5000 });
    const q = paylariHesapla(100, 'esit', [{ id: 'ece', secili: false }, ...kisiler.slice(1), { id: 'can', secili: true }], 'ece');
    expect(nesne(q)).toEqual({ ayse: 34, mert: 33, can: 33 });
  });

  it('pay: ağırlıkla; kalan ödeyene; sıfır ağırlık pay almaz', () => {
    const p = paylariHesapla(1000, 'pay', [
      { id: 'ece', secili: true, pay: 1 },
      { id: 'ayse', secili: true, pay: 2 },
      { id: 'mert', secili: true, pay: 0 },
    ], 'ayse');
    expect(nesne(p)).toEqual({ ece: 333, ayse: 667 });
    expect(toplami(p)).toBe(1000);
  });

  it('tutar: girilenler toplama eşitse aynen; değilse geçersiz', () => {
    expect(nesne(paylariHesapla(10000, 'tutar', [
      { id: 'ece', secili: true, tutar: 7000 },
      { id: 'ayse', secili: true, tutar: 3000 },
      { id: 'mert', secili: true, tutar: 0 },
    ], 'ece'))).toEqual({ ece: 7000, ayse: 3000 });
    expect(paylariHesapla(10000, 'tutar', [{ id: 'ece', secili: true, tutar: 7000 }], 'ece')).toBeNull();
  });

  it('kimse seçili değilse ya da tutar sıfırsa geçersiz', () => {
    expect(paylariHesapla(10000, 'esit', kisiler.map((k) => ({ ...k, secili: false })), 'ece')).toBeNull();
    expect(paylariHesapla(0, 'esit', kisiler, 'ece')).toBeNull();
  });

  it('rastgele 300 durumda toplam hep tutar, paylar arası fark kişi sayısından az', () => {
    let tohum = 7;
    const rastgele = (n: number) => {
      tohum = (tohum * 1103515245 + 12345) % 2 ** 31;
      return tohum % n;
    };
    for (let i = 0; i < 300; i++) {
      const n = 1 + rastgele(7);
      const toplam = 1 + rastgele(1_000_000);
      const ks = Array.from({ length: n }, (_, j) => ({ id: `k${j}`, secili: true }));
      const p = paylariHesapla(toplam, 'esit', ks, `k${rastgele(n)}`)!;
      expect(toplami(p)).toBe(toplam);
      const d = [...p.values()];
      expect(Math.max(...d) - Math.min(...d)).toBeLessThan(n);
    }
  });
});

describe('#183 KK5 döviz: kurla ₺ karşılığı, paylar ₺ toplamına tam eşit', () => {
  it('45 € × 36,2512 = 1.631,30 ₺; paylar orantılı, kalan ödeyene', () => {
    const tl = tlKarsiligi(4500, 36.2512);
    expect(tl).toBe(163130);
    const eur = paylariHesapla(4500, 'esit', [
      { id: 'ece', secili: true },
      { id: 'ayse', secili: true },
      { id: 'mert', secili: true },
    ], 'mert')!;
    const p = tlyeCevir(eur, 4500, tl, 'mert');
    expect(toplami(p)).toBe(tl);
    expect(nesne(p)).toEqual({ ece: 54376, ayse: 54376, mert: 54378 });
  });

  it('TRY\'de paylar aynen döner', () => {
    const m = new Map([['a', 5], ['b', 5]]);
    expect(nesne(tlyeCevir(m, 10, 10, 'a'))).toEqual({ a: 5, b: 5 });
  });

  it('kur girişi', () => {
    expect(kurAyristir('36,25')).toBe(36.25);
    expect(kurAyristir('36.2512')).toBe(36.2512);
    expect(kurAyristir('0')).toBeNull();
    expect(kurAyristir('abc')).toBeNull();
    expect(kurAyristir('1,23456')).toBeNull();
  });
});

describe('#183 KK6 bakiyeler ve sadeleştirme', () => {
  const pay = (user_id: string, pay_kurus: number) => ({ user_id, pay_kurus });
  // Kanvas 25: Ece +410, Ayşe −250, Mert −160.
  const harcamalar = [
    { odeyen_id: 'mert', tl_kurus: 9000, harcama_paylari: [pay('ece', 3000), pay('ayse', 3000), pay('mert', 3000)] },
    { odeyen_id: 'ece', tl_kurus: 55000, harcama_paylari: [pay('ece', 18334), pay('ayse', 18333), pay('mert', 18333)] },
    { odeyen_id: 'ece', tl_kurus: 140000, harcama_paylari: [pay('ece', 46668), pay('ayse', 46666), pay('mert', 46666)] },
    { odeyen_id: 'ayse', tl_kurus: 12000, harcama_paylari: [pay('ece', 6000), pay('mert', 6000)] },
    { odeyen_id: 'ece', tl_kurus: 18000, harcama_paylari: [pay('ece', 18000)] },
  ];

  it('net: ödeyen alacaklanır, pay sahibi borçlanır; toplam sıfır', () => {
    const net = netBakiyeler(harcamalar, []);
    expect([...net.values()].reduce((a, b) => a + b, 0)).toBe(0);
    expect(net.get('ece')! > 0).toBe(true);
    expect(net.get('ayse')! < 0 && net.get('mert')! < 0).toBe(true);
  });

  it('ödeşme bakiyeyi kapatır: veren alacaklanır, alan borçlanır', () => {
    const net = netBakiyeler(harcamalar, []);
    const borc = -net.get('mert')!;
    const sonra = netBakiyeler(harcamalar, [{ kimden: 'mert', kime: 'ece', tl_kurus: borc }]);
    expect(sonra.get('mert')).toBe(0);
    expect(sonra.get('ece')).toBe(net.get('ece')! - borc);
  });

  const uygula = (net: Map<string, number>, tr: Transfer[]) => {
    const m = new Map(net);
    for (const t of tr) {
      m.set(t.kimden, (m.get(t.kimden) ?? 0) + t.tutar);
      m.set(t.kime, (m.get(t.kime) ?? 0) - t.tutar);
    }
    return [...m.values()].every((v) => v === 0);
  };

  it('kanvas: iki kişi sana öder (2 transfer)', () => {
    const net = new Map([['ece', 41000], ['ayse', -25000], ['mert', -16000]]);
    expect(sadelestir(net)).toEqual([
      { kimden: 'ayse', kime: 'ece', tutar: 25000 },
      { kimden: 'mert', kime: 'ece', tutar: 16000 },
    ]);
  });

  it('eşleşen tutarlar ayrı kümelenir: 6 kişi, 3 transfer', () => {
    const net = new Map([['a', 500], ['b', 300], ['c', 200], ['d', -300], ['e', -200], ['f', -500]]);
    const tr = sadelestir(net);
    expect(tr).toHaveLength(3);
    expect(uygula(net, tr)).toBe(true);
  });

  it('açgözlünün kaçırdığı küme: {+6, +4, −3, −3, −4} → {+4, −4} ve {+6, −3, −3}: 3 transfer (açgözlü 4)', () => {
    const net = new Map([['a', 600], ['b', 400], ['c', -300], ['d', -300], ['e', -400]]);
    const tr = sadelestir(net);
    expect(tr).toHaveLength(3);
    expect(tr).toContainEqual({ kimden: 'e', kime: 'b', tutar: 400 });
    expect(uygula(net, tr)).toBe(true);
  });

  it('rastgele gruplarda hep ödeşir ve transfer sayısı n − 1\'i geçmez; 13+ kişide açgözlü', () => {
    let tohum = 11;
    const rastgele = (n: number) => {
      tohum = (tohum * 1103515245 + 12345) % 2 ** 31;
      return tohum % n;
    };
    for (let i = 0; i < 150; i++) {
      const n = 2 + rastgele(14);
      const degerler = Array.from({ length: n - 1 }, () => rastgele(20001) - 10000);
      degerler.push(-degerler.reduce((a, b) => a + b, 0));
      const net = new Map(degerler.map((v, j) => [`k${String(j).padStart(2, '0')}`, v]));
      const tr = sadelestir(net);
      expect(uygula(net, tr)).toBe(true);
      expect(tr.length).toBeLessThanOrEqual(Math.max(0, degerler.filter((v) => v !== 0).length - 1));
      expect(tr.every((t) => t.tutar > 0)).toBe(true);
    }
  });

  it('herkes ödeşmişse transfer yok', () => {
    expect(sadelestir(new Map([['a', 0], ['b', 0]]))).toEqual([]);
  });
});

describe('#183 KK1–KK2 liste yardımcıları', () => {
  it('günlere göre: yeniden eskiye, gün toplamı', () => {
    const g = gunGruplari(
      [
        { id: '1', created_at: '2026-10-16T09:00:00Z', tl_kurus: 100 },
        { id: '2', created_at: '2026-10-17T21:30:00Z', tl_kurus: 50 },
        { id: '3', created_at: '2026-10-17T08:00:00Z', tl_kurus: 25 },
      ],
      (iso) => iso.slice(0, 10),
    );
    expect(g.map((x) => [x.tarih, x.toplam, x.harcamalar.map((h) => h.id)])).toEqual([
      ['2026-10-17', 75, ['2', '3']],
      ['2026-10-16', 100, ['1']],
    ]);
  });

  it('kategori özeti büyükten küçüğe', () => {
    expect(kategoriOzeti([{ kategori: 'yemek', tl_kurus: 5 }, { kategori: 'ulasim', tl_kurus: 9 }, { kategori: 'yemek', tl_kurus: 6 }])).toEqual([
      { kategori: 'yemek', toplam: 11 },
      { kategori: 'ulasim', toplam: 9 },
    ]);
  });

  it('bölüşüm özeti: herkes eşit · biri hariç · yalnız · farklı', () => {
    const uyeler = ['ece', 'ayse', 'mert'];
    expect(bolusumOzeti([{ user_id: 'ece', pay_kurus: 18334 }, { user_id: 'ayse', pay_kurus: 18333 }, { user_id: 'mert', pay_kurus: 18333 }], uyeler)).toEqual({ tur: 'esit', n: 3 });
    expect(bolusumOzeti([{ user_id: 'ece', pay_kurus: 6000 }, { user_id: 'mert', pay_kurus: 6000 }], uyeler)).toEqual({ tur: 'haric', haric: 'ayse', n: 2 });
    expect(bolusumOzeti([{ user_id: 'ece', pay_kurus: 18000 }], uyeler)).toEqual({ tur: 'yalniz', kisi: 'ece' });
    expect(bolusumOzeti([{ user_id: 'ece', pay_kurus: 7000 }, { user_id: 'mert', pay_kurus: 3000 }, { user_id: 'ayse', pay_kurus: 3000 }], uyeler)).toEqual({ tur: 'farkli', n: 3 });
  });

  it('sayı yönelme eki', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 12].map(sayiYonelme)).toEqual([
      "1'e", "2'ye", "3'e", "4'e", "5'e", "6'ya", "7'ye", "8'e", "9'a", "10'a", "20'ye", "30'a", "40'a", "50'ye", "60'a", "70'e", "80'e", "90'a", "100'e", "12'ye",
    ]);
  });
});

describe('#183 biçim ve giriş', () => {
  it('para metni', () => {
    expect(paraMetni(234000)).toBe('2.340 ₺');
    expect(paraMetni(18333)).toBe('183,33 ₺');
    expect(paraMetni(41000, 'TRY', true)).toBe('+410 ₺');
    expect(paraMetni(-25000, 'TRY', true)).toBe('−250 ₺');
    expect(paraMetni(4500, 'EUR')).toBe('45 €');
    expect(paraMetni(12000, 'CHF')).toBe('120 CHF');
    expect(paraMetni(123456789)).toBe('1.234.567,89 ₺');
  });

  it('tutar ayrıştırma', () => {
    expect(tutarAyristir('550')).toBe(55000);
    expect(tutarAyristir('1.234,56')).toBe(123456);
    expect(tutarAyristir('12,5')).toBe(1250);
    expect(tutarAyristir('12.50')).toBe(1250);
    expect(tutarAyristir('1.234')).toBe(123400);
    expect(tutarAyristir('0')).toBeNull();
    expect(tutarAyristir('12,345')).toBeNull();
    expect(tutarAyristir('abc')).toBeNull();
    expect(tutarAyristir('')).toBeNull();
    expect(tutarMetni(55000)).toBe('550');
    expect(tutarMetni(1250)).toBe('12,50');
  });

  it('IBAN: mod-97, TR uzunluğu, biçim', () => {
    expect(ibanGecerli('TR33 0006 1005 1978 6457 8413 26')).toBe(true);
    expect(ibanGecerli('tr330006100519786457841326')).toBe(true);
    expect(ibanGecerli('TR330006100519786457841327')).toBe(false);
    expect(ibanGecerli('TR3300061005197864578413')).toBe(false);
    expect(ibanGecerli('DE89370400440532013000')).toBe(true);
    expect(ibanBicimle('TR330006100519786457841326')).toBe('TR33 0006 1005 1978 6457 8413 26');
  });
});
