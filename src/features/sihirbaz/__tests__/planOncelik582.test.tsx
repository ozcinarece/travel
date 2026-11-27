// #582: "Planı kur" grubun oylarını, il listesi sırasını ve kapalı günleri görür; Plan satırında "Pzt kapalı · Başka güne taşı".
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import { PlanListesi, type PlanSatirGorunumu } from '@/components/plan/PlanListesi';
import { kapaliGunKisa, tasinabilirGunler } from '@/features/plan/planListesi';
import { gundeKapali, oncelikSirasi, planKur, type PlanMekani } from '@/features/sihirbaz/planKur';
import { planiHesapla } from '@/features/sihirbaz/planUygula';
import { t } from '@/i18n';
import type { Durak, Gun, Mekan } from '@/lib/tipler';
import type { Periyot } from '@/schedule/acilis';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/components/ui/Foto', () => ({ Foto: () => null }));
jest.mock('@/components/harita/Harita', () => ({ Harita: () => null }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

// Eskişehir: Odunpazarı kümesi (birbirine yürüme mesafesi) ve ~5 km batıda Sazova.
const m = (id: string, lat: number, lng: number, dakika = 60, ek: Partial<PlanMekani> = {}): PlanMekani => ({ id, lat, lng, dakika, ...ek });
const o1 = m('o1', 39.7637, 30.5243);
const o2 = m('o2', 39.766, 30.526);
const s1 = m('s1', 39.77, 30.46);
const ids = (x: PlanMekani[]) => x.map((y) => y.id);

// 2026-11-30 Pazartesi, 12-01 Salı, 12-02 Çarşamba. Google hafta günü: Pzt = 1, Sal = 2, Çar = 3.
const PZT = 1;
const SAL = 2;
const gunlerTarihli = [
  { id: 'pzt', index: 1, haftaGunu: PZT },
  { id: 'sal', index: 2, haftaGunu: SAL },
  { id: 'car', index: 3, haftaGunu: 3 },
];

/** Pazartesi kapalı müze: Sal–Paz 09:00–17:00. */
const pztKapali: Periyot[] = [0, 2, 3, 4, 5, 6].map((gun) => ({ gun, ac: '09:00', kapaGun: gun, kapa: '17:00' }));

describe('#582 KK1 dağıtım önceliği: oy → il listesi sırası → yakınlık', () => {
  it('oy ve il sırası yoksa sıra değişmez (eski davranış)', () => {
    const sira = [o1, o2, s1];
    const r = oncelikSirasi(sira);
    expect(r.degisti).toBe(false);
    expect(r.sira).toBe(sira);
  });

  it('çok oylu önce; eşit oyda il listesi sırası; listede olmayan sonda; eşitlikte gezme (yakınlık) sırası', () => {
    const a = m('a', 39.76, 30.52, 60);
    const b = m('b', 39.76, 30.52, 60, { ilSira: 3 });
    const c = m('c', 39.76, 30.52, 60, { oy: 2 });
    const d = m('d', 39.76, 30.52, 60, { ilSira: 1 });
    const e = m('e', 39.76, 30.52, 60, { oy: 2, ilSira: 9 });
    expect(ids(oncelikSirasi([a, b, c, d, e]).sira)).toEqual(['e', 'c', 'd', 'b', 'a']);
  });

  it('kapasite yetmezse oylu mekan güne girer, oysuz yakın mekan atanmamış kalır', () => {
    // Tek gün, 2 mekanlık kapasite. Yakınlığa göre Odunpazarı ikilisi girerdi; Sazova'ya 2 oy var.
    const eski = planKur([o1, o2, s1], [{ id: 'g1', index: 1 }], { kapasiteDk: 130 });
    expect(ids(eski.gunler[0].mekanlar).sort()).toEqual(['o1', 'o2']);
    const oylu = planKur([o1, o2, { ...s1, oy: 2 }], [{ id: 'g1', index: 1 }], { kapasiteDk: 130 });
    expect(ids(oylu.gunler[0].mekanlar)[0]).toBe('s1');
    expect(ids(oylu.atanmamis).length).toBeGreaterThan(0);
    expect(ids(oylu.atanmamis)).not.toContain('s1');
  });

  it('il listesinde önde olan, listede olmayandan önce güne girer', () => {
    const p = planKur([o1, { ...o2, ilSira: 1 }], [{ id: 'g1', index: 1 }], { kapasiteDk: 60 });
    expect(ids(p.gunler[0].mekanlar)).toEqual(['o2']);
    expect(ids(p.atanmamis)).toEqual(['o1']);
  });

  it('planiHesapla: oy sayısı places.id ile, il sırası place_id ile eşleşir', () => {
    const mekan = (id: string, place_id: string, lat: number, lng: number): Mekan =>
      ({ id, trip_id: 't', place_id, primary_type: 'museum', lat, lng, google_fetched_at: '', default_minutes: 60, added_by: null, note: null, created_at: '' }) as Mekan;
    const mekanlar = [mekan('o1', 'P-o1', o1.lat!, o1.lng!), mekan('o2', 'P-o2', o2.lat!, o2.lng!), mekan('s1', 'P-s1', s1.lat!, s1.lng!)];
    const gunler = [{ id: 'g1', trip_id: 't', index: 1, date: null, start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null }] as Gun[];
    // Tam gün (9 sa): hepsi sığar, sıra öncelikle; gün içi yeniden yakınlık.
    const p = planiHesapla({ mekanlar, gunler, duraklar: [] as Durak[], oncelik: { oylar: new Map([['s1', 3]]), ilSira: new Map([['P-o2', 1]]) } });
    expect(ids(p.gunler[0].mekanlar).sort()).toEqual(['o1', 'o2', 's1']);
    // Gün içi sıra en yakın komşu: Odunpazarı ikilisi yan yana kalır (Sazova arada değil).
    const sira = ids(p.gunler[0].mekanlar);
    expect(Math.abs(sira.indexOf('o1') - sira.indexOf('o2'))).toBe(1);
  });
});

describe('#582 KK2 kapalı gün atlama', () => {
  it('Pazartesi kapalı mekan Pazartesi gününe konmaz, ertesi açık güne geçer', () => {
    const muze = { ...o1, kapaliGunler: [PZT] };
    const p = planKur([muze, o2], gunlerTarihli);
    expect(ids(p.gunler[0].mekanlar)).toEqual(['o2']);
    expect(ids(p.gunler[1].mekanlar)).toEqual(['o1']);
    expect(p.atanmamis).toEqual([]);
  });

  it('kapalı gün imleci ilerletmez: sonraki mekanlar yine Pazartesi gününe girebilir', () => {
    const muze = { ...o1, kapaliGunler: [PZT] };
    const p = planKur([muze, o2, s1], gunlerTarihli);
    expect(ids(p.gunler[0].mekanlar).sort()).toEqual(['o2', 's1']);
    expect(ids(p.gunler[1].mekanlar)).toEqual(['o1']);
  });

  it('bütün günlerde kapalıysa atanmamış kalır', () => {
    const p = planKur([{ ...o1, kapaliGunler: [PZT, SAL, 3] }], gunlerTarihli);
    expect(ids(p.atanmamis)).toEqual(['o1']);
  });

  it('saat yoksa (kapaliGunler yok) ya da gün tarihsizse kural uygulanmaz — eski davranış', () => {
    expect(gundeKapali({}, { haftaGunu: PZT })).toBe(false);
    expect(gundeKapali({ kapaliGunler: [PZT] }, { haftaGunu: null })).toBe(false);
    const saatsiz = planKur([o1, o2], gunlerTarihli);
    const eski = planKur([o1, o2], gunlerTarihli.map(({ id, index }) => ({ id, index })));
    expect(saatsiz).toEqual(eski);
    expect(ids(saatsiz.gunler[0].mekanlar).sort()).toEqual(['o1', 'o2']);
    const tarihsiz = planKur([{ ...o1, kapaliGunler: [PZT] }, o2], gunlerTarihli.map(({ id, index }) => ({ id, index })));
    expect(tarihsiz.gunler.map((g) => ids(g.mekanlar))).toEqual(eski.gunler.map((g) => ids(g.mekanlar)));
    expect(tarihsiz.atanmamis).toEqual([]);
  });

  it('planiHesapla: periyotlardan kapalı gün; saat bilinmiyorsa (null) kural yok', () => {
    const mekan = (id: string, place_id: string, lat: number, lng: number): Mekan =>
      ({ id, trip_id: 't', place_id, primary_type: 'museum', lat, lng, google_fetched_at: '', default_minutes: 60, added_by: null, note: null, created_at: '' }) as Mekan;
    const mekanlar = [mekan('o1', 'P-o1', o1.lat!, o1.lng!)];
    const gunler = [
      { id: 'pzt', trip_id: 't', index: 1, date: '2026-11-30' },
      { id: 'sal', trip_id: 't', index: 2, date: '2026-12-01' },
    ].map((g) => ({ ...g, start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null })) as Gun[];
    const kapali = planiHesapla({ mekanlar, gunler, duraklar: [], oncelik: { saatler: new Map([['P-o1', pztKapali]]) } });
    expect(ids(kapali.gunler[1].mekanlar)).toEqual(['o1']);
    const bilinmiyor = planiHesapla({ mekanlar, gunler, duraklar: [], oncelik: { saatler: new Map([['P-o1', null]]) } });
    expect(ids(bilinmiyor.gunler[0].mekanlar)).toEqual(['o1']);
    expect(ids(planiHesapla({ mekanlar, gunler, duraklar: [] }).gunler[0].mekanlar)).toEqual(['o1']);
  });
});

describe('#582 KK3 Plan satırında kapalı gün uyarısı', () => {
  it('"Pzt" günün tarihinden; açık günde, tarihsiz günde ya da saat yoksa uyarı yok', () => {
    expect(kapaliGunKisa('2026-11-30', pztKapali)).toBe('Pzt');
    expect(kapaliGunKisa('2026-12-01', pztKapali)).toBeNull();
    expect(kapaliGunKisa(null, pztKapali)).toBeNull();
    expect(kapaliGunKisa('2026-11-30', null)).toBeNull();
    expect(kapaliGunKisa('2026-11-30', undefined)).toBeNull();
    // Cumartesi kapalı → "Cmt" (dinamik kısaltma).
    expect(kapaliGunKisa('2026-12-05', [{ gun: 1, ac: '09:00', kapaGun: 1, kapa: '17:00' }])).toBe('Cmt');
  });

  it('"Başka güne taşı" seçenekleri: kendi günü ve kapalı günler yok', () => {
    const gunler = [
      { id: 'pzt', index: 1, date: '2026-11-30' },
      { id: 'pzt2', index: 8, date: '2026-12-07' },
      { id: 'sal', index: 2, date: '2026-12-01' },
      { id: 'tarihsiz', index: 3, date: null },
    ];
    expect(tasinabilirGunler(gunler, 'sal', pztKapali).map((g) => g.id)).toEqual(['tarihsiz']);
    expect(tasinabilirGunler(gunler, 'pzt', null).map((g) => g.id)).toEqual(['sal', 'tarihsiz', 'pzt2']);
  });

  const satir = (ek: Partial<PlanSatirGorunumu> = {}): PlanSatirGorunumu => ({
    id: 'd1',
    mekanId: 'm1',
    numara: 1,
    numaraRengi: '#7B4FE0',
    saat: '10:00',
    ad: 'Müze',
    alt: 'Müze · 1 sa',
    gelis: null,
    vurgulu: false,
    buradasin: false,
    gecildi: false,
    atlandi: false,
    ...ek,
  });
  const gun = { id: 'pzt', trip_id: 't', index: 1, date: '2026-11-30', start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null } as Gun;
  const ciz = (satirlar: PlanSatirGorunumu[], onBaskaGuneTasi?: (id: string) => void) =>
    render(
      <PlanListesi
        bugun={false}
        bosGun={null}
        onHarita={() => undefined}
        onDaha={() => undefined}
        gunler={[gun]}
        seciliGunId={gun.id}
        sekmeEtiketi={() => 'Pzt 30'}
        gunRengi={() => '#7B4FE0'}
        onGunSec={() => undefined}
        onGunUzunBas={() => undefined}
        ozet={null}
        otel={null}
        satirlar={satirlar}
        onDurak={() => undefined}
        onDurakUzunBas={() => undefined}
        onBaskaGuneTasi={onBaskaGuneTasi}
        onEkle={null}
        aksam={null}
        listem={null}
        uyari={null}
      />,
    );

  it('uyarı satırı "Pzt kapalı" #C25200; "Başka güne taşı" tek dokunuşla durağı verir', () => {
    const tasi = jest.fn();
    const { getByText } = ciz([satir({ kapali: t('plan.kapaliGun', { gun: 'Pzt' }) })], tasi);
    const uyari = getByText('Pzt kapalı');
    expect(uyari.props.style).toEqual(expect.objectContaining({ color: '#C25200', fontSize: 13 }));
    fireEvent.press(getByText(t('plan.baskaGuneTasi')));
    expect(tasi).toHaveBeenCalledWith('d1');
  });

  it('saat yoksa (kapali null) uyarı satırı yok', () => {
    const { queryByText } = ciz([satir({ kapali: null })], () => undefined);
    expect(queryByText(/kapalı/)).toBeNull();
    expect(queryByText(t('plan.baskaGuneTasi'))).toBeNull();
  });
});
