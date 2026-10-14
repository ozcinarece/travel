// #200 KK3–KK4 (kanvas 28): sığmayan mekanlar penceresi — başlık, uygulanabilen seçenekler, varsayılan, gün önizlemesi, düğme.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { dagitimSecenekleri } from '@/features/listem/sigmayanlar';
import type { Gun, Mekan } from '@/lib/tipler';

import { SigmayanlarSayfasi } from '../SigmayanlarSayfasi';

const mekan = (id: string, dk: number): Mekan => ({ id, trip_id: 't', place_id: `p-${id}`, primary_type: 'museum', lat: 39.77, lng: 30.52, google_fetched_at: '', default_minutes: dk, added_by: null, note: null, created_at: '2026-10-01T00:00:00Z' });
const gun = (index: number, date: string): Gun => ({ id: `g${index}`, trip_id: 't', index, date, start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null });
const gunler = [gun(1, '2026-10-19'), gun(2, '2026-10-20'), gun(3, '2026-10-21')];
const mekanlar = Array.from({ length: 27 }, (_, i) => mekan(`m${i + 1}`, 75));
const ADLAR: Record<string, string> = { m25: 'Sazova Parkı', m26: 'Kent Park' };

function ciz(onDagit = jest.fn()) {
  const hesap = dagitimSecenekleri({ mekanlar, gunler, duraklar: [], gunBasi: '09:00:00', gunSonu: '20:00:00' });
  render(<SigmayanlarSayfasi hesap={hesap} gunler={gunler} mekanAdi={(id) => ADLAR[id] ?? null} mesgul={false} onDagit={onDagit} onKapat={() => {}} />);
  return { hesap, onDagit };
}

describe('#200 Sığmayan mekanlar penceresi', () => {
  it('başlık, alt satır, üç seçenek; varsayılan hepsini sığdıran ilk seçenek (Süreleri kısalt) ve önizlemesi', () => {
    ciz();
    expect(screen.getByText('3 mekan günlere sığmıyor')).toBeTruthy();
    expect(screen.getByText('27 mekan · 3 gün · günler 09:00–20:00')).toBeTruthy();
    expect(screen.getByText('NASIL SIĞDIRALIM?')).toBeTruthy();
    expect(screen.getByText('Süreleri kısalt')).toBeTruthy();
    expect(screen.getByText('Günleri uzat')).toBeTruthy();
    expect(screen.getByText('Listede kalsın')).toBeTruthy();
    expect(screen.getAllByText('Hepsi sığar')).toHaveLength(2);
    // Önizleme: "Pzt 19 · 9 mekan · 09:00–19:57".
    expect(screen.getByText('Pzt 19')).toBeTruthy();
    expect(screen.getAllByText('9 mekan')).toHaveLength(3);
    expect(screen.getAllByText('09:00–19:57')).toHaveLength(3);
    expect(screen.getByText('27 mekanı dağıt')).toBeTruthy();
    expect(screen.getByText('Süreleri sonra Plan’da tek tek değiştirebilirsin.')).toBeTruthy();
  });

  it('Günleri uzat: "Pzt, Sal ve Çar bitişi 20:00 → 20:15"; Listede kalsın: kalanların adı ve düğme sayısı', () => {
    const { onDagit } = ciz();
    expect(screen.getByText('20:00 → 20:15')).toBeTruthy();
    fireEvent.press(screen.getByText('Listede kalsın'));
    expect(screen.getByText('Sazova Parkı, Kent Park ve 1 mekan daha')).toBeTruthy();
    fireEvent.press(screen.getByText('24 mekanı dağıt'));
    expect(onDagit).toHaveBeenCalledWith(expect.objectContaining({ tur: 'liste', dagitilan: 24 }));
  });
});
