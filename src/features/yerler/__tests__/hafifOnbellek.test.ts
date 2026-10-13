import { describe, expect, it, jest } from '@jest/globals';

import type { HafifYer } from '../api';
import { HAFIF_OMUR_MS, HafifOnbellek, seviyeler, type Seviye } from '../hafifOnbellek';

const yer = (id: string, seviye: Seviye): HafifYer => ({
  place_id: id,
  ad: `Ad ${id}`,
  lat: 39.7,
  lng: 30.5,
  primary_type: 'museum',
  tz: 'Europe/Istanbul',
  // Pro cevabında Enterprise alanları gelmez (sunucu null yazar).
  puan: seviye === 'pro' || seviye === 'proFoto' ? null : 4.6,
  puan_sayisi: seviye === 'pro' || seviye === 'proFoto' ? null : 1200,
  acik: seviye === 'pro' || seviye === 'proFoto' ? null : true,
  ulke_kodu: null,
  periyotlar: seviye === 'saatli' || seviye === 'saatliFoto' ? [] : undefined,
  foto_uri: seviye === 'foto' || seviye === 'proFoto' || seviye === 'saatliFoto' ? `https://foto/${id}` : undefined,
});

/** Sahte places-light: her çağrıyı (kimlikler, seviye) kaydeder. */
function kur(simdi = () => 0) {
  const cagrilar: { ids: string[]; seviye: Seviye }[] = [];
  const getir = jest.fn(async (ids: string[], seviye: Seviye) => {
    cagrilar.push({ ids, seviye });
    return ids.map((id) => yer(id, seviye));
  });
  return { o: new HafifOnbellek(getir, simdi), cagrilar, getir };
}
const idler = (n: number, on = 'p') => Array.from({ length: n }, (_, i) => `${on}${i + 1}`);

describe('#172 seviyeler: eksik gruplar için en ucuz maske', () => {
  it('temel → pro; puan → hafif; foto → proFoto; puan + foto → foto; saat (+ puan) → saatli; saat + foto → saatliFoto', () => {
    expect(seviyeler(new Set(), false)).toEqual(['pro']);
    expect(seviyeler(new Set(), true)).toEqual([]);
    expect(seviyeler(new Set(['puan']), true)).toEqual(['hafif']);
    expect(seviyeler(new Set(['foto']), true)).toEqual(['proFoto']);
    expect(seviyeler(new Set(['puan', 'foto']), false)).toEqual(['foto']);
    expect(seviyeler(new Set(['saat', 'puan']), false)).toEqual(['saatli']);
    expect(seviyeler(new Set(['saat', 'foto', 'puan']), false)).toEqual(['saatliFoto']);
    expect(seviyeler(new Set(['saat', 'foto']), true)).toEqual(['saatliFoto']);
  });
});

describe('#172 KK1: kimlik başına önbellek', () => {
  it('10 mekan varken 1 mekan eklenince yalnız o kimlik istenir; aynı kimlik aynı maskeyle bir kez', async () => {
    const { o, cagrilar } = kur();
    const on = idler(10);
    const ilk = await o.getirHepsi(on, ['puan']);
    expect(Object.keys(ilk)).toHaveLength(10);
    expect(cagrilar).toEqual([{ ids: on, seviye: 'hafif' }]);
    const sonra = await o.getirHepsi([...on, 'yeni'], ['puan']);
    expect(Object.keys(sonra)).toHaveLength(11);
    expect(cagrilar.slice(1)).toEqual([{ ids: ['yeni'], seviye: 'hafif' }]);
    await o.getirHepsi([...on, 'yeni'], ['puan']);
    await o.getirHepsi(['p3'], []);
    expect(cagrilar).toHaveLength(2);
  });

  it('uçuştaki kimlik ikinci kez istenmez', async () => {
    let bitir: (() => void) | undefined;
    const cagrilar: string[][] = [];
    const o = new HafifOnbellek((ids, s) => {
      cagrilar.push(ids);
      return new Promise((coz) => {
        bitir = () => coz(ids.map((id) => yer(id, s)));
      });
    });
    const a = o.getirHepsi(['p1', 'p2'], ['puan']);
    await new Promise((r) => setTimeout(r, 5));
    const b = o.getirHepsi(['p2', 'p3'], ['puan']);
    await new Promise((r) => setTimeout(r, 5));
    bitir!();
    await a;
    await new Promise((r) => setTimeout(r, 5));
    bitir!();
    const sonuc = await b;
    expect(cagrilar).toEqual([['p1', 'p2'], ['p3']]);
    expect(Object.keys(sonuc).sort()).toEqual(['p2', 'p3']);
  });

  it('parçalar: hafif 25, foto 12 kimlik', async () => {
    const { o, cagrilar } = kur();
    await o.getirHepsi(idler(30), ['puan']);
    await o.getirHepsi(idler(30, 'f'), ['foto']);
    expect(cagrilar.map((c) => [c.seviye, c.ids.length])).toEqual([
      ['hafif', 25],
      ['hafif', 5],
      ['proFoto', 12],
      ['proFoto', 12],
      ['proFoto', 6],
    ]);
  });

  it('24 saat sonra yeniden istenir', async () => {
    let an = 0;
    const { o, cagrilar } = kur(() => an);
    await o.getirHepsi(['p1'], ['puan']);
    an = HAFIF_OMUR_MS - 1;
    await o.getirHepsi(['p1'], ['puan']);
    expect(cagrilar).toHaveLength(1);
    an = HAFIF_OMUR_MS + 1;
    await o.getirHepsi(['p1'], ['puan']);
    expect(cagrilar).toHaveLength(2);
  });

  it('hata: istek reddedilir; sonraki çağrı yalnız alınamayanları ister', async () => {
    let dusur = true;
    const cagrilar: string[][] = [];
    const o = new HafifOnbellek(async (ids, s) => {
      cagrilar.push(ids);
      if (dusur && ids.includes('kotu')) throw new Error('502');
      return ids.map((id) => yer(id, s));
    });
    await o.getirHepsi(['p1'], ['puan']);
    await expect(o.getirHepsi(['p1', 'kotu'], ['puan'])).rejects.toThrow('502');
    dusur = false;
    const sonuc = await o.getirHepsi(['p1', 'kotu'], ['puan']);
    expect(Object.keys(sonuc).sort()).toEqual(['kotu', 'p1']);
    expect(cagrilar).toEqual([['p1'], ['kotu'], ['kotu']]);
  });
});

describe('#172 KK2: tek istek', () => {
  it('aynı turda ad + puan ve fotoğraf isteyen iki kanca tek foto isteği atar', async () => {
    const { o, cagrilar } = kur();
    const [hafif, foto] = await Promise.all([o.getirHepsi(['p1', 'p2'], ['puan']), o.getirHepsi(['p1', 'p2'], ['foto'])]);
    expect(cagrilar).toEqual([{ ids: ['p1', 'p2'], seviye: 'foto' }]);
    expect(hafif.p1.puan).toBe(4.6);
    expect(foto.p2.foto_uri).toBe('https://foto/p2');
  });

  it('foto maskesi gelmişse hafif istenmez; hafif eldeyse fotoğraf için Pro foto maskesi', async () => {
    const { o, cagrilar } = kur();
    await o.getirHepsi(['p1'], ['puan', 'foto']);
    await o.getirHepsi(['p1'], ['puan']);
    expect(cagrilar).toEqual([{ ids: ['p1'], seviye: 'foto' }]);
    await o.getirHepsi(['p2'], ['puan']);
    await o.getirHepsi(['p2'], ['foto']);
    expect(cagrilar.slice(1)).toEqual([
      { ids: ['p2'], seviye: 'hafif' },
      { ids: ['p2'], seviye: 'proFoto' },
    ]);
    // Pro foto cevabındaki boş puan eldeki puanı silmez.
    expect(o.oku('p2', ['puan', 'foto'])?.puan).toBe(4.6);
  });

  it('saatli kayıt puanı da karşılar; saat + foto tek istek (Listem); sonra fotoğraf istenmez', async () => {
    const { o, cagrilar } = kur();
    await o.getirHepsi(['p1'], ['saat']);
    await o.getirHepsi(['p1'], ['puan']);
    await o.getirHepsi(['p1'], ['foto']);
    await o.getirHepsi(['p2'], ['puan', 'saat', 'foto']);
    await o.getirHepsi(['p2'], ['foto']);
    expect(cagrilar.map((c) => `${c.seviye}:${c.ids}`)).toEqual(['saatli:p1', 'proFoto:p1', 'saatliFoto:p2']);
  });
});

describe('#172 KK3: puan göstermeyen çağrı Pro maskeyle', () => {
  it('yalnız temel alanlar → pro; dışarıdan yazılan cevap da önbelleğe girer', async () => {
    const { o, cagrilar } = kur();
    const sonuc = await o.getirHepsi(['p1'], []);
    expect(cagrilar).toEqual([{ ids: ['p1'], seviye: 'pro' }]);
    expect(sonuc.p1.ad).toBe('Ad p1');
    expect(sonuc.p1.puan).toBeNull();
    o.yaz([yer('p9', 'foto')], 'foto', ['p9']);
    await o.getirHepsi(['p9'], ['puan', 'foto']);
    expect(cagrilar).toHaveLength(1);
  });
});
