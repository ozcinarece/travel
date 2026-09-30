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

export type SeyahatOzet = {
  id: string;
  city_label: string;
  start_date: string | null;
  end_date: string | null;
  tz: string;
};

// account_deletion_preview() satırı
export type SilmeOnizleme = {
  trip_id: string;
  city_label: string;
  outcome: 'transfer' | 'delete';
  new_owner_name: string | null;
};
