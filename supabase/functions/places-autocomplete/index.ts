// places-autocomplete — PRD 3.2 KK1 / 3.3 KK1 / 3.4 arama kutusu.
// İstemci Autocomplete'i doğrudan çağırmaz; oturum token'ı istemcide üretilir, seçimde
// places-light'a aynı token'la gidilir ve oturum kapanır. Sonuçlar önbelleklenmez.
import { GoogleHatasi, metinAra, otomatikTamamla } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';
import { sayacli } from '../_shared/sayac.ts';

type Istek = {
  input: string;
  sessionToken: string;
  tur?: 'cities' | 'lodging';
  merkez?: { lat: number; lng: number; yaricapM?: number };
  /** Kaç öneri dönsün (3.2 KK1: 3). Üst sınır 5. */
  limit?: number;
  /** #118: Autocomplete boş dönerse Text Search ile (ad + merkez) tek sonuç dene — içerik yerlerinin kimlik çözümü. */
  aramaYedegi?: boolean;
};

Deno.serve(sayacli('places-autocomplete', async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;

  const g = await govde<Istek>(istek);
  const girdi = typeof g.input === 'string' ? g.input.trim() : '';
  const oturum = typeof g.sessionToken === 'string' ? g.sessionToken : '';
  if (girdi.length < 2 || girdi.length > 100) return json({ oneriler: [] });
  // Google Places (New): oturum anahtarı en çok 36 ASCII karakter; daha uzunu 400 INVALID_ARGUMENT (#118 kök nedeni).
  if (!/^[A-Za-z0-9_-]{8,36}$/.test(oturum)) return hata('sessionToken geçersiz (8–36 karakter)');
  const tur = g.tur === 'cities' || g.tur === 'lodging' ? g.tur : undefined;
  const limit = Math.min(Math.max(Number(g.limit) || 3, 1), 5);

  try {
    const oneriler = await otomatikTamamla({ girdi, oturum, tur, merkez: g.merkez });
    if (oneriler.length === 0 && g.aramaYedegi === true && g.merkez) {
      const yer = await metinAra({ metin: girdi, merkez: g.merkez, yaricapM: g.merkez.yaricapM ?? 5000 });
      if (yer) return json({ oneriler: [{ place_id: yer.place_id, ana: yer.ad, ikincil: '', tipler: yer.primary_type ? [yer.primary_type] : [] }], kaynak: 'arama' });
    }
    return json({ oneriler: oneriler.slice(0, limit) });
  } catch (e) {
    if (e instanceof GoogleHatasi) {
      console.error('places-autocomplete google', e.durum, e.message);
      return hata('arama şu an yapılamıyor', 502);
    }
    console.error('places-autocomplete', e);
    return hata('sunucu hatası', 500);
  }
}));
