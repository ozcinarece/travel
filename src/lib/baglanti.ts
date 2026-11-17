// #243 KK3: bağlantı durumu. NetInfo native bir paket (Ece'nin şartı: native paket yok), bu yüzden durum sorgu sonuçlarından
// çıkarılır: bir sorgu ya da işlem ağ hatasıyla düşerse çevrimdışı; ağdan bir sorgu başarıyla gelirse yeniden çevrimiçi.
// Çevrimdışıyken arada bir (ve uygulama ön plana gelince) profil sorgusu yeniden denenir; başarı gelince bütün etkin sorgular
// içinden yalnız bizim tablolarımızdan okunanlar (`saklanabilir`) yenilenir (şerit kalkar, plan güncellenir). Google sorguları
// (Edge Function → Places) bağlantı her döndüğünde tekrar gitmesin diye yenilenmez; kendi süreleri dolunca yenilenir.
import type { QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { saklanabilir } from './kaliciOnbellek';

/** Çevrimdışıyken yeniden deneme aralığı. */
export const YOKLAMA_MS = 20_000;

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
 * - Ağdan bir sorgu başarıyla gelirse (`success`, elle `setQueryData` değil) → çevrimiçi; önceden çevrimdışıysak etkin
 *   sorgular yenilenir.
 */
export function baglantiyiIzle(qc: QueryClient, secenek: { yoklamaMs?: number } = {}): () => void {
  const yoklamaMs = secenek.yoklamaMs ?? YOKLAMA_MS;
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

  const olay = (o: Olay) => {
    if (o.type !== 'updated' || !o.action) return;
    const a = o.action;
    if ((a.type === 'failed' || a.type === 'error') && agHatasi(a.error)) {
      ayarla(true);
      yoklamayiAyarla();
    } else if (a.type === 'success' && !a.manual && cevrimdisi) {
      ayarla(false);
      yoklamayiAyarla();
      void qc.invalidateQueries({ predicate: (q) => saklanabilir(q.queryKey), refetchType: 'active' });
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
    if (zamanlayici) clearInterval(zamanlayici);
    zamanlayici = null;
  };
}

/** Testler için: durumu sıfırla. */
export function baglantiyiSifirla(): void {
  ayarla(false);
}
