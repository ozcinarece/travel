import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

import { t } from '@/i18n';

import { HataSiniri } from '../HataSiniri';

const mockHataBildir = jest.fn();
jest.mock('@/lib/hataRaporu', () => ({ hataBildir: (...a: unknown[]) => mockHataBildir(...a), izBirak: jest.fn() }));
const mockKatmaniKaldir = jest.fn();
jest.mock('@/lib/webAcilis', () => ({ webAcilisiKaldir: () => mockKatmaniKaldir() }));

function Patlayan({ patla }: { patla: boolean }) {
  if (patla) throw new Error('deneme hatası');
  return <Text>iyi</Text>;
}

// #85 KK3: render hatası gri boş ekran yerine kart; hata raporlanır; "Yeniden dene" ağacı yeniden kurar.
describe('HataSiniri (#85)', () => {
  let konsol: ReturnType<typeof jest.spyOn>;
  beforeEach(() => {
    mockHataBildir.mockReset();
    konsol = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => konsol.mockRestore());

  it('hatada kartı gösterir ve bildirir; yeniden dene çocukları yeniden kurar', () => {
    let patla = true;
    const Sarmal = () => (
      <HataSiniri>
        <Patlayan patla={patla} />
      </HataSiniri>
    );
    const { getByText, queryByText, rerender } = render(<Sarmal />);
    expect(getByText('Bir şeyler ters gitti')).toBeTruthy();
    expect(mockHataBildir).toHaveBeenCalledTimes(1);
    // #552: web davet açılış katmanı (#549) kartın üstünde kalmaz.
    expect(mockKatmaniKaldir).toHaveBeenCalledTimes(1);
    expect(String((mockHataBildir.mock.calls[0] as unknown[])[1])).toContain('hata-siniri');
    patla = false;
    rerender(<Sarmal />);
    fireEvent.press(getByText('Yeniden dene'));
    expect(getByText('iyi')).toBeTruthy();
    expect(queryByText('Bir şeyler ters gitti')).toBeNull();
  });

  // #557 KK3: web'de "uygulamayı kapatıp aç" değil "sayfayı yenile"; native'de metin aynen kalır.
  const durumlar: [string, string][] = [
    ['ios', 'genel.hataMetin'],
    ['web', 'genel.hataMetinWeb'],
  ];
  it.each(durumlar)('%s: kart metni %s', (platform, anahtar) => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => platform });
    try {
      const { getByText } = render(
        <HataSiniri>
          <Patlayan patla />
        </HataSiniri>,
      );
      expect(getByText(t(anahtar))).toBeTruthy();
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
    }
  });
});
