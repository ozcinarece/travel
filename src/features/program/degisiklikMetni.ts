// #137: Grup penceresi ve (#141) Son değişiklikler — `changes` satırını kısa Türkçe cümleye çevirir (eski grup.tsx'ten taşındı).
import { paraMetni } from '@/features/harcama/hesap';
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
    // #200: Günlere dağıt tek kayıt (eklenen duraklar, kısalan süreler, uzayan günler birlikte geri alınır).
    case 'dagit': {
      const o = (yeni ?? {}) as { mekan?: number; kisalt?: boolean; uzat?: boolean };
      return [`${o.mekan ?? 0} mekanı günlere dağıttı`, o.kisalt ? 'süreleri kısalttı' : null, o.uzat ? 'günleri uzattı' : null].filter(Boolean).join(' · ');
    }
    case 'dagit_geri':
      return 'günlere dağıtımı geri aldı';
    // #183: harcama ve ödeşme (paylar akışta ayrıca gösterilmez; harcamayla birlikte geri alınır).
    case 'harcamalar': {
      const satir = (yeni ?? eski) as { aciklama?: string; tl_kurus?: number } | null;
      const ad = satir?.aciklama?.trim() ? `"${satir.aciklama.trim()}" harcamasını` : 'bir harcamayı';
      if (ekle) return `${ad} ekledi${satir?.tl_kurus ? ` · ${paraMetni(satir.tl_kurus)}` : ''}`;
      if (sil) return `${ad} sildi`;
      return 'bir harcamayı değiştirdi';
    }
    case 'odesmeler':
      if (ekle) return `bir ödeşmeyi işaretledi${yeni?.tl_kurus ? ` · ${paraMetni(Number(yeni.tl_kurus))}` : ''}`;
      if (sil) return 'bir ödeşmeyi geri aldı';
      return 'bir ödeşmeyi değiştirdi';
    default:
      return 'bir değişiklik yaptı';
  }
}

/**
 * #141 KK6: aynı işlemde (aynı an, aynı kişi, aynı satır) yazılan alan değişiklikleri tek cümle olur — "Mert Kurşunlu
 * Külliyesi mekanını 2. güne taşıdı". Sunucu geri almayı da aynı grup üzerinden yapar (degisikligi_geri_al).
 */
export type DegisiklikGrubu = { id: number; kim: string | null; at: string; entity: string; entity_id: string; satirlar: Degisiklik[] };

export function degisiklikGruplari(liste: Degisiklik[]): DegisiklikGrubu[] {
  const gruplar: DegisiklikGrubu[] = [];
  for (const d of liste) {
    const son = gruplar[gruplar.length - 1];
    if (son && son.at === d.at && son.kim === d.user_id && son.entity === d.entity && son.entity_id === d.entity_id) son.satirlar.push(d);
    else gruplar.push({ id: d.id, kim: d.user_id, at: d.at, entity: d.entity, entity_id: d.entity_id, satirlar: [d] });
  }
  return gruplar;
}

/**
 * Grubun cümlesi: taşıma ("… mekanını 2. güne taşıdı") öne alınır; diğerlerinde ilk anlamlı satırın cümlesi. Alan değişikliği
 * satırında place_ref yoktur — durağın mekanı `durakMekani` ile (güncel durak listesinden) bulunur.
 */
export function grupMetni(
  g: DegisiklikGrubu,
  k: { mekanAdi: (placesId: string | null | undefined) => string; gunNo: (dayId: string) => number | null; durakMekani: (durakId: string) => string | null },
): string {
  const tasima = g.satirlar.find((d) => d.entity === 'stops' && d.field === 'day_id');
  if (tasima) {
    const ad = k.mekanAdi(k.durakMekani(g.entity_id));
    const n = k.gunNo(String(tasima.new ?? ''));
    return n ? `${ad} mekanını ${n}. güne taşıdı` : `${ad} mekanını başka güne aldı`;
  }
  const ana = g.satirlar.find((d) => d.field !== 'order_key') ?? g.satirlar[0];
  return degisiklikMetni(ana, k.mekanAdi);
}

/**
 * Geri alınabilen gruplar: plan verisi (mekan, durak, gün alanları); varış/tamamlanma (otomatik) ve üyelik değil. #183: harcama
 * (ekleme · silme · düzenleme) ve ödeşme (işaretleme · geri alma) — sunucu yetkiyi ayrıca denetler (ekleyen ya da sahip; ödeşmede
 * iki taraf).
 */
export function geriAlinabilir(g: DegisiklikGrubu): boolean {
  const ilk = g.satirlar[0];
  if (g.entity === 'harcamalar' || g.entity === 'odesmeler' || g.entity === 'dagit') return true;
  if (g.entity === 'places' || g.entity === 'stops') {
    if (!ilk.field) return true;
    return g.satirlar.some((d) => d.field && !['arrived_at', 'arrived_by', 'completed_at', 'completed_by', 'auto_completed'].includes(d.field));
  }
  if (g.entity === 'days') return !!ilk.field && g.satirlar.some((d) => d.field === 'start_time' || d.field === 'order_manual');
  return false;
}

/**
 * #183: harcama / ödeşme grubunu bu kişi geri alabilir mi (sunucudaki kuralın aynısı; düğme boşuna görünmesin). Harcama: sahip,
 * ekleyen ya da değişikliği yapan (yapabildiyse ekleyen ya da sahiptir). Ödeşme: iki taraftan biri. Diğer varlıklarda kısıt yok.
 */
export function geriAlmaYetkisi(g: DegisiklikGrubu, benId: string | null, sahip: boolean): boolean {
  const satir = (g.satirlar[0].old ?? g.satirlar[0].new) as Record<string, unknown> | null;
  const nesne = satir && typeof satir === 'object' ? satir : null;
  if (g.entity === 'harcamalar') return sahip || (!!benId && (g.kim === benId || nesne?.olusturan === benId));
  if (g.entity === 'odesmeler') return !!benId && (nesne?.kimden === benId || nesne?.kime === benId);
  return true;
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
