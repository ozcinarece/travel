// #276 KK-ek2 (kanvas 29d): harf karosu renkleri — YAKLAŞAN'da tarihli satır #DCE6FF'den başlar, taslak `renk.yuzey`
// (#EEF2FF); GEÇMİŞ ilk satırı #FFE2CC'den (`sira % 5`).
import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { SeyahatOzet } from '@/lib/tipler';

import { GecmisSatiri, YaklasanSatiri } from '../SeyahatSatiri';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const sy = (id: string, start: string | null, end: string | null) =>
  ({ id, name: null, city_label: id, start_date: start, end_date: end, tz: 'Europe/Istanbul', members: [], places: [{ count: 0 }], hotel_place_id: null }) as unknown as SeyahatOzet;

const karo = (ekran: ReturnType<typeof render>, harf: string) => StyleSheet.flatten(ekran.getByText(harf).parent!.parent!.props.style).backgroundColor;

describe('harf karosu renkleri (#276 KK-ek2)', () => {
  it('YAKLAŞAN: tarihli #DCE6FF, taslak #EEF2FF', () => {
    const ekran = render(
      <>
        <YaklasanSatiri seyahat={sy('mardin', '2026-12-12', '2026-12-14')} sira={0} onPress={() => {}} />
        <YaklasanSatiri seyahat={sy('trabzon', null, null)} sira={1} onPress={() => {}} />
      </>,
    );
    expect(karo(ekran, 'M').toLowerCase()).toBe('#dce6ff');
    expect(karo(ekran, 'T').toLowerCase()).toBe('#eef2ff');
  });

  it('GEÇMİŞ: ilk satır #FFE2CC, ikinci #DCE6FF', () => {
    const ekran = render(
      <>
        <GecmisSatiri seyahat={sy('eskisehir', '2026-10-16', '2026-10-18')} durum={undefined} sira={0} onPress={() => {}} onTekrar={() => {}} />
        <GecmisSatiri seyahat={sy('kapadokya', '2026-03-01', '2026-03-03')} durum={undefined} sira={1} onPress={() => {}} onTekrar={() => {}} />
      </>,
    );
    expect(karo(ekran, 'E').toLowerCase()).toBe('#ffe2cc');
    expect(karo(ekran, 'K').toLowerCase()).toBe('#dce6ff');
  });
});
