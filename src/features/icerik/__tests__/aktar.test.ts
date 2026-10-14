import { describe, expect, it, jest } from '@jest/globals';

import type { GeziDetay, GeziDuragi, Gun } from '@/lib/tipler';

import {
  aktarmaBilgisi,
  aktarmaOzeti,
  aktarmaPlani,
  aktarmaSecenegi,
  alDugmesi,
  eklenecekGunler,
  eksikGunBilgisi,
  eksikGunler,
  hedefEslesmesi,
  hedefListesi,
  kalinParcalar,
  sanalGun,
  sanalSira,
  sanalSiraOnizleme,
  varsayilanDahil,
  varsayilanEslesme,
  type HedefListesi,
} from '../aktar';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const durak = (id: string, gun: string, sira: number, place_id: string | null = null): GeziDuragi => ({ id, gezi_gun_id: gun, sira, place_id, ad: id, kategori: 'museum', sure_dk: 60, lat: 39.7, lng: 30.5 });
const gezi = {
  gezi_gunleri: [
    { id: 'G1', gezi_id: 'z', sira: 1, baslik: 'Odunpazarı', gezi_duraklari: [durak('a', 'G1', 1, 'PA'), durak('b', 'G1', 2)] },
    { id: 'G2', gezi_id: 'z', sira: 2, baslik: 'Porsuk', gezi_duraklari: [durak('c', 'G2', 1), durak('a2', 'G2', 2, 'PA')] },
    { id: 'G3', gezi_id: 'z', sira: 3, baslik: null, gezi_duraklari: [durak('d', 'G3', 1)] },
  ],
} as unknown as Pick<GeziDetay, 'gezi_gunleri'>;
const gun = (id: string, index: number, date: string | null): Gun => ({ id, trip_id: 't', index, date, start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null });
const gunler = [gun('d2', 2, '2026-10-17'), gun('d1', 1, '2026-10-16')];

describe('geziyi seyahatime al (#97 C)', () => {
  it('tüm gezi: günler sırayla; gün azsa fazlası listeye; aynı mekan iki günde geçiyorsa bir kez', () => {
    const p = aktarmaPlani(gezi, gunler, { tur: 'tum' });
    expect(varsayilanEslesme(gezi, gunler)).toEqual({ G1: 'd1', G2: 'd2', G3: null });
    expect(p.atamalar).toEqual([
      { gunId: 'd1', duraklar: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })] },
      { gunId: 'd2', duraklar: [expect.objectContaining({ id: 'c' })] },
    ]);
    expect(p.listeyeKalan.map((d) => d.id)).toEqual(['d']);
    expect(p.duraklar.map((d) => d.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('günleri seç: eşleşmeye göre; eşleşmeyen gün listeye', () => {
    const p = aktarmaPlani(gezi, gunler, { tur: 'gunler', eslesme: { G1: 'd2', G2: null, G3: 'd2' } });
    expect(p.atamalar).toEqual([{ gunId: 'd2', duraklar: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' }), expect.objectContaining({ id: 'd' })] }]);
    expect(p.listeyeKalan.map((d) => d.id)).toEqual(['c']);
  });
  it('#118: gün onay kutusu — kapalı gün hiç alınmaz (listeye de değil); açık gün hedefine gider', () => {
    const p = aktarmaPlani(gezi, gunler, { tur: 'gunler', eslesme: { G1: 'd1', G2: 'd2', G3: null }, dahil: { G1: true, G2: false, G3: false } });
    expect(p.atamalar).toEqual([{ gunId: 'd1', duraklar: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })] }]);
    expect(p.listeyeKalan).toEqual([]);
    expect(p.duraklar.map((d) => d.id)).toEqual(['a', 'b']);
    // Kapalı güne "Listeye" seçilmiş olsa da gitmez; açık günün listeye seçimi gider.
    const q = aktarmaPlani(gezi, gunler, { tur: 'gunler', eslesme: { G1: null, G2: 'd2', G3: null }, dahil: { G1: true, G2: false, G3: true } });
    expect(q.atamalar).toEqual([]);
    expect(q.listeyeKalan.map((d) => d.id)).toEqual(['a', 'b', 'd']);
  });
  it('yalnız mekanlar: atama yok, hepsi listeye', () => {
    const p = aktarmaPlani(gezi, gunler, { tur: 'mekanlar' });
    expect(p.atamalar).toEqual([]);
    expect(p.listeyeKalan).toHaveLength(4);
  });
});

// Kimlik: durak place_id'si (çözülmüş say); 'b' çözülmemiş.
const kimlik = (d: { id: string; place_id: string | null }) => d.place_id ?? (d.id === 'b' ? null : `P${d.id}`);
const bos: HedefListesi = { listede: new Set(), gunde: new Map(), durakSayisi: new Map() };

describe('seyahatime al özeti (#143 KK5–6)', () => {
  it('boş hedef: hepsi yeni; düğme "N yeni durağı al · günler"; bilgi kutusu yok', () => {
    const secim = { tur: 'gunler' as const, eslesme: varsayilanEslesme(gezi, gunler) };
    const p = aktarmaPlani(gezi, gunler, secim);
    const o = aktarmaOzeti(gezi, p, kimlik, bos);
    expect(o.yeniDurak).toBe(3);
    expect(o.listeyeYeni).toBe(1);
    expect(o.yalnizMekanYeni).toBe(4);
    expect(alDugmesi(p, o, gunler)).toEqual({ metin: '3 yeni durağı al · Cum 16, Cmt 17', pasif: false });
    expect(aktarmaBilgisi(o, gunler)).toBeNull();
    expect(aktarmaSecenegi(gezi, secim)).toBe('gunler');
    expect(aktarmaSecenegi(gezi, { tur: 'gunler', eslesme: { G1: 'd1', G2: 'd2', G3: 'd2' } })).toBe('tum');
  });
  it('mükerrer: aynı günde varsa atlanır, başka günde varsa yerinde kalır, atanmamışsa taşınır (yeni sayılır)', () => {
    // PA Cuma'da (d1) zaten var; Pc Cumartesi'de (d2) var; Pd listede atanmamış. Cuma'da 3, Cumartesi'de 1 durak.
    const hedef: HedefListesi = { listede: new Set(['PA', 'Pc', 'Pd']), gunde: new Map([['PA', 'd1'], ['Pc', 'd2']]), durakSayisi: new Map([['d1', 3], ['d2', 1]]) };
    // Üç gezi günü de Cuma'ya; G2'deki a2 = a (aynı place_id) bir kez sayılır.
    const p = aktarmaPlani(gezi, gunler, { tur: 'gunler', eslesme: { G1: 'd1', G2: 'd1', G3: 'd1' }, dahil: { G2: true } });
    const o = aktarmaOzeti(gezi, p, kimlik, hedef);
    // d1'e giden: a (PA, ortak → atlanır), b (çözülmemiş → yeni), c (Pc başka günde → yerinde), d (Pd atanmamış → taşınır, yeni).
    expect(o.hedefGunler).toEqual([{ gunId: 'd1', mevcut: 3, ortak: [expect.objectContaining({ id: 'a' })], yeni: 2 }]);
    expect(o.baskaGunde.map((d) => d.id)).toEqual(['c']);
    expect(o.gunSatirlari).toEqual({ G1: { mekan: 2, zatenListede: 1 }, G2: { mekan: 2, zatenListede: 2 }, G3: { mekan: 1, zatenListede: 1 } });
    expect(o.yalnizMekanYeni).toBe(1);
    expect(alDugmesi(p, o, gunler)).toEqual({ metin: '2 yeni durağı al · Cum 16', pasif: false });
    expect(aktarmaBilgisi(o, gunler)).toBe("Cuma'da zaten 3 durağın var, **a** ikisinde de ortak. **c** başka bir gününde zaten var, yerinde kalır. Kalan **2 yeni durak** eklenir, saatler yeniden hesaplanır.");
    expect(kalinParcalar('x **a** y')).toEqual([{ metin: 'x ', kalin: false }, { metin: 'a', kalin: true }, { metin: ' y', kalin: false }]);
  });
  it('hedef listesi: mekanlar + duraklar → listede / günde / gün başına durak', () => {
    const h = hedefListesi([{ id: 'm1', place_id: 'PA' }, { id: 'm2', place_id: 'Pd' }], [{ day_id: 'd1', place_ref: 'm1' }, { day_id: 'd1', place_ref: 'yok' }]);
    expect([...h.listede]).toEqual(['PA', 'Pd']);
    expect([...h.gunde]).toEqual([['PA', 'd1']]);
    expect(h.durakSayisi.get('d1')).toBe(2);
  });
  it('tarihsiz gün "1. günde"; hepsi zaten programdaysa düğme pasif; hiç gün seçilmediyse "Bir gün seç"', () => {
    const tarihsiz = [gun('d1', 1, null)];
    const hedef: HedefListesi = { listede: new Set(['PA', 'Pc']), gunde: new Map([['PA', 'd1'], ['Pc', 'd1']]), durakSayisi: new Map([['d1', 2]]) };
    const tekGun = { gezi_gunleri: [{ ...gezi.gezi_gunleri[0], gezi_duraklari: [gezi.gezi_gunleri[0].gezi_duraklari[0]] }, gezi.gezi_gunleri[1]] } as typeof gezi;
    const p = aktarmaPlani(tekGun, tarihsiz, { tur: 'gunler', eslesme: { G1: 'd1', G2: 'd1' } });
    const o = aktarmaOzeti(tekGun, p, kimlik, hedef);
    expect(o.yeniDurak).toBe(0);
    expect(alDugmesi(p, o, tarihsiz)).toEqual({ metin: 'Hepsi zaten programında', pasif: true });
    expect(aktarmaBilgisi(o, tarihsiz)).toBe('1. günde zaten 2 durağın var, **2 mekan** ikisinde de ortak. Eklenecek yeni durak yok.');
    const hic = aktarmaPlani(tekGun, tarihsiz, { tur: 'gunler', eslesme: {}, dahil: { G1: false, G2: false } });
    expect(alDugmesi(hic, aktarmaOzeti(tekGun, hic, kimlik, bos), tarihsiz)).toEqual({ metin: 'Bir gün seç', pasif: true });
  });
});

describe('#193 KK5 eksik gün: seyahatten fazla gezi günü sona eklenir', () => {
  // Gezi 3 gün, seyahat 2 gün (Cum 16 – Cmt 17): 3. gün "Paz 18 +".
  const sirali = [gun('d1', 1, '2026-10-16'), gun('d2', 2, '2026-10-17')];
  it('fazla gün sanal hedefe eşlenir ama varsayılan seçilmez; bilgi satırı söyler', () => {
    expect(eksikGunler(gezi, sirali)).toEqual({ G3: '+1' });
    const eslesme = hedefEslesmesi(gezi, sirali);
    expect(eslesme).toEqual({ G1: 'd1', G2: 'd2', G3: '+1' });
    const dahil = varsayilanDahil(gezi, sirali);
    expect(dahil).toEqual({ G3: false });
    const plan = aktarmaPlani(gezi, sirali, { tur: 'gunler', eslesme, dahil });
    expect(plan.atamalar.map((a) => a.gunId)).toEqual(['d1', 'd2']);
    const sira = sanalSira(gezi, eslesme, dahil);
    expect(sira.size).toBe(0);
    expect(eklenecekGunler(plan, sira)).toEqual([]);
    expect(eksikGunBilgisi(gezi, sirali, eslesme, dahil)).toBe('Seyahatin 2 gün; 3. günü seçersen seyahate **Paz 18** eklenir.');
  });
  it('seçilirse hedefi "Paz 18" olan yeni gün; düğme ve bilgi satırı onu söyler', () => {
    const eslesme = hedefEslesmesi(gezi, sirali);
    const dahil = { G3: true };
    const plan = aktarmaPlani(gezi, sirali, { tur: 'gunler', eslesme, dahil });
    expect(plan.atamalar.map((a) => a.gunId)).toEqual(['d1', 'd2', '+1']);
    const sira = sanalSira(gezi, eslesme, dahil);
    expect(eklenecekGunler(plan, sira)).toEqual(['+1']);
    const yeni = sanalGun(sirali, '+1', 1);
    expect(yeni).toEqual(expect.objectContaining({ index: 3, date: '2026-10-18' }));
    const tum = [...sirali, yeni];
    const o = aktarmaOzeti(gezi, plan, kimlik, bos);
    expect(o.hedefGunler.find((h) => h.gunId === '+1')).toEqual({ gunId: '+1', mevcut: 0, ortak: [], yeni: 1 });
    // a, b, c, d (a2 = a bir kez).
    expect(alDugmesi(plan, o, tum).metin).toBe('4 yeni durağı al · Cum 16, Cmt 17, Paz 18');
    expect(eksikGunBilgisi(gezi, sirali, eslesme, dahil)).toBe('Seyahatin 2 gün; sonuna **Paz 18** eklenir.');
  });
  it('sıkıştırma: 5 günlük gezinin yalnız 5. günü seçilirse tek gün eklenir (son günden sonraki ilk gün)', () => {
    const bes = { gezi_gunleri: [1, 2, 3, 4, 5].map((n) => ({ id: `G${n}`, gezi_id: 'z', sira: n, baslik: null, gezi_duraklari: [durak(`s${n}`, `G${n}`, 1, `P${n}`)] })) } as unknown as Pick<GeziDetay, 'gezi_gunleri'>;
    const eslesme = hedefEslesmesi(bes, sirali);
    expect(eslesme).toEqual({ G1: 'd1', G2: 'd2', G3: '+1', G4: '+2', G5: '+3' });
    const dahil = { ...varsayilanDahil(bes, sirali), G5: true };
    const sira = sanalSira(bes, eslesme, dahil);
    expect([...sira]).toEqual([['+3', 1]]);
    expect(eklenecekGunler(aktarmaPlani(bes, sirali, { tur: 'gunler', eslesme, dahil }), sira)).toEqual(['+3']);
    // Seçilmemiş 3. gün seçilirse 5.'nin önüne geçer: önizleme sırası 1.
    expect(sanalSiraOnizleme(sira, '+1')).toBe(1);
    expect(eksikGunBilgisi(bes, sirali, eslesme, dahil)).toBe('Seyahatin 2 gün; sonuna **Paz 18** eklenir.');
    expect(eksikGunBilgisi(bes, sirali, eslesme, varsayilanDahil(bes, sirali))).toBe('Seyahatin 2 gün; 3., 4. ve 5. günleri seçersen seyahate **Paz 18, Pzt 19, Sal 20** eklenir.');
  });
  it('tarihsiz seyahatte yeni gün "3. gün"; fazla gün yoksa bilgi satırı yok', () => {
    const tarihsiz = [gun('d1', 1, null), gun('d2', 2, null)];
    expect(sanalGun(tarihsiz, '+1', 1)).toEqual(expect.objectContaining({ index: 3, date: null }));
    const uc = [...sirali, gun('d3', 3, '2026-10-18')];
    expect(eksikGunBilgisi(gezi, uc, hedefEslesmesi(gezi, uc), varsayilanDahil(gezi, uc))).toBeNull();
  });
});
