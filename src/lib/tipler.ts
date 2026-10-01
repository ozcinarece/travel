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
  city_label: string;
  start_date: string | null;
  end_date: string | null;
  tz: string;
  hotel_place_id: string | null;
  created_at: string;
  members: UyeOzet[];
  places: { count: number }[];
};

/** Tek seyahat (3.3 ve seyahat içi ekranlar). */
export type Seyahat = {
  id: string;
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
};

/** stops satırı: güne atanmış mekan. place_ref → places.id. */
export type Durak = {
  id: string;
  trip_id: string;
  day_id: string;
  place_ref: string;
  order_key: string;
  minutes: number;
  arrived_at: string | null;
  arrived_by: string | null;
  skipped: boolean;
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
  start_date: string | null;
  end_date: string | null;
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
