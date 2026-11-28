// #643 KK1: davet / paylaşım sayfasının satır içi erken özet betiği.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { BETIK_ID, GLOBAL, SAYFALAR, betikEkle, depoAnahtari, ozetBetigi, supabaseDegerleri } from './web-davet-ozet.mjs';
import { ayristirilabilir } from './web-davet-girisi.mjs';

const URL_ = 'https://ornek.supabase.co';
const ANAHTAR = 'ornek-anahtar';

/** Betiği sahte bir sayfada çalıştırır; atılan istekleri ve global'i döner. */
async function calistir(sayfa, yol, { depo = {}, depoYok = false, yanit = { status: 200, tur: 'application/json', govde: '{"a":1}' }, simdi = Date.now() } = {}) {
  const html = ozetBetigi({ url: URL_, anahtar: ANAHTAR, ...SAYFALAR[sayfa] });
  const kod = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
  const istekler = [];
  const localStorage = depoYok
    ? null
    : { getItem: (k) => (k in depo ? depo[k] : null), setItem: (k, v) => (depo[k] = v), removeItem: (k) => delete depo[k] };
  const window = { localStorage };
  const baglam = {
    window,
    location: { pathname: yol },
    AbortController,
    setTimeout,
    clearTimeout,
    Date: { now: () => simdi },
    fetch: async (adres, secenek) => {
      istekler.push({ adres, ...secenek });
      return { status: yanit.status, headers: { get: () => yanit.tur }, text: async () => yanit.govde };
    },
  };
  vm.runInNewContext(kod, baglam);
  const erken = window[GLOBAL];
  return { istekler, erken, sonuc: erken ? await erken.sonuc : undefined, kod };
}

test('betik eski tarayıcılarda ayrıştırılır (ES2019) ve değerler kaçırılır', () => {
  const html = ozetBetigi({ url: URL_, anahtar: '</script><b>', ...SAYFALAR['r/[token].html'] });
  ayristirilabilir(html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
  assert.equal(html.match(/<\/script>/g).length, 1);
  assert.ok(html.startsWith(`<script id="${BETIK_ID}">`));
});

test('davet: girişsiz, anon anahtarla davet_ozeti bir kez başlar', async () => {
  const { istekler, erken, sonuc } = await calistir('r/[token].html', '/r/Ab3dE5gH');
  assert.equal(istekler.length, 1);
  assert.equal(istekler[0].adres, `${URL_}/rest/v1/rpc/davet_ozeti`);
  assert.equal(istekler[0].method, 'POST');
  assert.equal(istekler[0].body, '{"token":"Ab3dE5gH"}');
  assert.equal(istekler[0].headers.apikey, ANAHTAR);
  assert.equal(istekler[0].headers.Authorization, `Bearer ${ANAHTAR}`);
  assert.equal(erken.rpc, 'davet_ozeti');
  assert.equal(erken.govde, '{"token":"Ab3dE5gH"}');
  assert.equal(erken.yetki, null);
  assert.deepEqual({ ...sonuc }, { durum: 200, tur: 'application/json', metin: '{"a":1}' });
});

test('davet: geçerli oturum varsa onun erişim anahtarıyla; süresi bitmek üzereyse hiç başlamaz', async () => {
  const simdi = 1_800_000_000_000;
  const anahtar = depoAnahtari(URL_);
  assert.equal(anahtar, 'sb-ornek-auth-token');
  const gecerli = { [anahtar]: JSON.stringify({ access_token: 'jwt-1', expires_at: simdi / 1000 + 3600 }) };
  const a = await calistir('r/[token].html', '/r/Ab3dE5gH', { depo: gecerli, simdi });
  assert.equal(a.istekler[0].headers.Authorization, 'Bearer jwt-1');
  assert.equal(a.erken.yetki, 'jwt-1');
  const bitiyor = { [anahtar]: JSON.stringify({ access_token: 'jwt-1', expires_at: simdi / 1000 + 60 }) };
  const b = await calistir('r/[token].html', '/r/Ab3dE5gH', { depo: bitiyor, simdi });
  assert.equal(b.istekler.length, 0);
  assert.equal(b.erken, undefined);
  const bozuk = await calistir('r/[token].html', '/r/Ab3dE5gH', { depo: { [anahtar]: '{bozuk' }, simdi });
  assert.equal(bozuk.istekler.length, 0);
});

test('depolama kapalıysa (uygulama bellek içi oturum kullanır) anon anahtarla', async () => {
  const { istekler, erken } = await calistir('r/[token].html', '/r/Ab3dE5gH', { depoYok: true });
  assert.equal(istekler[0].headers.Authorization, `Bearer ${ANAHTAR}`);
  assert.equal(erken.yetki, null);
});

test('paylaşım: yalnız 24 karakterlik token; kimlikli link ve başka yollar başlamaz', async () => {
  const tk = 'Pq1Rs2Tu3Vw4Xy5Za6Bc7De8';
  const a = await calistir('r/g/[token].html', `/r/g/${tk}`);
  assert.equal(a.istekler[0].adres, `${URL_}/rest/v1/rpc/paylasim_ozeti`);
  assert.equal(a.istekler[0].body, `{"p_token":"${tk}"}`);
  assert.equal((await calistir('r/g/[token].html', '/r/g/11111111-2222-4333-8444-555555555555')).istekler.length, 0);
  assert.equal((await calistir('r/g/[token].html', '/r/g/kisa')).istekler.length, 0);
  assert.equal((await calistir('r/[token].html', `/r/g/${tk}`)).istekler.length, 0);
  assert.equal((await calistir('r/[token].html', '/r/%E0%A4%A')).istekler.length, 0);
});

test('ağ hatası: söz null ile biter (uygulama isteği kendisi atar)', async () => {
  const html = ozetBetigi({ url: URL_, anahtar: ANAHTAR, ...SAYFALAR['r/[token].html'] });
  const window = { localStorage: null };
  vm.runInNewContext(html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''), {
    window,
    location: { pathname: '/r/x' },
    AbortController,
    setTimeout,
    clearTimeout,
    Date,
    fetch: () => Promise.reject(new TypeError('Failed to fetch')),
  });
  assert.equal(await window[GLOBAL].sonuc, null);
});

test('betik <head> başına, karakter kümesi bildiriminden hemen sonra bir kez yazılır', () => {
  const betik = ozetBetigi({ url: URL_, anahtar: ANAHTAR, ...SAYFALAR['r/[token].html'] });
  // expo export çıktısındaki sıra.
  const html = '<!DOCTYPE html><html  lang="tr"><head><title data-rh="true"></title><meta charSet="utf-8"/><meta name="viewport"/></head><body></body></html>';
  const bir = betikEkle(html, betik);
  assert.ok(bir.startsWith(`<!DOCTYPE html><html  lang="tr"><head><title data-rh="true"></title><meta charSet="utf-8"/>${betik}<meta name`));
  assert.ok(bir.indexOf('charSet') < 1024);
  assert.equal(betikEkle(bir, betik), bir);
  assert.ok(betikEkle('<html><head></head></html>', betik).startsWith(`<html><head>${betik}`));
  assert.throws(() => betikEkle('<html></html>', betik), /head/);
});

test('Supabase değerleri ortamdan; yoksa null', () => {
  assert.deepEqual(supabaseDegerleri('/olmayan', { EXPO_PUBLIC_SUPABASE_URL: URL_, EXPO_PUBLIC_SUPABASE_ANON_KEY: ANAHTAR }), { url: URL_, anahtar: ANAHTAR });
  assert.equal(supabaseDegerleri('/olmayan', {}), null);
});
