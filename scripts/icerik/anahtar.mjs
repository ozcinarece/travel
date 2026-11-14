// İçerik hattı (docs/07): oturumun anahtar çifti. Özel anahtar .icerik-gizli/ozel.pem'e (gitignore; yalnız bu makinede),
// açık anahtar tek satır base64 olarak ekrana ve .icerik-gizli/acik.txt'ye. Açık anahtar `arastir` isteğine girer.
// Kullanım: node scripts/icerik/anahtar.mjs [--yenile]
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { anahtarCifti } from './sifre.mjs';

const KLASOR = path.resolve('.icerik-gizli');
const OZEL = path.join(KLASOR, 'ozel.pem');
const ACIK = path.join(KLASOR, 'acik.txt');

if (existsSync(OZEL) && existsSync(ACIK) && !process.argv.includes('--yenile')) {
  console.log((await readFile(ACIK, 'utf8')).trim());
} else {
  await mkdir(KLASOR, { recursive: true, mode: 0o700 });
  const { acik, ozelPem } = await anahtarCifti();
  await writeFile(OZEL, ozelPem, { mode: 0o600 });
  await chmod(OZEL, 0o600);
  await writeFile(ACIK, `${acik}\n`);
  console.log(acik);
}
