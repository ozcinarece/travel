import { baslikStili, olcek, yazi } from '@/theme';

// #307 KK1: başlık Figtree 800; harf aralığı kart ve üstü −0,5, bölüm boyu −0,3.
describe('baslikStili', () => {
  it('başlık fontu Figtree 800', () => {
    expect(yazi.baslik).toBe('Figtree_800ExtraBold');
    expect(baslikStili(olcek.ekran).fontFamily).toBe('Figtree_800ExtraBold');
  });

  it('harf aralığı ölçeğe göre', () => {
    expect(baslikStili(olcek.ekran)).toEqual({ fontFamily: yazi.baslik, fontSize: 32, letterSpacing: -0.5 });
    expect(baslikStili(olcek.kart).letterSpacing).toBe(-0.5);
    expect(baslikStili(olcek.bolum).letterSpacing).toBe(-0.3);
    expect(baslikStili(19).letterSpacing).toBe(-0.3);
    expect(baslikStili(16).letterSpacing).toBe(0);
  });
});
