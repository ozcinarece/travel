// Ekran testleri için sahte Supabase (#181 KK13, #182 KK7): DB sorguları `sahte.tablolar` fikstüründen; PostgREST zinciri taklit
// edilir (her çağrı aynı nesneyi döner, `await` tablonun satırlarını, `.single()` ilk satırı verir). Edge Function çağrıları
// (places-*, route-*, otomatik tamamlama — Google'a giden her şey) ve RPC'ler sayılır. Kullanım:
//   jest.mock('@/lib/supabase', () => jest.requireActual('@/testYardim/sahteSupabase'));
export type Tablolar = Record<string, unknown[]>;

export const sahte = {
  tablolar: {} as Tablolar,
  /** `icerik_mekan_bilgileri` RPC'sinin bildiği yerler: place_id → ad, kategori. */
  icerik: {} as Record<string, { ad: string; kategori: string }>,
  invoke: [] as string[],
  rpc: [] as string[],
  tablo: [] as string[],
};

export function sahteSifirla(tablolar: Tablolar, icerik: Record<string, { ad: string; kategori: string }> = {}) {
  sahte.tablolar = tablolar;
  sahte.icerik = icerik;
  sahte.invoke = [];
  sahte.rpc = [];
  sahte.tablo = [];
}

function sorgu(tablo: string) {
  let tek = false;
  const zincir: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get(_hedef, ad) {
        if (ad === 'then') {
          const satirlar = sahte.tablolar[tablo] ?? [];
          const sonuc = tek ? { data: satirlar[0] ?? null, error: satirlar[0] ? null : { code: 'PGRST116' } } : { data: satirlar, error: null };
          return (coz: (v: unknown) => unknown, red: (e: unknown) => unknown) => Promise.resolve(sonuc).then(coz, red);
        }
        if (ad === 'single' || ad === 'maybeSingle') {
          return () => {
            tek = true;
            return zincir;
          };
        }
        return () => zincir;
      },
    },
  );
  return zincir;
}

export const supabase = {
  from: (tablo: string) => {
    sahte.tablo.push(tablo);
    return sorgu(tablo);
  },
  rpc: async (ad: string, args: { p_place_ids?: string[] }) => {
    sahte.rpc.push(ad);
    if (ad !== 'icerik_mekan_bilgileri') return { data: null, error: { message: `beklenmeyen rpc ${ad}` } };
    const ids = (args.p_place_ids ?? []).filter((id) => sahte.icerik[id]);
    return { data: ids.map((id) => ({ place_id: id, ad: sahte.icerik[id].ad, kategori: sahte.icerik[id].kategori, lat: 39.77, lng: 30.52, kapak_url: null, foto_yol: null })), error: null };
  },
  functions: {
    invoke: async (ad: string) => {
      sahte.invoke.push(ad);
      return { data: null, error: { message: `Google isteği beklenmiyordu: ${ad}` } };
    },
  },
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
  removeChannel: () => undefined,
};
