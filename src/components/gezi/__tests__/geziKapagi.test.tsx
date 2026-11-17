// #275 (PR #281 inceleme): Gezi kapağındaki geri düğmesi "‹ Keşfet" der; seyahat içi "Yer ekle" sekmesinin adı buraya taşmaz.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { GeziKapagi } from '../GeziKapagi';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);

describe('GeziKapagi geri düğmesi', () => {
  it('"Keşfet" yazar, "Yer ekle" yazmaz; dokununca onKesfet çağrılır', () => {
    const onKesfet = jest.fn();
    render(<GeziKapagi baslik="Mardin" tarih="12–14 Aralık" uyeler={[]} cip={null} onKesfet={onKesfet} onPaylas={jest.fn()} onMenu={jest.fn()} onGrup={jest.fn()} />);
    expect(screen.getByText('Keşfet')).toBeTruthy();
    expect(screen.queryByText('Yer ekle')).toBeNull();
    fireEvent.press(screen.getByText('Keşfet'));
    expect(onKesfet).toHaveBeenCalled();
  });
});
