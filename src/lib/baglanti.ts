// #243 KK3: bağlantı durumu. NetInfo native bir paket (Ece'nin şartı: native paket yok), bu yüzden durum sorgu sonuçlarından
// çıkarılır: bir sorgu ya da işlem ağ hatasıyla düşerse çevrimdışı; ağdan bir sorgu başarıyla gelirse yeniden çevrimiçi.
// Çevrimdışıyken arada bir (ve uygulama ön plana gelince) profil sorgusu yeniden denenir; başarı gelince bütün etkin sorgular
// içinden Google'a gitmeyen bütün sorgularımız yenilenir (şerit kalkar, plan ve sohbet güncellenir; #293 KK9). Google sorguları
// (Edge Function → Places/Routes, Autocomplete) bağlantı her döndüğünde tekrar gitmesin diye yenilenmez; kendi süreleri dolunca
// yenilenir.
// #293 KK2: zayıf ağda şerit gidip gelmesin. Çevrimdışına geçiş ilk ağ hatasında; çevrimiçine dönüş ya ard arda 2 başarılı
// yanıtla ya da ilk başarıdan sonra 3 sn hiç ağ hatası gelmezse.
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

/** Çevrimdışıyken yeniden deneme aralığı. */
export const YOKLAMA_MS = 20_000;
/** #293 KK2: çevrimiçine dönmek için gereken ard arda başarı sayısı… */
export const DONUS_BASARI = 2;
/** …ya da ilk başarıdan sonra kesintisiz geçmesi gereken süre. */
export const DONUS_MS = 3_000;

/**
 * #293 KK9: Google'a (Edge Function → Places/Routes, Autocomplete) giden sorguların anahtar başları. Bağlantı dönünce bunlar
 * yenilenmez; geri kalan bütün etkin sorgular (bizim tablolarımız, Storage) yenilenir. Google'a giden yeni bir sorgu buraya
 * eklenmeli (`baglanti.test.ts` bilinen anahtarları sınar).
 */
const GOOGLE: readonly (readonly string[])[] = [
  ['tam-yer'],
  ['mekan-ozeti'],
  ['place-foto'],
  ['yorumlar'],
  ['onizleme'],
  ['hafif-yerler'],
  ['yer-foto'],
  ['icerik-canli'],
  ['icerik', 'gezi-rota'],
  ['rota'],
  ['yuruyus'],
  ['sihirbaz-oneri'],
  ['sihirbaz-rehber'],
  ['sihirbaz', 'sehir'],
  // Autocomplete (useOneriler)
  ['mekan-oneri'],
  ['otel-oneri'],
  ['sehir-oneri'],
  ['sohbet-mekan'],
  ['yonetim-mekan'],
  ['yonetim-rehber-mekan'],
  ['yonetim-sehir'],
];

/** Bu sorgu Google'a mı gidiyor? */
export function googleSorgusu(anahtar: QueryKey): boolean {
  return GOOGLE.some((bas) => bas.every((parca, i) => anahtar[i] === parca));
}

let cevrimdisi = false;
const dinleyiciler = new Set<() => void>();

function ayarla(deger: boolean) {
  if (cevrimdisi === deger) return;
  cevrimdisi = deger;
  dinleyiciler.forEach((d) => d());
}

export function cevrimdisiMi(): boolean {
  return cevrimdisi;
}

/** Bileşenler için: bağlantı yokken true. */
export function useCevrimdisi(): boolean {
  return useSyncExternalStore(
    (d) => {
      dinleyiciler.add(d);
      return () => dinleyiciler.delete(d);
    },
    () => cevrimdisi,
  );
}

/**
 * Hata bir ağ hatası mı (sunucuya hiç ulaşılamadı)? Sunucunun döndüğü hatalar (RLS, 4xx/5xx) bağlantı yokluğu sayılmaz.
 * - React Native `fetch`: `TypeError: Network request failed`;
 * - supabase-js (PostgREST) aynı hatayı `{ message: 'TypeError: Network request failed', code: '' }` diye döndürür;
 * - Edge Function çağrısı: `FunctionsFetchError`; oturum yenileme: `AuthRetryableFetchError` (durum kodu yok).
 */
export function agHatasi(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const h = e as { name?: unknown; message?: unknown; code?: unknown; status?: unknown };
  const ad = typeof h.name === 'string' ? h.name : '';
  const mesaj = typeof h.message === 'string' ? h.message : '';
  if (ad === 'FunctionsFetchError') return true;
  if (ad === 'AuthRetryableFetchError') return h.status === 0 || h.status === undefined;
  const agMesaji = /Network request failed|Failed to fetch|Network Error|NetworkError/i.test(mesaj);
  if (e instanceof TypeError) return agMesaji;
  // PostgREST hata nesnesi: sunucu yanıtı olsaydı code dolu olurdu.
  return agMesaji && (h.code === undefined || h.code === '');
}

type Olay = { type: string; action?: { type: string; error?: unknown; manual?: boolean } };

/**
 * Sorgu ve işlem önbelleğini dinler. Dönen fonksiyon dinlemeyi bırakır (testler için).
 * - Bir deneme ağ hatasıyla düşerse (`failed` / `error`, ilk denemede; 3 yeniden denemeyi beklemeden) → çevrimdışı.
 * - Çevrimdışıyken ağdan bir sorgu başarıyla gelirse (`success`, elle `setQueryData` değil) dönüş başlar: ard arda 2. başarıda
 *   ya da 3 sn içinde ağ hatası gelmezse çevrimiçi; etkin sorgular (Google hariç) yenilenir. Arada gelen ağ hatası dönüşü sıfırlar.
 */
export function baglantiyiIzle(qc: QueryClient, secenek: { yoklamaMs?: number; donusMs?: number } = {}): () => void {
  const yoklamaMs = secenek.yoklamaMs ?? YOKLAMA_MS;
  const donusMs = secenek.donusMs ?? DONUS_MS;
  let zamanlayici: ReturnType<typeof setInterval> | null = null;
  const yokla = () => {
    void qc.refetchQueries({ queryKey: ['profil'] });
  };
  const yoklamayiAyarla = () => {
    if (cevrimdisi && !zamanlayici) zamanlayici = setInterval(yokla, yoklamaMs);
    if (!cevrimdisi && zamanlayici) {
      clearInterval(zamanlayici);
      zamanlayici = null;
    }
  };

  let basari = 0;
  let donus: ReturnType<typeof setTimeout> | null = null;
  const donusuBirak = () => {
    basari = 0;
    if (donus) clearTimeout(donus);
    donus = null;
  };
  const cevrimiciOl = () => {
    donusuBirak();
    if (!cevrimdisi) return;
    ayarla(false);
    yoklamayiAyarla();
    void qc.invalidateQueries({ predicate: (q) => !googleSorgusu(q.queryKey), refetchType: 'active' });
  };

  const olay = (o: Olay) => {
    if (o.type !== 'updated' || !o.action) return;
    const a = o.action;
    if ((a.type === 'failed' || a.type === 'error') && agHatasi(a.error)) {
      donusuBirak();
      ayarla(true);
      yoklamayiAyarla();
    } else if (a.type === 'success' && !a.manual && cevrimdisi) {
      basari += 1;
      if (basari >= DONUS_BASARI) cevrimiciOl();
      else if (!donus) donus = setTimeout(cevrimiciOl, donusMs);
    }
  };
  const sorgular = qc.getQueryCache().subscribe((o) => olay(o as Olay));
  const islemler = qc.getMutationCache().subscribe((o) => olay(o as Olay));
  const durum = AppState.addEventListener('change', (s) => {
    if (s === 'active' && cevrimdisi) yokla();
  });
  return () => {
    sorgular();
    islemler();
    durum.remove();
    donusuBirak();
    if (zamanlayici) clearInterval(zamanlayici);
    zamanlayici = null;
  };
}

/** Testler için: durumu sıfırla. */
export function baglantiyiSifirla(): void {
  ayarla(false);
}
