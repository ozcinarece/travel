// #444 (`Ekran07cIlOnerileri` A–B üst bölüm): sihirbaz adım kabuğu — zeminsiz geri/kapat düğmesi (44 pt), 28 px Figtree 800
// başlık, 15 px alt başlık; üç adımda aynı; uzun başlık kesilmez.
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { AdimKabugu } from '@/components/sihirbaz/AdimKabugu';
import { ADIMLAR } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { anaV5, minDokunma, yazi } from '@/theme';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const duz = (stil: unknown) => StyleSheet.flatten(stil as never) as Record<string, unknown>;

describe('#444 adım kabuğu', () => {
  it.each(ADIMLAR.map((a, i) => [a, i] as const))('%s: geri düğmesi zeminsiz ve 44 pt, başlık 28/800, alt 15 px', (adim, i) => {
    const onGeri = jest.fn();
    render(
      <AdimKabugu adim={adim} baslik="Neleri görmek istersin?" alt="Bolu · seçtiklerini günlere biz dağıtalım." onGeri={onGeri}>
        <Text>içerik</Text>
      </AdimKabugu>,
    );
    const etiket = i === 0 ? t('sihirbaz.kapat') : t('sihirbaz.geri');
    const geri = screen.getAllByRole('button', { name: etiket });
    expect(geri).toHaveLength(1);
    const g = duz(geri[0].props.style);
    expect(g.backgroundColor).toBeUndefined();
    expect(g.width).toBe(minDokunma);
    expect(g.height).toBe(minDokunma);

    const basliklar = screen.getAllByRole('header');
    expect(basliklar).toHaveLength(1);
    const b = duz(basliklar[0].props.style);
    expect(b.fontSize).toBe(28);
    expect(b.fontFamily).toBe(yazi.baslik);
    // KK4: satır sınırı yok; 360 px ve büyük yazıda iki satıra iner, kesilmez.
    expect(basliklar[0].props.numberOfLines).toBeUndefined();

    const alt = duz(screen.getByText('Bolu · seçtiklerini günlere biz dağıtalım.').props.style);
    expect(alt.fontSize).toBe(15);
    expect(alt.color).toBe(anaV5.ikincil);
  });
});
