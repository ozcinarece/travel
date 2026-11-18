/**
 * `useSeyahat`'in okuduğu `trips` sütunları. Bu sorgu cihazda saklanır (#243 KK1), bu yüzden Google'dan gelmiş olabilecek
 * alan okunmaz: `hotel_*` (eski satırlarda `hotel_label`'da Google otel adı olabilir, #250) burada yok; otel `stays`'ten okunur (#56).
 * `invite_token` davet paylaşımı için gerekli (bizim değerimiz).
 */
export const SEYAHAT_ALANLARI = 'id, name, city_label, city_place_id, country_code, lat, lng, tz, start_date, end_date, day_start, day_end, invite_token';
