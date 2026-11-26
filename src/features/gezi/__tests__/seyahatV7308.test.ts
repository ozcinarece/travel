// #308: seyahat sayfası v7 metinleri (kanvas `Sayfa_v7_Seyahat_*`).
import { describe, expect, it } from '@jest/globals';

import { baslikAltSatiri, bosGunOnerileri, gunSatiri, kisiAdlari, simdiEtiketi, varanlarMetni } from '../seyahatV7';

const seyahat = { start_date: '2026-11-24', end_date: '2026-11-29', tz: 'Europe/Istanbul' };
const an = new Date('2026-11-20T09:00:00Z');

describe('seyahat v7 (#308)', () => {
  it('KK2 plan modu: "24–29 Kasım · 4 gün kaldı"', () => {
    expect(baslikAltSatiri({ seyahat, mod: 'plan', an, bugunIndex: null, bugunTarih: null, gezilen: 0, toplam: 0 })).toBe('24–29 Kasım · 4 gün kaldı');
  });

  it('KK2 gezi modu: "2. gün · Çarşamba · 3 / 6 durak"; boş günde tarih aralığı', () => {
    const g = { seyahat, mod: 'gezi' as const, an: new Date('2026-11-25T09:00:00Z'), bugunIndex: 2, bugunTarih: '2026-11-25' };
    expect(baslikAltSatiri({ ...g, gezilen: 3, toplam: 6 })).toBe('2. gün · Çarşamba · 3 / 6 durak');
    expect(baslikAltSatiri({ ...g, gezilen: 0, toplam: 0 })).toBe('2. gün · Çarşamba · 24–29 Kasım');
  });

  it('KK2 tarih seyahatin saat diliminde: İstanbul gece yarısından sonra yeni gün', () => {
    // 23 Kasım 21:30 UTC = 24 Kasım 00:30 İstanbul → başlangıç bugün, "gün kaldı" yok.
    expect(baslikAltSatiri({ seyahat, mod: 'plan', an: new Date('2026-11-23T21:30:00Z'), bugunIndex: null, bugunTarih: null, gezilen: 0, toplam: 0 })).toBe('24–29 Kasım');
  });

  it('KK3 kişi adları benimle başlar', () => {
    const uyeler = [
      { user_id: 'm', display_name: 'Mert' },
      { user_id: 'e', display_name: 'Ece' },
      { user_id: 'a', display_name: 'Ayşe' },
    ];
    expect(kisiAdlari(uyeler, 'e')).toBe('Ece, Mert, Ayşe');
  });

  it("KK3 varanlar: \"Sen ve Mert Sazova'da\"; kimse yoksa null", () => {
    const varanlar = [
      { user_id: 'e', display_name: 'Ece' },
      { user_id: 'm', display_name: 'Mert' },
    ];
    expect(varanlarMetni({ varanlar, benId: 'e', yerAdi: 'Sazova' })).toBe("Sen ve Mert Sazova'da");
    expect(varanlarMetni({ varanlar: [varanlar[1]], benId: 'e', yerAdi: 'Sazova Parkı' })).toBe("Mert Sazova Parkı'nda");
    expect(varanlarMetni({ varanlar: [], benId: 'e', yerAdi: 'Sazova' })).toBeNull();
  });

  it('KK5 gün satırı: "1. gün · Salı" / "5 durak · 09:30 Kurşunlu Külliyesi"', () => {
    const gun = { id: 'g1', trip_id: 't', index: 1, date: '2026-11-24', start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null };
    expect(gunSatiri({ gun, tema: 'Kurşunlu Külliyesi', durakSayisi: 5, saat: '~09:30–18:10' })).toEqual({ ust: '1. gün · Salı', alt: '5 durak · 09:30 Kurşunlu Külliyesi' });
    expect(gunSatiri({ gun, tema: null, durakSayisi: 0, saat: null }).alt).toBe('Durak yok');
  });

  it('KK5 şimdi etiketi büyük harf (Türkçe)', () => {
    expect(simdiEtiketi(12, false)).toBe('ŞİMDİ · 12 DK YÜRÜME');
    expect(simdiEtiketi(null, false)).toBe('ŞİMDİ');
  });

  it('KK5 boş gün: listede olmayan 3 yer, yakından uzağa', () => {
    const y = (id: string, lat: number) => ({ place_id: id, lat, lng: 30.5 });
    const sonuc = bosGunOnerileri([y('uzak', 39.9), y('yakin', 39.78), y('listede', 39.77), y('orta', 39.8), y('dorduncu', 40)], [{ place_id: 'listede' }], { lat: 39.77, lng: 30.5 });
    expect(sonuc.map((x) => x.place_id)).toEqual(['yakin', 'orta', 'uzak']);
    expect(sonuc[0].mesafeM).toBeGreaterThan(1000);
  });
});
