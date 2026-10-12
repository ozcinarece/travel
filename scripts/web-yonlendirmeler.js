// #137: Expo statik web çıktısındaki dinamik rota sayfalarını ("[token].html") Cloudflare Pages'in yeniden yazabileceği
// köşeli parantezsiz adlara kopyalar ve `_redirects` üretir: "/r/:token /r/_token 200". İstemci (expo-router) rotayı adres
// çubuğundan çözer. Kullanım: node scripts/web-yonlendirmeler.js dist
const fs = require('node:fs');
const path = require('node:path');

const kok = process.argv[2];
if (!kok) {
  console.error('kullanım: node scripts/web-yonlendirmeler.js <dist>');
  process.exit(1);
}

const kurallar = [];
function gez(dizin) {
  for (const ad of fs.readdirSync(dizin)) {
    const tam = path.join(dizin, ad);
    if (fs.statSync(tam).isDirectory()) {
      gez(tam);
      continue;
    }
    if (!ad.endsWith('.html')) continue;
    const goreli = path.relative(kok, tam).split(path.sep).join('/');
    if (!goreli.includes('[')) continue;
    // "seyahat/[id]/(sekmeler)/program.html" → kaynak "/seyahat/:id/program", hedef "/seyahat/_id/program"
    const yolsuz = goreli.replace(/\.html$/, '').replace(/\/index$/, '');
    const gruplarsiz = yolsuz.replace(/\(([^)]+)\)\//g, '');
    const kaynak = '/' + gruplarsiz.replace(/\[([^\]]+)\]/g, ':$1');
    const hedefYol = gruplarsiz.replace(/\[([^\]]+)\]/g, '_$1');
    const hedefDosya = path.join(kok, `${hedefYol}.html`);
    fs.mkdirSync(path.dirname(hedefDosya), { recursive: true });
    fs.copyFileSync(tam, hedefDosya);
    kurallar.push(`${kaynak} /${hedefYol} 200`);
  }
}
gez(kok);
// Seyahat kökü ("/seyahat/:id") statik sayfa üretmez; sekme düzeni Keşfet'le açılır.
if (fs.existsSync(path.join(kok, 'seyahat/_id/kesfet.html'))) kurallar.push('/seyahat/:id /seyahat/_id/kesfet 200');
// Rota grupları "(sekmeler)/program.html" gibi klasörlerde de kalır (aynı kural iki kez) → tekilleştir; en özelden genele.
const tekil = [...new Set(kurallar)].sort((a, b) => b.split('/').length - a.split('/').length);
fs.writeFileSync(path.join(kok, '_redirects'), tekil.join('\n') + '\n');
console.log(`${tekil.length} yönlendirme:\n${tekil.join('\n')}`);
process.exit(0);
