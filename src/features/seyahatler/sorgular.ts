import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOturum } from '@/lib/oturum';
import { tumGunlereOtel } from '@/features/konaklama/sorgular';
import { supabase } from '@/lib/supabase';
import type { OtelSecimi, Seyahat, SeyahatOzet, YeniSeyahat } from '@/lib/tipler';

import { kendiSildiklerim, seyahatYokMu, yerelKayitlariTemizle } from './silme';

/** Üyesi olunan seyahatler (RLS süzer) + üyeler + mekan sayısı. Aktif/yaklaşan/geçmiş ayrımı ekranda (3.1). */
export function useSeyahatler() {
  const { hesapli } = useOturum();
  return useQuery({
    queryKey: ['seyahatler'],
    enabled: hesapli,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(
          'id, name, city_label, start_date, end_date, tz, hotel_place_id, created_at, members(user_id, role, display_name, guest), places(count), stays(count)',
        )
        .order('start_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as SeyahatOzet[];
    },
  });
}

/**
 * PRD 3.2 KK3: seyahati oluşturur; sahip üyeliği ve günler tetikleyiciyle gelir.
 * Google'dan yalnızca place_id, konum, tz ve ülke kodu yazılır (PRD §7); şehir adı düzenlenebilir etikettir.
 */
export function useSeyahatOlustur() {
  const { session } = useOturum();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (yeni: YeniSeyahat) => {
      if (!session) throw new Error('oturum yok');
      const { data, error } = await supabase
        .from('trips')
        .insert({
          owner_id: session.user.id,
          // #98 KK2: seyahatin adı (boş → null; ekranlar şehir etiketine düşer).
          name: yeni.name?.trim().slice(0, 80) || null,
          city_place_id: yeni.sehir.place_id,
          city_label: yeni.sehir.ad.slice(0, 80),
          country_code: yeni.sehir.country_code,
          lat: yeni.sehir.lat,
          lng: yeni.sehir.lng,
          tz: yeni.sehir.tz,
          start_date: yeni.start_date,
          end_date: yeni.end_date,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seyahatler'] }),
  });
}

/** #98 KK2: seyahatin adını günceller ("Değiştir"). */
export function useSeyahatAdiKaydet(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ad: string) => {
      const { error } = await supabase.from('trips').update({ name: ad.trim().slice(0, 80) || null }).eq('id', seyahatId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seyahat', seyahatId] });
      qc.invalidateQueries({ queryKey: ['seyahatler'] });
    },
  });
}

/**
 * #181 KK4: tarihleri değiştir — günler tarihle kayar; uzayınca sona gün eklenir, kısalınca sondaki günler (ve durakları) silinir
 * (seyahat_tarihlerini_degistir, tek işlem).
 */
export function useTarihleriDegistir(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gidis, donus }: { gidis: string; donus: string }) => {
      const { error } = await supabase.rpc('seyahat_tarihlerini_degistir', { p_trip_id: seyahatId, p_start: gidis, p_end: donus });
      if (error) throw error;
    },
    onSettled: () => {
      for (const k of ['seyahat', 'gunler', 'duraklar']) qc.invalidateQueries({ queryKey: [k, seyahatId] });
      qc.invalidateQueries({ queryKey: ['seyahatler'] });
      qc.invalidateQueries({ queryKey: ['seyahat-durumlari'] });
    },
  });
}

/** Tek seyahat (RLS üyeyi süzer). #174 KK5: seyahat yoksa (silindi) yeniden denenmez — ekran hemen listeye döner. */
export function useSeyahat(id: string | undefined) {
  const { hesapli } = useOturum();
  return useQuery({
    queryKey: ['seyahat', id],
    enabled: hesapli && !!id,
    retry: (n, hata) => !seyahatYokMu(hata) && n < 3,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('id, name, city_label, country_code, lat, lng, tz, start_date, end_date, hotel_place_id, hotel_lat, hotel_lng, hotel_label, day_start, day_end, invite_token')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Seyahat;
    },
  });
}

/**
 * PRD 3.3: oteli kaydeder (null → otel yok, KK4). Google'dan yalnızca place_id + konum tutulur;
 * ad kullanıcının düzenleyebildiği etikettir (hotel_label). KK5: 3.7'den değiştirme aynı mutasyonu kullanır.
 */
export function useOtelKaydet(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (otel: OtelSecimi | null) => {
      const { error } = await supabase
        .from('trips')
        .update(
          otel
            ? {
                hotel_place_id: otel.place_id,
                hotel_lat: otel.lat,
                hotel_lng: otel.lng,
                hotel_label: otel.ad.slice(0, 80) || null,
                hotel_fetched_at: new Date().toISOString(),
              }
            : { hotel_place_id: null, hotel_lat: null, hotel_lng: null, hotel_label: null, hotel_fetched_at: null },
        )
        .eq('id', seyahatId);
      if (error) throw error;
      // #56: otel artık gün bazında (stays); 3.3 seçimi tüm günlere uygulanır. trips.hotel_* eski derlemeler için yazılır.
      await tumGunlereOtel(seyahatId, otel);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seyahat', seyahatId] });
      qc.invalidateQueries({ queryKey: ['gunler', seyahatId] });
      qc.invalidateQueries({ queryKey: ['konaklamalar', seyahatId] });
      qc.invalidateQueries({ queryKey: ['seyahatler'] });
    },
  });
}

/**
 * #174: seyahati siler — yalnız sahip (trips_delete = is_owner); günler, mekanlar, duraklar, üyeler, değişiklikler, oylar
 * cascade ile gider. RLS yetkisiz silmeyi hata vermeden süzer; silinen satır dönmezse hata sayılır (KK9: seyahat yerinde
 * kalır). KK4: liste anında güncellenir; durumlar ve profil sayıları yenilenir; seyahate ait önbellek ve cihazdaki bağlı
 * kayıtlar (KK7) temizlenir.
 */
export function useSeyahatSil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (seyahatId: string) => {
      kendiSildiklerim.add(seyahatId);
      const { data, error } = await supabase.from('trips').delete().eq('id', seyahatId).select('id');
      if (error || !data || data.length === 0) {
        kendiSildiklerim.delete(seyahatId);
        throw error ?? new Error('silinemedi');
      }
    },
    onSuccess: (_sonuc, seyahatId) => {
      qc.setQueryData<SeyahatOzet[]>(['seyahatler'], (eski) => eski?.filter((sy) => sy.id !== seyahatId));
      qc.invalidateQueries({ queryKey: ['seyahatler'] });
      qc.invalidateQueries({ queryKey: ['seyahat-durumlari'] });
      qc.invalidateQueries({ queryKey: ['profil-sayilari'] });
      // Açık ekranın sorguları ekran kapanınca atılır (açıkken atılırsa boşa yeniden istenir).
      const seyahatinMi = (anahtar: readonly unknown[]) => anahtar.includes(seyahatId);
      qc.removeQueries({ predicate: (q) => seyahatinMi(q.queryKey), type: 'inactive' });
      setTimeout(() => qc.removeQueries({ predicate: (q) => seyahatinMi(q.queryKey), type: 'inactive' }), 3000);
      void yerelKayitlariTemizle(seyahatId);
    },
  });
}
