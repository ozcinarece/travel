import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { GoogleFotoAtfi, KapakAtfi } from '../KapakAtfi';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'opened' })) }));

const KAYNAK = 'https://commons.wikimedia.org/wiki/File:Izmir.jpg';

describe('#345 KK4 KapakAtfi (kanvas 29i)', () => {
  it('A · Commons: "Foto: yazar" + kısa lisans; ekran okuyucu tam lisansı okur; dokununca E açılır, kaynak tarayıcıda', () => {
    render(<KapakAtfi atif={{ yazar: 'Ahmet Y.', lisans: 'CC BY-SA 4.0', kaynak_url: KAYNAK }} />);
    expect(screen.getByText('Foto: Ahmet Y.')).toBeTruthy();
    expect(screen.getByText('· CC BY-SA')).toBeTruthy();
    const dugme = screen.getByLabelText('Fotoğraf: Ahmet Y., lisans CC BY-SA 4.0. Kaynağı aç');
    fireEvent.press(dugme);
    expect(screen.getByText('Fotoğraf hakkında')).toBeTruthy();
    expect(screen.getByText(/Wikimedia Commons’tan/)).toBeTruthy();
    fireEvent.press(screen.getByText('Kaynak sayfasını aç'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(KAYNAK);
  });

  it('B · kendi fotoğrafımız: "Foto: Tripmate", dokunulmaz', () => {
    render(<KapakAtfi atif={{ yazar: 'Tripmate' }} />);
    expect(screen.getByText('Foto: Tripmate')).toBeTruthy();
    expect(screen.queryByTestId('kapak-atfi')).toBeNull();
  });

  it('C · uzun ad tek satırda kısalır, lisans ayrı ve kesilmez', () => {
    render(<KapakAtfi atif={{ yazar: 'Wikimedia kullanıcısı Zeynep Karaosmanoğlu', lisans: 'CC BY 4.0', kaynak_url: KAYNAK }} />);
    expect(screen.getByText('Foto: Wikimedia kullanıcısı Zeynep Karaosmanoğlu').props.numberOfLines).toBe(1);
    expect(screen.getByText('· CC BY').props.numberOfLines).toBeUndefined();
  });

  it('Google fotoğrafı: aynı kutu, "· Google Maps"', () => {
    render(<GoogleFotoAtfi yazar="Ali" />);
    expect(screen.getByText('Foto: Ali')).toBeTruthy();
    expect(screen.getByText('· Google Maps')).toBeTruthy();
  });
});
