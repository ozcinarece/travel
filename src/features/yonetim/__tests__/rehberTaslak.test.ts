import { describe, expect, it } from '@jest/globals';

import {
  bolumCogalt,
  bolumGeriAl,
  bolumKartSayisi,
  bolumSil,
  bolumTasi,
  canlidanTaslak,
  mekanBaskaBolumde,
  onizlemeSatirlari,
  rehberMekanSayisi,
  taslakDegisti,
  yeniBolum,
  type TaslakBolum,
} from '../rehberTaslak';

const S = '11111111-1111-4111-8111-000000000001';
const bolumler: TaslakBolum[] = [
  { id: 'a', baslik: 'Nasıl gezilir', ozet: null, govde: '::mekan[ChIJ-tramvay-000001]', gizli: false, bolum: 'ulasim' },
  { id: 'b', baslik: 'Ne yenir', ozet: 'Çibörek', govde: '[Met](mekan:ChIJ-met-helva-00002)\n\n::mekan[ChIJ-hayri-usta-0001]\n\n::mekan[ChIJ-cam-sanat-0003]', gizli: false, bolum: 'yemek' },
  { id: 'c', baslik: 'Akşam ne yapılır', ozet: null, govde: '::mekan[ChIJ-gizli-mekan-04]', gizli: true, bolum: null },
];

// #156 KK7–13: serbest bölümler, gizle, sil + geri al, taslak / yayın.
describe('rehber taslağı (#156)', () => {
  it('canlı bölümlerden taslak: sıra, başlıksız gövde, tür korunur', () => {
    expect(
      canlidanTaslak([
        { id: 'y', sehir_id: S, bolum: 'yemek', baslik: 'Ne yenir', ozet: null, yazi_md: '# Ne yenir\n\nÇibörek.', sira: 2 },
        { id: 'u', sehir_id: S, bolum: 'ulasim', baslik: 'Ulaşım', ozet: 'Tramvay', yazi_md: '# Ulaşım', sira: 1, gizli: true },
      ]),
    ).toEqual([
      { id: 'u', baslik: 'Ulaşım', ozet: 'Tramvay', govde: '', gizli: true, bolum: 'ulasim' },
      { id: 'y', baslik: 'Ne yenir', ozet: null, govde: 'Çibörek.', gizli: false, bolum: 'yemek' },
    ]);
  });

  it('"Taslak değişiklik var": yayından sonra kayıt', () => {
    expect(taslakDegisti(null)).toBe(false);
    expect(taslakDegisti({ updated_at: '2026-10-13T08:00:00Z', yayinlandi_at: null })).toBe(true);
    expect(taslakDegisti({ updated_at: '2026-10-13T08:00:00Z', yayinlandi_at: '2026-10-13T08:00:01Z' })).toBe(false);
    expect(taslakDegisti({ updated_at: '2026-10-13T08:05:00Z', yayinlandi_at: '2026-10-13T08:00:01Z' })).toBe(true);
  });

  it('önizleme: gizli bölüm yok (Bu bölüm seçiliyse görünür), yazı # başlık + gövde, sıra yeniden', () => {
    const t = onizlemeSatirlari(S, bolumler);
    expect(t.map((b) => b.id)).toEqual(['a', 'b']);
    expect(t[1]).toMatchObject({ yazi_md: `# Ne yenir\n\n${bolumler[1].govde}`, sira: 2, sehir_id: S });
    expect(onizlemeSatirlari(S, bolumler, 'c').map((b) => b.id)).toEqual(['c']);
  });

  it('sayılar: bölüm kartı; rehberdeki tekil mekanlar (gizli hariç)', () => {
    expect(bolumKartSayisi(bolumler[1])).toBe(2);
    expect(rehberMekanSayisi(bolumler)).toBe(4);
  });

  it('mekan başka bölümde varsa "02 · Ne yenir"', () => {
    expect(mekanBaskaBolumde('ChIJ-hayri-usta-0001', bolumler, 'a')).toEqual({ no: '02', baslik: 'Ne yenir' });
    expect(mekanBaskaBolumde('ChIJ-hayri-usta-0001', bolumler, 'b')).toBeNull();
  });

  it('çoğalt (türsüz kopya altta), taşı, sil + geri al aynı yere', () => {
    const c = bolumCogalt(bolumler, 'b', 'b2', '(kopya)');
    expect(c.map((b) => b.id)).toEqual(['a', 'b', 'b2', 'c']);
    expect(c[2]).toMatchObject({ baslik: 'Ne yenir (kopya)', bolum: null, govde: bolumler[1].govde });
    expect(bolumTasi(bolumler, 'c', -1).map((b) => b.id)).toEqual(['a', 'c', 'b']);
    expect(bolumTasi(bolumler, 'a', -1).map((b) => b.id)).toEqual(['a', 'b', 'c']);
    const { kalan, silinen } = bolumSil(bolumler, 'b');
    expect(kalan.map((b) => b.id)).toEqual(['a', 'c']);
    expect(bolumGeriAl(kalan, silinen!).map((b) => b.id)).toEqual(['a', 'b', 'c']);
    expect(bolumGeriAl(bolumler, silinen!)).toHaveLength(3);
    expect(yeniBolum('n', 'Yeni bölüm')).toEqual({ id: 'n', baslik: 'Yeni bölüm', ozet: null, govde: '', gizli: false, bolum: null });
  });
});
