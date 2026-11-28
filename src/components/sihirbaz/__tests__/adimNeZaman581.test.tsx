// #581 KK1: takvimde ilk dokunuştan sonra üstte "Dönüş günü?" ipucu. KK2: "Tarihim belli değil" → "Kaç gün? − N +" sayacı.
// KK3d: eski kilit notları yok.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AdimNeZaman } from '@/components/sihirbaz/AdimNeZaman';
import tr from '@/i18n/tr.json';
import { t } from '@/i18n';

describe('#581 Ne zaman adımı', () => {
  it('KK1: seçim yokken ipucu yok, yalnız gidiş seçiliyken "Dönüş günü?", dönüş seçilince kalkar', () => {
    const { rerender } = render(<AdimNeZaman aralik={null} onAralik={jest.fn()} tarihsizGun={null} onTarihsizGun={jest.fn()} />);
    expect(screen.queryByText(t('sihirbaz.nezaman.donusIpucu', { n: 60 }))).toBeNull();
    rerender(<AdimNeZaman aralik={{ gidis: '2099-01-10', donus: null }} onAralik={jest.fn()} tarihsizGun={null} onTarihsizGun={jest.fn()} />);
    expect(screen.getByText(t('sihirbaz.nezaman.donusIpucu', { n: 60 }))).toBeTruthy();
    rerender(<AdimNeZaman aralik={{ gidis: '2099-01-10', donus: '2099-01-12' }} onAralik={jest.fn()} tarihsizGun={null} onTarihsizGun={jest.fn()} />);
    expect(screen.queryByText(t('sihirbaz.nezaman.donusIpucu', { n: 60 }))).toBeNull();
  });

  it('KK2: tarihsiz seçimde "Kaç gün?" sayacı; − ve + gün sayısını değiştirir, 1 günde − pasif', () => {
    const onTarihsizGun = jest.fn();
    const { rerender } = render(<AdimNeZaman aralik={null} onAralik={jest.fn()} tarihsizGun={2} onTarihsizGun={onTarihsizGun} />);
    expect(screen.getByText(t('sihirbaz.nezaman.kacGun'))).toBeTruthy();
    expect(screen.getByText(t('sihirbaz.nezaman.gunSayisi', { n: 2 }))).toBeTruthy();
    expect(screen.queryByText(t('sihirbaz.nezaman.ozetYok'))).toBeNull();
    fireEvent.press(screen.getByLabelText(t('sihirbaz.nezaman.gunArttir')));
    expect(onTarihsizGun).toHaveBeenLastCalledWith(3);
    fireEvent.press(screen.getByLabelText(t('sihirbaz.nezaman.gunAzalt')));
    expect(onTarihsizGun).toHaveBeenLastCalledWith(1);

    onTarihsizGun.mockClear();
    rerender(<AdimNeZaman aralik={null} onAralik={jest.fn()} tarihsizGun={1} onTarihsizGun={onTarihsizGun} />);
    fireEvent.press(screen.getByLabelText(t('sihirbaz.nezaman.gunAzalt')));
    expect(onTarihsizGun).not.toHaveBeenCalled();
  });

  it('KK3: takvim günleri tarih seçildikten sonra da dokunulabilir; kilit notları metinlerden silindi', () => {
    const onAralik = jest.fn();
    render(<AdimNeZaman aralik={{ gidis: '2099-01-10', donus: '2099-01-12' }} onAralik={onAralik} tarihsizGun={null} onTarihsizGun={jest.fn()} />);
    fireEvent.press(screen.getByTestId('gun-2099-01-15'));
    expect(onAralik).toHaveBeenCalledWith({ gidis: '2099-01-15', donus: null });
    const sihirbaz = (tr as unknown as { sihirbaz: { nereye: Record<string, string>; nezaman: Record<string, string> } }).sihirbaz;
    expect(sihirbaz.nereye.kilitli).toBeUndefined();
    expect(sihirbaz.nezaman.kilitli).toBeUndefined();
  });
});
