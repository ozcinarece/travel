// #183: harcama satırlarının ve bakiyelerin kişi adlı metinleri — "Mert ödedi · 3'e eşit · durağa bağlı", "Ayşe → sana".
import { t } from '@/i18n';
import type { Uye } from '@/lib/tipler';
import { yuzRenkleri } from '@/theme';

import { bolusumOzeti, sayiYonelme, type Harcama } from './hesap';

export type Kisiler = {
  /** Üyenin adı; seyahatten ayrılmış biri "Ayrılan üye". */
  ad: (id: string) => string;
  renk: (id: string) => string;
  foto: (id: string) => string | null;
  uyeIdleri: string[];
};

export function kisiler(uyeler: Uye[]): Kisiler {
  const ile = new Map(uyeler.map((u, i) => [u.user_id, { u, i }]));
  return {
    ad: (id) => ile.get(id)?.u.display_name ?? t('harcama.ayrilan'),
    renk: (id) => yuzRenkleri[(ile.get(id)?.i ?? 2) % yuzRenkleri.length],
    foto: (id) => ile.get(id)?.u.photo_url ?? null,
    uyeIdleri: uyeler.map((u) => u.user_id),
  };
}

export function odeyenMetni(odeyen: string, benId: string | null, k: Kisiler): string {
  return odeyen === benId ? t('harcama.senOdedin') : t('harcama.odedi', { ad: k.ad(odeyen) });
}

export function bolusumMetni(h: Pick<Harcama, 'harcama_paylari'>, benId: string | null, k: Kisiler): string {
  const o = bolusumOzeti(h.harcama_paylari, k.uyeIdleri);
  if (o.tur === 'esit') return t('harcama.esit', { n: sayiYonelme(o.n) });
  if (o.tur === 'haric') return t('harcama.haric', { ad: k.ad(o.haric), n: sayiYonelme(o.n) });
  if (o.tur === 'yalniz') return o.kisi === benId ? t('harcama.yalnizSen') : t('harcama.yalniz', { ad: k.ad(o.kisi) });
  return t('harcama.farkli', { n: o.n });
}

/** KK2 satır alt metni. */
export function satirAltMetni(h: Pick<Harcama, 'odeyen_id' | 'harcama_paylari' | 'stop_id'>, benId: string | null, k: Kisiler): string {
  return [odeyenMetni(h.odeyen_id, benId, k), bolusumMetni(h, benId, k), h.stop_id ? t('harcama.duragaBagli') : null].filter(Boolean).join(' · ');
}

/** Açıklama boşsa kategori adı. */
export function harcamaBasligi(h: Pick<Harcama, 'aciklama' | 'kategori'>): string {
  return h.aciklama.trim() || t(`harcama.kategori.${h.kategori}`);
}

/** "Ayşe" / "sen" (Kim kime satırı). */
export function kisiKisa(id: string, benId: string | null, k: Kisiler, durum: 'yalin' | 'yonelme'): string {
  if (id === benId) return durum === 'yonelme' ? t('harcama.sana') : t('harcama.sen');
  return k.ad(id);
}
