// #550: uçtan uca testler ve ölçüm için Supabase taklidi (gerçek veri yok; sentetik "Test · davet-550" seyahati).
// Web çıktısı `EXPO_PUBLIC_SUPABASE_URL=https://ornek.supabase.co` ile derlenir; o adrese giden her istek burada yanıtlanır.
import type { Page, Route } from '@playwright/test';

export const SUPABASE = 'https://ornek.supabase.co';
export const DEPO_ANAHTARI = 'sb-ornek-auth-token';
export const DAVET_TOKENI = 'Ab3dE5gH';
export const PAYLASIM_TOKENI = 'Pq1Rs2Tu3Vw4Xy5Za6Bc7De8';
export const PAYLASIM_HARITALI = 'Hr1Hr2Hr3Hr4Hr5Hr6Hr7Hr8';
export const SEYAHAT = '11111111-2222-4333-8444-555555555555';
export const YENI_SEYAHAT = '66666666-7777-4888-8999-000000000000';
const KULLANICI = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

export const DAVET_OZETI = {
  trip_id: SEYAHAT,
  name: 'Test · davet-550',
  city_label: 'Eskişehir',
  start_date: '2026-12-12',
  end_date: '2026-12-13',
  member_count: 2,
  place_count: 3,
  day_count: 2,
  inviter_name: 'Deneme',
  inviter_photo: null,
  uye: false,
  gunler: [
    { index: 1, date: '2026-12-12', durak: 2 },
    { index: 2, date: '2026-12-13', durak: 1 },
  ],
};

export const PAYLASIM_OZETI = {
  kapali: false,
  id: SEYAHAT,
  paylasan: 'Deneme',
  ad: 'Test · paylaşım-550',
  sehir: 'Eskişehir',
  gun_sayisi: 2,
  durak_sayisi: 3,
  kisi_sayisi: 2,
  kisi_kip: 'gezdi',
  gunler: [
    { gun: 1, duraklar: [{ ad: null, tur: 'museum', dakika: 60, lat: null, lng: null }, { ad: null, tur: 'cafe', dakika: 30, lat: null, lng: null }] },
    { gun: 2, duraklar: [{ ad: null, tur: 'park', dakika: 45, lat: null, lng: null }] },
  ],
};

const base64url = (s: string) => btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** Sahte oturum (imzasız JWT; taklit sunucu doğrulamaz). */
export function oturum() {
  const simdi = Math.floor(Date.now() / 1000);
  const jwt = [base64url('{"alg":"HS256","typ":"JWT"}'), base64url(JSON.stringify({ sub: KULLANICI, role: 'authenticated', aud: 'authenticated', exp: simdi + 3600 })), 'imza'].join('.');
  return {
    access_token: jwt,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: simdi + 3600,
    refresh_token: 'yenileme',
    user: {
      id: KULLANICI,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'test@ornek.test',
      app_metadata: { provider: 'google' },
      user_metadata: { full_name: 'Test Kişi' },
      is_anonymous: false,
      created_at: '2026-11-01T00:00:00Z',
    },
  };
}

const PROFIL = { id: KULLANICI, name: 'Test Kişi', username: 'testkisi', photo_url: null, map_visibility: 'arkadaslar', onboarding_done_at: '2026-11-01T00:00:00Z', created_at: '2026-11-01T00:00:00Z' };

export type Cagri = { yol: string; govde: unknown };
type Yanit = { status: number; headers: Record<string, string>; body: string };

const CORS = { 'access-control-allow-origin': '*' };
const json = (govde: unknown, status = 200): Yanit => ({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(govde) });

/** Bir Supabase isteğinin taklit yanıtı (page.route ve CDP Fetch ortak). */
function yanitla(yontem: string, adres: string, basliklar: Record<string, string>, govde: unknown): Yanit {
  const url = new URL(adres);
  const yol = url.pathname;
  if (yontem === 'OPTIONS') return { status: 204, headers: { ...CORS, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: '' };
  // Google girişi: sağlayıcıya gitmeden ?code= ile uygulamaya döner (PKCE).
  if (yol === '/auth/v1/authorize') {
    const donus = url.searchParams.get('redirect_to') ?? '/';
    return { status: 302, headers: { location: `${donus}${donus.includes('?') ? '&' : '?'}code=taklit-kod` }, body: '' };
  }
  if (yol === '/auth/v1/token') return json(oturum());
  if (yol === '/auth/v1/user') return json(oturum().user);
  if (yol.startsWith('/auth/v1/')) return json({});

  switch (yol) {
    case '/rest/v1/rpc/davet_ozeti':
      return json((govde as { token?: string })?.token === DAVET_TOKENI ? DAVET_OZETI : null);
    case '/rest/v1/rpc/davetle_katil':
      return json({ trip_id: SEYAHAT, zaten_uye: false, name: DAVET_OZETI.name, city_label: 'Eskişehir', inviter_name: 'Deneme', day_count: 2, place_count: 3 });
    case '/rest/v1/rpc/paylasim_ozeti': {
      const tk = (govde as { p_token?: string })?.p_token;
      // Haritalı paylaşım: sentetik koordinatlar (şehir merkezi civarı, Google verisi değil).
      if (tk === PAYLASIM_HARITALI)
        return json({ ...PAYLASIM_OZETI, gunler: [{ gun: 1, duraklar: [{ ad: null, tur: 'park', dakika: 30, lat: 39.77, lng: 30.52 }, { ad: null, tur: 'cafe', dakika: 30, lat: 39.78, lng: 30.51 }] }] });
      return json(tk === PAYLASIM_TOKENI ? PAYLASIM_OZETI : null);
    }
    case '/rest/v1/rpc/paylasim_harita_izni':
      return json(true);
    case '/rest/v1/rpc/paylasimdan_al':
      return json(YENI_SEYAHAT);
    case '/rest/v1/profiles': {
      const tek = (basliklar['accept'] ?? '').includes('vnd.pgrst.object');
      return json(tek ? PROFIL : [PROFIL]);
    }
    case '/rest/v1/olaylar':
      return { status: 201, headers: CORS, body: '' };
  }
  if (yol.startsWith('/rest/v1/rpc/')) return json(null);
  if (yol.startsWith('/rest/v1/')) return json(yontem === 'GET' ? [] : null);
  if (yol.startsWith('/functions/v1/')) return json({});
  return json({}, 404);
}

const govdeOku = (ham: string | null | undefined): unknown => {
  if (!ham) return null;
  try {
    return JSON.parse(ham);
  } catch {
    return ham;
  }
};

/** Supabase isteklerini yanıtlar; yapılan çağrıları döndürür. `gecikmeMs` yanıtı bekletir (ölçüm). */
export async function supabaseTaklidi(page: Page, { gecikmeMs = 0 }: { gecikmeMs?: number } = {}): Promise<Cagri[]> {
  const cagrilar: Cagri[] = [];
  await page.route(`${SUPABASE}/**`, async (route: Route) => {
    const istek = route.request();
    const govde = govdeOku(istek.postData());
    if (istek.method() !== 'OPTIONS') cagrilar.push({ yol: new URL(istek.url()).pathname + new URL(istek.url()).search, govde });
    if (gecikmeMs && istek.method() !== 'OPTIONS') await new Promise((r) => setTimeout(r, gecikmeMs));
    const y = yanitla(istek.method(), istek.url(), istek.headers(), govde);
    return route.fulfill({ status: y.status, headers: y.headers, body: y.body });
  });
  return cagrilar;
}

/**
 * Aynı taklit, Playwright yönlendirmesi yerine CDP Fetch ile. `page.route` tarayıcının HTTP önbelleğini kapatır; önden
 * indirmenin (prefetch) etkisini ölçmek için önbellek açık kalmalı (e2e/olcum.spec.ts).
 */
export async function supabaseTaklidiCdp(page: Page, { gecikmeMs = 0 }: { gecikmeMs?: number } = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: `${SUPABASE}/*`, requestStage: 'Request' }] });
  cdp.on('Fetch.requestPaused', async (e) => {
    if (gecikmeMs && e.request.method !== 'OPTIONS') await new Promise((r) => setTimeout(r, gecikmeMs));
    const y = yanitla(e.request.method, e.request.url, Object.fromEntries(Object.entries(e.request.headers).map(([a, d]) => [a.toLowerCase(), String(d)])), govdeOku(e.request.postData));
    await cdp
      .send('Fetch.fulfillRequest', {
        requestId: e.requestId,
        responseCode: y.status,
        responseHeaders: Object.entries(y.headers).map(([name, value]) => ({ name, value })),
        body: btoa(String.fromCharCode(...new TextEncoder().encode(y.body))),
      })
      .catch(() => undefined);
  });
  return cdp;
}
