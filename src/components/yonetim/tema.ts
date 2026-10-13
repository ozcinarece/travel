// #155 Backoffice Tripmate görünümü (kanvas BO-0/1/2): renkler uygulamanın jetonlarından (src/theme.ts, #136).
// Panel yalnız okur; src/theme.ts'e panel için bir şey eklenmez (mobil paket değişmesin, #106 KK1).
import { renk } from '@/theme';

export const yRenk = {
  zemin: renk.zemin,
  /** Lacivert — metin. */
  metin: renk.metin,
  /** Gri mavi — ikincil metin. */
  ikincil: renk.ikincil,
  /** Üst etiket, pasif sekme. */
  soluk: renk.soluk,
  /** Buz — sayfa zemini, segment ve rozet zemini. */
  yuzey: renk.yuzey,
  /** Çizgi — ayraç. */
  ayrac: renk.ayrac,
  /** Çizgi — kutu ve ikincil düğme çerçevesi (kanvasta ayraçla aynı #DDE3F6). */
  cerceve: renk.ayrac,
  /** Gece — sol menü, birincil düğme, bağlantı rengi. */
  ana: renk.ana,
  /** Mandalina — Yayınla, seçili sekme çizgisi, seçili menü ikonu. */
  vurgu: renk.vurgu,
  basari: renk.basari,
  basariMetin: renk.basariMetin,
  basariZemin: renk.basariZemin,
  hata: renk.uyari,
  hataZemin: renk.uyariZemin,
  /** Kanvas "Taslak değişiklik var" rozeti. */
  bekliyorZemin: '#fff6e6',
  bekliyorMetin: '#8a5a00',
  /** Yazı alanında yer tutucu (kanvas BO-1 "/ ile blok ekle"). */
  yerTutucu: '#b4bbd3',
  /** Genel bakış: içerik sağlığında sorunsuz satır; kapak yoksa küçük resim zeminleri (kanvas BO-0). */
  notrZemin: '#f4f6fa',
  kapakZeminleri: [renk.anaAcik, '#ffe2cc', '#dce6ff'],
  /** Sol menü (Gece zemin üstünde). */
  menuMetin: '#b9c3e6',
  menuIkon: '#8e9bcb',
  menuEtiket: '#ffb27a',
} as const;

/** Kart gölgesi (kanvas: 0 10px 30px rgba(21,42,107,.06); editör kâğıdı .08). */
export const yGolge = '0 10px 30px rgba(21,42,107,0.06)';
export const yGolgeKagit = '0 10px 30px rgba(21,42,107,0.08)';
/** Segmentte seçili düğme ve küçük yükseltiler. */
export const yGolgeKucuk = '0 1px 3px rgba(14,20,48,0.1)';
