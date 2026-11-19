// #361 (UX önerileri kanvası, "#358 Ana sayfa v5 · harman": Ana_v5_Yok, Ana_v5_Var, Ana_v5_Bitti): ana sayfanın saf kuralları.
// Hepsi bizim içerik tablolarımızdan; Google isteği yok (ana aramada Autocomplete çağrılmaz, KK5).
import { AKIS_AMACLARI, type Amac } from '@/features/icerik/amaclar';
import type { KesfetDurumu } from '@/features/anasayfa/serit';
import type { Siniflar } from '@/features/seyahatler/siniflandir';
import { t } from '@/i18n';
import type { AmacTonu } from '@/theme';
import type { Gezi, Sehir } from '@/lib/tipler';

/** KK6: en çok bu kadar amaç sekmesi ("Hepsi" hariç). */
export const EN_COK_SEKME = 4;
/** KK6: bir amacın sekme olması için gereken yayında gezi sayısı. */
export const SEKME_ICIN_GEZI = 2;

/**
 * KK6: sekme olacak amaçlar — en az 2 yayında gezisi olanlar, sabit sırayla, en çok 4. Böyle 2'den az amaç varsa boş döner:
 * o zaman sekme satırı ("Hepsi" dahil) hiç çizilmez.
 */
export function sekmeAmaclari(geziler: readonly Pick<Gezi, 'amaclar'>[]): Amac[] {
  const dolu = AKIS_AMACLARI.filter((a) => geziler.filter((g) => g.amaclar?.includes(a)).length >= SEKME_ICIN_GEZI);
  return dolu.length >= 2 ? dolu.slice(0, EN_COK_SEKME) : [];
}

/** KK7: kartın alt satırı veriden — gün ve durak sayısı günlerden hesaplanır; gün verisi yoksa gezinin sayaçları. */
export function kartAltSatiri(g: Pick<Gezi, 'gun_sayisi' | 'mekan_sayisi'> & { gunDuraklari?: readonly number[] }): string {
  const gunler = g.gunDuraklari && g.gunDuraklari.length > 0 ? g.gunDuraklari : null;
  const gun = gunler ? gunler.length : g.gun_sayisi;
  const durak = gunler ? gunler.reduce((a, b) => a + b, 0) : g.mekan_sayisi;
  return t('anasayfa.v5.kartAlt', { gun, durak });
}

/**
 * KK3 · KK4: üstteki tek satır. Gezi günü (aktif seyahat) satır yok, uygulama doğrudan seyahatte açılır (#285). Sonra en
 * yakın bitmemiş seyahat "Planlamaya devam" olur (yaklaşan, sonra planlanan); yoksa yeni biten seyahatin açık borcu varsa
 * "Harcamaları kapat". Kural `kesfetDurumu` ile aynı öncelik, yalnız aktif seyahat burada satır çıkarmaz.
 */
export function ustSatir(s: Siniflar, yeniBitenKartiVar: boolean): KesfetDurumu {
  if (s.aktif[0]) return null;
  if (s.yaklasan[0]) return { tur: 'serit', seyahat: s.yaklasan[0], sinif: 'yaklasan' };
  if (s.yeniBiten[0] && yeniBitenKartiVar) return { tur: 'geziBitti', seyahat: s.yeniBiten[0] };
  if (s.planlanan[0]) return { tur: 'serit', seyahat: s.planlanan[0], sinif: 'planlanan' };
  return null;
}

const kucuk = (m: string) => m.toLocaleLowerCase('tr');

export type AramaSonucu<G> = {
  /** Önce eşleşen hazır geziler. */
  geziler: G[];
  /** Rehberli şehre denk geldiyse o şehir ("{Şehir} için seyahat kur ›"); yoksa null. */
  sehir: Pick<Sehir, 'id' | 'ad'> | null;
  /** Şehre denk gelmediyse yazılan metin ("“{metin}” ile seyahat kur ›"). */
  metin: string | null;
};

/**
 * KK5: ana arama yerel süzgeçle (`/ara` ile aynı: Türkçe küçük harf, içerir). 2 harften azsa null. Şehir eşleşmesi: adı
 * yazılanla başlayan rehberli şehir (yoksa adı içeren); yalnız gezisi olan şehir rehberli sayılır.
 */
export function anaArama<G extends Pick<Gezi, 'baslik' | 'ozet' | 'sehirler'>>(sorgu: string, geziler: readonly G[], sehirler: readonly Pick<Sehir, 'id' | 'ad' | 'gezi_sayisi'>[]): AramaSonucu<G> | null {
  const ham = sorgu.trim();
  const q = kucuk(ham);
  if (q.length < 2) return null;
  const es = (m: string | null | undefined) => !!m && kucuk(m).includes(q);
  const rehberli = sehirler.filter((s) => (s.gezi_sayisi ?? 0) > 0);
  const sehir = rehberli.find((s) => kucuk(s.ad).startsWith(q)) ?? rehberli.find((s) => es(s.ad)) ?? null;
  return {
    geziler: geziler.filter((g) => es(g.baslik) || es(g.ozet) || es(g.sehirler?.ad)),
    sehir: sehir ? { id: sehir.id, ad: sehir.ad } : null,
    metin: sehir ? null : ham,
  };
}

/**
 * KK7 (kanvas `Ana_v5_Amaclar`, "Hangi ton?"): kapaksız kartın tonu. 1) bir amaç sekmesi seçiliyse o amaç; 2) "Hepsi"nde
 * gezinin ilk amacı (`amaclar[0]`, BO'daki sıra); 3) amacı yoksa (ya da tanınmıyorsa) gri zemin ve pusula (`yok`).
 */
export function kapakTonu(amaclar: readonly string[] | null | undefined, seciliSekme: Amac | null): AmacTonu {
  if (seciliSekme) return seciliSekme;
  const ilk = amaclar?.[0];
  return ilk && (AKIS_AMACLARI as readonly string[]).includes(ilk) ? (ilk as Amac) : 'yok';
}
