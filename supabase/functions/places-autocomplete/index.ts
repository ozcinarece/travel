// places-autocomplete — PRD 3.2 KK1 / 3.3 KK1 / 3.4 arama kutusu.
// İstemci Autocomplete'i doğrudan çağırmaz; oturum token'ı istemcide üretilir, seçimde
// places-light'a aynı token'la gidilir ve oturum kapanır. Sonuçlar önbelleklenmez.
import { GoogleHatasi, otomatikTamamla } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';

type Istek = {
  input: string;
  sessionToken: string;
  tur?: 'cities' | 'lodging';
  merkez?: { lat: number; lng: number; yaricapM?: number };
  /** Kaç öneri dönsün (3.2 KK1: 3). Üst sınır 5. */
  limit?: number;
};

Deno.serve(async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;

  const g = await govde<Istek>(istek);
  const girdi = typeof g.input === 'string' ? g.input.trim() : '';
  const oturum = typeof g.sessionToken === 'string' ? g.sessionToken : '';
  if (girdi.length < 2 || girdi.length > 100) return json({ oneriler: [] });
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(oturum)) return hata('sessionToken geçersiz');
  const tur = g.tur === 'cities' || g.tur === 'lodging' ? g.tur : undefined;
  const limit = Math.min(Math.max(Number(g.limit) || 3, 1), 5);

  try {
    const oneriler = await otomatikTamamla({ girdi, oturum, tur, merkez: g.merkez });
    return json({ oneriler: oneriler.slice(0, limit) });
  } catch (e) {
    if (e instanceof GoogleHatasi) {
      console.error('places-autocomplete google', e.durum, e.message);
      return hata('arama şu an yapılamıyor', 502);
    }
    console.error('places-autocomplete', e);
    return hata('sunucu hatası', 500);
  }
});
