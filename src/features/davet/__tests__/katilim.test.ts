import { describe, expect, it } from '@jest/globals';

import type { DavetOzeti } from '@/lib/tipler';

import { davetAdimi, yonelmeEki } from '../katilim';

const ozet: DavetOzeti = { trip_id: 't', name: 'İzmir Gezisi', city_label: 'İzmir', start_date: null, end_date: null, member_count: 1, place_count: 3, day_count: 2, inviter_name: 'Ece', uye: false, gunler: [] };

describe('davetAdimi (#137)', () => {
  it('özet beklenirken ve oturum okunmadan "yükleniyor"', () => {
    expect(davetAdimi({ ozet: undefined, ozetBekliyor: true, hazir: true, hesapli: false, profilVar: undefined })).toBe('yukleniyor');
    expect(davetAdimi({ ozet, ozetBekliyor: false, hazir: false, hesapli: false, profilVar: undefined })).toBe('yukleniyor');
  });
  it('token bilinmiyorsa geçersiz; oturum yoksa giriş; profil yoksa profil; zaten üyeyse üye; aksi hâlde katıl', () => {
    expect(davetAdimi({ ozet: null, ozetBekliyor: false, hazir: true, hesapli: true, profilVar: true })).toBe('gecersiz');
    expect(davetAdimi({ ozet, ozetBekliyor: false, hazir: true, hesapli: false, profilVar: undefined })).toBe('giris');
    expect(davetAdimi({ ozet, ozetBekliyor: false, hazir: true, hesapli: true, profilVar: undefined })).toBe('yukleniyor');
    expect(davetAdimi({ ozet, ozetBekliyor: false, hazir: true, hesapli: true, profilVar: false })).toBe('profil');
    expect(davetAdimi({ ozet: { ...ozet, uye: true }, ozetBekliyor: false, hazir: true, hesapli: true, profilVar: true })).toBe('uye');
    expect(davetAdimi({ ozet, ozetBekliyor: false, hazir: true, hesapli: true, profilVar: true })).toBe('katil');
  });
});

describe('yonelmeEki', () => {
  it('ünlü uyumu ve kaynaştırma', () => {
    expect(yonelmeEki('Eskişehir Gezisi')).toBe("Eskişehir Gezisi'ne");
    expect(yonelmeEki('Roma Turu')).toBe("Roma Turu'na");
    expect(yonelmeEki('Ankara')).toBe("Ankara'ya");
    expect(yonelmeEki('İzmir')).toBe("İzmir'e");
    expect(yonelmeEki('İstanbul')).toBe("İstanbul'a");
    expect(yonelmeEki('Ürgüp')).toBe("Ürgüp'e");
    expect(yonelmeEki('Bodrum ')).toBe("Bodrum'a");
    expect(yonelmeEki('')).toBe('');
  });
});
