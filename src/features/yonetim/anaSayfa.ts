// #109 ana sayfa düzeni — panelin saf kuralları: satır özeti, planlı yayın metni, yeni bölüm, taslak/yayın farkı. Testli.
import type { AnaSayfaBolumu, BolumTuru } from '@/lib/anaSayfa';
import { AYLAR_KISA } from '@/lib/takvim';

/** Taslak satırı (tablo): görünümdeki alanlar + açık/kapalı. */
export type TaslakBolum = AnaSayfaBolumu & { acik: boolean };

export const BOLUM_TURLERI: BolumTuru[] = ['serit', 'mozaik', 'tek_kart', 'sehir_seckisi'];

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
  if (b.kaynak === 'otomatik') {
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

/** "+ Bölüm ekle": sona, kapalı, elle (açılınca görünür; yayınlanmadıkça uygulamada yok). */
export function yeniBolum(bolumler: readonly { sira: number }[], baslik: string): Omit<TaslakBolum, 'id'> {
  return { tur: 'serit', baslik, sira: Math.max(0, ...bolumler.map((b) => b.sira)) + 1, acik: false, kaynak: 'elle', icerik: { gezi_idler: [] }, baslangic_at: null, bitis_at: null };
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
