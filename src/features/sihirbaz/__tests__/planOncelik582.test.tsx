// #582: "Planı kur" grubun oylarını, il listesi sırasını ve kapalı günleri görür; Plan satırında "Pzt kapalı · Başka güne taşı".
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import { ALT_SATIR_YUKSEKLIK, altParcala, durakEtiketi, PlanListesi, TASI_EYLEMI, TASI_HITSLOP, type PlanSatirGorunumu } from '@/components/plan/PlanListesi';
import { kapaliGunKisa, tasinabilirGunler } from '@/features/plan/planListesi';
import { gundeKapali, oncelikSirasi, planKur, type PlanMekani } from '@/features/sihirbaz/planKur';
import { planiHesapla, planOnceliginiOku, SAAT_SURESI_MS } from '@/features/sihirbaz/planUygula';
import { hafifOnbellek, type HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import type { Durak, Gun, Mekan } from '@/lib/tipler';
import type { Periyot } from '@/schedule/acilis';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/components/ui/Foto', () => ({ Foto: () => null }));
jest.mock('@/components/harita/Harita', () => ({ Harita: () => null }));
// Zincirlenebilir sorgu taklidi: her çağrı `mockCagrilar`a yazılır; sonuç tabloya göre `mockVeri`den.
const mockCagrilar: { tablo: string; yontem: string; arg: unknown[] }[] = [];
const mockVeri: Record<string, unknown[]> = {};
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tablo: string) => {
      const sonuc = () => Promise.resolve({ data: mockVeri[tablo] ?? [], error: null });
      const q: Record<string, unknown> = {};
      for (const yontem of ['select', 'eq', 'in']) {
        q[yontem] = (...arg: unknown[]) => {
          mockCagrilar.push({ tablo, yontem, arg });
          return q;
        };
      }
      q.maybeSingle = () => Promise.resolve({ data: (mockVeri[tablo] ?? [])[0] ?? null, error: null });
      q.then = (c: (v: unknown) => unknown, h?: (e: unknown) => unknown) => sonuc().then(c, h);
      return q;
    },
  },
}));

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
    altTur: 'Müze',
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

  const duz = (stil: unknown) => Object.assign({}, ...[stil].flat(Infinity).filter(Boolean)) as Record<string, unknown>;
  const pzt = (ek: Partial<PlanSatirGorunumu> = {}) => satir({ kapali: t('plan.kapaliGun', { gun: 'Pzt' }), kapaliUzun: t('plan.kapaliGun', { gun: 'Pazartesi' }), tasinabilir: true, ...ek });

  it('uyarı alt satırın içinde: "Müze · 1 sa · Pzt kapalı · Başka güne taşı ›"; ayrı ikinci satır yok', () => {
    const tasi = jest.fn();
    const { getByText, queryByText } = ciz([pzt({ ad: 'Eti Arkeoloji' })], tasi);
    // Alt satır tek başına (uyarısız biçimde) çizilmez; parçalar aynı satırda.
    expect(queryByText('Müze · 1 sa')).toBeNull();
    const tur = getByText('Müze', { exact: true });
    const ara = getByText(' · 1 sa · ');
    const uyari = getByText('Pzt kapalı');
    const bag = getByText(t('plan.baskaGuneTasiBag'));
    expect(t('plan.baskaGuneTasiBag')).toBe('Başka güne taşı ›');
    // Hepsi aynı satır kabında (flexDirection row).
    const satirKabi = tur.parent?.parent;
    expect(duz(satirKabi?.props.style).flexDirection).toBe('row');
    for (const n of [ara, uyari]) expect(n.parent?.parent).toBe(satirKabi);
    fireEvent.press(bag);
    expect(tasi).toHaveBeenCalledWith('d1');
  });

  it('renk ve ağırlık: "Pzt kapalı" #C25200 normal, "Başka güne taşı ›" #C25200 yarı kalın; boyut alt satırla aynı', () => {
    const uyarisiz = ciz([satir({ id: 'd2' })]);
    const altBoyut = duz(uyarisiz.getByText('Müze · 1 sa').props.style).fontSize;
    uyarisiz.unmount();
    const { getByText } = ciz([pzt()], () => undefined);
    const uyari = duz(getByText('Pzt kapalı').props.style);
    const bag = duz(getByText(t('plan.baskaGuneTasiBag')).props.style);
    expect(uyari).toEqual(expect.objectContaining({ color: '#C25200', fontFamily: 'Figtree_400Regular', fontSize: altBoyut }));
    expect(bag).toEqual(expect.objectContaining({ color: '#C25200', fontFamily: 'Figtree_600SemiBold', fontSize: altBoyut }));
    // Ayraçlar gri (alt satır rengi); turuncu yalnız uyarı ve bağlantı.
    expect(duz(getByText(' · ', { exact: true }).props.style).color).not.toBe('#C25200');
  });

  it('tek satır; kısalma sırası önce tür, sonra süre (numberOfLines 1); uyarı ve bağlantı kesilmez (flexShrink 0)', () => {
    const { getByText, getByLabelText } = ciz([pzt({ ad: 'Eti Arkeoloji', alt: 'Arkeoloji müzesi ve sanat galerisi · 1 sa 30 dk', altTur: 'Arkeoloji müzesi ve sanat galerisi' })], () => undefined);
    const tur = getByText('Arkeoloji müzesi ve sanat galerisi');
    const ara = getByText(' · 1 sa 30 dk · ');
    expect(tur.props.numberOfLines).toBe(1);
    expect(ara.props.numberOfLines).toBe(1);
    expect(duz(tur.props.style).flexShrink).toBeGreaterThanOrEqual(1000);
    expect(duz(ara.props.style).flexShrink).toBe(1);
    expect(duz(getByText('Pzt kapalı').props.style).flexShrink).toBe(0);
    expect(duz(getByLabelText('Pazartesi kapalı. Başka güne taşı').props.style).flexShrink).toBe(0);
  });

  it('320 dp: tür önce tükenir, süre kısalır, "Pzt kapalı" ve bağlantı tam genişlikte kalır', () => {
    // Yoga'nın flex-shrink payı: taşma, (flexShrink × doğal genişlik) oranında dağıtılır; 0'a inen dondurulur.
    const kucult = (alan: number, ogeler: { w: number; shrink: number }[]) => {
      const w = ogeler.map((o) => o.w);
      for (let tur = 0; tur < ogeler.length; tur++) {
        const tasma = w.reduce((a, b) => a + b, 0) - alan;
        const etkin = ogeler.map((o, i) => (o.shrink > 0 && w[i] > 0 ? o.shrink * o.w : 0));
        const top = etkin.reduce((a, b) => a + b, 0);
        if (tasma <= 0 || top === 0) break;
        ogeler.forEach((_, i) => (w[i] = Math.max(0, w[i] - (tasma * etkin[i]) / top)));
      }
      return w;
    };
    const { getByText, getByLabelText } = ciz([pzt({ alt: 'Tarihî yer · 1 sa 30 dk', altTur: 'Tarihî yer' })], () => undefined);
    const shrink = (n: { props: { [k: string]: unknown } }) => (duz(n.props.style).flexShrink as number) ?? 0;
    const px = (m: string) => m.length * 6.6; // 13 px Figtree için kaba ortalama
    // 320 − 2×16 kenar − 44 saat − 12 − 28 daire − 12 = 192 px içerik.
    const alan = 320 - 32 - 44 - 12 - 28 - 12;
    const ogeler = [
      { w: px('Tarihî yer'), shrink: shrink(getByText('Tarihî yer')) },
      { w: px(' · 1 sa 30 dk · '), shrink: shrink(getByText(' · 1 sa 30 dk · ')) },
      { w: px('Pzt kapalı'), shrink: shrink(getByText('Pzt kapalı')) },
      { w: px(' · '), shrink: 0 },
      { w: px('Başka güne taşı ›'), shrink: shrink(getByLabelText('Pazartesi kapalı. Başka güne taşı')) },
    ];
    const [tur, ara, uyari, ayrac, bag] = kucult(alan, ogeler);
    expect(tur).toBeLessThan(1);
    expect(ara).toBeLessThan(ogeler[1].w);
    expect(uyari).toBe(ogeler[2].w);
    expect(ayrac).toBe(ogeler[3].w);
    expect(bag).toBe(ogeler[4].w);
  });

  it('altParcala: tür ayrı, "· süre ·" sabit; tür yoksa yalnız süre', () => {
    expect(altParcala({ alt: 'Müze · 1 sa', altTur: 'Müze' })).toEqual({ tur: 'Müze', ara: ' · 1 sa · ' });
    expect(altParcala({ alt: '1 sa', altTur: null })).toEqual({ tur: null, ara: '1 sa · ' });
    expect(altParcala({ alt: 'Müze', altTur: 'Müze' })).toEqual({ tur: 'Müze', ara: ' · ' });
    expect(altParcala({ alt: '', altTur: null })).toEqual({ tur: null, ara: '' });
  });

  it('saat yoksa (kapali null) uyarı yok; alt satır eskisi gibi', () => {
    const { queryByText, getByText } = ciz([satir({ kapali: null })], () => undefined);
    expect(queryByText(/kapalı/)).toBeNull();
    expect(queryByText(t('plan.baskaGuneTasiBag'))).toBeNull();
    expect(getByText('Müze · 1 sa')).toBeTruthy();
  });

  it('ekran okuyucu: bağlantı "Pazartesi kapalı. Başka güne taşı"; satır gün adını tam okur ve özel eylemi durağı verir', () => {
    const tasi = jest.fn();
    const r = pzt();
    const { getByLabelText } = ciz([r], tasi);
    expect(getByLabelText('Pazartesi kapalı. Başka güne taşı')).toBeTruthy();
    expect(durakEtiketi(r)).toContain('Pazartesi kapalı');
    const dugme = getByLabelText(durakEtiketi(r));
    expect(dugme.props.accessibilityActions).toEqual([{ name: TASI_EYLEMI, label: t('plan.baskaGuneTasi') }]);
    // Eylem menüsünü açmayan kullanıcı da duyar.
    expect(dugme.props.accessibilityHint).toBe(t('plan.baskaGuneTasi'));
    fireEvent(dugme, 'accessibilityAction', { nativeEvent: { actionName: TASI_EYLEMI } });
    expect(tasi).toHaveBeenCalledWith('d1');
  });

  it('dokunma alanı hitSlop ile 44 pt; bağlantıda dolgu yok (satır yüksekliği uyarısız satırla aynı)', () => {
    const uyarisiz = ciz([satir({ id: 'd2' })]);
    expect(duz(uyarisiz.getByText('Müze · 1 sa').props.style).lineHeight).toBe(ALT_SATIR_YUKSEKLIK);
    uyarisiz.unmount();
    const { getByLabelText, getByText } = ciz([pzt()], () => undefined);
    const baglanti = getByLabelText('Pazartesi kapalı. Başka güne taşı');
    expect(baglanti.props.hitSlop).toEqual(TASI_HITSLOP);
    // Alt satır 18 pt + üst/alt hitSlop ≥ 44; altta durağın 8 pt dolgusunu aşmaz (Android).
    expect(ALT_SATIR_YUKSEKLIK + TASI_HITSLOP.top + TASI_HITSLOP.bottom).toBeGreaterThanOrEqual(44);
    expect(TASI_HITSLOP.bottom).toBeLessThanOrEqual(8);
    expect(duz(getByText(t('plan.baskaGuneTasiBag')).props.style).lineHeight).toBe(ALT_SATIR_YUKSEKLIK);
    const stil = duz(baglanti.props.style);
    for (const k of ['padding', 'paddingVertical', 'paddingTop', 'paddingBottom', 'minHeight', 'height', 'marginVertical']) expect(stil[k]).toBeUndefined();
  });

  it('taşınacak gün yoksa bağlantı ve eylem yok; "Pzt kapalı" kalır', () => {
    const r = satir({ kapali: 'Pzt kapalı', tasinabilir: false });
    const { getByText, queryByText, getByLabelText } = ciz([r], () => undefined);
    expect(getByText('Pzt kapalı')).toBeTruthy();
    expect(queryByText(t('plan.baskaGuneTasi'))).toBeNull();
    expect(getByLabelText(durakEtiketi(r)).props.accessibilityActions).toBeUndefined();
    // Tek gün ya da diğer günlerin hepsi kapalı → taşınacak gün yok.
    expect(tasinabilirGunler([{ id: 'pzt', index: 1, date: '2026-11-30' }], 'pzt', pztKapali)).toEqual([]);
    expect(tasinabilirGunler([{ id: 'pzt', index: 1, date: '2026-11-30' }, { id: 'pzt2', index: 2, date: '2026-12-07' }], 'pzt', pztKapali)).toEqual([]);
  });
});

describe('#582 planOnceliginiOku', () => {
  const mekan = (id: string, place_id: string): Mekan =>
    ({ id, trip_id: 't', place_id, primary_type: 'museum', lat: 39.76, lng: 30.52, google_fetched_at: '', default_minutes: 60, added_by: null, note: null, created_at: '' }) as Mekan;
  const mekanlar = [mekan('m1', 'P1'), mekan('m2', 'P2')];

  it('saat okuması süre sınırını (4 sn) aşarsa saatsiz kurulur; oy ve il sırası yine okunur', async () => {
    expect(SAAT_SURESI_MS).toBe(4000);
    const casus = jest.spyOn(hafifOnbellek, 'getirHepsi').mockReturnValue(new Promise(() => undefined));
    mockVeri.oylar = [{ mekan: 'm2' }, { mekan: 'm2' }];
    mockVeri.il_oneriler = [{ place_id: 'P1', sira: 4 }];
    const o = await planOnceliginiOku('t', mekanlar, [], true, { ilSlug: 'eskisehir', saatSuresiMs: 20 });
    expect(o.saatler).toBeUndefined();
    expect(o.oylar?.get('m2')).toBe(2);
    expect(o.ilSira?.get('P1')).toBe(4);
    casus.mockRestore();
  });

  it('süre içinde gelen saatler kullanılır', async () => {
    const yer = { place_id: 'P1', periyotlar: pztKapali } as unknown as HafifYer;
    const casus = jest.spyOn(hafifOnbellek, 'getirHepsi').mockResolvedValue({ P1: yer });
    const o = await planOnceliginiOku('t', mekanlar, [], true, { ilSlug: null });
    expect(o.saatler?.get('P1')).toBe(pztKapali);
    expect(o.saatler?.get('P2')).toBeUndefined();
    casus.mockRestore();
  });

  it('il sırası yalnız seyahatin ilinin listesinden; il bilinmiyorsa il sırası yok', async () => {
    mockCagrilar.length = 0;
    mockVeri.il_oneriler = [{ place_id: 'P1', sira: 1 }];
    await planOnceliginiOku('t', mekanlar, [], false, { ilSlug: 'eskisehir' });
    expect(mockCagrilar).toContainEqual({ tablo: 'il_oneriler', yontem: 'eq', arg: ['il_slug', 'eskisehir'] });
    mockCagrilar.length = 0;
    const o = await planOnceliginiOku('t', mekanlar, [], false, { ilSlug: null });
    expect(o.ilSira).toBeUndefined();
    expect(mockCagrilar.some((c) => c.tablo === 'il_oneriler')).toBe(false);
  });

  it('il seyahatten çözülür: rehber şehri yoksa şehir adının slug\'ı', async () => {
    mockCagrilar.length = 0;
    mockVeri.trips = [{ city_label: 'Eskişehir, Türkiye', lat: 39.77, lng: 30.52 }];
    mockVeri.sehirler = [];
    await planOnceliginiOku('t', mekanlar, [], false);
    expect(mockCagrilar).toContainEqual({ tablo: 'il_oneriler', yontem: 'eq', arg: ['il_slug', 'eskisehir'] });
  });
});
