import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { kapakDegisikligi } from '@/features/yonetim/gezi';

import { IcerikFotolari } from '../IcerikFotolari';

const bos = () => {};

describe('#345 KK3 BO kapak atfı', () => {
  it('Commons kapağı listede olmasa da atfı ve "Kaldır" ile görünür', () => {
    const kaldir = jest.fn();
    render(
      <IcerikFotolari
        fotolar={[]}
        kapakUrl="https://x.supabase.co/storage/v1/object/public/icerik/kapak/commons/ab12.jpg"
        kapakAtif={{ yazar: 'Ahmet Y.', lisans: 'CC BY-SA 4.0', kaynak_url: 'https://commons.wikimedia.org/wiki/File:A.jpg' }}
        onKapakKaldir={kaldir}
        onYukle={async () => {}}
        onKapak={bos}
        onYaziyaEkle={bos}
        onAltyazi={bos}
        onSirala={bos}
        onSil={bos}
      />,
    );
    expect(screen.getByTestId('kapak-ozeti')).toBeTruthy();
    expect(screen.getByText('Foto: Ahmet Y. · CC BY-SA 4.0')).toBeTruthy();
    expect(screen.getByText('Kaynak sayfası')).toBeTruthy();
    fireEvent.press(screen.getByText('Kaldır'));
    expect(kaldir).toHaveBeenCalled();
  });

  it('kapak yoksa özet satırı yok', () => {
    render(<IcerikFotolari fotolar={[]} kapakUrl={null} kapakAtif={null} onKapakKaldir={bos} onYukle={async () => {}} onKapak={bos} onYaziyaEkle={bos} onAltyazi={bos} onSirala={bos} onSil={bos} />);
    expect(screen.queryByTestId('kapak-ozeti')).toBeNull();
  });

  it('Değiştir = kendi fotoğrafı: atıf "Tripmate"; Kaldır: ikisi de boş', () => {
    expect(kapakDegisikligi('https://x/a.webp')).toEqual({ kapak_url: 'https://x/a.webp', kapak_atif: { yazar: 'Tripmate' } });
    expect(kapakDegisikligi(null)).toEqual({ kapak_url: null, kapak_atif: null });
  });
});
