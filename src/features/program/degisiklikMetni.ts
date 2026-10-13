// #137: Grup penceresi ve (#141) Son değişiklikler — `changes` satırını kısa Türkçe cümleye çevirir (eski grup.tsx'ten taşındı).
import type { Degisiklik } from '@/lib/tipler';

export function degisiklikMetni(d: Degisiklik, mekanAdi: (placesId: string | null | undefined) => string): string {
  const yeni = d.new as Record<string, unknown> | null;
  const eski = d.old as Record<string, unknown> | null;
  const ekle = !eski && yeni;
  const sil = eski && !yeni;
  switch (d.entity) {
    case 'places':
      if (ekle) return `${mekanAdi(d.entity_id)} ekledi`;
      if (sil) return 'bir mekanı listeden çıkardı';
      if (d.field === 'note') return `${mekanAdi(d.entity_id)} için not yazdı`;
      if (d.field === 'default_minutes') return `${mekanAdi(d.entity_id)} süresini ${d.new} dk yaptı`;
      return `${mekanAdi(d.entity_id)} bilgisini değiştirdi`;
    case 'stops': {
      const ref = String((yeni ?? eski)?.place_ref ?? '');
      if (ekle) return `${mekanAdi(ref)} mekanını bir güne ekledi`;
      if (sil) return 'bir durağı günden çıkardı';
      if (d.field === 'arrived_at') return d.new ? 'bir durağa vardı' : 'varış işaretini geri aldı';
      if (d.field === 'completed_at') return d.new ? 'bir durağı tamamladı' : 'tamamlamayı geri aldı';
      if (d.field === 'skipped') return d.new ? 'bir durağı atladı' : 'atlamayı geri aldı';
      if (d.field === 'day_id') return 'bir durağı başka güne aldı';
      if (d.field === 'order_key') return 'sırayı değiştirdi';
      if (d.field === 'minutes') return `bir durağın süresini ${d.new} dk yaptı`;
      return 'bir durağı değiştirdi';
    }
    case 'days':
      if (ekle) return 'gün ekledi';
      if (sil) return 'bir günü sildi';
      if (d.field === 'start_time') return `gün başlangıcını ${String(d.new ?? '').slice(0, 5)} yaptı`;
      if (d.field === 'order_manual') return d.new ? 'sırayı elle düzenledi' : 'en kısa rotaya dizdi';
      if (d.field === 'start_stay_id' || d.field === 'end_stay_id') return 'günün otelini değiştirdi';
      return 'günü değiştirdi';
    case 'stays':
      if (ekle) return 'bir otel ekledi';
      if (sil) return 'bir oteli kaldırdı';
      return 'bir oteli değiştirdi';
    case 'members':
      if (ekle) return 'katıldı';
      if (sil) return 'ayrıldı';
      return 'üyeliği değişti';
    case 'trips':
      if (d.field?.startsWith('hotel')) return 'oteli değiştirdi';
      return 'seyahati değiştirdi';
    default:
      return 'bir değişiklik yaptı';
  }
}

export function zamanMetni(iso: string, simdi = Date.now()): string {
  const fark = Math.max(0, simdi - Date.parse(iso));
  const dk = Math.round(fark / 60_000);
  if (dk < 1) return 'şimdi';
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.round(dk / 60);
  if (sa < 24) return `${sa} sa önce`;
  return `${Math.round(sa / 24)} gün önce`;
}
