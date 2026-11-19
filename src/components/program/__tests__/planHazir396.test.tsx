// #396 (UX önerileri kanvası, `Sayfa_v5_PlanHazir`): "Plan hazır" + "{Şehir}'de N gün, N durak", gün satırları (renk noktası,
// "Cuma · … çevresi", "N durak · 09:45–13:00", dokununca o gün), boş gün tek satır yazı, ana eylem Arkadaşlarını çağır /
// grupta başkası varsa Plana bak.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { Gun } from '@/lib/tipler';
import { gunRengi } from '@/theme';

import { PlanHazirSayfasi, type PlanGunOzeti } from '../PlanHazirSayfasi';

const gun = (index: number, date: string): Gun => ({ id: `g${index}`, trip_id: 't1', index, date }) as unknown as Gun;
// 2026-11-20 Cuma, 21 Cumartesi, 22 Pazar.
const G1 = gun(1, '2026-11-20');
const G2 = gun(2, '2026-11-21');
const G3 = gun(3, '2026-11-22');
const ozet = (g: Gun, n: number, bas: string, bit: string, ilkAd: string): PlanGunOzeti => ({ gun: g, durakSayisi: n, bas, bit, yolDk: 20, araba: false, ilkAd });

function cizdir(grupVar = false) {
  const f = { onDavet: jest.fn(), onPlan: jest.fn(), onGun: jest.fn(), onKapat: jest.fn() };
  render(
    <PlanHazirSayfasi
      acik
      sehir="Eskişehir"
      ozetler={[ozet(G1, 3, '09:45', '13:00', 'Odunpazarı Modern Müze'), ozet(G2, 2, '10:00', '14:30', 'Sazova Parkı')]}
      bosGunler={[G3]}
      atanmamis={0}
      grupVar={grupVar}
      {...f}
    />,
  );
  return f;
}

describe('Plan hazır v5 (#396)', () => {
  it('KK2: küçük "Plan hazır" ve başlık "{Şehir}\'de N gün, N durak"; rozet yok', () => {
    cizdir();
    expect(screen.getByText('Plan hazır')).toBeTruthy();
    expect(screen.getByRole('header', { name: "Eskişehir'de 3 gün, 5 durak" })).toBeTruthy();
    expect(screen.queryByText('PLANIN HAZIR')).toBeNull();
  });

  it('KK3: gün satırı gri zemin, renk noktası, "Cuma · …", "N durak · 09:45–13:00"; dokununca o gün', () => {
    const f = cizdir();
    const satir = screen.getByRole('button', { name: 'Cuma · Odunpazarı Modern Müze çevresi, 3 durak · 09:45–13:00' });
    expect(StyleSheet.flatten(satir.props.style).backgroundColor).toBe('#F6F7FA');
    expect(StyleSheet.flatten(screen.getByTestId('plan-hazir-nokta-2').props.style).backgroundColor).toBe(gunRengi(2));
    fireEvent.press(screen.getByRole('button', { name: /^Cumartesi · Sazova/ }));
    expect(f.onGun).toHaveBeenCalledWith(G2);
  });

  it('KK4: boş gün tek satır yazı', () => {
    cizdir();
    expect(screen.getByText('Pazar boş')).toBeTruthy();
  });

  it('KK5: ana eylem Arkadaşlarını çağır, altında Önce plana bak', () => {
    const f = cizdir();
    fireEvent.press(screen.getByRole('button', { name: 'Arkadaşlarını çağır' }));
    expect(f.onDavet).toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Önce plana bak' }));
    expect(f.onPlan).toHaveBeenCalled();
  });

  it('KK6: grupta başkası varsa ana eylem Plana bak, davet yok', () => {
    const f = cizdir(true);
    expect(screen.queryByRole('button', { name: 'Arkadaşlarını çağır' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Önce plana bak' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Plana bak' }));
    expect(f.onPlan).toHaveBeenCalled();
    expect(f.onDavet).not.toHaveBeenCalled();
  });
});
