// #581 KK3b: şehir değişimi onay çekmecesi — soru başlığı, "Seçtiğin {n} yer listeden çıkar.", "Devam et" ve "Vazgeç".
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SehirDegisimSayfasi } from '@/components/sihirbaz/SehirDegisimSayfasi';
import { t } from '@/i18n';

describe('#581 KK3b şehir değişimi onayı', () => {
  it('kapalıyken görünmez', () => {
    render(<SehirDegisimSayfasi yerSayisi={null} sehir="Kars" onDevam={jest.fn()} onVazgec={jest.fn()} />);
    expect(screen.queryByText(t('sihirbaz.nereye.sehirDegisti', { n: 3 }))).toBeNull();
  });

  it('metin yer sayısını söyler; Devam et ve Vazgeç doğru işi çağırır', () => {
    const onDevam = jest.fn();
    const onVazgec = jest.fn();
    render(<SehirDegisimSayfasi yerSayisi={3} sehir="Kars" onDevam={onDevam} onVazgec={onVazgec} />);
    expect(screen.getByText('Seçtiğin 3 yer listeden çıkar.')).toBeTruthy();
    expect(screen.getByText(t('sihirbaz.nereye.sehirDegistiBaslik', { sehir: 'Kars' }))).toBeTruthy();
    fireEvent.press(screen.getByText(t('sihirbaz.nereye.sehirDegistiDevam')));
    expect(onDevam).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getAllByText(t('genel.vazgec'))[0]);
    expect(onVazgec).toHaveBeenCalled();
  });
});
