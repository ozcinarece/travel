// #570 (#567 sonrası, kanvas `Plan_v7p_Haller` sürüm 54): kayma cümlesi, numarasız atlanan durak, BURADASIN, son gün pasif.
import { describe, expect, it, jest } from '@jest/globals';
import { render, within } from '@testing-library/react-native';

import { gunSilMetni } from '@/components/plan/GunSilSayfasi';
import { durakEtiketi, durakOzeti, PlanListesi, rozetAnahtari, type PlanSatirGorunumu } from '@/components/plan/PlanListesi';
import { SecimMenusu } from '@/components/program/SecimMenusu';
import { t } from '@/i18n';
import type { Gun } from '@/lib/tipler';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/components/ui/Foto', () => ({ Foto: () => null }));
jest.mock('@/components/harita/Harita', () => ({ Harita: () => null }));

const satir = (id: string, ek: Partial<PlanSatirGorunumu> = {}): PlanSatirGorunumu => ({
  id,
  mekanId: `m-${id}`,
  numara: Number(id),
  numaraRengi: '#16A06E',
  saat: '10:00',
  ad: `Durak ${id}`,
  alt: 'Müze · 1 sa',
  gelis: null,
  vurgulu: false,
  buradasin: false,
  gecildi: false,
  atlandi: false,
  ...ek,
});
const gun = { id: 'g1', index: 1, date: '2026-11-28' } as unknown as Gun;
const ciz = (ek: Partial<Parameters<typeof PlanListesi>[0]>) =>
  render(
    <PlanListesi
      bugun
      bosGun={null}
      onHarita={() => undefined}
      onDaha={() => undefined}
      gunler={[gun]}
      seciliGunId={gun.id}
      sekmeEtiketi={() => 'Bugün'}
      gunRengi={() => '#16A06E'}
      onGunSec={() => undefined}
      onGunUzunBas={() => undefined}
      ozet={null}
      otel={null}
      satirlar={[]}
      onDurak={() => undefined}
      onDurakUzunBas={() => undefined}
      onEkle={() => undefined}
      aksam={null}
      listem={null}
      uyari={null}
      {...ek}
    />,
  );

describe('Plan v7p takip (#570)', () => {
  it('KK1: onay metni — son gün değil / son gün / durak yok', () => {
    expect(gunSilMetni(3, false)).toBe("3 durak Listem'e döner; yerler silinmez. Sonraki günler bir gün öne kayar.");
    expect(gunSilMetni(3, true)).toBe("3 durak Listem'e döner; yerler silinmez.");
    expect(gunSilMetni(0, false)).toBe('Bu günde durak yok. Sonraki günler bir gün öne kayar.');
    expect(gunSilMetni(0, true)).toBe('Bu günde durak yok.');
  });

  it('KK2: atlanan durağın kesik dairesi boş ("–" yok)', () => {
    const r = satir('9', { atlandi: true, numara: null, saat: null });
    const { getByLabelText } = ciz({ satirlar: [satir('1'), r, satir('2')] });
    const dugme = getByLabelText(durakEtiketi(r));
    expect(within(dugme).queryByText('–')).toBeNull();
    expect(within(dugme).queryByText(/^\d+$/)).toBeNull();
  });

  it('KK3: buradasın durağında BURADASIN, sıradakinde SIRADAKİ — yalnız biri; ekran okuyucu metni aynı', () => {
    expect(rozetAnahtari({ vurgulu: true, buradasin: true })).toBe('plan.buradasinRozet');
    expect(rozetAnahtari({ vurgulu: true, buradasin: false })).toBe('plan.siradakiRozet');
    expect(rozetAnahtari({ vurgulu: false, buradasin: false })).toBeNull();
    const b = ciz({ satirlar: [satir('1', { vurgulu: true, buradasin: true }), satir('2')] });
    expect(b.getAllByText('BURADASIN').length).toBe(1);
    expect(b.queryByText('SIRADAKİ')).toBeNull();
    expect(durakEtiketi({ ...satir('1'), vurgulu: true, buradasin: true })).toMatch(/, şu an buradasın$/);
  });

  it('KK4: son günde "Günü sil" pasif (0.4), dokunulmaz ve devre dışı okunur', () => {
    const sil = jest.fn();
    const { getByText } = render(
      <SecimMenusu acik gorunus="v7p" baslik="Cuma · 27 Kasım" secenekler={[{ etiket: t('gunler.gunuSil'), onPress: sil, tehlike: true, ayrac: true, pasif: true }]} onKapat={() => undefined} />,
    );
    const satirEl = getByText(t('gunler.gunuSil')).parent!.parent!;
    expect(satirEl.props.accessibilityState).toMatchObject({ disabled: true });
    expect(JSON.stringify(satirEl.props.style)).toContain('"opacity":0.4');
    expect(sil).not.toHaveBeenCalled();
  });

  it('KK5: Listem boşken boş gün metni değişir; başlık header', () => {
    const bos = { baslik: t('plan.bosGunBaslik', { gun: 'Cumartesi' }) };
    const a = ciz({ bosGun: bos, listem: null });
    expect(a.getByText('Yakındaki yerlerden seç; saatler kendiliğinden dizilir.')).toBeTruthy();
    expect(a.getByRole('header', { name: 'Cumartesi henüz boş' })).toBeTruthy();
    const b = ciz({ bosGun: bos, listem: { n: 2, onPress: () => undefined } });
    expect(b.getByText(t('plan.bosGunMetin'))).toBeTruthy();
  });

  it('KK6: hepsi atlandıysa alt başlıkta "Hepsi atlandı" ("0 durak" değil)', () => {
    expect(durakOzeti([satir('1', { atlandi: true, numara: null }), satir('2', { atlandi: true, numara: null })])).toBe('Hepsi atlandı');
    expect(durakOzeti([satir('1', { atlandi: true, numara: null }), satir('1')])).toBe('1 durak');
    expect(durakOzeti([satir('1'), satir('2')])).toBe('2 durak');
  });
});
