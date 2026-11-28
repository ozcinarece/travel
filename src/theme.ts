// #136 Tripmate kimliği (kanvas "Marka kimliği" → Temel): Gece ana renk, Mandalina vurgu, Lacivert metin, Buz yüzey;
// başlık ve metin Figtree (başlık 800, düğme 700; #307). Jetonlar: docs/06-marka.md. Hex'ler KÜÇÜK harf (pin PNG anahtarları).

export const renk = {
  zemin: '#ffffff',
  /** Lacivert — metin. */
  metin: '#0e1430',
  /** Gri mavi — ikincil metin, açıklama. */
  ikincil: '#4a5274',
  /** Yer tutucu, pasif sekme ikonu. */
  soluk: '#6a7290',
  /** Google atfı ("Google Maps"): Google'ın izin verdiği gri (#342, kanvas 9b/9c). Başka yerde kullanılmaz. */
  atif: '#5e5e5e',
  /** Buz — yüzey: arama, ikincil düğme, alıntı, kart zemini. */
  yuzey: '#eef2ff',
  /** Çizgi — kenar ve ayraç. */
  ayrac: '#dde3f6',
  /** Boş / pasif kutu kenarı (kesik numara, boş onay kutusu); yönetim temasındaki `yerTutucu` ile aynı. */
  yerTutucu: '#b4bbd3',
  /** Gece — ana renk: birincil düğme, koyu kart, seçili sekme/çip, pin kenarı. */
  ana: '#152a6b',
  /** Koyu kart üstünde ikincil metin ve açık avatar. */
  anaAcik: '#c9d2f2',
  /** Mandalina — vurgu: Yeni düğmesi, rozet, sıradaki durak, Listeye ekle. Üstünde yazı Lacivert. */
  vurgu: '#ff7a1a',
  /** Açık Mandalina: kaydedilmiş kalp düğmesinin zemini (kanvas 29b). */
  vurguZemin: '#fff1e6',
  uyari: '#d93a2b',
  uyariZemin: '#fbe7e4',
  /** Başarı: Listede ✓ zemini / ikon metni. */
  basari: '#16a06e',
  basariMetin: '#0e7a52',
  basariZemin: '#e3f5ee',
  /** Harita arkasındaki ekran zemini (kanvas 3c). */
  haritaZemin: '#f1f3f8',
  /** Dikkat (turuncu): geçersiz davet ikon kutusu zemini ve çizgisi (kanvas 3d-B). */
  dikkatZemin: '#fff0e3',
  dikkat: '#b5500a',
} as const;

// Gün renkleri (kanvas Temel · harita dili): 1 mavi · 2 sarı (üstünde Lacivert yazı) · 3 yeşil · 4 mor; 5–6 ek, 7. günden sonra döner.
/** Kişi yüzleri (avatar zemini) sırası: Mandalina, Gece, Gece açık. */
export const yuzRenkleri = [renk.vurgu, renk.ana, renk.anaAcik] as const;
/** #407 (kanvas `Ana_v6_Arkadaslar`): Arkadaşlar sekmesindeki kişi yüzleri sırası: Lacivert, açık mavi, mor, petrol. */
export const arkadasRenkleri = [renk.ana, renk.anaAcik, '#7A3FC0', '#0E6A85'] as const;

/** #361 ana sayfa v5 (kanvas `Ana_v5_Var` · `Ana_v5_Yok` · `Ana_v5_Bitti`): panolardaki ikincil metin, çizgi ve satır zemini. */
export const anaV5 = {
  ikincil: '#5B6178',
  cizgi: '#E4E7EE',
  satirZemin: '#F6F7FA',
  /** "Sıradaki adım: …" turuncusu. */
  adim: '#C25200',
  /** Profil dairesi ve kapaksız küçük kapak zemini. */
  profilZemin: '#ECEEF2',
  ok: '#9AA1B2',
  /** Kart ♥ kayıtlıyken kenar (`Ana_v5_Ayrinti` §2). */
  kalpKenar: '#C25200',
  /** Kart ♥ dairesi (`Ana_v5_Ayrinti` §2). */
  kalpDaire: 'rgba(255,255,255,0.92)',
  /** #397 (`Sayfa_v5_SehirRehberi`): fotoğrafsız kapak ve 56 px mekan kutusunun zemini (ortada `ok` renginde kamera). */
  fotoYok: '#D9DDE5',
  /** #397: mekan satırındaki ince "+" dairesinin kenarı. */
  inceKenar: '#C3C9D6',
  /** #401 (`Ekran07cIlOnerileri`): yer satırındaki `neden` cümlesi. */
  nedenMetin: '#232B48',
  /** #445 (`Ekran07dDolulukTasma`): "K yer sığmıyor" metni ve gün çubuklarının arkasındaki taşma parçası (beyazda 4,6:1). */
  tasma: '#D93A2B',
  /** #432 (`Sos_v6_PaylasAcik`): "Paylaşımı kapat" kırmızı metin düğmesi. */
  kapat: '#B42318',
} as const;

/** #405 alt menü sekme renkleri (`AltMenu`); #308 KK7 seyahat içi menü de aynı. */
export const altMenuRenk = { secili: renk.vurgu, pasif: '#8A91A3', cizgi: '#E4E7EE' } as const;

/** #308 (kanvas `Sayfa_v7_Seyahat_*`): seyahat sayfası v7. */
export const seyahatV7 = {
  /** Harita yüklenene kadar 260 pt alanın zemini. */
  haritaZemin: '#EEF0F4',
  /** Harita üstü beyaz düğmelerin gölgesi. */
  golge: 'rgba(14,20,48,0.12)',
  /** Kişiler satırındaki kesikli "+" dairesi. */
  kesikKenar: '#9AA6C8',
  /** Gezilen durağın tik dairesi. */
  tikZemin: '#E3F4EC',
  /** Kişi yüzleri: Mandalina, açık mavi, Gece (kanvas sırası). */
  yuzler: ['#FF7A1A', '#C9D2F2', '#152A6B'],
  /** Boş gün öneri satırındaki "+" dairesinin kenarı. */
  artiKenar: '#C3C9D6',
  /** #579 (kanvas `Dalga1_BuguneEkle`): Gece bildirimdeki "Geri al" yazı düğmesi (açık Mandalina; Gece üstünde ≥ 4,5:1). */
  geriAl: '#FFB27A',
} as const;

/** #667 (UX önerileri kanvası `Plan_v13_Genel` · `Plan_v13_Gun`): Plan genel bakışı ve gün detayı. */
export const planV13 = {
  /** Gün kartı zemini. */
  kartZemin: '#F6F7FA',
  /** Dolgu çubuğunun izi. */
  cubukIz: '#E1E5EE',
  /** Boş günün kesik çerçevesi. */
  bosKenar: '#9AA6C8',
  /** ⋯ düğmesi ve otel satırının yatak dairesi. */
  dugmeZemin: '#F2F4F8',
  /** Harita yüklenene kadar zemin. */
  haritaZemin: '#EEF0F4',
  /** Kart sağındaki ›. */
  ok: '#9AA1B2',
  /** Kişi yüzleri sırası (kanvas E · M · A): zemin ve baş harf. */
  yuzler: [
    { zemin: '#FFE3CC', harf: '#0E1430' },
    { zemin: '#C9D2F2', harf: '#152A6B' },
    { zemin: '#152A6B', harf: '#FFFFFF' },
  ],
} as const;

/** #580 (UX önerileri kanvası `Dalga1_DurakCekmecesi` · `Dalga1_GecikmeBandi`): durak çekmecesi ve gecikme bandı. */
export const durakCekmecesi = {
  /** Satır ikonlarının 36 pt dairesi. */
  ikonZemin: '#F2F4F8',
  /** "Çıkar" metni ve ikonu. */
  cikar: '#B42318',
  /** Gecikme bandı zemini, saat ikonu ve "N dk gerideyiz" metni (zeminde ≥ 4,5:1). */
  bantZemin: '#FFF4EB',
  bantIkon: '#C25200',
  bantMetin: '#8A3A00',
} as const;

/**
 * #361 KK7 (UX önerileri kanvası, `Ana_v5_Amaclar`): kapaksız gezi kartının amaca göre zemini, tepesi (%85 opak) ve
 * dairesi; daire üstünde beyaz ikon. Anahtarlar `features/icerik/amaclar.ts` ile aynı; `yok` = amacı olmayan gezi.
 */
export const amacTonlari = {
  kultur_tarih: { zemin: '#E6E0FA', tepe: '#A48BE8', daire: '#5B34B8' },
  lezzet: { zemin: '#FFE2CC', tepe: '#FF9A4D', daire: '#C25200' },
  doga: { zemin: '#D7F0E6', tepe: '#6CC59C', daire: '#16703C' },
  yavas: { zemin: '#D3F0EF', tepe: '#62C2C2', daire: '#0E6B73' },
  gece: { zemin: '#DDE1EF', tepe: '#7C88BC', daire: '#152A6B' },
  cocuklu: { zemin: '#FFF0C2', tepe: '#F5C04A', daire: '#8A5300' },
  yok: { zemin: '#ECEEF2', tepe: '#C3C9D6', daire: '#4B5563' },
} as const;
export type AmacTonu = keyof typeof amacTonlari;

export const gunRenkleri = ['#2c64f5', '#f5a524', '#16a06e', '#7b4fe0', '#e0457b', '#0ea5e9'] as const;

export function gunRengi(gunIndex: number): string {
  return gunRenkleri[(gunIndex - 1) % gunRenkleri.length];
}

/** Gün rengi üstündeki yazı: sarı (2. gün) Lacivert, diğerleri beyaz. */
export function gunUstuMetin(gunRengiHex: string): string {
  return gunRengiHex.toLowerCase() === '#f5a524' ? renk.metin : renk.zemin;
}

/**
 * #432 2/3b (`Sos_v6_Alici`): alıcı ekranındaki gün çipi noktası ve durak numarası dairesi (kanvasta 1–3. gün). 4. günden
 * sonra döner. Haritadaki pinler ikon sistemindeki gün renklerinde kalır (`gunRengi`).
 */
export const paylasimGunRenkleri = ['#2350C4', '#7A3FC0', '#B3305E'] as const;

export function paylasimGunRengi(gunIndex: number): string {
  return paylasimGunRenkleri[(gunIndex - 1) % paylasimGunRenkleri.length];
}

/** Rota tonu = gün renginin ~%20 koyusu (pinler gün renginde kalır). */
export const rotaRenkleri = ['#2350c4', '#c4841d', '#128058', '#623fb3', '#b33762', '#0b84ba'] as const;

export function rotaRengi(gunIndex: number): string {
  return rotaRenkleri[(gunIndex - 1) % rotaRenkleri.length];
}

/** Tek aile Figtree (#307): metin 400–600, düğme `kalin` (700), başlık `baslik` (800). Eski adlar korunur. */
export const yazi = {
  normal: 'Figtree_400Regular',
  orta: 'Figtree_500Medium',
  yari: 'Figtree_600SemiBold',
  kalin: 'Figtree_700Bold',
  ekstra: 'Figtree_800ExtraBold',
  /** Ekran, kart ve bölüm başlıkları: Figtree 800 (#307). Harf aralığı için `baslikStili`. */
  baslik: 'Figtree_800ExtraBold',
} as const;

/** Yazı ölçeği (px): başlıklar Figtree 800, gerisi Figtree; etiket büyük harf 800. */
export const olcek = { ekran: 32, kart: 24, bolum: 20, metin: 16, alt: 14, etiket: 12 } as const;

/**
 * #307 KK1 (kanvas Temel · YAZI): başlık stili — Figtree 800, verilen boyut ve harf aralığı.
 * Kart (24) ve üstü −0,5; bölüm boyu (18–23) −0,3; daha küçük başlıklarda harf aralığı yok.
 */
export function baslikStili(boyut: number) {
  const letterSpacing = boyut >= olcek.kart ? -0.5 : boyut >= 18 ? -0.3 : 0;
  return { fontFamily: yazi.baslik, fontSize: boyut, letterSpacing } as const;
}

/** Köşeler: düğme/giriş 14 · kart 22 · rozet 8 · çip tam yuvarlak. */
export const kose = { dugme: 14, kart: 22, rozet: 8, cip: 999, alan: 12 } as const;

/** Gölge yok; yalnız harita üstündeki kart / panel / çekmece hafif gölgeli. */
export const haritaGolgesi = {
  shadowColor: renk.metin,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.12,
  shadowRadius: 18,
  elevation: 6,
} as const;

export const bosluk = { kenar: 20, arasi: 12 } as const;

// PRD §11: dokunma hedefleri ≥ 44 pt.
export const minDokunma = 44;
