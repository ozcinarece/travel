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

  it('#351 KK2: Google yazar bağlantısı varsa dokununca tarayıcıda açılır; görünüm aynı, 44 pt', () => {
    const uri = 'https://maps.google.com/maps/contrib/123';
    render(<GoogleFotoAtfi yazar="Ali" uri={uri} />);
    expect(screen.getByText('Foto: Ali')).toBeTruthy();
    expect(screen.getByText('· Google Maps')).toBeTruthy();
    const dugme = screen.getByTestId('google-foto-atfi');
    expect(dugme.props.accessibilityRole).toBe('link');
    expect(screen.getByLabelText('Fotoğraf: Ali, Google Maps. Yazarın sayfasını aç')).toBeTruthy();
    fireEvent.press(dugme);
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(uri);
  });

  it('#351 KK2: bağlantı yoksa, https değilse ya da yazar yoksa dokunulmaz (bugünkü gibi)', () => {
    const { rerender } = render(<GoogleFotoAtfi yazar="Ali" />);
    expect(screen.queryByTestId('google-foto-atfi')).toBeNull();
    rerender(<GoogleFotoAtfi yazar="Ali" uri="javascript:alert(1)" />);
    expect(screen.queryByTestId('google-foto-atfi')).toBeNull();
    rerender(<GoogleFotoAtfi yazar={null} uri="https://maps.google.com/maps/contrib/1" />);
    expect(screen.queryByTestId('google-foto-atfi')).toBeNull();
    expect(screen.getByText('Foto: Google Maps')).toBeTruthy();
  });
});
