import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import { RehberEditoru } from '../yer/RehberEditoru';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const MD = '## Ne zaman gidilir\n\nHafta içi sabah sakin.\n\n![Şato](foto:yerler/y1/a.jpg)\n\n> [Kent Park](mekan:ChIJkent123456) ile birleştirin.';

// #108 KK3: Rehber blok görünümü — bloklar, araç çubuğu, sayaçlar; değişiklik markdown olarak yazılır.
describe('RehberEditoru (#108 KK3)', () => {
  const ciz = (onDegis = jest.fn()) => ({
    onDegis,
    ...render(<RehberEditoru md={MD} onDegis={onDegis} merkez={undefined} fotoYukle={async () => 'yerler/y1/b.jpg'} onHata={() => {}} kayitMetni="Taslak kaydedildi · 17:18" />),
  });

  it('bloklar, görsel altyazısı, ses yeri ve alt şerit', () => {
    const { getByDisplayValue, getByText } = ciz();
    expect(getByDisplayValue('Ne zaman gidilir')).toBeTruthy();
    expect(getByDisplayValue('Hafta içi sabah sakin.')).toBeTruthy();
    expect(getByDisplayValue('[Kent Park](mekan:ChIJkent123456) ile birleştirin.')).toBeTruthy();
    expect(getByText(/Altyazı: Şato/)).toBeTruthy();
    expect(getByText(/Sesli anlatım · v2/)).toBeTruthy();
    expect(getByText('1 görsel')).toBeTruthy();
    expect(getByText('1 mekan bağlantısı')).toBeTruthy();
    expect(getByText('Taslak kaydedildi · 17:18')).toBeTruthy();
  });

  it('paragraf düzenlenince markdown güncellenir; B seçimi sarar; H2 türü değiştirir', () => {
    const { onDegis, getByDisplayValue, getByRole } = ciz();
    const p = getByDisplayValue('Hafta içi sabah sakin.');
    fireEvent.changeText(p, 'Hafta içi sabah çok sakin.');
    expect(onDegis).toHaveBeenLastCalledWith(MD.replace('sabah sakin', 'sabah çok sakin'));
    fireEvent(p, 'selectionChange', { nativeEvent: { selection: { start: 0, end: 5 } } });
    fireEvent.press(getByRole('button', { name: 'Kalın' }));
    expect(onDegis).toHaveBeenLastCalledWith(MD.replace('Hafta içi sabah sakin.', '**Hafta** içi sabah çok sakin.'));
    fireEvent.press(getByRole('button', { name: 'Ara başlık' }));
    expect(onDegis).toHaveBeenLastCalledWith(MD.replace('Hafta içi sabah sakin.', '## **Hafta** içi sabah çok sakin.'));
  });

  it('görsel kaldırılınca markdown\'dan çıkar; Ses düğmesi devre dışı', () => {
    const { onDegis, getByText, getByRole } = ciz();
    fireEvent.press(getByText('kaldır'));
    expect(String(onDegis.mock.calls.at(-1)?.[0])).not.toContain('foto:');
    expect(getByRole('button', { name: 'Sesli anlatım (yakında)' }).props.accessibilityState).toEqual({ disabled: true });
  });
});
