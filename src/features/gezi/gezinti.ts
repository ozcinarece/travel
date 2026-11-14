// #181: seyahat içi gezinti — Gezi sayfası seyahatin evi. Listem, Rehber ve diğer sekmelerdeki "‹ {seyahat adı}" Gezi'ye döner.
import { router } from 'expo-router';

/** Gezi sekmesi (seyahatin ana sayfası). */
export function geziyeGit(id: string) {
  router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id } });
}

/** Yığına açılan ekrandan (Listem, Rehber) geri: önceki ekran varsa ona, yoksa (derin link) Gezi sayfasına. */
export function geriYaDaGezi(id: string) {
  if (router.canGoBack()) router.back();
  else router.replace({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id } });
}
