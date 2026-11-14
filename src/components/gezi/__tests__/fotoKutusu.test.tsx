// #200 (Ayrıca): fotoğrafı olmayan mekanın kutusunda kategori ikonu — boş renkli kutu değil.
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { FotoKutusu } from '../GeziParcalari';

describe('#200 FotoKutusu', () => {
  it('fotoğraf yoksa kategori ikonu, varsa ikon yok', () => {
    const { rerender } = render(<FotoKutusu uri={null} tip="historical_landmark" boyut={46} kose={12} />);
    expect(screen.getByTestId('kategori-ikonu')).toBeTruthy();
    rerender(<FotoKutusu uri="https://ornek.test/foto.jpg" tip="historical_landmark" boyut={46} kose={12} />);
    expect(screen.queryByTestId('kategori-ikonu')).toBeNull();
  });
});
