#!/usr/bin/env bash
# #550: uygulamanın web çıktısı. İki derleme:
#   1. uygulamanın tamamı (rota kökü src/app),
#   2. web davet girişi: yalnız /r/{token} ve /r/g/{token} (WEB_GIRIS=davet → rota kökü src/davet-web; app.config.ts).
# Sonra küçük giriş dist'e katılır (iki girişin de JS'i Chrome 74 / Safari 14 için düşürülür), davet sayfalarına açılış katmanı yazılır
# (#549) ve dinamik rotalar `_redirects` ile kopyalanır (#137). web-yayin ve uçtan uca testler (e2e/) bunu kullanır.
# Kullanım: bash scripts/web-derle.sh [dist]
set -euo pipefail
cikti="${1:-dist}"
davet="${cikti}-davet"
rm -rf "$cikti" "$davet"
npx expo export --platform web --output-dir "$cikti"
WEB_GIRIS=davet npx expo export --platform web --output-dir "$davet"
test -f "$cikti/index.html"
test -f "$cikti/r/[token].html"
node scripts/web-davet-girisi.mjs "$cikti" "$davet"
# #549: davet sayfaları JS gelmeden de açılış halini (kanvas 3e) gösterir; kopyalardan önce yazılır. #550: tam uygulamaya
# geçiş sayfaları (/giris, /, /seyahat/{id}/gezi) da aynı katmanı alır: yeniden yüklemede boş sayfa yok.
node scripts/web-davet-acilis.mjs "$cikti"
# #643 KK1: davet ve paylaşım sayfalarında özet RPC'si sayfa JS'i gelmeden, HTML'deki satır içi betikle başlar.
node scripts/web-davet-ozet.mjs "$cikti"
# Dinamik rotalar: "[x]" sayfaları köşeli parantezsiz kopyalanır, Pages yeniden yazar (istemci rotayı adres çubuğundan çözer).
node scripts/web-yonlendirmeler.js "$cikti"
rm -rf "$davet"
# #542: Cloudflare Pages `node_modules` klasörlerini yüklemez; varlıklar `assets/nm/...`'ye taşınır, adresler yeniden yazılır.
node scripts/web-node-modules.mjs "$cikti"
