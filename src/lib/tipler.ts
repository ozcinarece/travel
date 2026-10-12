// Veritabanı satır tipleri (supabase/migrations ile birebir). Üretilmiş tipler gelene kadar elle.

export type HaritaGizliligi = 'friends' | 'everyone' | 'me';

// PRD 0.3 KK2: "Sonraki seyahatin ne zaman?"
export type SonrakiSeyahat = 'bu_ay' | 'uc_ay' | 'daha_sonra' | 'bilmiyorum';

export type Profil = {
  id: string;
  name: string;
  username: string;
  photo_url: string | null;
  map_visibility: HaritaGizliligi;
  next_trip_window: SonrakiSeyahat | null;
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
  lat: number;
  lng: number;
  tz: string;
  start_date: string | null;
  end_date: string | null;
  hotel_place_id: string | null;
  hotel_lat: number | null;
  hotel_lng: number | null;
  hotel_label: string | null;
  /** "HH:MM:SS" (Postgres time) — §5.3 gün başlangıcı/bitişi varsayılanları. */
  day_start: string;
  day_end: string;
  /** #98 adım 4: davet linki (PRD 3.10, 8 karakter base62). */
  invite_token: string;
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
  lat: number;
  lng: number;
  tz: string;
  country_code: string | null;
};

export type YeniSeyahat = {
  sehir: SehirSecimi;
  /** #98 KK2: boşsa otomatik "{Şehir} Gezisi" (sihirbaz.seyahatAdiOner). */
  name?: string | null;
  start_date: string | null;
  end_date: string | null;
};

/** #97 / #98: içerik tabloları (yayınlı okunur; backoffice yazar). */
export type Sehir = { id: string; ad: string; slug: string; kapak_url: string | null; lat: number; lng: number; /** #97: yayınlı gezi sayısı ("N gezi"). */ gezi_sayisi?: number; /** #100: rehber sayfası özeti (2 cümle). */ ozet?: string | null };

/** #100 B: şehir rehberi bölümü (backoffice yazar; yayınlı şehir okunur). */
export type RehberBolumu = 'ulasim' | 'yemek' | 'mahalle' | 'ipucu';
export type SehirRehberi = { id: string; sehir_id: string; bolum: RehberBolumu; baslik: string; ozet: string | null; yazi_md: string | null; sira: number };

/** #97: önerilen gezi (içerik ekibi yazar; yayınlı okunur). */
export type Gezi = {
  id: string;
  sehir_id: string;
  baslik: string;
  slug: string;
  kapak_url: string | null;
  ozet: string | null;
  yazi_md: string | null;
  yazar_ad: string | null;
  gun_sayisi: number;
  mekan_sayisi: number;
  sira: number | null;
  created_at: string;
  /** Gömülü şehir (liste kartlarında "Eskişehir"). */
  sehirler?: { ad: string; slug: string } | null;
};
export type GeziDuragi = { id: string; gezi_gun_id: string; sira: number; place_id: string | null; ad: string; kategori: string | null; sure_dk: number; lat: number; lng: number };
export type GeziGunu = { id: string; gezi_id: string; sira: number; baslik: string | null; gezi_duraklari: GeziDuragi[] };
export type GeziDetay = Gezi & { gezi_gunleri: GeziGunu[] };
export type KaydedilenTuru = 'gezi' | 'yer';
export type Kaydedilen = { tur: KaydedilenTuru; hedef_id: string; created_at: string };
export type OlayTuru = 'gezi_goruntulendi' | 'gezi_alindi' | 'yer_eklendi';
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
  one_cikan_sira: number | null;
  lat: number;
  lng: number;
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
  lat: number;
  lng: number;
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
};
