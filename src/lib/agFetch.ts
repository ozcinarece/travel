// #293 KK3: takılan bağlantı. Supabase istemcisinin `fetch`'i:
// - 15 sn içinde yanıt gelmezse istek kesilir ve ağ hatası olarak düşer (`TypeError: Network request failed …`;
//   `agHatasi` bunu tanır, şerit çıkar). Dosya yüklemeleri (Storage'a POST/PUT) hariç: yavaş ağda büyük fotoğraf 15 sn'yi
//   meşru olarak aşabilir.
// - Supabase hiçbir zaman HTML döndürmez. HTML ya da (veritabanı ve oturum uçlarında) JSON olmayan bir yanıt, otel
//   Wi-Fi'sinin giriş sayfası gibi araya giren bir ağdır: o da ağ hatası sayılır.

/** İstek başına zaman aşımı. */
export const ZAMAN_ASIMI_MS = 15_000;

type Fetch = typeof fetch;

function agHatasiOlustur(neden: string): TypeError {
  return new TypeError(`Network request failed (${neden})`);
}

function adres(girdi: Parameters<Fetch>[0]): string {
  if (typeof girdi === 'string') return girdi;
  if (girdi instanceof URL) return girdi.href;
  return (girdi as { url?: string }).url ?? '';
}

function yuklemeMi(url: string, yontem: string): boolean {
  return /\/storage\/v1\/object\//.test(url) && (yontem === 'POST' || yontem === 'PUT');
}

/** Yanıt araya giren bir ağdan mı (giriş sayfası)? */
export function arayaGirenYanit(url: string, yanit: Pick<Response, 'headers' | 'status'>): boolean {
  if (yanit.status === 204) return false;
  const tur = (yanit.headers.get('content-type') ?? '').toLowerCase();
  if (tur.includes('text/html')) return true;
  const json = /\/(rest|auth)\/v1\//.test(url);
  return json && tur !== '' && !tur.includes('json');
}

/** `fetch`'i zaman aşımı ve giriş sayfası denetimiyle sarar. */
export function agFetch(temel: Fetch = fetch, zamanAsimiMs: number = ZAMAN_ASIMI_MS): Fetch {
  return async (girdi, secenek) => {
    const url = adres(girdi);
    const yontem = (secenek?.method ?? 'GET').toUpperCase();
    if (yuklemeMi(url, yontem)) return temel(girdi, secenek);

    const denetci = new AbortController();
    const dis = secenek?.signal;
    const disIptal = () => denetci.abort();
    if (dis) {
      if (dis.aborted) denetci.abort();
      else dis.addEventListener('abort', disIptal);
    }
    let asildi = false;
    const zamanlayici = setTimeout(() => {
      asildi = true;
      denetci.abort();
    }, zamanAsimiMs);
    try {
      const yanit = await temel(girdi, { ...secenek, signal: denetci.signal });
      if (arayaGirenYanit(url, yanit)) throw agHatasiOlustur('giriş sayfası');
      return yanit;
    } catch (e) {
      if (asildi) throw agHatasiOlustur('zaman aşımı');
      throw e;
    } finally {
      clearTimeout(zamanlayici);
      dis?.removeEventListener('abort', disIptal);
    }
  };
}
