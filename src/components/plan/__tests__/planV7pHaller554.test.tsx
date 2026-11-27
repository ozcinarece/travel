// #554 (kanvas `Plan_v7p_Haller`): sıradaki ve atlanan durak, boş gün, ⋯ "Günü sil" ve onay çekmecesi.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, within } from '@testing-library/react-native';

import { GunSilSayfasi, gunSilMetni } from '@/components/plan/GunSilSayfasi';
import { daireTuru, durakEtiketi, PlanListesi, type PlanSatirGorunumu } from '@/components/plan/PlanListesi';
import { SecimMenusu } from '@/components/program/SecimMenusu';
import { listemGruplari } from '@/features/listem/listem';
import { t } from '@/i18n';
import type { Durak, Gun, Mekan } from '@/lib/tipler';

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
const gun: Gun = { id: 'g5', trip_id: 't', index: 5, date: '2026-11-28', start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null } as unknown as Gun;
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

describe('Plan v7p halleri (#554)', () => {
  it('KK1: bugünde gezilen ✓, sıradaki dolu + "SIRADAKİ", sonrakiler çerçeveli; plan gününde hepsi dolu', () => {
    expect(daireTuru({ gecildi: true, atlandi: false, vurgulu: false }, true)).toBe('tik');
    expect(daireTuru({ gecildi: false, atlandi: false, vurgulu: true }, true)).toBe('dolu');
    expect(daireTuru({ gecildi: false, atlandi: false, vurgulu: false }, true)).toBe('cerceve');
    expect(daireTuru({ gecildi: false, atlandi: false, vurgulu: false }, false)).toBe('dolu');
    const { getAllByText, getByText } = ciz({ satirlar: [satir('1', { gecildi: true }), satir('2', { vurgulu: true }), satir('3')] });
    expect(getAllByText(t('plan.siradakiRozet')).length).toBe(1);
    expect(getByText('2')).toBeTruthy();
    // "buradasın" durumunda SIRADAKİ etiketi yok.
    const b = ciz({ satirlar: [satir('2', { vurgulu: true, buradasin: true })] });
    expect(b.queryByText(t('plan.siradakiRozet'))).toBeNull();
  });

  it('KK2: atlanan — saat yok, kesik çizgili daire, sağda "Atlandı" hapı; ekran okuyucu da "Atlandı" der', () => {
    expect(daireTuru({ gecildi: false, atlandi: true, vurgulu: false }, true)).toBe('kesik');
    const r = satir('2', { atlandi: true, numara: null, saat: null, alt: 'Müze · 45 dk' });
    const { getByLabelText } = ciz({ satirlar: [satir('1', { gecildi: true }), r] });
    const dugme = getByLabelText(durakEtiketi(r));
    expect(within(dugme).getByText(t('plan.atlandi'))).toBeTruthy();
    expect(within(dugme).queryByText(/· atlandı/)).toBeNull();
    expect(durakEtiketi(r)).toBe(`Durak 2, Müze · 45 dk, ${t('plan.atlandi')}`);
  });

  it('KK3: boş gün — başlık, açıklama ve tek turuncu "+ Bu güne yer ekle"', () => {
    const onEkle = jest.fn();
    const { getByText, getAllByText } = ciz({ bosGun: { baslik: t('plan.bosGunBaslik', { gun: 'Cumartesi' }) }, onEkle });
    expect(getByText('Cumartesi henüz boş')).toBeTruthy();
    expect(getByText(t('plan.bosGunMetin'))).toBeTruthy();
    expect(getAllByText(t('plan.buGuneEkle')).length).toBe(1);
    fireEvent.press(getByText(t('plan.buGuneEkle')));
    expect(onEkle).toHaveBeenCalled();
  });

  it('KK4: ⋯ menüsü (v7p) — başlık ve en altta "Günü sil"', () => {
    const sil = jest.fn();
    const { getByText, getAllByRole } = render(
      <SecimMenusu
        acik
        gorunus="v7p"
        baslik="Cuma · 27 Kasım"
        secenekler={[
          { etiket: t('plan.sirayiDuzenle'), onPress: () => undefined },
          { etiket: t('gunler.gunuSil'), onPress: sil, tehlike: true, ayrac: true },
        ]}
        onKapat={() => undefined}
      />,
    );
    expect(getByText('Cuma · 27 Kasım')).toBeTruthy();
    const dugmeler = getAllByRole('button').map((b) => within(b).queryByText(/./)?.props.children);
    expect(dugmeler.slice(-2)).toEqual([t('gunler.gunuSil'), t('genel.vazgec')]);
    fireEvent.press(getByText(t('gunler.gunuSil')));
    expect(sil).toHaveBeenCalled();
  });

  it('KK5: onay çekmecesi — "{Gün} {no} silinsin mi?", durak sayısına göre metin; Günü sil ve Vazgeç', () => {
    expect(gunSilMetni(2)).toBe("2 durak Listem'e döner; yerler silinmez.");
    expect(gunSilMetni(0)).toBe('Bu günde durak yok.');
    const onSil = jest.fn();
    const onKapat = jest.fn();
    const { getByText } = render(<GunSilSayfasi gun={gun} baslik="Cuma 27" durakSayisi={2} onSil={onSil} onKapat={onKapat} />);
    expect(getByText('Cuma 27 silinsin mi?')).toBeTruthy();
    expect(getByText("2 durak Listem'e döner; yerler silinmez.")).toBeTruthy();
    fireEvent.press(getByText(t('gunler.gunuSil')));
    expect(onSil).toHaveBeenCalledWith(gun);
    fireEvent.press(getByText(t('genel.vazgec')));
    expect(onKapat).toHaveBeenCalled();
  });

  it('KK7: gün silinince (duraklar cascade) mekanlar kalır ve Listem\'de gün bekler', () => {
    const m = (id: string) => ({ id, created_at: `2026-11-0${id.length}T00:00:00Z` }) as unknown as Mekan;
    const mekanlar = [m('a'), m('bb'), m('ccc')];
    const duraklar = [
      { id: 'd1', day_id: 'g1', place_ref: 'a', order_key: 'a0' },
      { id: 'd2', day_id: 'g5', place_ref: 'bb', order_key: 'a0' },
      { id: 'd3', day_id: 'g5', place_ref: 'ccc', order_key: 'a1' },
    ] as unknown as Durak[];
    const once = listemGruplari({ mekanlar, duraklar, gunler: [], oylar: [], benId: null, siralama: 'plan' });
    expect(once.atanmamis.map((x) => x.mekan.id)).toEqual([]);
    const sonra = listemGruplari({ mekanlar, duraklar: duraklar.filter((d) => d.day_id !== 'g5'), gunler: [], oylar: [], benId: null, siralama: 'plan' });
    expect(sonra.atanmamis.map((x) => x.mekan.id)).toEqual(['bb', 'ccc']);
    expect(mekanlar.length).toBe(3);
  });
});
