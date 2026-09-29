// Veritabanı satır tipleri (supabase/migrations ile birebir). Üretilmiş tipler gelene kadar elle.

export type HaritaGizliligi = 'friends' | 'everyone' | 'me';

export type Profil = {
  id: string;
  name: string;
  username: string;
  photo_url: string | null;
  map_visibility: HaritaGizliligi;
  next_trip_window: string | null;
  created_at: string;
};

export type SeyahatOzet = {
  id: string;
  city_label: string;
  start_date: string | null;
  end_date: string | null;
  tz: string;
};
