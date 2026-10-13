// İçerik hattı (docs/07): `osm` ya da `arastir` sonucunu geçici daldan (icerik-sonuc/<run_id>) alır, oturumun özel anahtarıyla çözer,
// repo DIŞINDA bir dosyaya yazar ve geçici dalı siler. Ekrana yalnız sayılar yazılır (Google verisi değil).
// Kullanım: node scripts/icerik/coz.mjs <run_id> --cikti <repo dışında bir klasör>
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { coz } from './sifre.mjs';

const runId = process.argv[2];
const i = process.argv.indexOf('--cikti');
const klasor = i > 0 ? path.resolve(process.argv[i + 1] ?? '') : '';
if (!/^[0-9]+$/.test(runId ?? '') || !klasor) {
  console.error('kullanım: node scripts/icerik/coz.mjs <run_id> --cikti <repo dışında klasör>');
  process.exit(1);
}
const kok = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
if (klasor === kok || klasor.startsWith(kok + path.sep)) {
  console.error('çıktı klasörü repo dışında olmalı (Google verisi repoya girmez)');
  process.exit(1);
}

const dal = `icerik-sonuc/${runId}`;
execFileSync('git', ['fetch', '-q', 'origin', `refs/heads/${dal}`], { stdio: 'inherit' });
const paket = JSON.parse(execFileSync('git', ['show', 'FETCH_HEAD:sonuc.enc'], { encoding: 'utf8' }));
const metin = await coz(paket, await readFile(path.join(kok, '.icerik-gizli', 'ozel.pem'), 'utf8'));
const sonuc = JSON.parse(metin);
await mkdir(klasor, { recursive: true, mode: 0o700 });
const dosya = path.join(klasor, `arastirma-${runId}.json`);
await writeFile(dosya, JSON.stringify(sonuc, null, 1), { mode: 0o600 });

const sayilar = [
  sonuc.adaylar ? `${sonuc.adaylar.length} OSM adayı` : null,
  sonuc.kimlik ? `${sonuc.kimlik.sonuclar?.length ?? 0} kimlik sorgusu` : null,
  sonuc.puan ? `${sonuc.puan.yerler?.length ?? 0} puan` : null,
].filter(Boolean);
console.log(`çözüldü: ${dosya} · ${sayilar.join(' · ')}`);

try {
  execFileSync('git', ['push', '-q', 'origin', '--delete', dal], { stdio: 'pipe' });
  console.log(`geçici dal silindi: ${dal}`);
} catch {
  console.log(`geçici dal silinemedi (${dal}); icerik iş akışını islem=temizle, istek=${runId} ile çalıştır`);
}
