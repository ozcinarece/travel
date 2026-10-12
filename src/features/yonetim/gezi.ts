// #107 gezi editörü — saf kurallar (slug, yayın durumu, markdown araç çubuğu, sıra, otomatik kayıt farkı). Testli.
import { AYLAR_KISA } from '@/lib/takvim';

export type GeziDurumu = 'yayinda' | 'taslak' | 'planli';

/** Editörün tuttuğu gezi alanları (Genel + Yazı sekmeleri). */
export type GeziAlanlari = {
  baslik: string;
  slug: string;
  sehir_id: string;
  ozet: string | null;
  yazar_ad: string | null;
  yazi_md: string | null;
  kapak_url: string | null;
  yayin: boolean;
  yayin_at: string | null;
};

const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

/** "Odunpazarı'ndan Porsuk'a iki gün" → "odunpazarindan-porsuka-iki-gun" (DB kısıtı: ^[a-z0-9-]{2,80}$). */
export function slugUret(baslik: string): string {
  const s = baslik
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (h) => TR[h])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return s.length >= 2 ? s : 'gezi';
}

export function gecerliSlug(slug: string): boolean {
  return /^[a-z0-9-]{2,80}$/.test(slug);
}

/** Taslak: yayin=false; Planlı: yayin=true ve zamanı gelmemiş; aksi Yayında (DB okuma politikasıyla aynı kural). */
export function geziDurumu(g: { yayin: boolean; yayin_at: string | null }, simdi: Date = new Date()): GeziDurumu {
  if (!g.yayin) return 'taslak';
  if (g.yayin_at && new Date(g.yayin_at).getTime() > simdi.getTime()) return 'planli';
  return 'yayinda';
}

// Planlı yayın saati İstanbul'a göre girilir ve gösterilir (Türkiye 2016'dan beri yaz saati olmadan UTC+3).
const ISTANBUL = 'Europe/Istanbul';

/** ISO → İstanbul'da { tarih: "2026-10-20", saat: "09:00" }. */
export function istanbulParcalari(iso: string): { tarih: string; saat: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: ISTANBUL, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return { tarih: `${p.year}-${p.month}-${p.day}`, saat: `${p.hour}:${p.minute}` };
}

/** İstanbul tarihi + saati → ISO; bozuksa null. */
export function istanbuldanIso(tarih: string, saat: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih) || !/^\d{2}:\d{2}$/.test(saat)) return null;
  const t = new Date(`${tarih}T${saat}:00+03:00`);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

/** "2026-10-20" → "20 Eki 2026". */
export function tarihGosterimi(tarih: string): string {
  const [y, a, g] = tarih.split('-').map(Number);
  return `${g} ${AYLAR_KISA[a - 1]} ${y}`;
}

/** Durum seçimi → DB alanları. Planlıda tarih yoksa ya da geçmişteyse yarın 09:00 (İstanbul). Yayında'da gelecekteki tarih bugüne çekilir. */
export function durumAlanlari(durum: GeziDurumu, planli: string | null, simdi: Date = new Date()): { yayin: boolean; yayin_at: string | null } {
  if (durum === 'taslak') return { yayin: false, yayin_at: planli };
  if (durum === 'yayinda') {
    const gecmis = planli && new Date(planli).getTime() <= simdi.getTime();
    return { yayin: true, yayin_at: gecmis ? planli : simdi.toISOString() };
  }
  if (planli && new Date(planli).getTime() > simdi.getTime()) return { yayin: true, yayin_at: planli };
  // Yarın 09:00 İstanbul (kanvas: "Uygulamada … görünür (İstanbul)").
  const yarin = new Date(`${istanbulParcalari(simdi.toISOString()).tarih}T00:00:00Z`);
  yarin.setUTCDate(yarin.getUTCDate() + 1);
  return { yayin: true, yayin_at: istanbuldanIso(yarin.toISOString().slice(0, 10), '09:00')! };
}

/** "Yayınla": planlı tarih gelecekteyse onunla, değilse şimdi. */
export function yayinlaAlanlari(g: { yayin_at: string | null }, simdi: Date = new Date()): { yayin: true; yayin_at: string } {
  const ileri = g.yayin_at && new Date(g.yayin_at).getTime() > simdi.getTime();
  return { yayin: true, yayin_at: ileri ? g.yayin_at! : simdi.toISOString() };
}

/** Otomatik kayıtta yalnız değişen alanlar yazılır; fark yoksa null. */
export function kayitFarki<T extends object>(sunucu: T, taslak: T): Partial<T> | null {
  const fark: Partial<T> = {};
  for (const k of Object.keys(taslak) as (keyof T)[]) {
    if (taslak[k] !== sunucu[k]) fark[k] = taslak[k];
  }
  return Object.keys(fark).length ? fark : null;
}

/** Diziyi `kaynak` indisinden `hedef` indisine taşır (sürükle-bırak). */
export function tasi<T>(dizi: readonly T[], kaynak: number, hedef: number): T[] {
  const yeni = [...dizi];
  if (kaynak < 0 || kaynak >= yeni.length || hedef < 0 || hedef >= yeni.length || kaynak === hedef) return yeni;
  const [oge] = yeni.splice(kaynak, 1);
  yeni.splice(hedef, 0, oge);
  return yeni;
}

export type Secim = { start: number; end: number };
export type MdArac = 'kalin' | 'italik' | 'h2' | 'alinti' | 'liste';

/**
 * KK3 araç çubuğu: seçimi sarar (B, I) ya da seçili satırların başına işaret koyar (H2, alıntı, liste).
 * Dönen seçim yeni metindeki işaretlenmiş bölümdür.
 */
export function mdArac(metin: string, secim: Secim, arac: MdArac): { metin: string; secim: Secim } {
  const { start, end } = secim;
  if (arac === 'kalin' || arac === 'italik') {
    const isaret = arac === 'kalin' ? '**' : '*';
    const ic = metin.slice(start, end) || (arac === 'kalin' ? 'kalın' : 'italik');
    const yeni = `${metin.slice(0, start)}${isaret}${ic}${isaret}${metin.slice(end)}`;
    return { metin: yeni, secim: { start: start + isaret.length, end: start + isaret.length + ic.length } };
  }
  const onek = arac === 'h2' ? '## ' : arac === 'alinti' ? '> ' : '- ';
  const satirBasi = metin.lastIndexOf('\n', start - 1) + 1;
  const satirSonuAra = metin.indexOf('\n', Math.max(end - 1, start));
  const satirSonu = satirSonuAra === -1 ? metin.length : satirSonuAra;
  const satirlar = metin.slice(satirBasi, satirSonu).split('\n');
  const isaretli = satirlar.map((s) => `${onek}${s.replace(/^(## |> |- )/, '')}`).join('\n');
  const yeni = `${metin.slice(0, satirBasi)}${isaretli}${metin.slice(satirSonu)}`;
  return { metin: yeni, secim: { start: satirBasi, end: satirBasi + isaretli.length } };
}

/** İmlecin olduğu yere (ayrı paragraf olarak) bir blok ekler: görsel satırı. */
export function blokEkle(metin: string, secim: Secim, blok: string): { metin: string; secim: Secim } {
  const once = metin.slice(0, secim.start).replace(/\s+$/, '');
  const sonra = metin.slice(secim.end).replace(/^\s+/, '');
  const bas = once ? `${once}\n\n` : '';
  const yeni = `${bas}${blok}${sonra ? `\n\n${sonra}` : '\n'}`;
  const konum = bas.length + blok.length;
  return { metin: yeni, secim: { start: konum, end: konum } };
}

/** İmleçte satır içi metin (mekan bağlantısı): seçim varsa ad olarak seçili metin kullanılır. */
export function satirIciEkle(metin: string, secim: Secim, parca: (secili: string) => string): { metin: string; secim: Secim } {
  const eklenen = parca(metin.slice(secim.start, secim.end));
  const yeni = `${metin.slice(0, secim.start)}${eklenen}${metin.slice(secim.end)}`;
  const konum = secim.start + eklenen.length;
  return { metin: yeni, secim: { start: konum, end: konum } };
}

export const gorselSatiri = (alt: string, yol: string) => `![${alt.replace(/[[\]]/g, '')}](foto:${yol})`;
export const mekanBaglantisi = (ad: string, placeId: string) => `[${ad.replace(/[[\]]/g, '')}](mekan:${placeId})`;

/** Yüklenen dosyanın kovadaki yolu: `geziler/<geziId>/<rastgele>.<uzantı>` (DB kısıtı ile aynı biçim). */
export function fotoYolu(tur: 'geziler' | 'yerler', sahipId: string, dosyaAdi: string, rastgele: string): string {
  const uzanti = (/\.([a-z0-9]{2,5})$/i.exec(dosyaAdi)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
  // Kanvas (BekleyenTasarim21 ekran 6) satırda dosya adını gösterir: "<8 rastgele>-<sade ad>.<uzantı>".
  const kok = dosyaAdi
    .replace(/\.[^.]+$/, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (h) => TR[h])
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${tur}/${sahipId}/${rastgele.slice(0, 8)}${kok ? `-${kok}` : ''}.${uzanti}`;
}

/** Yolun gösterilen dosya adı: 8 haneli rastgele önek atılır ("odunpazari-01.webp"); eski (UUID) adlar olduğu gibi. */
export function fotoDosyaAdi(yol: string): string {
  const ad = yol.split('/').pop() ?? yol;
  return ad.replace(/^[0-9a-f]{8}-(?![0-9a-f]{4}-)/, '');
}

export const FOTO_TURLERI = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const FOTO_EN_COK_BAYT = 5 * 1024 * 1024;

/** Kova kuralıyla aynı denetim (5 MB, jpeg/png/webp); hata anahtarı ya da null. */
export function fotoDenetle(dosya: { type: string; size: number }): 'tur' | 'boyut' | null {
  if (!(FOTO_TURLERI as readonly string[]).includes(dosya.type)) return 'tur';
  if (dosya.size > FOTO_EN_COK_BAYT) return 'boyut';
  return null;
}

/** "16:12" — Türkiye saatiyle (panel kullanıcısının tarayıcısı). */
export function saatMetni(t: Date): string {
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

/** ISO → `datetime-local` girişi ("2026-10-16T09:00", yerel saat) ve geri. */
export function yerelTarihGirdisi(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`;
}

export function yerelTarihtenIso(girdi: string): string | null {
  if (!girdi) return null;
  const t = new Date(girdi);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}
