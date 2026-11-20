// #109 ana sayfa düzeni — panelin saf kuralları: satır özeti, planlı yayın metni, yeni bölüm, taslak/yayın farkı. Testli.
import type { AnaSayfaBolumu, BannerHedefi, BolumTuru, RafTuru } from '@/lib/anaSayfa';
import { AYLAR_KISA } from '@/lib/takvim';

/** Taslak satırı (tablo): görünümdeki alanlar + açık/kapalı. */
export type TaslakBolum = AnaSayfaBolumu & { acik: boolean };

export const BOLUM_TURLERI: BolumTuru[] = ['serit', 'mozaik', 'tek_kart', 'sehir_seckisi'];

/** #406 2/2: v6 Keşfet'in türleri; "+ Bölüm ekle" ve tür seçimi yalnız bunları sunar (#428, soru 6). */
export const V6_TURLERI = ['raf', 'banner'] as const satisfies readonly BolumTuru[];
/** Panelde seçilebilen raf türleri (`arkadaslardan` 26 Kasım paylaşımından sonra). */
export const RAF_TURLERI = ['amac', 'sehir', 'elle'] as const satisfies readonly RafTuru[];
export const BANNER_HEDEF_TURLERI = ['gezi', 'sehir', 'raf'] as const satisfies readonly BannerHedefi['tur'][];

/** v6 Keşfet'te çizilmeyen eski tür mü (panelde gri, "v6'da görünmez"). */
export function eskiTurMu(tur: BolumTuru): boolean {
  return tur !== 'banner' && tur !== 'raf';
}

/** v6 türünün boş içeriği (tür değişince eski alanlar düşer). Raf elle ve boş başlar; banner hedefsiz. */
export function v6BosIcerik(tur: 'banner' | 'raf'): AnaSayfaBolumu['icerik'] {
  return tur === 'raf' ? { raf_turu: 'elle', gezi_idler: [] } : {};
}

/** Raf türü değişince içerik: yalnız o türün alanı kalır. */
export function rafIcerigi(raf_turu: (typeof RAF_TURLERI)[number], deger: { amac?: string; sehir_id?: string; gezi_idler?: string[] } = {}): AnaSayfaBolumu['icerik'] {
  if (raf_turu === 'amac') return deger.amac ? { raf_turu, amac: deger.amac } : { raf_turu };
  if (raf_turu === 'sehir') return deger.sehir_id ? { raf_turu, sehir_id: deger.sehir_id } : { raf_turu };
  return { raf_turu, gezi_idler: deger.gezi_idler ?? [] };
}

/** Banner içeriğine alan yazar; boş metin ve `null` alanı siler (DB fazladan anahtar ve boş üst yazı kabul etmez). */
export function bannerIcerigi(eski: AnaSayfaBolumu['icerik'], degisen: Partial<Pick<AnaSayfaBolumu['icerik'], 'ust_yazi' | 'kapak_url' | 'kapak_atif' | 'hedef'>>): AnaSayfaBolumu['icerik'] {
  const yeni: Record<string, unknown> = {};
  for (const k of ['ust_yazi', 'kapak_url', 'kapak_atif', 'hedef'] as const) {
    const v = k in degisen ? degisen[k] : eski[k];
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) continue;
    yeni[k] = typeof v === 'string' ? v.trim() : v;
  }
  return yeni as AnaSayfaBolumu['icerik'];
}

/**
 * KK-ek1 · KK-ek2: banner görsel adresi DB kuralının (`banner_gorsel_adresi_gecerli`) aynısı; panel kaydetmeden önce
 * anlaşılır hata gösterir. Yalnız Commons (`upload.wikimedia.org`) ya da kendi `icerik` kovamız; izin listesi dışındaki
 * karakter (boşluk, sekme, satır sonu, `?`, `#`, `(` …) ve yol hilesi reddedilir.
 */
export function bannerAdresiGecerli(adres: string): boolean {
  return (
    adres.length <= 500 &&
    /^[A-Za-z0-9._~/:%-]+$/.test(adres) &&
    /^https:\/\/(upload\.wikimedia\.org\/|xwqeobelyeuzoxyuvauw\.supabase\.co\/storage\/v1\/object\/public\/icerik\/)/.test(adres) &&
    !/(\.\.|%2e|%2f|%5c|%25|\\)/i.test(adres)
  );
}

type Adli = { id: string; ad: string };

/** "20 Eki 09:00" (panel kullanıcısının yerel saati). */
export function kisaTarih(iso: string): string {
  const t = new Date(iso);
  return `${t.getDate()} ${AYLAR_KISA[t.getMonth()]} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

/** Bölüm içeriğinin hangi listeden seçildiği. */
export function icerikTuru(tur: BolumTuru): 'gezi' | 'yer' | 'sehir' {
  return tur === 'mozaik' ? 'yer' : tur === 'sehir_seckisi' ? 'sehir' : 'gezi';
}

/** İçerik anahtarı (tablo `icerik` jsonb). */
export function icerikAnahtari(tur: BolumTuru): 'gezi_id' | 'gezi_idler' | 'yer_idler' | 'sehir_idler' {
  return tur === 'tek_kart' ? 'gezi_id' : tur === 'serit' ? 'gezi_idler' : tur === 'mozaik' ? 'yer_idler' : 'sehir_idler';
}

/** Elle seçilmiş kimlikler (tek kart için tek öğeli liste). */
export function seciliIdler(b: Pick<AnaSayfaBolumu, 'tur' | 'icerik'>): string[] {
  if (b.tur === 'tek_kart') return b.icerik.gezi_id ? [b.icerik.gezi_id] : [];
  return b.icerik[icerikAnahtari(b.tur) as 'gezi_idler' | 'yer_idler' | 'sehir_idler'] ?? [];
}

/** Seçim değişince yazılacak içerik (tür değişince eski anahtar düşer). */
export function icerikYaz(tur: BolumTuru, idler: string[]): AnaSayfaBolumu['icerik'] {
  return tur === 'tek_kart' ? { gezi_id: idler[0] ?? null } : { [icerikAnahtari(tur)]: idler };
}

/**
 * Kanvastaki satır alt yazısı: "Bursa · Kapadokya · İzmir · + 2 (sıra: elle)", "otomatik: en çok alınan (son 30 gün)",
 * "(sıra: öne çıkan sırası)"; planlıysa "· açılış … · kapanış …".
 */
export function bolumOzeti(
  b: TaslakBolum,
  adlar: { geziler: readonly { id: string; baslik: string }[]; yerler: readonly Adli[]; sehirler: readonly Adli[] },
  metin: (anahtar: string, degerler?: Record<string, string | number>) => string,
): string {
  const kaynakListe = icerikTuru(b.tur) === 'gezi' ? adlar.geziler.map((g) => ({ id: g.id, ad: g.baslik })) : icerikTuru(b.tur) === 'yer' ? adlar.yerler : adlar.sehirler;
  const ad = (id: string) => kaynakListe.find((x) => x.id === id)?.ad;
  const parcalar: string[] = [];
  if (b.tur === 'banner' || b.tur === 'raf') {
    parcalar.push(v6Ozeti(b, adlar, metin));
  } else if (b.kaynak === 'otomatik') {
    parcalar.push(metin(`anaSayfa.otomatik.${b.tur}`));
  } else {
    const adlari = seciliIdler(b).map(ad).filter((x): x is string => !!x);
    if (b.tur === 'tek_kart') parcalar.push(adlari[0] ? `${adlari[0]} · ${metin('anaSayfa.elleSabit')}` : metin('anaSayfa.secilmedi'));
    else if (!adlari.length) parcalar.push(metin('anaSayfa.secilmedi'));
    else parcalar.push(`${adlari.slice(0, 3).join(' · ')}${adlari.length > 3 ? ` · + ${adlari.length - 3}` : ''} ${metin('anaSayfa.siraElle')}`);
  }
  if (b.baslangic_at) parcalar.push(metin('anaSayfa.acilis', { tarih: kisaTarih(b.baslangic_at) }));
  if (b.bitis_at) parcalar.push(metin('anaSayfa.kapanis', { tarih: kisaTarih(b.bitis_at) }));
  return parcalar.join(' · ');
}

/** #406: banner ve raf satırının özeti ("Bu kış · hedef: raf", "amaç: Lezzet", "şehir: Bursa", "elle seçilmiş 4 gezi"). */
function v6Ozeti(b: TaslakBolum, adlar: { sehirler: readonly Adli[] }, metin: (anahtar: string, degerler?: Record<string, string | number>) => string): string {
  const i = b.icerik;
  if (b.tur === 'banner') {
    const hedef = i.hedef ? metin('anaSayfa.v6Ozet.bannerHedef', { hedef: metin(`anaSayfa.v6Ozet.hedef.${i.hedef.tur}`) }) : metin('anaSayfa.v6Ozet.bannerHedefsiz');
    return [i.ust_yazi, hedef].filter(Boolean).join(' · ');
  }
  switch (i.raf_turu) {
    case 'amac':
      return metin('anaSayfa.v6Ozet.raf.amac', { amac: i.amac ?? '—' });
    case 'sehir':
      return metin('anaSayfa.v6Ozet.raf.sehir', { sehir: adlar.sehirler.find((x) => x.id === i.sehir_id)?.ad ?? '—' });
    case 'arkadaslardan':
      return metin('anaSayfa.v6Ozet.raf.arkadaslardan');
    default:
      return metin('anaSayfa.v6Ozet.raf.elle', { n: i.gezi_idler?.length ?? 0 });
  }
}

/** Kanvastaki "Planlı yayın:" kutusu: tarihli bölümlerin satırları (yoksa boş). */
export function planliSatirlar(bolumler: readonly TaslakBolum[], metin: (anahtar: string, degerler?: Record<string, string | number>) => string): string[] {
  return bolumler
    .filter((b) => b.baslangic_at || b.bitis_at)
    .map((b) =>
      [
        `"${b.baslik}"`,
        b.baslangic_at ? metin('anaSayfa.acilis', { tarih: kisaTarih(b.baslangic_at) }) : null,
        b.bitis_at ? metin('anaSayfa.kapanis', { tarih: kisaTarih(b.bitis_at) }) : null,
      ]
        .filter(Boolean)
        .join(' · '),
    );
}

/** "+ Bölüm ekle": sona, kapalı, elle seçimli boş raf (#406 2/2; açılınca görünür, yayınlanmadıkça uygulamada yok). */
export function yeniBolum(bolumler: readonly { sira: number }[], baslik: string): Omit<TaslakBolum, 'id'> {
  return { tur: 'raf', baslik, sira: Math.max(0, ...bolumler.map((b) => b.sira)) + 1, acik: false, kaynak: 'elle', icerik: v6BosIcerik('raf'), baslangic_at: null, bitis_at: null };
}

const KARSILASTIR = ['id', 'tur', 'baslik', 'sira', 'acik', 'kaynak', 'icerik', 'baslangic_at', 'bitis_at'] as const;

/** Taslak son yayından farklı mı ("Yayınlanmamış değişiklik var"). Zamanlar ISO olarak karşılaştırılır. */
export function yayindanFarkli(taslak: readonly TaslakBolum[], yayin: readonly Record<string, unknown>[] | null): boolean {
  if (!yayin) return taslak.length > 0;
  if (taslak.length !== yayin.length) return true;
  const zaman = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v).getTime() : v);
  const sirali = [...taslak].sort((a, c) => a.sira - c.sira);
  const yayinSirali = [...yayin].sort((a, c) => Number(a.sira) - Number(c.sira));
  return sirali.some((b, i) => KARSILASTIR.some((k) => JSON.stringify(zaman(b[k])) !== JSON.stringify(zaman(yayinSirali[i][k]))));
}
