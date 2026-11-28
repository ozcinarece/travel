// #643 KK1: web davet (/r/{token}) ve paylaşım (/r/g/{token}) sayfalarında özet RPC'si sayfa JS'i gelmeden başlar.
// `<head>`'e küçük bir satır içi betik yazılır: token'ı adresten okur, Supabase'e uygulamanın atacağı isteğin aynısını
// (aynı RPC, aynı gövde, aynı yetki) gönderir ve sözünü `window.__tripmateErkenOzet`'e koyar. Uygulama gelince özet sorgusu
// (src/features/davet/sorgular.ts, src/features/paylasim/alici.ts) bu sözü bir kez alır (src/lib/erkenOzet.ts); ikinci
// istek gitmez. Eşleşmezse (başka token, başka oturum, hata, HTML yanıtı) uygulama isteği her zamanki gibi kendisi atar.
// Supabase adresi ve anon (publishable) anahtarı istemci paketine zaten gömülü olan EXPO_PUBLIC_ değerleridir; derleme
// ortamından (ya da Expo'nun okuduğu .env dosyalarından) okunur, repoya yazılmaz.
// Kullanım: node scripts/web-davet-ozet.mjs dist   (web-derle.sh'ta web-davet-girisi.mjs'ten sonra)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BETIK_ID = 'tripmate-erken-ozet';
export const GLOBAL = '__tripmateErkenOzet';
/** src/lib/agFetch.ts `ZAMAN_ASIMI_MS` ile aynı. */
export const ZAMAN_ASIMI_MS = 15_000;
/** auth-js oturumu süresinin bitmesine 90 sn kala yeniler; o aralıkta uygulamanın yetkisi farklı olur, erken istek atılmaz. */
export const YENILEME_PAYI_MS = 120_000;

/** Sayfa → RPC. Desen adresin yolu; token biçimi uygulamanınkiyle aynı (paylaşım: `TOKEN_BICIMI`, kimlikli link hariç). */
export const SAYFALAR = {
  'r/[token].html': { desen: '^/r/([^/]+)/?$', bicim: '^[^/]+$', rpc: 'davet_ozeti', arguman: 'token' },
  'r/g/[token].html': { desen: '^/r/g/([^/]+)/?$', bicim: '^[A-Za-z0-9_-]{24}$', rpc: 'paylasim_ozeti', arguman: 'p_token' },
};

/** supabase-js'in varsayılan oturum anahtarı (`sb-{proje}-auth-token`). */
export function depoAnahtari(url) {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}

const dizgi = (s) => JSON.stringify(s).replace(/</g, '\\u003c');

/**
 * Satır içi betik (Chrome 74 / Safari 14: ES5 sözdizimi). Hata fırlatmaz; bir koşul tutmazsa hiçbir şey yapmaz.
 * Yetki uygulamanınkiyle aynı: depolama kullanılabilir ve geçerli oturum varsa o oturumun erişim anahtarı, yoksa anon
 * anahtar (src/lib/supabase.ts, src/lib/depolama.ts `webDepolama`).
 */
export function ozetBetigi({ url, anahtar, rpc, arguman, desen, bicim }) {
  const kod =
    `(function(){try{` +
    `var m=location.pathname.match(new RegExp(${dizgi(desen)}));if(!m)return;` +
    `var t=decodeURIComponent(m[1]);if(!new RegExp(${dizgi(bicim)}).test(t))return;` +
    `var k=${dizgi(anahtar)},y=k,d=null;` +
    `try{d=window.localStorage;if(d){var s0='gezi-ds-'+Math.random();d.setItem(s0,'1');d.removeItem(s0)}}catch(e){d=null}` +
    `if(d){var h=d.getItem(${dizgi(depoAnahtari(url))});if(h){var o=JSON.parse(h);if(o&&o.currentSession)o=o.currentSession;` +
    `if(!o||!o.access_token||!o.expires_at||o.expires_at*1000-Date.now()<${YENILEME_PAYI_MS})return;y=o.access_token}}` +
    `var a={};a[${dizgi(arguman)}]=t;var g=JSON.stringify(a);` +
    `var c=typeof AbortController==='function'?new AbortController():null;` +
    `var z=c?setTimeout(function(){c.abort()},${ZAMAN_ASIMI_MS}):0;` +
    `var p=fetch(${dizgi(`${url.replace(/\/+$/, '')}/rest/v1/rpc/${rpc}`)},{method:'POST',` +
    `headers:{apikey:k,Authorization:'Bearer '+y,'Content-Type':'application/json'},body:g,signal:c?c.signal:void 0})` +
    `.then(function(r){return r.text().then(function(b){return{durum:r.status,tur:r.headers.get('content-type')||'',metin:b}})})` +
    `.then(function(x){clearTimeout(z);return x},function(){clearTimeout(z);return null});` +
    `window.${GLOBAL}={rpc:${dizgi(rpc)},govde:g,yetki:y===k?null:y,sonuc:p}` +
    `}catch(e){}})();`;
  return `<script id="${BETIK_ID}">${kod}</script>`;
}

/**
 * Betiği `<head>`'in başına, karakter kümesi bildiriminin hemen arkasına yazar (bildirim ilk 1024 baytta kalsın; betik ön
 * yüklemelerden ve paket betiklerinden önce çalışsın); varsa dokunmaz.
 */
export function betikEkle(html, betik) {
  if (html.includes(`id="${BETIK_ID}"`)) return html;
  const bas = html.match(/<head[^>]*>/i);
  if (!bas) throw new Error('<head> bulunamadı');
  const karakter = html.slice(bas.index).match(/<meta\s+charset=["']?utf-8["']?\s*\/?>/i);
  const yer = karakter ? bas.index + karakter.index + karakter[0].length : bas.index + bas[0].length;
  return html.slice(0, yer) + betik + html.slice(yer);
}

/** EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY: önce ortam, yoksa Expo'nun okuduğu .env dosyaları (expo export ile aynı kaynak). */
export function supabaseDegerleri(kok = process.cwd(), ortam = process.env) {
  let dosya = {};
  try {
    const expoEnv = createRequire(createRequire(path.join(kok, 'package.json')).resolve('expo/package.json'))('@expo/env');
    dosya = expoEnv.parseProjectEnv(kok, { mode: 'production', silent: true }).env ?? {};
  } catch {
    dosya = {};
  }
  const url = ortam.EXPO_PUBLIC_SUPABASE_URL || dosya.EXPO_PUBLIC_SUPABASE_URL || '';
  const anahtar = ortam.EXPO_PUBLIC_SUPABASE_ANON_KEY || dosya.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  return url && anahtar ? { url, anahtar } : null;
}

function calistir(dist) {
  const degerler = supabaseDegerleri();
  if (!degerler) {
    console.error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlı değil: erken özet betiği yazılmadı');
    process.exit(1);
  }
  for (const [sayfa, ayar] of Object.entries(SAYFALAR)) {
    const dosya = path.join(dist, sayfa);
    if (!existsSync(dosya)) {
      console.error(`sayfa yok: ${sayfa}`);
      process.exit(1);
    }
    writeFileSync(dosya, betikEkle(readFileSync(dosya, 'utf8'), ozetBetigi({ ...degerler, ...ayar })));
    console.log(`erken özet (${ayar.rpc}): ${sayfa}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = process.argv[2];
  if (!dist) {
    console.error('kullanım: node scripts/web-davet-ozet.mjs <dist>');
    process.exit(1);
  }
  calistir(dist);
}
