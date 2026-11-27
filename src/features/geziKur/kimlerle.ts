// #574 KK6 · KK-ek1 (kanvas `Kur_v11_Cekmece` "Kimlerle?"): son gezilen arkadaşlar (en çok 3) seçilebilir yuvarlaklar; girişte
// verilen kişi (`arkadas`, Profil v12) seçili gelir ve yuvarlaklarda yer alır. "Geziyi oluştur"dan sonra seçilenlere #573'ün
// uygulama içi daveti (`useDavetGonder`) gider. Çekmece ve sihirbaz aynı kancayı kullanır. Google'a istek yok.
import { useMemo, useState } from 'react';

import { useArkadaslarim, type Arkadas } from '@/features/arkadaslar/sorgular';

export type KimlerleKisi = { id: string; ad: string; foto: string | null };

/** Kanvas: en çok 3 yuvarlak. */
export const KIMLERLE_EN_COK = 3;

/** Girişteki kişiler: `arkadas` parametresi (virgülle birden çok; Profil v12 tek kişi verir). */
export function giristekiler(arkadas: string | null | undefined): string[] {
  return (arkadas ?? '').split(',').map((x) => x.trim()).filter(Boolean);
}

/**
 * Yuvarlaklar: `arkadaslarim()` sırası (en son birlikte gezilen önde), en çok 3. Girişteki kişiler listedeyse önce gelir
 * (kalan yerler sırayla dolar). Birlikte gezilenlerden olmayan girişteki kişi eklenmez (sunucu da davet yazmaz).
 */
export function kimlerleKisileri(arkadaslar: readonly Arkadas[] | undefined, giristeki: readonly string[]): KimlerleKisi[] {
  const liste = (arkadaslar ?? []).map((a) => ({ id: a.user_id, ad: a.ad, foto: a.foto }));
  const one = giristeki.map((id) => liste.find((k) => k.id === id)).filter((k): k is KimlerleKisi => !!k);
  const ilk3 = liste.slice(0, KIMLERLE_EN_COK);
  // Girişteki kişi zaten ilk 3'teyse sıra bozulmaz.
  if (one.every((k) => ilk3.some((x) => x.id === k.id))) return ilk3;
  const kalan = liste.filter((k) => !one.some((x) => x.id === k.id));
  return [...one, ...kalan].slice(0, KIMLERLE_EN_COK);
}

/** Çekmece ve sihirbazın ortak seçimi: girişteki kişiler seçili başlar; dokunuş seçer / kaldırır. */
export function useKimlerle(arkadas: string | null | undefined) {
  const arkadaslar = useArkadaslarim();
  const ilk = useMemo(() => giristekiler(arkadas), [arkadas]);
  const kisiler = useMemo(() => kimlerleKisileri(arkadaslar.data, ilk), [arkadaslar.data, ilk]);
  const [secili, setSecili] = useState<ReadonlySet<string>>(() => new Set(ilk));
  const degistir = (id: string) =>
    setSecili((x) => {
      const y = new Set(x);
      if (y.has(id)) y.delete(id);
      else y.add(id);
      return y;
    });
  /** Görünen ve seçili kişiler (davet bunlara gider). */
  const secilenler = kisiler.filter((k) => secili.has(k.id));
  return { kisiler, secili, degistir, secilenler, sifirla: (a: string | null | undefined) => setSecili(new Set(giristekiler(a))) };
}

export type Kimlerle = ReturnType<typeof useKimlerle>;
