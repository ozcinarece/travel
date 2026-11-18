import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

import tr from '../tr.json';
import yonetim from '../yonetim.json';

// #315 KK3: koddaki sabit `t('…')` / `ty('…')` anahtarlarının hepsi sözlükte olmalı; yoksa kullanıcı ham anahtarı görür
// ("yerler.atif" 6 ekranda böyle göründü). Şablonlu (`t(\`a.${b}\`)`) ve değişkenli çağrılar burada sınanmaz.
type Dugum = { [k: string]: string | Dugum };
const KOK = join(__dirname, '..', '..');

function dosyalar(klasor: string): string[] {
  return readdirSync(klasor).flatMap((ad) => {
    const yol = join(klasor, ad);
    if (statSync(yol).isDirectory()) return ad === '__tests__' || ad === 'node_modules' ? [] : dosyalar(yol);
    // i18n/index.ts: belge yorumundaki örnek çağrılar (`t('x.y')`) anahtar değil.
    return /\.(ts|tsx)$/.test(ad) && yol !== join(KOK, 'i18n', 'index.ts') ? [yol] : [];
  });
}

function varMi(sozluk: Dugum, anahtar: string): boolean {
  let d: string | Dugum | undefined = sozluk;
  for (const p of anahtar.split('.')) d = typeof d === 'object' ? d[p] : undefined;
  return typeof d === 'string';
}

function eksikler(fonk: 't' | 'ty', sozluk: Dugum): string[] {
  const desen = new RegExp(`(?<![\\w.$])${fonk}\\(\\s*(['"])([A-Za-z0-9_.]+)\\1`, 'g');
  const sonuc: string[] = [];
  for (const dosya of dosyalar(KOK)) {
    const metin = readFileSync(dosya, 'utf8');
    for (const m of metin.matchAll(desen)) {
      if (!varMi(sozluk, m[2])) sonuc.push(`${relative(KOK, dosya)}: ${m[2]}`);
    }
  }
  return sonuc;
}

describe('i18n anahtarları (#315 KK3)', () => {
  it("koddaki her sabit t('…') anahtarı tr.json'da var", () => {
    expect(eksikler('t', tr as Dugum)).toEqual([]);
  });

  it("koddaki her sabit ty('…') anahtarı yonetim.json'da var", () => {
    expect(eksikler('ty', yonetim as Dugum)).toEqual([]);
  });
});
