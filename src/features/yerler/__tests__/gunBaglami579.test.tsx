// #579 KK1–KK3 (kanvas `Dalga1_BuguneEkle`): gün bağlamı yardımcıları — bugün seyahatin saat diliminden (trips.tz, cihaz saati
// değil), hap ve bildirim metinleri (Türkçe yönelme eki), "+" etiketi, Değiştir çekmecesinin gün seçenekleri; "+" ve Gece
// bildirim biçimi.
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { GeriAlBandi } from '@/components/listem/GeriAlBandi';
import { EkleDugmesi } from '@/components/ui/EkleDugmesi';
import { baglamGunSecenekleri, bugununGunSirasi, etkinGunSirasi, GUN_BILDIRIMI_MS, gunEklendiMetni, gunEkleEtiketi, gunHapiMetni } from '@/features/yerler/gunBaglami';
import { t } from '@/i18n';
import type { Gun } from '@/lib/tipler';
import { renk, seyahatV7 } from '@/theme';

const gun = (index: number, date: string | null): Gun => ({ id: `g${index}`, trip_id: 't1', index, date, start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null }) as Gun;

describe('#579 gün bağlamı', () => {
  it('KK1: bugün seyahatin saat dilimiyle — UTC 22:30 İstanbul\'da ertesi gün, New York\'ta aynı gün; aralık dışında null', () => {
    const an = new Date('2026-11-25T22:30:00Z');
    const seyahat = { start_date: '2026-11-25', end_date: '2026-11-28', tz: 'Europe/Istanbul' };
    expect(bugununGunSirasi(seyahat, an)).toBe(2);
    expect(bugununGunSirasi({ ...seyahat, tz: 'America/New_York' }, an)).toBe(1);
    expect(bugununGunSirasi({ ...seyahat, start_date: '2026-12-01', end_date: '2026-12-03' }, an)).toBeNull();
    expect(bugununGunSirasi({ start_date: null, end_date: null, tz: 'Europe/Istanbul' }, an)).toBeNull();
  });

  it('KK1: açıkça seçilen gün (Plan, Değiştir) bugüne üstün; seçim yoksa bugün', () => {
    expect(etkinGunSirasi(null, 2)).toBe(2);
    expect(etkinGunSirasi(4, 2)).toBe(4);
    expect(etkinGunSirasi(null, null)).toBeNull();
  });

  it('KK2: hap "2. gün · Çarşamba\'ya ekleniyor", "4. gün · Cuma\'ya ekleniyor"; tarihsiz "2. güne ekleniyor"', () => {
    expect(gunHapiMetni(gun(2, '2026-11-25'))).toBe("2. gün · Çarşamba'ya ekleniyor");
    expect(gunHapiMetni(gun(4, '2026-11-27'))).toBe("4. gün · Cuma'ya ekleniyor");
    expect(gunHapiMetni(gun(5, '2026-11-29'))).toBe("5. gün · Pazar'a ekleniyor");
    expect(gunHapiMetni(gun(2, null))).toBe('2. güne ekleniyor');
  });

  it('KK3: bildirim bugünse "{ad} bugüne eklendi", başka günse "{ad} Cuma\'ya eklendi"; 4 sn', () => {
    expect(gunEklendiMetni('Kurşunlu Külliyesi', gun(2, '2026-11-25'), 2)).toBe('Kurşunlu Külliyesi bugüne eklendi');
    expect(gunEklendiMetni('Kurşunlu Külliyesi', gun(4, '2026-11-27'), 2)).toBe("Kurşunlu Külliyesi Cuma'ya eklendi");
    expect(gunEklendiMetni('Kurşunlu Külliyesi', gun(4, null), 2)).toBe('Kurşunlu Külliyesi 4. güne eklendi');
    expect(GUN_BILDIRIMI_MS).toBe(4000);
  });

  it('KK3: "+" etiketi "Bugüne ekle" / "Perşembe\'ye ekle"', () => {
    expect(gunEkleEtiketi(gun(2, '2026-11-25'), 2)).toBe('Bugüne ekle');
    expect(gunEkleEtiketi(gun(3, '2026-11-26'), 2)).toBe("Perşembe'ye ekle");
    expect(gunEkleEtiketi(gun(3, null), 2)).toBe('3. güne ekle');
  });

  it('KK2: Değiştir çekmecesi — her gün bir seçenek, atlanmayan durak sayısı, son gün dönüş', () => {
    const s = baglamGunSecenekleri([gun(2, '2026-11-25'), gun(1, '2026-11-24'), gun(3, '2026-11-26')], [
      { day_id: 'g2', skipped: false },
      { day_id: 'g2', skipped: true },
      { day_id: 'g1', skipped: false },
    ]);
    expect(s.map((x) => [x.gun.index, x.durakSayisi, x.sonGun, x.onerilen, x.enYakinM])).toEqual([
      [1, 1, false, false, null],
      [2, 1, false, false, null],
      [3, 0, true, false, null],
    ]);
  });
});

describe('#579 KK3 biçim', () => {
  it('"+" gün bağlamında "Bugüne ekle" okunur; eklenince açık yeşil ✓ (basariZemin)', () => {
    const { rerender } = render(<EkleDugmesi listede={false} etiket="Bugüne ekle" onPress={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Bugüne ekle' })).toBeTruthy();
    rerender(<EkleDugmesi listede etiket="Bugüne ekle" onPress={() => undefined} />);
    const tik = screen.getByRole('button', { name: t('ui.ekle.listede') });
    expect(StyleSheet.flatten(tik.props.style).backgroundColor).toBe(renk.basariZemin);
  });

  it('Gece bildirim: Gece zemin, 52 pt, "Geri al" açık Mandalina yazı düğmesi (44 pt)', () => {
    let geriAlindi = 0;
    render(<GeriAlBandi metin="Kurşunlu Külliyesi bugüne eklendi" onGeriAl={() => (geriAlindi += 1)} yazili />);
    const bant = StyleSheet.flatten(screen.getByTestId('geri-al-bandi').props.style);
    expect(bant.backgroundColor).toBe(renk.ana);
    expect(bant.minHeight).toBe(52);
    const dugme = screen.getByRole('button', { name: t('listem.geriAl') });
    expect(StyleSheet.flatten(dugme.props.style).height).toBe(44);
    expect(StyleSheet.flatten(screen.getByText(t('listem.geriAl')).props.style).color).toBe(seyahatV7.geriAl);
    fireEvent.press(dugme);
    expect(geriAlindi).toBe(1);
  });
});
