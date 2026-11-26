// #401 KK1/KK3: il önerileri doğrulayıcısı ve yükleme verisi.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { IL_KATEGORILERI, ilDenetle, ilOsmIdleri, ilYuklemeVerisi, kategoriDagilimi } from '../il.mjs';

const KAT = ['doga', 'yemek', 'tarih', 'muze', 'carsi', 'manzara', 'aktivite'];
function liste(n = 21) {
  return {
    il: 'Deneme',
    slug: 'deneme',
    guncelleme: '2026-11-19',
    oneriler: Array.from({ length: n }, (_, i) => ({
      sira: i + 1,
      ad: `Yer ${i + 1}`,
      kategori: KAT[i % KAT.length],
      amaclar: ['doga'],
      ilce: 'Merkez',
      merkeze_km: i,
      neden: 'Kısa bir neden',
      ...(i === 0 ? { osm: 'node/1' } : {}),
      place_id: i === 1 ? 'ChIJ_test' : null,
    })),
  };
}

describe('ilDenetle', () => {
  it('geçerli listeyi kabul eder, OSM\'siz yerleri tek uyarıda sayar', () => {
    const { hatalar, uyarilar } = ilDenetle(liste(), { dosyaSlug: 'deneme' });
    expect(hatalar).toEqual([]);
    expect(uyarilar).toEqual(['20 yerde OSM kimliği yok; konumları boş kalır']);
  });

  it('20–50 yer sınırı', () => {
    expect(ilDenetle(liste(19)).hatalar).toContain('oneriler: 20–50 yer olmalı (19)');
    expect(ilDenetle(liste(51)).hatalar).toContain('oneriler: 20–50 yer olmalı (51)');
  });

  it('kategori zorunlu, listede olmalı; bulunan kategoride en az 3 yer', () => {
    const v = liste();
    v.oneriler[0].kategori = 'gece';
    v.oneriler[1].kategori = 'tatli_kahve';
    const { hatalar } = ilDenetle(v);
    expect(hatalar).toContain(`oneriler[0].kategori: ${IL_KATEGORILERI.join(', ')} değerlerinden biri`);
    expect(hatalar).toContain('kategori tatli_kahve: en az 3 yer (1)');
  });

  it('sira tekil ve 1\'den ardışık', () => {
    const v = liste();
    v.oneriler[3].sira = 3;
    expect(ilDenetle(v).hatalar).toContain('sira: tekil olmalı');
    const w = liste();
    w.oneriler[20].sira = 25;
    expect(ilDenetle(w).hatalar).toContain('sira: 1’den başlayıp boşluksuz ardışık olmalı');
  });

  it('neden zorunlu ve en çok 90 karakter', () => {
    const v = liste();
    v.oneriler[2].neden = 'a'.repeat(91);
    v.oneriler[4].neden = ' ';
    const { hatalar } = ilDenetle(v);
    expect(hatalar).toContain('oneriler[2].neden: en çok 90 karakter (91)');
    expect(hatalar).toContain('oneriler[4].neden: zorunlu');
  });

  it('Google alanı ve bilinmeyen alan reddedilir', () => {
    const v = liste();
    Object.assign(v.oneriler[0], { lat: 40, puan: 4.5 });
    v.oneriler[1].foo = 1;
    const { hatalar } = ilDenetle(v);
    expect(hatalar).toContain('oneriler[0].lat: il dosyasında Google verisi olmaz');
    expect(hatalar).toContain('oneriler[0].puan: il dosyasında Google verisi olmaz');
    expect(hatalar).toContain('oneriler[1].foo: bilinmeyen alan');
  });

  it('amaç, OSM kimliği ve dosya adı denetlenir', () => {
    const v = liste();
    v.oneriler[0].amaclar = ['deniz'];
    v.oneriler[1].osm = 'yol/5';
    const { hatalar } = ilDenetle(v, { dosyaSlug: 'baska' });
    expect(hatalar.some((h) => h.startsWith('oneriler[0].amaclar:'))).toBe(true);
    expect(hatalar).toContain('oneriler[1].osm: node/…, way/… ya da relation/…');
    expect(hatalar).toContain('slug: dosya adıyla aynı olmalı');
  });

  it('repodaki il dosyaları kurallara uyar', () => {
    const klasor = path.join(__dirname, '../../../icerik/iller');
    for (const ad of readdirSync(klasor).filter((d) => d.endsWith('.json'))) {
      const veri = JSON.parse(readFileSync(path.join(klasor, ad), 'utf8'));
      expect({ ad, hatalar: ilDenetle(veri, { dosyaSlug: ad.replace(/\.json$/, '') }).hatalar }).toEqual({ ad, hatalar: [] });
    }
  });
});

describe('ilYuklemeVerisi', () => {
  it('konum yalnız OSM\'den; place_id ve boş alanlar korunur', () => {
    const v = liste();
    const r = ilYuklemeVerisi(v, new Map([['node/1', { lat: 40.1, lng: 31.2 }]]));
    expect(r.slug).toBe('deneme');
    expect(r.oneriler[0]).toMatchObject({ sira: 1, osm: 'node/1', lat: 40.1, lng: 31.2 });
    expect(r.oneriler[1]).toMatchObject({ place_id: 'ChIJ_test', osm: null });
    expect(r.oneriler[1]).not.toHaveProperty('lat');
    expect(ilOsmIdleri(v)).toEqual(['node/1']);
  });

  it('kategori dağılımı kategori sırasıyla', () => {
    expect(kategoriDagilimi(liste(7))).toBe('doga 1 · yemek 1 · muze 1 · tarih 1 · carsi 1 · aktivite 1 · manzara 1');
  });
});
