// #448 (kanvas `Ekran04Nereye` · `Ekran05NeZaman` · `Ekran07cIlOnerileri` A–B üst bölüm): sayaç 13/700 #5B6178;
// 2. adımda seyahat adı başlığın altında, 3. adımdaki alt başlıkla aynı biçimde.
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';

import { AdimKabugu } from '@/components/sihirbaz/AdimKabugu';
import { ADIMLAR } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { anaV5, yazi } from '@/theme';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const duz = (stil: unknown) => StyleSheet.flatten(stil as never) as Record<string, unknown>;

/** Ağaçtaki metin düğümlerinin sırası (host Text'ler, derinlik öncelikli). */
function metinSirasi(kok: ReactTestInstance): string[] {
  return kok.findAll((n) => n.type === Text).map((n) => [n.props.children].flat().join(''));
}

describe('#448 sihirbaz kabuğu: sayaç ve alt başlık', () => {
  it.each(ADIMLAR.map((a, i) => [a, i] as const))('%s: sayaç 13 px, 700, #5B6178', (adim, i) => {
    render(
      <AdimKabugu adim={adim} baslik="Başlık" onGeri={jest.fn()}>
        <Text>içerik</Text>
      </AdimKabugu>,
    );
    const sayac = duz(screen.getByText(t('sihirbaz.sayac', { n: i + 1, toplam: ADIMLAR.length })).props.style);
    expect(sayac.fontSize).toBe(13);
    expect(sayac.fontFamily).toBe(yazi.kalin);
    expect(sayac.color).toBe(anaV5.ikincil);
  });

  it('2. adım: seyahat adı başlıktan sonra, 3. adımın alt başlığıyla aynı biçimde', () => {
    const { root } = render(
      <AdimKabugu adim={ADIMLAR[1]} baslik="Ne zaman gidiyorsun?" alt="Eskişehir Gezisi" onGeri={jest.fn()}>
        <Text>içerik</Text>
      </AdimKabugu>,
    );
    const sira = metinSirasi(root);
    expect(sira.indexOf('Eskişehir Gezisi')).toBeGreaterThan(sira.indexOf('Ne zaman gidiyorsun?'));
    const ad = duz(screen.getByText('Eskişehir Gezisi').props.style);

    screen.unmount();
    render(
      <AdimKabugu adim={ADIMLAR[2]} baslik="Neleri görmek istersin?" alt="Bolu · seçtiklerini günlere biz dağıtalım." onGeri={jest.fn()}>
        <Text>içerik</Text>
      </AdimKabugu>,
    );
    const alt3 = duz(screen.getByText('Bolu · seçtiklerini günlere biz dağıtalım.').props.style);
    expect(ad).toEqual(alt3);
    expect(ad.fontSize).toBe(15);
    expect(ad.color).toBe(anaV5.ikincil);
  });
});
