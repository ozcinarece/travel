import { describe, expect, it } from '@jest/globals';

import type { Yorum } from '@/features/yerler/api';

import { acikDurumu, ctaAnahtari, geriTusu, gorunenFotoSayisi, govdeYuksekligi, KAPALI_PANEL, panelGecis, panelYukseklikleri, yorumlariSirala } from '../panel';

describe('mekan paneli durum makinesi (#80 KK14)', () => {
  it('kapalı → pine dokun: yarı + genel; açıkken başka pine dokun: hal ve sekme korunur (KK13)', () => {
    const acik = panelGecis(KAPALI_PANEL, { tur: 'ac' });
    expect(acik).toEqual({ hal: 'yari', sekme: 'genel' });
    const tamYorum = panelGecis(panelGecis(acik, { tur: 'hal', hal: 'tam' }), { tur: 'sekme', sekme: 'yorumlar' });
    expect(tamYorum).toEqual({ hal: 'tam', sekme: 'yorumlar' });
    expect(panelGecis(tamYorum, { tur: 'ac' })).toBe(tamYorum);
  });

  it('×, haritaya dokunma, yarıdan aşağı çekme ve geri tuşu kapatır; tamdan aşağı çekme önce yarıya iner (#83 KK3)', () => {
    const acik = panelGecis(KAPALI_PANEL, { tur: 'ac' });
    expect(panelGecis(acik, { tur: 'kapat' })).toEqual(KAPALI_PANEL);
    expect(panelGecis(acik, { tur: 'hal', hal: 'katli' })).toEqual(KAPALI_PANEL);
    expect(panelGecis(acik, { tur: 'geri' })).toEqual(KAPALI_PANEL);
    expect(panelGecis(KAPALI_PANEL, { tur: 'geri' })).toBe(KAPALI_PANEL);
    const tam = panelGecis(acik, { tur: 'hal', hal: 'tam' });
    expect(panelGecis(tam, { tur: 'hal', hal: 'katli' })).toEqual({ hal: 'yari', sekme: 'genel' });
    expect(panelGecis(panelGecis(tam, { tur: 'hal', hal: 'katli' }), { tur: 'hal', hal: 'katli' })).toEqual(KAPALI_PANEL);
    expect(panelGecis(tam, { tur: 'geri' })).toEqual(KAPALI_PANEL);
    expect(panelGecis(KAPALI_PANEL, { tur: 'hal', hal: 'katli' })).toBe(KAPALI_PANEL);
    expect(panelGecis(KAPALI_PANEL, { tur: 'kapat' })).toBe(KAPALI_PANEL);
    // Yeniden açılınca sekme genel'e döner.
    expect(panelGecis(panelGecis(panelGecis(acik, { tur: 'sekme', sekme: 'rehber' }), { tur: 'kapat' }), { tur: 'ac' })).toEqual({ hal: 'yari', sekme: 'genel' });
  });

  it('yükseklikler alt menü hariç alana göre: yarı %55, tam = alan − üst güvenli − 8, kapanma durağı yarının %45\'i (#83 KK1–3)', () => {
    expect(panelYukseklikleri(800, 40)).toEqual({ katli: 198, yari: 440, tam: 752 });
    // Gövde (içerik + alt çubuk) görünür yüksekliğe sığar: alt çubuk alt menünün üstünde kalır.
    expect(govdeYuksekligi(440, 150)).toBe(280);
    expect(govdeYuksekligi(100, 150)).toBe(0);
  });
});

describe('geri tuşu önceliği (#85 KK4)', () => {
  it('galeri açıkken geri galeriyi kapatır, değilse paneli', () => {
    expect(geriTusu(true)).toBe('galeri');
    expect(geriTusu(false)).toBe('panel');
  });
});

describe('CTA metni (#80 KK3)', () => {
  it('Keşfet: listeye ekle / listeden çıkar; Program: güne ekle / günden çıkar', () => {
    expect(ctaAnahtari('kesfet', false)).toBe('listeyeEkle');
    expect(ctaAnahtari('kesfet', true)).toBe('listedenCikar');
    expect(ctaAnahtari('program', false)).toBe('guneEkle');
    expect(ctaAnahtari('program', true)).toBe('gundenCikar');
  });
});

describe('yorum sıralaması (#80 KK9)', () => {
  const y = (yazar: string, puan: number | null, yayin: string | null): Yorum => ({ yazar, puan, metin: '', zaman: '', yayin });
  const liste = [y('a', 4, '2026-09-01T00:00:00Z'), y('b', 5, '2026-10-01T00:00:00Z'), y('c', 2, null), y('d', 5, '2026-08-01T00:00:00Z')];

  it('en yeni: yayın tarihine göre, tarihsizler Google sırasıyla sona', () => {
    expect(yorumlariSirala(liste, 'yeni').map((x) => x.yazar)).toEqual(['b', 'a', 'd', 'c']);
  });
  it('en yüksek / en düşük: puana göre, eşitlikte yeni önce; girdi değişmez', () => {
    expect(yorumlariSirala(liste, 'yuksek').map((x) => x.yazar)).toEqual(['b', 'd', 'a', 'c']);
    expect(yorumlariSirala(liste, 'dusuk').map((x) => x.yazar)).toEqual(['c', 'a', 'b', 'd']);
    expect(liste.map((x) => x.yazar)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('açık/kapalı satırı ve fotoğraf şeridi (#80 KK2, KK5)', () => {
  it('açık → kapanış saati; kapalı → sonraki açılış; bilinmiyor → null', () => {
    expect(acikDurumu({ acik: true, kapanis: '22:00' })).toEqual({ acik: true, kapanis: '22:00' });
    expect(acikDurumu({ acik: false, acilis: { gun: 'yarin', saat: '09:00' } })).toEqual({ acik: false, acilis: { gun: 'yarin', saat: '09:00' } });
    expect(acikDurumu({ acik: null })).toBeNull();
    expect(acikDurumu(undefined)).toBeNull();
  });
  it('yalnız görünür kareler + 1 komşu yüklenir', () => {
    // 390 px ekran, 120 px kare + 8 boşluk: başta 3 görünür → 5 (indeks 0–4) istenir; 10 fotoğrafın hepsi değil.
    expect(gorunenFotoSayisi(0, 390, 120, 8)).toBe(5);
    expect(gorunenFotoSayisi(640, 390, 120, 8)).toBe(10);
  });
});
