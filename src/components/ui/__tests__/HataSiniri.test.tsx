import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { HataSiniri } from '../HataSiniri';

const mockHataBildir = jest.fn();
jest.mock('@/lib/hataRaporu', () => ({ hataBildir: (...a: unknown[]) => mockHataBildir(...a), izBirak: jest.fn() }));

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
    expect(String((mockHataBildir.mock.calls[0] as unknown[])[1])).toContain('hata-siniri');
    patla = false;
    rerender(<Sarmal />);
    fireEvent.press(getByText('Yeniden dene'));
    expect(getByText('iyi')).toBeTruthy();
    expect(queryByText('Bir şeyler ters gitti')).toBeNull();
  });
});
