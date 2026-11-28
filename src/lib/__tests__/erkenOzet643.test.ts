// #643 KK1: HTML'deki betiğin başlattığı özet isteği bir kez ve yalnız eşleşirse kullanılır (web; dosya doğrudan alınır,
// jest native çözümlemesinde `erkenOzet.native.ts` gelirdi).
import { describe, expect, it } from '@jest/globals';

// jest native (ios) çözümlemesiyle `@/lib/erkenOzet` → erkenOzet.native.ts.
import { erkenOzetiAl as nativeErkenOzet } from '../erkenOzet';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ERKEN_OZET, erkenOzetiAl } = require('../erkenOzet.ts') as typeof import('../erkenOzet');

type Yanit = { durum: number; tur: string; metin: string } | null;
const kapsam = (yanit: Yanit, { rpc = 'davet_ozeti', govde = '{"token":"Ab3dE5gH"}', yetki = null as string | null } = {}) =>
  ({ [ERKEN_OZET]: { rpc, govde, yetki, sonuc: Promise.resolve(yanit) } }) as Record<string, unknown>;
const JSON_YANIT = (veri: unknown): Yanit => ({ durum: 200, tur: 'application/json; charset=utf-8', metin: JSON.stringify(veri) });

describe('#643 erken özet', () => {
  it('aynı RPC ve gövde: sonuç bir kez alınır, ikinci çağrı ağa gider', async () => {
    const k = kapsam(JSON_YANIT({ name: 'Test' }));
    await expect(erkenOzetiAl('davet_ozeti', { token: 'Ab3dE5gH' }, undefined, k)).resolves.toEqual({ data: { name: 'Test' } });
    expect(k[ERKEN_OZET]).toBeUndefined();
    await expect(erkenOzetiAl('davet_ozeti', { token: 'Ab3dE5gH' }, undefined, k)).resolves.toBeNull();
  });

  it('bilinmeyen token: sunucunun `null`u veri olarak gelir', async () => {
    await expect(erkenOzetiAl('davet_ozeti', { token: 'Ab3dE5gH' }, undefined, kapsam(JSON_YANIT(null)))).resolves.toEqual({ data: null });
  });

  it('başka RPC ya da başka token: kullanılmaz, dokunulmaz', async () => {
    const k = kapsam(JSON_YANIT({}));
    await expect(erkenOzetiAl('paylasim_ozeti', { p_token: 'Ab3dE5gH' }, undefined, k)).resolves.toBeNull();
    await expect(erkenOzetiAl('davet_ozeti', { token: 'baska' }, undefined, k)).resolves.toBeNull();
    expect(k[ERKEN_OZET]).toBeDefined();
  });

  it('oturuma bağlı RPC: yetki uygulamanınkiyle aynı değilse kullanılmaz', async () => {
    const anon = async () => null;
    const girisli = async () => 'jwt-1';
    await expect(erkenOzetiAl('davet_ozeti', { token: 'Ab3dE5gH' }, girisli, kapsam(JSON_YANIT({ uye: false })))).resolves.toBeNull();
    await expect(erkenOzetiAl('davet_ozeti', { token: 'Ab3dE5gH' }, anon, kapsam(JSON_YANIT({ uye: true }), { yetki: 'jwt-1' }))).resolves.toBeNull();
    await expect(erkenOzetiAl('davet_ozeti', { token: 'Ab3dE5gH' }, girisli, kapsam(JSON_YANIT({ uye: true }), { yetki: 'jwt-1' }))).resolves.toEqual({
      data: { uye: true },
    });
  });

  it('düşen istek, hata durumu, HTML (araya giren ağ) ya da bozuk JSON: istek uygulamadan yeniden atılır', async () => {
    const a = { token: 'Ab3dE5gH' };
    await expect(erkenOzetiAl('davet_ozeti', a, undefined, kapsam(null))).resolves.toBeNull();
    await expect(erkenOzetiAl('davet_ozeti', a, undefined, kapsam({ durum: 500, tur: 'application/json', metin: '{}' }))).resolves.toBeNull();
    await expect(erkenOzetiAl('davet_ozeti', a, undefined, kapsam({ durum: 200, tur: 'text/html', metin: '<html>' }))).resolves.toBeNull();
    await expect(erkenOzetiAl('davet_ozeti', a, undefined, kapsam({ durum: 200, tur: 'application/json', metin: '{bozuk' }))).resolves.toBeNull();
  });

  it('native: hiçbir şey yapmaz', async () => {
    await expect(nativeErkenOzet('davet_ozeti', { token: 'Ab3dE5gH' })).resolves.toBeNull();
  });
});
