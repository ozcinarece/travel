// #276 2b · KK3 · KK-ek4: Keşfet durumu (şerit / gezi bitti) ve şeritteki Sıradaki adım metni.
import { describe, expect, it, jest } from '@jest/globals';

import { kesfetDurumu, seritAdimMetni } from '@/features/anasayfa/serit';
import { siniflandir } from '@/features/seyahatler/siniflandir';
import type { Gun, SeyahatOzet } from '@/lib/tipler';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const AN = new Date('2026-11-17T09:00:00Z');
const gun = (n: number) => new Date(Date.parse('2026-11-17T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
const sy = (id: string, start: string | null, end: string | null): SeyahatOzet => ({
  id,
  name: null,
  city_label: id,
  start_date: start,
  end_date: end,
  tz: 'Europe/Istanbul',
  hotel_place_id: null,
  created_at: '2026-01-01T00:00:00Z',
  members: [],
  places: [{ count: 0 }],
});
const durum = (liste: SeyahatOzet[], kart: boolean) => kesfetDurumu(siniflandir(liste, AN), kart);

describe('kesfetDurumu', () => {
  it('öncelik: aktif > yaklaşan > yeniBiten (kart varsa) > planlanan', () => {
    const aktif = sy('aktif', gun(-1), gun(1));
    const yakin = sy('yakin', gun(3), gun(5));
    const biten = sy('biten', gun(-4), gun(-2));
    const taslak = sy('taslak', null, null);
    expect(durum([taslak, biten, yakin, aktif], true)).toEqual({ tur: 'serit', seyahat: aktif, sinif: 'aktif' });
    expect(durum([taslak, biten, yakin], true)).toEqual({ tur: 'serit', seyahat: yakin, sinif: 'yaklasan' });
    expect(durum([taslak, biten], true)).toEqual({ tur: 'geziBitti', seyahat: biten });
  });

  it('KK-ek4: yeni biten seyahatte kart yoksa planlanan şeridine geçilir; o da yoksa durum yok', () => {
    const biten = sy('biten', gun(-4), gun(-2));
    const uzak = sy('uzak', gun(30), gun(32));
    expect(durum([biten, uzak], false)).toEqual({ tur: 'serit', seyahat: uzak, sinif: 'planlanan' });
    expect(durum([biten], false)).toBeNull();
    // Yalnız eski seyahatler (bitişin üstünden > 7 gün): şerit yok.
    expect(durum([sy('eski', gun(-20), gun(-18))], true)).toBeNull();
  });
});

describe('seritAdimMetni', () => {
  it('kanvas 29b: "Sıradaki adım: 2 mekanı güne dağıt"', () => {
    expect(seritAdimMetni({ tur: 'dagit', mekanIdleri: ['a', 'b'], otelYok: true })).toBe('Sıradaki adım: 2 mekanı güne dağıt');
  });

  it('diğer adımlar da tek satırda', () => {
    expect(seritAdimMetni({ tur: 'planKur', mekanSayisi: 3 })).toBe('Sıradaki adım: planı kur');
    expect(seritAdimMetni({ tur: 'davet' })).toBe('Sıradaki adım: arkadaşlarını davet et');
    expect(seritAdimMetni({ tur: 'yemek', gun: { index: 1, date: '2026-11-20' } as Gun })).toBe('Sıradaki adım: 20 Kasım için öğle yemeği ekle');
    expect(seritAdimMetni({ tur: 'yarin', ilkMekanId: null, cikis: '09:30' })).toBe('Sıradaki adım: yarın başlıyor, çıkış 09:30');
  });
});
