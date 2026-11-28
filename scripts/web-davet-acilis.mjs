// #549: web davet sayfası (/r/{token}, /r/g/{token}) JS gelmeden de bir şey gösterir (kanvas 3e A–B).
// `expo export -p web` çıktısındaki davet HTML'lerine, #root'un dışına, sabit bir açılış katmanı yazar. Metinler
// src/i18n/tr.json `davet.webAcilis.*` ve `marka.ad`'dan gelir. Katman yalnız CSS: üç nokta sırayla yanar, 8 sn
// sonra "Biraz uzun sürüyor" notu açılır (`animation-delay`), 30 sn'de "sayfayı yenile"ye döner (#557),
// `prefers-reduced-motion`'da noktalar durur.
// Uygulama açılış kararını verince (`src/lib/webAcilis.ts`, kök `_layout`) katman kaldırılır.
// #550: davet girişinden tam uygulamaya geçiş tam yeniden yüklemedir (`src/davet-web/+not-found.tsx`); Google dönüşü
// (/giris), katılım → seyahat (/seyahat/{id}/gezi) ve ana sayfa (/) da aynı katmanı gösterir (Ürün kararı, kanvas 3e aynen).
// Kullanım: node scripts/web-davet-acilis.mjs dist   (web-yayin'de web-yonlendirmeler.js'ten ÖNCE: kopyalar da alsın)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KATMAN_ID = 'davet-acilis';
export const BELIRME_MS = 600;
/** #557: JS paketi hiç gelmezse 3e-B notu bu süreden sonra "sayfayı yenile" der (yalnız CSS). */
export const YENILE_SN = 30;
export const DAVET_SAYFALARI = ['r/[token].html', 'r/g/[token].html'];
/** #550: davet ekranlarının tam yeniden yüklemeyle geçtiği tam uygulama sayfaları (Google dönüşü, katılım → seyahat, ana sayfa). */
export const GECIS_SAYFALARI = ['giris.html', 'index.html', 'seyahat/[id]/gezi.html', 'seyahat/[id]/(sekmeler)/gezi.html'];

const kacir = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Kanvas 3e: beyaz zemin, 390 px'te 32 px yan boşluk, öğeler arası 20 px; logo 80×48; başlık 22/800; satır 15 #4A5274;
// noktalar 10 px, 8 px aralık (#FF7A1A, #FFC9A1, #FFE4D1); not 14/700, #EEF2FF zemin, 16 px köşe, 14×16 iç boşluk.
// İçerik BELIRME_MS sonra görünür: hızlı ağda uygulama o süreden önce açılır, 3e-A hiç görünmez (KK3); o ana kadar
// katman yalnız beyaz zemin (uygulamanın kendi zemini de beyaz, kare atlaması yok).
// Not görünmeden yer kaplamasın (A'da içerik ortada kalsın) diye `gap` yerine margin; not kapalıyken yüksekliği 0.
// #552: eski motor (Android 9 WebView = Chrome 74): `inset` (Chrome 87) ve flex `gap` (Chrome 84) kullanılmaz.
const STIL = `
#${KATMAN_ID}{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483647;box-sizing:border-box;padding:0 32px;background:#FFFFFF;color:#0E1430;font-family:Figtree,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
#${KATMAN_ID} *{box-sizing:border-box}
#${KATMAN_ID} .da-icerik{width:100%;display:flex;flex-direction:column;align-items:center;animation:da-belir 0s linear ${BELIRME_MS}ms both}
@keyframes da-belir{from{visibility:hidden}to{visibility:visible}}
#${KATMAN_ID} .da-metinler{margin-top:20px;display:flex;flex-direction:column;align-items:center}
#${KATMAN_ID} h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em}
#${KATMAN_ID} .da-satir{margin:6px 0 0;font-size:15px;line-height:1.45;color:#4A5274}
#${KATMAN_ID} .da-noktalar{margin-top:20px;display:flex}
#${KATMAN_ID} .da-noktalar span+span{margin-left:8px}
#${KATMAN_ID} .da-noktalar span{width:10px;height:10px;border-radius:5px;background:#FF7A1A;animation:da-nokta 1.2s linear infinite}
#${KATMAN_ID} .da-noktalar span:nth-child(2){background:#FFC9A1;animation-delay:-0.8s}
#${KATMAN_ID} .da-noktalar span:nth-child(3){background:#FFE4D1;animation-delay:-0.4s}
@keyframes da-nokta{0%,100%{background:#FF7A1A}33.3%{background:#FFE4D1}66.6%{background:#FFC9A1}}
#${KATMAN_ID} .da-uzun{width:100%;max-width:326px;margin:0;max-height:0;padding:0 16px;overflow:hidden;visibility:hidden;border-radius:16px;background:#EEF2FF;font-size:14px;font-weight:700;line-height:1.4;animation:da-uzun 0s linear 8s forwards}
@keyframes da-uzun{to{margin-top:20px;max-height:240px;padding:14px 16px;visibility:visible}}
#${KATMAN_ID} .da-uzun span{display:block}
#${KATMAN_ID} .da-uzun-ilk{overflow:hidden;animation:da-gizle 0s linear ${YENILE_SN}s forwards}
#${KATMAN_ID} .da-uzun-yenile{max-height:0;overflow:hidden;visibility:hidden;animation:da-goster 0s linear ${YENILE_SN}s forwards}
@keyframes da-gizle{to{max-height:0;visibility:hidden}}
@keyframes da-goster{to{max-height:240px;visibility:visible}}
@media (prefers-reduced-motion:reduce){#${KATMAN_ID} .da-noktalar span{animation:none}}
`
  .trim()
  .replace(/\n/g, '');

export function katmanHtml(metin) {
  const { baslik, metin: satir, uzun, yenile } = metin.davet.webAcilis;
  const marka = metin.marka.ad;
  return (
    `<style id="${KATMAN_ID}-stil">${STIL}</style>` +
    // #550 KK-ek2: canlı bölge kapsayıcıda değil, yalnız 8 sn notunda: not açılınca (ve 30 sn'de metni değişince) duyurulur.
    `<div id="${KATMAN_ID}"><div class="da-icerik">` +
    `<svg width="80" height="48" viewBox="0 0 80 48" role="img" aria-label="${kacir(marka)}"><circle cx="24" cy="14" r="7" fill="#FF7A1A"></circle><circle cx="56" cy="14" r="7" fill="#152A6B"></circle><path d="M20 30 Q40 48 60 30" stroke="#FF7A1A" stroke-width="7" fill="none" stroke-dasharray="7 4.5"></path></svg>` +
    `<div class="da-metinler"><h1>${kacir(baslik)}</h1><p class="da-satir">${kacir(satir)}</p></div>` +
    `<div class="da-noktalar" aria-hidden="true"><span></span><span></span><span></span></div>` +
    `<p class="da-uzun" role="status"><span class="da-uzun-ilk">${kacir(uzun)}</span><span class="da-uzun-yenile">${kacir(yenile)}</span></p>` +
    `</div></div>`
  );
}

/** Katmanı `<body>`'nin hemen başına (React kökünün dışına) yazar; zaten varsa dokunmaz. */
export function katmanEkle(html, metin) {
  if (html.includes(`id="${KATMAN_ID}"`)) return html;
  const govde = html.match(/<body[^>]*>/i);
  if (!govde) throw new Error('<body> bulunamadı');
  const yer = govde.index + govde[0].length;
  return html.slice(0, yer) + katmanHtml(metin) + html.slice(yer);
}

function calistir(kok) {
  const metin = JSON.parse(readFileSync(new URL('../src/i18n/tr.json', import.meta.url), 'utf8'));
  for (const sayfa of [...DAVET_SAYFALARI, ...GECIS_SAYFALARI]) {
    const dosya = path.join(kok, sayfa);
    if (!existsSync(dosya)) {
      console.error(`sayfa yok: ${sayfa}`);
      process.exit(1);
    }
    writeFileSync(dosya, katmanEkle(readFileSync(dosya, 'utf8'), metin));
    console.log(`açılış katmanı: ${sayfa}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const kok = process.argv[2];
  if (!kok) {
    console.error('kullanım: node scripts/web-davet-acilis.mjs <dist>');
    process.exit(1);
  }
  calistir(kok);
}
