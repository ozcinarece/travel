// #532 KK1–KK3: "Yakında, bugüne ekle" görünme koşulu, adaylar, akşam kuralı ve üst haritanın kadrajı.
import { describe, expect, it } from '@jest/globals';

import type { IlYeri } from '@/features/icerik/ilOnerileri';
import type { Durak, Gun, Mekan, Yer } from '@/lib/tipler';

import { hangiGuneSirasi } from '@/features/listem/listem';

import { ustHaritaVerisi } from '../ustHarita';
import { adayKonumu, eklenenleriSabitle, geziKadraji, GUN_SONU_DK, yakindaAdaylari, yakindaGorunur } from '../yakinda';

const kart = (numara: number | null, gezildi: boolean, varisDk: number | null, dakika = 60) => ({ numara, gezildi, varisDk, dakika });

describe('yakindaGorunur (KK2)', () => {
  it('bütün duraklar gezildiyse görünür (Ece: 2 durak, ikisi de gezildi)', () => {
    expect(yakindaGorunur([kart(1, true, 540), kart(2, true, 733)])).toBe(true);
  });
  it('kalan durak 1 ise görünür; 2 kalan ve gün 18:00 sonrası bitiyorsa görünmez', () => {
    expect(yakindaGorunur([kart(1, true, 540), kart(2, false, 1000), kart(3, true, 1100)])).toBe(true);
    expect(yakindaGorunur([kart(1, false, 900), kart(2, false, 1020, 60)])).toBe(false);
  });
  it('son durağın bitişi 18:00\'den önceyse görünür; atlanan durak sayılmaz; durak yoksa görünmez', () => {
    expect(yakindaGorunur([kart(1, false, 600), kart(2, false, GUN_SONU_DK - 61, 60)])).toBe(true);
    expect(yakindaGorunur([kart(null, false, null), kart(1, false, 900), kart(2, false, 1020)])).toBe(false);
    expect(yakindaGorunur([])).toBe(false);
  });
});

const mekan = (id: string, tip: string, lat: number, lng = 30.5) => ({ id, place_id: `p-${id}`, primary_type: tip, lat, lng, default_minutes: 60 }) as unknown as Mekan;
const il = (id: string, kategori: IlYeri['kategori'], lat: number, place_id: string | null = `il-${id}`): IlYeri => ({
  id,
  sira: 1,
  ad: `İl ${id}`,
  kategori,
  ilce: null,
  merkeze_km: null,
  neden: null,
  place_id,
  primary_type: kategori === 'doga' ? 'park' : 'museum',
  lat,
  lng: 30.5,
});
const rehber = (id: string, place_id: string, kategori: string, lat: number): Yer => ({ id, sehir_id: 's', place_id, ad: `Rehber ${id}`, kategori, rehber_md: null, kapak_url: null, one_cikan_sira: null, lat, lng: 30.5 });

describe('yakindaAdaylari (KK2, KK3)', () => {
  const referans = { lat: 39.77, lng: 30.5 };
  const mekanlar = [mekan('bugun', 'museum', 39.771), mekan('gunsuz-uzak', 'museum', 39.9), mekan('gunsuz-yakin', 'cafe', 39.775), mekan('otel', 'hotel', 39.7701)];
  const duraklar = [{ place_ref: 'bugun' }] as Pick<Durak, 'place_ref'>[];

  it('önce Listem (güne atanmamış, otel hariç), sonra içerik; her grupta yakınlık sırası; listede olan içerik çıkar', () => {
    const a = yakindaAdaylari({
      mekanlar,
      duraklar,
      ilYerleri: [il('a', 'muze', 39.772), il('listede', 'muze', 39.7705, 'p-bugun'), il('kimliksiz', 'muze', 39.77, null)],
      rehberYerleri: [rehber('r1', 'rehber-1', 'museum', 39.78)],
      referans,
      aksam: false,
      adet: 10,
    });
    expect(a.map((x) => x.place_id)).toEqual(['p-gunsuz-yakin', 'p-gunsuz-uzak', 'il-a', 'rehber-1']);
    expect(a[0].kaynak).toBe('liste');
  });

  it('aynı yer il listesinde ve rehberde: tek aday, rehber kimliği taşınır', () => {
    const a = yakindaAdaylari({ mekanlar: [], duraklar: [], ilYerleri: [il('a', 'muze', 39.772, 'ortak')], rehberYerleri: [rehber('r1', 'ortak', 'museum', 39.772)], referans, aksam: false, adet: 5 });
    expect(a).toHaveLength(1);
    expect(a[0].kaynak === 'icerik' && a[0].yerId).toBe('r1');
  });

  it('akşam: doğa ve manzara çıkar (il kategorisi ve Google tipi), yemek/müze öne', () => {
    const a = yakindaAdaylari({
      mekanlar: [mekan('park', 'park', 39.7701)],
      duraklar: [],
      ilYerleri: [il('doga', 'doga', 39.7702), il('manzara', 'manzara', 39.7703), il('aktivite', 'aktivite', 39.7704), il('muze', 'muze', 39.79)],
      rehberYerleri: [rehber('kp', 'kentpark', 'park', 39.7705)],
      referans,
      aksam: true,
      adet: 5,
    });
    expect(a.map((x) => x.place_id)).toEqual(['il-muze', 'il-aktivite']);
  });

  it('uzaklık sınırı (3 km) Listem ve içerik adaylarına birlikte; adet sınırı', () => {
    const a = yakindaAdaylari({ mekanlar: [mekan('uzak', 'museum', 40.2), mekan('yakin', 'museum', 39.776)], duraklar: [], ilYerleri: [il('uzak', 'muze', 40.2), il('yakin', 'muze', 39.775)], rehberYerleri: [], referans, aksam: false, adet: 2, icerikSiniriM: 3000 });
    expect(a.map((x) => x.place_id)).toEqual(['p-yakin', 'il-yakin']);
  });

  it('#536 inceleme 2: 40 km\'deki Listem yeri ne adayda ne kadrajda (sigdir)', () => {
    const a = yakindaAdaylari({ mekanlar: [mekan('uzak', 'museum', 40.13)], duraklar: [], ilYerleri: [il('muze', 'muze', 39.778)], rehberYerleri: [], referans, aksam: false, adet: 2, icerikSiniriM: 3000 });
    expect(a.map((x) => x.place_id)).toEqual(['il-muze']);
    const sigdir = geziKadraji({ duraklar: [referans], oneriler: a.map(adayKonumu).filter((k): k is NonNullable<typeof k> => k !== null), otel: null, konum: null });
    expect(sigdir.some((k) => k.lat === 40.13)).toBe(false);
  });
});

describe('üst harita kadrajı (KK1)', () => {
  const duraklar = [{ lat: 39.77, lng: 30.5 }, { lat: 39.78, lng: 30.52 }];
  it('Ece: konum 250 km uzakta → kadrajda yok; bugünün durakları ve öneriler var', () => {
    const k = geziKadraji({ duraklar, oneriler: [{ lat: 39.775, lng: 30.51 }], otel: null, konum: { lat: 40.75, lng: 29.5 } });
    expect(k).toHaveLength(3);
    expect(k.some((x) => x.lat === 40.75)).toBe(false);
  });
  it('konum en yakın durağa ≤ 10 km ise kadraja girer', () => {
    expect(geziKadraji({ duraklar, oneriler: [], otel: null, konum: { lat: 39.8, lng: 30.5 } })).toHaveLength(3);
  });
  it('boş gün: otel ve öneriler; hiçbiri yoksa boş (şehir merkezi)', () => {
    expect(geziKadraji({ duraklar: [], oneriler: [{ lat: 1, lng: 1 }], otel: { lat: 2, lng: 2 }, konum: { lat: 2, lng: 2 } })).toEqual([{ lat: 2, lng: 2 }, { lat: 1, lng: 1 }]);
    expect(geziKadraji({ duraklar: [], oneriler: [], otel: null, konum: { lat: 2, lng: 2 } })).toEqual([]);
  });

  it('ustHaritaVerisi gezi modu: sigdir konumu içermez, öneri pini çizilir; plan modu bütün pinler', () => {
    const gun = { id: 'g1', index: 3 } as Gun;
    const m = [mekan('a', 'museum', 39.77), mekan('b', 'museum', 39.78)];
    const d = [
      { id: 'd1', day_id: 'g1', place_ref: 'a', order_key: 'a', skipped: false, completed_at: 'x' },
      { id: 'd2', day_id: 'g1', place_ref: 'b', order_key: 'b', skipped: false, completed_at: 'x' },
    ] as unknown as Durak[];
    const ortak = { gunler: [gun], duraklar: d, mekanlar: m, bugunGunId: 'g1', konum: { lat: 40.75, lng: 29.5 }, otel: null, oneriler: [{ id: 'o', konum: { lat: 39.775, lng: 30.5 } }], bugunCizgileri: [] };
    const v = ustHaritaVerisi({ ...ortak, hal: 'gezi' });
    expect(v.pinler.map((p) => p.tur)).toEqual(['durak', 'durak', 'oneri', 'konum']);
    expect(v.sigdir).toHaveLength(3);
    expect(v.sigdir.some((x) => x.lat === 40.75)).toBe(false);
    expect(ustHaritaVerisi({ ...ortak, hal: 'plan' }).sigdir).toHaveLength(2);
  });
});

describe('Hangi güne sırası (#532 KK4, #534 KK8)', () => {
  const sec = (id: string, index: number, onerilen = false, enYakinM: number | null = 100) => ({ gun: { id, index } as Gun, durakSayisi: enYakinM === null ? 0 : 1, enYakinM, yakindaki: 0, bitisDk: 900, yeniBitisDk: 960, ekleIndeksi: 1, onerilen, sonGun: false });
  const ozet = (x: ReturnType<typeof hangiGuneSirasi>) => x.map((v) => [v.secenek.gun.id, v.gecti, v.enYakin]);
  it('bağlam ve bugün yoksa gün sırası; en yakın gün rozetli', () => {
    const liste = [sec('g2', 2, true), sec('g1', 1), sec('g3', 3)];
    expect(ozet(hangiGuneSirasi(liste, { bugunIndex: null }))).toEqual([
      ['g1', false, false],
      ['g2', false, true],
      ['g3', false, false],
    ]);
  });
  it('bağlamdaki gün en üstte; rozet en yakın günde kalır', () => {
    const liste = [sec('g2', 2, true), sec('g1', 1), sec('g3', 3)];
    expect(ozet(hangiGuneSirasi(liste, { baglamGunId: 'g3', bugunIndex: null }))).toEqual([
      ['g3', false, false],
      ['g1', false, false],
      ['g2', false, true],
    ]);
  });
  it('bağlam yoksa bugün en üstte; geçmiş günler en altta ve geçti', () => {
    const liste = [sec('g1', 1), sec('g2', 2), sec('g3', 3, true), sec('g4', 4)];
    expect(ozet(hangiGuneSirasi(liste, { bugunIndex: 3 }))).toEqual([
      ['g3', false, true],
      ['g4', false, false],
      ['g1', true, false],
      ['g2', true, false],
    ]);
  });
  it('bağlam geçmiş bir günse en üstte ve soluk değil; durağı olmayan önerilen gün rozetsiz', () => {
    const liste = [sec('g1', 1), sec('g2', 2, true, null), sec('g3', 3)];
    expect(ozet(hangiGuneSirasi(liste, { baglamGunId: 'g1', bugunIndex: 2 }))).toEqual([
      ['g1', false, false],
      ['g2', false, false],
      ['g3', false, false],
    ]);
  });
});

describe('eklenenleriSabitle (KK2: satır ✓ olur)', () => {
  const a = (id: string) => ({ place_id: id });
  it('eklenen satır yerinde kalır, düşen yerler yeni adaylarla dolar', () => {
    const ilk = new Map([['x', { aday: a('x'), sira: 0 }]]);
    expect(eklenenleriSabitle(ilk, [a('y'), a('z')], 2).map((v) => v.place_id)).toEqual(['x', 'y']);
    const ikinci = new Map([['y', { aday: a('y'), sira: 1 }]]);
    expect(eklenenleriSabitle(ikinci, [a('z'), a('w')], 2).map((v) => v.place_id)).toEqual(['z', 'y']);
    expect(eklenenleriSabitle(new Map(), [a('z')], 2).map((v) => v.place_id)).toEqual(['z']);
  });
});
