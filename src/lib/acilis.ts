// #276 KK2 · KK-ek1: açılış kuralı ve Keşfet'e dönüş.
import { router } from 'expo-router';

import { yerelTarih } from '@/lib/zaman';

/**
 * KK2: gezi günündeki kullanıcı uygulamayı açınca bir kez doğrudan seyahatin Gezi sayfasına iner. Bayrak JS oturumu boyunca
 * (uygulama süreci) yaşar: kullanıcı Keşfet'e döndükten sonra ana ekran yeniden kurulsa ya da uygulama aynı gün ön plana
 * gelse de tekrar seyahate atılmaz. Uygulama kapatılıp açılınca ya da seyahatin diliminde gün değişince (KK-ek3) kural
 * yeniden işler.
 */
let acilisKarariVerildi = false;
/** KK-ek3: bayrağın kapandığı an (yönlendirme, Keşfet'e dönüş ya da Keşfet'ten ayrılış). Gün değişimi buna göre bakılır. */
let kapanisAni: Date | null = null;

function kapat() {
  acilisKarariVerildi = true;
  kapanisAni = new Date();
}

/** Açılış yönlendirmesi bu oturumda yapılacaksa true döner ve bayrağı kapatır (tek seferlik). */
export function acilisKarariAl(): boolean {
  if (acilisKarariVerildi) return false;
  kapat();
  return true;
}

/**
 * #276 KK-ek3: uygulama ön plana gelince çağrılır. Bayrak, aktif seyahatin diliminde (`tz`, `trips.tz`) kapandığı günden
 * farklı bir güne geçildiyse yeniden açılır: gece arka planda kalan uygulama gezi sabahı Gezi'ye iner. Kullanıcı o gün
 * Keşfet'e kendisi döndüyse bayrak bugün kapanmıştır, açılmaz. Bayrak açıksa (ya da yeniden açıldıysa) true döner.
 */
export function acilisKarariniYenile(tz: string, an = new Date()): boolean {
  if (!acilisKarariVerildi) return true;
  if (kapanisAni && yerelTarih(kapanisAni, tz) !== yerelTarih(an, tz)) {
    acilisKarariVerildi = false;
    return true;
  }
  return false;
}

/** Açılış kararı bu oturumda hâlâ verilebilir mi (bayrak açık mı). */
export function acilisKarariAcik(): boolean {
  return !acilisKarariVerildi;
}

/** Açılışta seyahat listesi beklenirken yükleniyor göstergesi en çok bu kadar kalır; sonra Keşfet açılır (#283 inceleme 2). */
export const ACILIS_BEKLEME_MS = 1500;

/** Ana ekran açılış kararını beklemeden kurulduysa (ör. davet akışı önce geldi) kural bu oturumda artık işlemez. */
export function acilisKarariniKapat() {
  kapat();
}

/** Yalnız testler için. */
export function acilisKarariniSifirla() {
  acilisKarariVerildi = false;
  kapanisAni = null;
}

type Yigin = { routes: { name: string; state?: Partial<Yigin> }[] } | undefined;

/** Kök durumda `(tabs)` iç yığınında ana ekranın üstünde ekran (ör. Profil) var mı. */
function sekmeYiginiDerin(kok: Yigin): boolean {
  const ara = (d: Yigin): number => {
    for (const r of d?.routes ?? []) {
      if (r.name === '(tabs)') return r.state?.routes?.length ?? 1;
      const ic = ara(r.state as Yigin);
      if (ic) return ic;
    }
    return 0;
  };
  return ara(kok) > 1;
}

/**
 * KK-ek1: "‹ Keşfet" her yoldan ana ekrana (`(tabs)/index`) döner. `dismissTo('/(tabs)')` kök yığında seyahati kapatır ama
 * `(tabs)` iç yığınında üstte Profil varsa onun üstüne yeni bir ana ekran koyar (Profil › Gezilerim yolu; geri tuşu Profil'e
 * döner). Bu durumda ardından `dismissAll` iç yığını ana ekrana indirir: yığın yalnız Keşfet olur. `kok`: çağrı anındaki kök
 * gezinme durumu (`useNavigationContainerRef().getRootState()`).
 */
export function kesfeteDon(kok: Yigin) {
  // Kullanıcı Keşfet'e kendisi döndü: bu oturumda açılış kuralı artık işlemez (ana ekran yeniden kurulsa da Gezi'ye atılmaz).
  acilisKarariniKapat();
  const derin = sekmeYiginiDerin(kok);
  router.dismissTo('/(tabs)');
  if (derin) router.dismissAll();
}

/**
 * #283 inceleme 2 · 2: kök yığındaki `seyahat/[id]` rotasına açılış kuralıyla mı gelindi (`acilis=1`). Expo Router iç ekranın
 * parametrelerini kök rotada `params` altında taşır; ikisine de bakılır.
 */
export function acilisGecisi(p: unknown): boolean {
  const r = p as { acilis?: string; params?: { acilis?: string } } | undefined;
  return r?.acilis === '1' || r?.params?.acilis === '1';
}
