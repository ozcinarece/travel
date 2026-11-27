// #553 (#547 takibi): sekme dokunma alanı, sıradaki durağın ve geçmiş günün ekran okuyucu metni.
import { describe, expect, it, jest } from '@jest/globals';

import { gunAlti, gunSatiriEtiketi } from '@/components/listem/GuneEkleSayfasi';
import { bugunDurumu, type GunSecenegi } from '@/features/listem/listem';
import { durakEtiketi, SEKME_YUKSEKLIK } from '@/components/plan/PlanListesi';
import { t } from '@/i18n';

jest.mock('@/components/ui/Foto', () => ({ Foto: () => null }));
jest.mock('@/components/harita/Harita', () => ({ Harita: () => null }));

describe('Plan v7p küçükleri (#553)', () => {
  it('KK1: sekme kutusunun kendisi 44 pt (hitSlop üst kabı aşamaz)', () => {
    expect(SEKME_YUKSEKLIK).toBeGreaterThanOrEqual(44);
  });

  it('KK2: sıradaki durak etiketin sonunda "sıradaki durak"; diğerlerinde yok', () => {
    const r = { saat: '10:42', ad: 'Pantheon', alt: 'Müze · 1 sa', vurgulu: true };
    expect(durakEtiketi(r)).toBe(`10:42, Pantheon, Müze · 1 sa, ${t('plan.siradakiDurak')}`);
    expect(durakEtiketi({ ...r, vurgulu: false })).toBe('10:42, Pantheon, Müze · 1 sa');
    expect(durakEtiketi({ ...r, saat: null, vurgulu: false })).toBe('Pantheon, Müze · 1 sa');
    // #558 madde 2: "buradasın" durumundaki durak "sıradaki" diye okunmaz.
    expect(durakEtiketi({ ...r, buradasin: true })).toBe(`10:42, Pantheon, Müze · 1 sa, ${t('plan.buradasinDurak')}`);
    expect(durakEtiketi({ ...r, buradasin: true })).not.toContain(t('plan.siradakiDurak'));
  });

  it('KK4: geçmiş gün "…, geçti" diye okunur; diğer günler alt satırla', () => {
    expect(gunSatiriEtiketi('Çar 25', t('listem.guneEkle.gecti'), { gecti: true, enYakin: false })).toBe(`Çar 25, ${t('listem.guneEkle.gectiOkunus')}`);
    expect(gunSatiriEtiketi('Cum 27', '2 durak', { gecti: false, enYakin: true })).toBe(`Cum 27 · 2 durak · ${t('listem.guneEkle.enYakinRozet')}`);
  });

  it('KK3: bugünün alt satırı — gezildiyse "N durak gezildi · akşam boş", akşam doluysa yalnız gezilen; hiç gezilmediyse eski metin', () => {
    const o = { gun: { id: 'g', index: 2, date: '2026-11-27' }, durakSayisi: 3, enYakinM: 400, sonGun: false } as unknown as GunSecenegi;
    expect(gunAlti(o, false, { gezilen: 2, aksamBos: true })).toBe(`${t('listem.guneEkle.gezildi', { n: 2 })} · ${t('listem.guneEkle.aksamBos')}`);
    expect(gunAlti(o, false, { gezilen: 2, aksamBos: false })).toBe(t('listem.guneEkle.gezildi', { n: 2 }));
    expect(gunAlti(o, false, { gezilen: 0, aksamBos: true })).toBe(gunAlti(o, false, null));
    expect(gunAlti(o, false, null)).toContain(t('listem.guneEkle.durak', { n: 3 }));
  });

  it('KK3: bugunDurumu — atlanan sayılmaz; son durak 17:00 öncesi biterse akşam boş', () => {
    const satir = (durum: string, ayrilisDk: number) => ({ durum, ayrilisDk }) as never;
    expect(bugunDurumu({ satirlar: [satir('gecildi', 600), satir('gecildi', 700), satir('bekliyor', 900), satir('atlandi', 1200)] })).toEqual({ gezilen: 2, aksamBos: true });
    expect(bugunDurumu({ satirlar: [satir('gecildi', 600), satir('siradaki', 1140)] })).toEqual({ gezilen: 1, aksamBos: false });
    expect(bugunDurumu({ satirlar: [] })).toEqual({ gezilen: 0, aksamBos: true });
  });
});
