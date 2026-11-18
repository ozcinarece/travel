// #293 KK1 (şeritte tarih), KK3 (takılan bağlantı), KK8 (7 gün, sorgu başına).
import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';

import { seritBasligi } from '@/components/gezi/CevrimdisiSeridi';

import { agFetch, arayaGirenYanit, YUKLEME_ZAMAN_ASIMI_MS, yuklemeMi, ZAMAN_ASIMI_MS } from '../agFetch';
import { agHatasi } from '../baglanti';
import { cihazaYazilsinMi, ONBELLEK_OMRU_MS } from '../kaliciOnbellek';
import { guncellemeGunu } from '../zaman';

describe('KK1: şeritte tarih (trips.tz ile)', () => {
  const tz = 'Europe/Istanbul';
  // 17 Kas 2026 10:00 İstanbul = 07:00 UTC.
  const an = new Date('2026-11-17T07:00:00Z');

  it('bugünse yalnız saat', () => {
    expect(seritBasligi(Date.parse('2026-11-17T05:12:00Z'), tz, an)).toBe('Çevrimdışı · son güncelleme 08:12');
  });
  it('dünse "dün 22:40"', () => {
    expect(seritBasligi(Date.parse('2026-11-16T19:40:00Z'), tz, an)).toBe('Çevrimdışı · son güncelleme dün 22:40');
  });
  it('daha eskiyse "16 Kas 22:40" biçimi', () => {
    expect(seritBasligi(Date.parse('2026-11-14T19:40:00Z'), tz, an)).toBe('Çevrimdışı · son güncelleme 14 Kas 22:40');
  });
  it('gün cihazın değil seyahatin diliminde hesaplanır', () => {
    // 16 Kas 22:30 UTC: İstanbul'da 17 Kas 01:30 (bugün), New York'ta 16 Kas 17:30 (dün değil; New York'ta "an" 17 Kas 02:00).
    const o = new Date('2026-11-16T22:30:00Z');
    expect(guncellemeGunu(o, an, tz)).toMatchObject({ tur: 'bugun', saat: '01:30' });
    expect(guncellemeGunu(o, an, 'America/New_York')).toMatchObject({ tur: 'dun', saat: '17:30' });
  });
  it('bilinmiyorsa saatsiz başlık', () => {
    expect(seritBasligi(0, tz, an)).toBe('Çevrimdışı');
  });
});

describe('KK3: takılan bağlantı', () => {
  const REST = 'https://x.supabase.co/rest/v1/trips?select=*';

  it('15 sn içinde yanıt gelmezse istek kesilir ve ağ hatası sayılır', async () => {
    jest.useFakeTimers();
    try {
      let sinyal: AbortSignal | undefined;
      const takilan = jest.fn((_g: unknown, s?: RequestInit) => {
        sinyal = s?.signal ?? undefined;
        return new Promise<Response>((_, reddet) => s?.signal?.addEventListener('abort', () => reddet(Object.assign(new Error('Aborted'), { name: 'AbortError' }))));
      });
      const f = agFetch(takilan as unknown as typeof fetch, 15_000);
      const sonuc = f(REST).then(
        () => null,
        (e: unknown) => e,
      );
      jest.advanceTimersByTime(14_999);
      expect(sinyal?.aborted).toBe(false);
      jest.advanceTimersByTime(1);
      const hata = await sonuc;
      expect(sinyal?.aborted).toBe(true);
      expect(hata).toBeInstanceOf(TypeError);
      expect(agHatasi(hata)).toBe(true);
      // supabase-js (PostgREST) hatayı "TypeError: <mesaj>" diye, code boş döndürür; o da ağ hatası.
      expect(agHatasi({ message: `TypeError: ${(hata as Error).message}`, code: '' })).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('JSON olmayan yanıt (otel Wi-Fi giriş sayfası) ağ hatası sayılır', async () => {
    const portal = jest.fn(async () => new Response('<html>Giriş</html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }));
    const f = agFetch(portal as unknown as typeof fetch);
    const hata = await f(REST).then(
      () => null,
      (e: unknown) => e,
    );
    expect(agHatasi(hata)).toBe(true);
    // Veritabanı ucunda düz metin de giriş sayfası sayılır.
    expect(arayaGirenYanit(REST, new Response('ok', { headers: { 'content-type': 'text/plain' } }))).toBe(true);
  });

  it('normal yanıtlar geçer: JSON, 204, Storage dosyası', () => {
    expect(arayaGirenYanit(REST, new Response('[]', { headers: { 'content-type': 'application/json; charset=utf-8' } }))).toBe(false);
    expect(arayaGirenYanit(REST, new Response(null, { status: 204 }))).toBe(false);
    expect(arayaGirenYanit('https://x.supabase.co/storage/v1/object/sign/fisler/a.jpg', new Response('x', { headers: { 'content-type': 'image/jpeg' } }))).toBe(false);
  });

  /** Yanıt vermeyen bir ağ: istek yalnız iptal edilince düşer. */
  function takilanAg() {
    let sinyal: AbortSignal | undefined;
    const temel = jest.fn((_g: unknown, s?: RequestInit) => {
      sinyal = s?.signal ?? undefined;
      return new Promise<Response>((_, reddet) => s?.signal?.addEventListener('abort', () => reddet(Object.assign(new Error('Aborted'), { name: 'AbortError' }))));
    });
    return { temel: temel as unknown as typeof fetch, iptal: () => sinyal?.aborted };
  }

  it('yükleme sayılan istekler: yalnız dosya gövdesi giden POST/PUT; imzalı URL, liste, taşıma, kopya, bilgi değil', () => {
    const S = 'https://x.supabase.co/storage/v1/object';
    expect(yuklemeMi(`${S}/sohbet/t1/a.jpg`, 'POST')).toBe(true);
    expect(yuklemeMi(`${S}/profil/u1.jpg`, 'PUT')).toBe(true);
    for (const yol of ['sign/fisler/t1/a.jpg', 'sign/sohbet', 'list/fisler', 'move', 'copy', 'info/fisler/a.jpg']) expect(yuklemeMi(`${S}/${yol}`, 'POST')).toBe(false);
    expect(yuklemeMi(`${S}/sohbet/t1/a.jpg`, 'GET')).toBe(false);
  });

  it('imzalı URL isteği (POST /object/sign/…) 15 sn\'de kesilir', async () => {
    jest.useFakeTimers();
    try {
      const ag = takilanAg();
      const sonuc = agFetch(ag.temel)('https://x.supabase.co/storage/v1/object/sign/fisler/t1/a.jpg', { method: 'POST', body: '{"expiresIn":3600}' }).then(
        () => null,
        (e: unknown) => e,
      );
      jest.advanceTimersByTime(ZAMAN_ASIMI_MS - 1);
      expect(ag.iptal()).toBe(false);
      jest.advanceTimersByTime(1);
      expect(agHatasi(await sonuc)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('dosya yüklemesi 15 sn\'de kesilmez, 90 sn\'de kesilir ve ağ hatası sayılır', async () => {
    jest.useFakeTimers();
    try {
      const ag = takilanAg();
      const sonuc = agFetch(ag.temel)('https://x.supabase.co/storage/v1/object/fisler/t1/a.jpg', { method: 'POST', body: 'x' }).then(
        () => null,
        (e: unknown) => e,
      );
      jest.advanceTimersByTime(ZAMAN_ASIMI_MS);
      expect(ag.iptal()).toBe(false);
      jest.advanceTimersByTime(YUKLEME_ZAMAN_ASIMI_MS - ZAMAN_ASIMI_MS - 1);
      expect(ag.iptal()).toBe(false);
      jest.advanceTimersByTime(1);
      expect(ag.iptal()).toBe(true);
      expect(agHatasi(await sonuc)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('çağıranın iptali iletilir (zaman aşımı sayılmaz); sunucu hatası (4xx) geçer', async () => {
    const dis = new AbortController();
    const bekleyen = jest.fn((_g: unknown, s?: RequestInit) => new Promise<Response>((_, reddet) => s?.signal?.addEventListener('abort', () => reddet(Object.assign(new Error('Aborted'), { name: 'AbortError' })))));
    const sonuc = agFetch(bekleyen as unknown as typeof fetch)(REST, { signal: dis.signal }).then(
      () => null,
      (e: unknown) => e,
    );
    dis.abort();
    const hata = (await sonuc) as Error;
    expect(hata.name).toBe('AbortError');
    expect(agHatasi(hata)).toBe(false);

    const yasak = jest.fn(async () => new Response('{"code":"42501"}', { status: 403, headers: { 'content-type': 'application/json' } }));
    expect((await agFetch(yasak as unknown as typeof fetch)(REST)).status).toBe(403);
  });
});

describe('KK8: cihaza yalnız son 7 gün içinde sunucudan gelen sorgular yazılır', () => {
  it('dataUpdatedAt 7 günü aşan izinli sorgu yazılmaz', () => {
    const qc = new QueryClient();
    const an = Date.now();
    qc.setQueryData(['mekanlar', 't1'], [{ place_id: 'p' }], { updatedAt: an - ONBELLEK_OMRU_MS - 1 });
    qc.setQueryData(['duraklar', 't1'], [], { updatedAt: an - ONBELLEK_OMRU_MS + 60_000 });
    const sorgu = (k: string[]) => qc.getQueryCache().find({ queryKey: k, exact: true })!;
    expect(cihazaYazilsinMi(sorgu(['mekanlar', 't1']), an)).toBe(false);
    expect(cihazaYazilsinMi(sorgu(['duraklar', 't1']), an)).toBe(true);
    qc.clear();
  });
});
