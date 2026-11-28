// Veritabanı satır tipleri (supabase/migrations ile birebir). Üretilmiş tipler gelene kadar elle.

export type HaritaGizliligi = 'friends' | 'everyone' | 'me';

// PRD 0.3 KK2: "Sonraki seyahatin ne zaman?"

export type Profil = {
  id: string;
  name: string;
  username: string;
  photo_url: string | null;
  map_visibility: HaritaGizliligi;
  onboarding_done_at: string | null;
  created_at: string;
};

export type UyeOzet = { user_id: string; role: 'owner' | 'member'; display_name: string; guest: boolean };

/** 3.1 listesi için seyahat + üyeler + mekan sayısı (tek sorgu, RLS süzer). */
export type SeyahatOzet = {
  id: string;
  /** #98 KK2: seyahatin adı ("Eskişehir Gezisi"); boşsa şehir etiketi gösterilir. */
  name: string | null;
  city_label: string;
  /** #569: şehir merkezi (Google, ≤ 30 gün; boşalmış olabilir) — ana sayfa kartında şehrin BO kapağını bulmak için. */
  lat?: number | null;
  lng?: number | null;
  start_date: string | null;
  end_date: string | null;
  tz: string;
  hotel_place_id: string | null;
  created_at: string;
  members: UyeOzet[];
  places: { count: number }[];
  /** #56: seyahatin otelleri (sayı); eski önbellekte olmayabilir. */
  stays?: { count: number }[];
};

/** Tek seyahat (3.3 ve seyahat içi ekranlar). */
export type Seyahat = {
  id: string;
  /** #98 KK2: seyahatin adı; boşsa şehir etiketi. */
  name: string | null;
  city_label: string;
  country_code: string | null;
  /** #318: Google koordinatı 30 günde yenilenemezse null (satır kalır). */
  lat: number | null;
  lng: number | null;
  /** #318 inceleme 4: şehrin Google kimliği (merkez boşaldıysa canlı konum için). */
  city_place_id?: string | null;
  tz: string;
  start_date: string | null;
  end_date: string | null;
  /** "HH:MM:SS" (Postgres time) — §5.3 gün başlangıcı/bitişi varsayılanları. */
  day_start: string;
  day_end: string;
  /** #98 adım 4: davet linki (PRD 3.10, 8 karakter base62). */
  invite_token: string;
  /** #432 KK6: "Seyahatime al" ile bir arkadaş paylaşımından kurulduysa paylaşımın kimliği (#574 KK7). */
  kaynak_paylasim?: string | null;
};

/** days satırı (PRD §8). Tarihsiz seyahatte date null. */
export type Gun = {
  id: string;
  trip_id: string;
  index: number;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  order_manual: boolean;
  /** #56: günün başlangıç / bitiş oteli (stays.id); null = otel yok. */
  start_stay_id: string | null;
  end_stay_id: string | null;
};

/** stops satırı: güne atanmış mekan. place_ref → places.id. */
export type Durak = {
  id: string;
  trip_id: string;
  day_id: string;
  place_ref: string;
  order_key: string;
  minutes: number;
  /** Konumla sessizce yazılan varış (istatistik; zamanlamayı etkilemez, #43 KK4). */
  arrived_at: string | null;
  arrived_by: string | null;
  /** #43: tamamlanma anı — "Tamamlandı" düğmesi ya da otomatik (planlanan bitiş + 10 dk). */
  completed_at: string | null;
  completed_by: string | null;
  auto_completed: boolean;
  skipped: boolean;
};

/** changes satırı (PRD §5.5; 3.7 KK9 son değişiklikler). */
export type Degisiklik = {
  id: number;
  user_id: string | null;
  entity: string;
  entity_id: string;
  field: string | null;
  old: unknown;
  new: unknown;
  at: string;
};

/** #141 KK3: Listem oyu — kişi başına mekan başına bir. */
export type Oy = { mekan: string; kullanici: string };

/** 3.3'te seçilen otel; place_id yalnız koordinattan geldiyse boş. */
export type OtelSecimi = {
  place_id: string | null;
  ad: string;
  lat: number;
  lng: number;
};

/** 3.2'de seçilen şehir; trips satırına dönüşür (Google'dan yalnızca place_id, konum, tz, ülke kodu). */
export type SehirSecimi = {
  place_id: string;
  ad: string;
  ikincil: string;
  lat: number | null;
  lng: number | null;
  tz: string;
  country_code: string | null;
  /**
   * #642 KK3: içerik şehrinden seçimde şehrin koordinat damgası (`sehirler.google_fetched_at`; osm/elle şehirde null). Google'dan
   * yeni seçimde yok (koordinat şimdi alındı). Seyahat bu damgayla yazılır (`sihirbaz.sehirKonumu`).
   */
  google_fetched_at?: string | null;
};

export type YeniSeyahat = {
  sehir: SehirSecimi;
  /** #98 KK2: boşsa otomatik "{Şehir} Gezisi" (sihirbaz.seyahatAdiOner). */
  name?: string | null;
  start_date: string | null;
  end_date: string | null;
};

/** #97 / #98: içerik tabloları (yayınlı okunur; backoffice yazar). */
export type Sehir = {
  id: string;
  ad: string;
  slug: string;
  kapak_url: string | null;
  /** #345: {yazar, lisans, kaynak_url} (`features/icerik/kapakAtfi`); sorgu seçmediyse yok. */
  kapak_atif?: unknown;
  /** #205 Parça 1: google_30g konum 30 günde boşalır (gece temizliği). */
  lat: number | null;
  lng: number | null;
  /** #97: yayınlı gezi sayısı ("N gezi"). */
  gezi_sayisi?: number;
  /** #100: rehber sayfası özeti (2 cümle). */
  ozet?: string | null;
  /** #197: şehrin Google kimliği, IANA saat dilimi ve ülke kodu — doluysa seyahat açarken şehir için Google'a gidilmez. */
  place_id?: string | null;
  tz?: string | null;
  ulke_kodu?: string | null;
  /** #642 KK3: google_30g koordinatın alınma anı (osm/elle şehirde null); seyahat şehri bu damgayı alır. */
  google_fetched_at?: string | null;
};

/** #100 B: şehir rehberi bölümü (backoffice yazar; yayınlı şehir okunur). */
export type RehberBolumu = 'ulasim' | 'yemek' | 'mahalle' | 'ipucu';
/** #156: `bolum` yalnız eski 4 bölümde; editörde eklenen serbest bölümde null. */
export type SehirRehberi = { id: string; sehir_id: string; bolum: RehberBolumu | null; baslik: string; ozet: string | null; yazi_md: string | null; sira: number };

/** #97: önerilen gezi (içerik ekibi yazar; yayınlı okunur). */
export type Gezi = {
  id: string;
  sehir_id: string;
  baslik: string;
  slug: string;
  kapak_url: string | null;
  /** #345: {yazar, lisans, kaynak_url} (`features/icerik/kapakAtfi`); sorgu seçmediyse yok. */
  kapak_atif?: unknown;
  ozet: string | null;
  yazi_md: string | null;
  yazar_ad: string | null;
  gun_sayisi: number;
  mekan_sayisi: number;
  sira: number | null;
  created_at: string;
  /** #300: amaç etiketleri (`public.amac_listesi()`); eski satırda ya da seçilmemişse boş. */
  amaclar?: string[] | null;
  /** Gömülü şehir (liste kartlarında "Eskişehir"). */
  sehirler?: { ad: string; slug: string; kapak_url?: string | null; kapak_atif?: unknown } | null;
};
export type GeziDuragi = { id: string; gezi_gun_id: string; sira: number; place_id: string | null; ad: string; kategori: string | null; sure_dk: number;
  /** #205 Parça 1: google_30g konum 30 günde boşalır (gece temizliği); durak listede kalır, haritada pin olmaz. */
  lat: number | null;
  lng: number | null;
  /** #205 KK7: koordinat Google'dan geldiyse alınma anı (osm/elle durakta null); "Seyahatime al" places'a taşır. */
  google_fetched_at?: string | null;
};
export type GeziGunu = { id: string; gezi_id: string; sira: number; baslik: string | null; gezi_duraklari: GeziDuragi[] };
export type GeziDetay = Gezi & { gezi_gunleri: GeziGunu[] };
export type KaydedilenTuru = 'gezi' | 'yer';
export type Kaydedilen = { tur: KaydedilenTuru; hedef_id: string; created_at: string };
export type OlayTuru = 'gezi_goruntulendi' | 'gezi_alindi' | 'yer_eklendi' | 'davet_paylasildi' | 'davet_acildi' | 'davet_katildi' | 'sihirbaz_bitti' | 'plan_kuruldu'
  // #361 KK8: ana sayfa v5.
  | 'ana_kart_acildi'
  | 'ana_ara'
  | 'planlamaya_devam'
  // #396 KK7: Plan hazır'da "Arkadaşlarını çağır".
  | 'plan_hazir_davet'
  // #405 KK6: alt menüde sekme açıldı (meta: sekme).
  | 'sekme_acildi'
  // #406 KK6: raflı ana sayfa (banner: hedef_id bölüm, meta hedef türü; raf kartı: hedef_id gezi, meta raf).
  | 'banner_acildi'
  | 'raf_kart_acildi'
  // #432 KK8: gezi paylaşımı (hedef_id: paylaşım; girişsiz açılış yalnız sayaçta).
  | 'paylasim_olustu'
  | 'paylasim_acildi'
  | 'paylasimdan_alindi';

/** #137: /r/{token} özeti (davet_ozeti; giriş gerektirmez). Google verisi yok: yalnız sayılar ve günler. */
export type DavetOzeti = {
  trip_id: string;
  name: string | null;
  city_label: string;
  start_date: string | null;
  end_date: string | null;
  member_count: number;
  place_count: number;
  day_count: number;
  inviter_name: string | null;
  /** Davet edenin profil fotoğrafı (yoksa null). */
  inviter_photo?: string | null;
  /** Soran kullanıcı zaten üye mi (anon için false). */
  uye: boolean;
  gunler: { index: number; date: string | null; durak: number }[];
};

/** #137: davetle_katil cevabı. */
export type DavetKatilim = { trip_id: string; zaten_uye: boolean; name: string | null; city_label: string; inviter_name: string | null; day_count: number; place_count: number };

/** #137 KK2: web'de katılıp uygulamayı ilk kez açan kişinin düşeceği seyahat (davet_karsilama). */
export type DavetKarsilama = { trip_id: string; name: string | null; city_label: string; inviter_name: string | null; day_count: number; place_count: number };
export type Yer = {
  id: string;
  sehir_id: string;
  /** Google place_id; boşsa istemci adıyla çözer (icerik.yerPlaceId). */
  place_id: string | null;
  ad: string;
  /** Google birincil tipi (museum, park, mosque…). */
  kategori: string | null;
  rehber_md: string | null;
  kapak_url: string | null;
  /** #345: {yazar, lisans, kaynak_url} (`features/icerik/kapakAtfi`); sorgu seçmediyse yok. */
  kapak_atif?: unknown;
  one_cikan_sira: number | null;
  /** #205 Parça 1: google_30g konum 30 günde boşalır (gece temizliği); yer listede kalır, haritada pin olmaz. */
  lat: number | null;
  lng: number | null;
};

// account_deletion_preview() satırı
export type SilmeOnizleme = {
  trip_id: string;
  city_label: string;
  outcome: 'transfer' | 'delete';
  new_owner_name: string | null;
};

/** places satırı (seyahatin mekan havuzu). Ad/puan saklanmaz; places-light ile canlı gelir. */
export type Mekan = {
  id: string;
  trip_id: string;
  place_id: string;
  primary_type: string | null;
  /** #318: Google koordinatı 30 günde yenilenemezse null; mekan listede kalır, haritada pin olmaz. */
  lat: number | null;
  lng: number | null;
  google_fetched_at: string;
  default_minutes: number;
  added_by: string | null;
  note: string | null;
  created_at: string;
};

export type Uye = {
  trip_id: string;
  user_id: string;
  guest: boolean;
  display_name: string;
  role: 'owner' | 'member';
  joined_at: string;
  /** #137: davetle katılma kanalı ve uygulamada ilk karşılanma zamanı (web katılımında boş başlar). */
  joined_via?: 'web' | 'app' | null;
  landed_at?: string | null;
  /** Profil fotoğrafı (profillerden; üyelikte tutulmaz). */
  photo_url?: string | null;
};
