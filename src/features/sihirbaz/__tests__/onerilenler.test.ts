import { describe, expect, it, jest } from '@jest/globals';

import type { HafifYer } from '@/features/yerler/api';
import type { Yer } from '@/lib/tipler';

import { cipListesi, GORMEN_EN_AZ, googleMekani, rehberMekani } from '../onerilenler';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const hafif = (id: string, puan: number, yorum: number, tip = 'tourist_attraction'): HafifYer =>
  ({ place_id: id, ad: id, lat: 39.7, lng: 30.5, primary_type: tip, tz: null, puan, puan_sayisi: yorum, acik: null, ulke_kodu: null }) as HafifYer;
const yer = (id: string, ad: string, place_id: string | null = null): Yer =>
  ({ id, sehir_id: 's', place_id, ad, kategori: 'museum', rehber_md: null, kapak_url: null, one_cikan_sira: 1, lat: 39.76, lng: 30.52 }) as Yer;

describe('görmen gerekenler listesi (#98 KK6)', () => {
  // 20 mekan: ilk 2'si öne çıkan (≥4,3 puan, ≥200 yorum, en iyi %10).
  const hepsi = [hafif('a', 4.8, 9000), hafif('b', 4.7, 7000), ...Array.from({ length: 18 }, (_, i) => hafif(`x${i}`, 4.0, 150))];
  const rehber = [rehberMekani(yer('y1', 'Odunpazarı Evleri'), 'b', hafif('b', 4.7, 7000))!, rehberMekani(yer('y2', 'Kurşunlu'), 'k', undefined)!];

  it('rehber yeri: Google verisiyle puan/yorum dolar, rozet "rehber", süre kategoriden; kimlik çözülmediyse null', () => {
    expect(rehber[0]).toMatchObject({ place_id: 'b', ad: 'Odunpazarı Evleri', puan: 4.7, puan_sayisi: 7000, neden: 'rehber', dakika: 60 });
    expect(rehber[1]).toMatchObject({ place_id: 'k', puan: null, primary_type: 'museum', dakika: 90 });
    expect(rehberMekani(yer('y3', 'Yok'), null, undefined)).toBeNull();
  });
  it('"Görmen gerekenler" = rehberdekiler + öne çıkanlar (tekrar yok, puan sırası), en az 10 karta kadar genel listeyle dolar; "Rehberden" yalnız rehber', () => {
    const g = cipListesi('gormen', rehber, hepsi, undefined);
    expect(g.map((m) => m.place_id).slice(0, 3)).toEqual(['b', 'k', 'a']);
    expect(g[2].neden).toBe('oneCikan');
    expect(g).toHaveLength(GORMEN_EN_AZ);
    expect(g[3].neden).toBeNull();
    expect(cipListesi('rehber', rehber, hepsi, undefined).map((m) => m.place_id)).toEqual(['b', 'k']);
  });
  it('#121 KK1: turistik Nearby listesi (gezilecek + müze) öne çıkanlardan sonra puan sırasıyla gelir, tekrar yok', () => {
    const turistik = [hafif('t1', 4.5, 300), hafif('t2', 4.6, 900, 'museum'), hafif('a', 4.8, 9000)];
    const g = cipListesi('gormen', rehber, hepsi, undefined, turistik);
    expect(g.map((m) => m.place_id).slice(0, 5)).toEqual(['b', 'k', 'a', 't2', 't1']);
    expect(g.filter((m) => m.place_id === 'a')).toHaveLength(1);
  });
  it('#121 KK4: listede olanlar gizlenir, az önce eklenenler (tut) "Listede ✓" ile kalır', () => {
    const havuz = new Set(['b', 'a']);
    expect(cipListesi('gormen', rehber, hepsi, undefined, [], havuz).map((m) => m.place_id)).not.toContain('b');
    expect(cipListesi('gormen', rehber, hepsi, undefined, [], havuz).map((m) => m.place_id)).not.toContain('a');
    expect(cipListesi('gormen', rehber, hepsi, undefined, [], havuz, new Set(['a'])).map((m) => m.place_id)).toContain('a');
    expect(cipListesi('rehber', rehber, hepsi, undefined, [], havuz).map((m) => m.place_id)).toEqual(['k']);
    expect(cipListesi('yemek', rehber, hepsi, [hafif('a', 4.8, 9000, 'restaurant'), hafif('r', 4, 10, 'restaurant')], [], havuz).map((m) => m.place_id)).toEqual(['r']);
  });
  it('kategori çipi: Google listesi puan sırası, öne çıkan rozeti korunur', () => {
    const yemek = [hafif('r2', 4.2, 500, 'restaurant'), hafif('a', 4.8, 9000, 'restaurant')];
    const liste = cipListesi('yemek', rehber, hepsi, yemek);
    expect(liste.map((m) => m.place_id)).toEqual(['a', 'r2']);
    expect(liste[0].neden).toBe('oneCikan');
    expect(liste[1].neden).toBeNull();
    expect(googleMekani(hafif('z', 4, 10, 'cafe'), false).dakika).toBe(30);
  });
});
