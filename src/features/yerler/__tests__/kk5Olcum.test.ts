// #172 KK5: test akışında giden Google istekleri — ekranların kullandığı kancalar, places-light'ın sunucu mantığını taklit eden
// sahte bir uçla (maske → Details isteği, fotoğraf maskesinde + Place Photo isteği, izolat önbelleği) çalıştırılır.
// Aynı akışın değişiklikten önceki sayısı PR açıklamasında (main üzerinde aynı akış). Bu test sonraki sayıyı kilitler.
import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook as rtlRenderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { useIcerikCanli } from '../../icerik/fotolar';
import { useIcerikMekanlari } from '../../icerik/mekanBilgileri';
import { hafifOnbellek, hafifYerler, otomatikTamamla, useHafifYerler, useOnizleme } from '../api';

type Govde = Record<string, unknown>;
/** light = places-light'ın Google istekleri; SKU dağılımı: Enterprise Details · Pro Details · Place Photo. */
type Sayac = { light: number; lightCagri: number; enterprise: number; pro: number; foto: number; tamamlama: number; rpc: number };

/** Sahte uç: places-light (sunucudaki maske ve önbellek kuralları), places-autocomplete, icerik_mekan_bilgileri. */
function sahteUc(secenek: { sicak: boolean; db: Set<string> }) {
  const onbellek = new Set<string>();
  const sayac: Sayac = { light: 0, lightCagri: 0, enterprise: 0, pro: 0, foto: 0, tamamlama: 0, rpc: 0 };
  const invoke = async (ad: string, { body }: { body: Govde }) => {
    if (ad === 'places-light') {
      sayac.lightCagri++;
      const ids = [...new Set(body.ids as string[])];
      if (ids.length > 25) return { data: null, error: new Error('en fazla 25 place_id') };
      const sehir = body.sehir === true;
      const saatler = body.saatler === true && !sehir;
      const foto = body.foto === true && !sehir && ids.length <= 12;
      const ozet = foto && !saatler && body.ozet === true;
      const puansiz = body.puansiz === true && !sehir && !saatler && !ozet;
      const tur = sehir ? 'sehir' : saatler ? (foto ? 'saatlifotolu' : 'saatli') : foto ? (ozet ? 'ozetli' : puansiz ? 'profotolu' : 'fotolu') : puansiz ? 'pro' : 'hafif';
      for (const id of ids) {
        const anahtar = `${tur}:${id}`;
        if (secenek.sicak && onbellek.has(anahtar)) continue;
        onbellek.add(anahtar);
        // Details + (fotoğraflı maskede) Place Photo medya isteği.
        sayac.light += 1 + (foto ? 1 : 0);
        if (sehir || puansiz) sayac.pro++;
        else sayac.enterprise++;
        if (foto) sayac.foto++;
      }
      const yerler = ids.map((id) => ({
        place_id: id,
        ad: `Ad ${id}`,
        lat: 39.77,
        lng: 30.52,
        primary_type: 'museum',
        tz: 'Europe/Istanbul',
        puan: puansiz ? null : 4.5,
        puan_sayisi: puansiz ? null : 900,
        acik: puansiz ? null : true,
        ulke_kodu: null,
        periyotlar: saatler ? [] : undefined,
        foto_uri: foto ? `https://foto/${id}` : undefined,
      }));
      return { data: { yerler }, error: null };
    }
    if (ad === 'places-autocomplete') {
      sayac.tamamlama++;
      const ad = String(body.input).split(',')[0].trim().replace(/\s+/g, '-');
      return { data: { oneriler: [{ place_id: `ChIJ-${ad}`, ana: ad, ikincil: '', tipler: [] }] }, error: null };
    }
    return { data: null, error: new Error(`beklenmeyen uç: ${ad}`) };
  };
  const rpc = async (ad: string, args: { p_place_ids: string[] }) => {
    if (ad !== 'icerik_mekan_bilgileri') return { data: null, error: new Error(`beklenmeyen rpc: ${ad}`) };
    sayac.rpc++;
    // Üretimdeki gibi bizim fotoğrafımız yok (kapak_url / icerik_fotolari boş) — fotoğraf Google'a düşer.
    return { data: args.p_place_ids.filter((id) => secenek.db.has(id)).map((id) => ({ place_id: id, ad: `Bizim ${id}`, kategori: 'museum', lat: 39.77, lng: 30.52, kapak_url: null, foto_yol: null })), error: null };
  };
  return { invoke, rpc, sayac };
}

// Sentry içe aktarılınca zamanlayıcı kurar (jest kapanmaz); iz bırakma bu testte gerekmez.
jest.mock('@/lib/hataRaporu', () => ({ izBirak: () => undefined }));

let mockUc: ReturnType<typeof sahteUc>;
jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (ad: string, s: { body: Govde }) => mockUc.invoke(ad, s) },
    rpc: (ad: string, args: { p_place_ids: string[] }) => mockUc.rpc(ad, args),
  },
}));

// ---------------------------------------------------------------- veri (KK5 akışının varsayımları; PR'da aynı)
const aralik = (on: string, n: number) => Array.from({ length: n }, (_, i) => `${on}${i + 1}`);
/** Eskişehir rehberi: 6 kart + 6 satır içi bağlantı. */
const REHBER_KART = aralik('ChIJ-rehber-k', 6);
const REHBER_HEPSI = [...REHBER_KART, ...aralik('ChIJ-rehber-s', 6)];
/** Eskişehir gezisi: 11 durak (place_id DB'de boş → otomatik tamamlamayla çözülür), yazıda 4 kart + 2 bağlantı (3'ü durak). */
const DURAKLAR = aralik('Durak-', 11).map((ad, i) => ({ id: `d${i + 1}`, place_id: null, ad, lat: 39.77, lng: 30.52, kapak_url: null }));
const GEZI_KART = ['ChIJ-Durak-2', 'ChIJ-Durak-5', 'ChIJ-gezi-k1', 'ChIJ-gezi-k2'];
const GEZI_HEPSI = [...GEZI_KART, 'ChIJ-Durak-7', 'ChIJ-gezi-s1'];
/** Seyahat: Listem'de 7 mekan; rehberden ve geziden 3 mekan eklenir (birer birer). */
const LISTE_7 = aralik('ChIJ-liste-', 7);
const EKLENEN = ['ChIJ-rehber-k1', 'ChIJ-rehber-k2', 'ChIJ-Durak-3'];
/** Program: odak kart ve iki yanı (fotoğraf). */
const PROGRAM_KARTLARI = ['ChIJ-liste-1', 'ChIJ-liste-2', 'ChIJ-rehber-k1'];
/** BO: düzenlenen bölümde 3 kart; 2 kart eklenir (her biri bir otomatik tamamlama seçimi); önizleme tüm sayfa. */
const BO_KARTLAR = REHBER_KART.slice(0, 3);
const BO_YENI = ['ChIJ-yeni-1', 'ChIJ-yeni-2'];
const DB = new Set([...REHBER_HEPSI, ...GEZI_HEPSI]);

/** Açılan kanca ağaçları; akış sonunda sökülür (açık gözlemci jest'i kapatmaz). */
const acik: { unmount: () => void }[] = [];
const renderHook = ((...args: Parameters<typeof rtlRenderHook>) => {
  const r = rtlRenderHook(...args);
  acik.push(r);
  return r;
}) as typeof rtlRenderHook;

const istemci = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const sarmal = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
  return { qc, sarmal };
};
const bitti = async (...qcs: QueryClient[]) => {
  await waitFor(() => expect(qcs.every((q) => q.isFetching() === 0)).toBe(true));
  await new Promise((r) => setTimeout(r, 5));
  await waitFor(() => expect(qcs.every((q) => q.isFetching() === 0)).toBe(true));
};

/** Akış (sonraki kod): her adımdan sonra sayaçların anlık görüntüsü. */
async function akis(sicak: boolean) {
  mockUc = sahteUc({ sicak, db: DB });
  const adimlar: Record<string, Sayac> = {};
  const al = (ad: string) => (adimlar[ad] = { ...mockUc.sayac });
  hafifOnbellek.temizle();
  const uygulama = istemci();
  // 1 · Eskişehir rehberi (SehirRehberi).
  renderHook(() => useIcerikMekanlari(REHBER_HEPSI, { kartlar: REHBER_KART }), { wrapper: uygulama.sarmal });
  await bitti(uygulama.qc);
  al('rehber');
  // 2 · Eskişehir gezisi (gezi/[slug]: durak satırları + yazı).
  renderHook(
    () => {
      useIcerikCanli(DURAKLAR, () => 'Eskişehir', true);
      useIcerikMekanlari(GEZI_HEPSI, { kartlar: GEZI_KART });
    },
    { wrapper: uygulama.sarmal },
  );
  await bitti(uygulama.qc);
  al('gezi');
  // 3 · Listem (açık) — 3 mekan birer birer eklenir.
  const liste = renderHook(({ ids }: { ids: string[] }) => useHafifYerler(ids, { puan: true, saatler: true, foto: true }), {
    wrapper: uygulama.sarmal,
    initialProps: { ids: LISTE_7 },
  });
  await bitti(uygulama.qc);
  for (let i = 1; i <= EKLENEN.length; i++) {
    liste.rerender({ ids: [...LISTE_7, ...EKLENEN.slice(0, i)] });
    await bitti(uygulama.qc);
  }
  al('listem');
  // 4 · Program (saatli liste + kart fotoğrafları).
  renderHook(
    () => {
      useHafifYerler([...LISTE_7, ...EKLENEN], { puan: true, saatler: true });
      // DurakKartlari: odak kart ve iki yanı.
      useOnizleme(PROGRAM_KARTLARI[0]);
      useOnizleme(PROGRAM_KARTLARI[1]);
      useOnizleme(PROGRAM_KARTLARI[2]);
    },
    { wrapper: uygulama.sarmal },
  );
  await bitti(uygulama.qc);
  al('program');
  // 5 · BO rehber editörü (ayrı cihaz/oturum): editör kartları + önizleme (kendi sorgu istemcisi); 2 kart eklenir.
  // Ayrı cihaz (BO, web): istemci önbelleği boş; sunucu aynı.
  hafifOnbellek.temizle();
  const editor = istemci();
  const onizleme = istemci();
  const bilinen: Record<string, { ad: string; kategori: string | null; lat: number; lng: number }> = {};
  const ed = renderHook(({ k }: { k: string[] }) => useIcerikMekanlari(k, { kartlar: k, bilinen }), { wrapper: editor.sarmal, initialProps: { k: BO_KARTLAR } });
  const on = renderHook(({ r, k }: { r: string[]; k: string[] }) => useIcerikMekanlari(r, { kartlar: k, bilinen }), {
    wrapper: onizleme.sarmal,
    initialProps: { r: REHBER_HEPSI, k: REHBER_KART },
  });
  await bitti(editor.qc, onizleme.qc);
  for (let i = 1; i <= BO_YENI.length; i++) {
    const id = BO_YENI[i - 1];
    // MekanEkleKutusu: otomatik tamamlama + seçim (Pro maske, oturumu kapatır); taslağın bildiği mekanlara girer.
    await otomatikTamamla({ girdi: id, oturum: 'oturum-jetonu-123' });
    const [yer] = await hafifYerler([id], { oturum: 'oturum-jetonu-123', puansiz: true });
    hafifOnbellek.yaz([yer], 'pro');
    bilinen[id] = { ad: yer.ad, kategori: yer.primary_type, lat: yer.lat, lng: yer.lng };
    const yeniKartlar = [...BO_KARTLAR, ...BO_YENI.slice(0, i)];
    ed.rerender({ k: yeniKartlar });
    on.rerender({ r: [...REHBER_HEPSI, ...BO_YENI.slice(0, i)], k: [...REHBER_KART, ...BO_YENI.slice(0, i)] });
    await bitti(editor.qc, onizleme.qc);
  }
  al('bo');
  // Önce ağaçlar sökülür, sonra sorgular atılır (24 sa gcTime zamanlayıcıları da gider; jest temiz çıkar).
  for (const r of acik.splice(0)) r.unmount();
  for (const q of [uygulama.qc, editor.qc, onizleme.qc]) q.clear();
  return adimlar;
}

const fark = (a: Record<string, Sayac>) => {
  const sira = ['rehber', 'gezi', 'listem', 'program', 'bo'];
  return Object.fromEntries(sira.map((ad, i) => [ad, a[ad].light - (i ? a[sira[i - 1]].light : 0)]));
};

describe('#172 KK5: test akışında places-light Google istekleri (sonra)', () => {
  it('soğuk sunucu (izolat önbelleği yok — üretimdeki 13 Ekim oranı: istenen kimlik ≈ Google isteği)', async () => {
    const a = await akis(false);
    if (process.env.KK5_YAZ) console.log('KK5 soğuk', JSON.stringify({ adim: fark(a), toplam: a.bo }));
    // Rehber ve gezi açılışında ad / kategori / konum için places-light yok (KK7); yalnız kart fotoğrafı (KK8).
    expect(fark(a)).toEqual({ rehber: 12, gezi: 26, listem: 17, program: 0, bo: 18 });
    // Önce (main, aynı akış): 339 istek — rehber 36 · gezi 40 · Listem 102 · Program 6 · BO 155.
    expect(a.bo.light).toBe(73);
  }, 60_000);
  it('sıcak sunucu (tek izolat, 24 sa önbellek)', async () => {
    const a = await akis(true);
    if (process.env.KK5_YAZ) console.log('KK5 sıcak', JSON.stringify({ adim: fark(a), toplam: a.bo }));
    // Önce (main, aynı akış): 100 istek.
    expect(a.bo.light).toBe(61);
  }, 60_000);
});
