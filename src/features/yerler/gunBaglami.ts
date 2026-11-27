// #579 (UX önerileri kanvası `Dalga1_BuguneEkle`): Yer ekle'nin gün bağlamı. Gezi günlerinde (seyahat saat dilimine göre, `trips.tz`)
// sekme bugün seçili açılır; arama ve çiplerin altındaki beyaz hap "2. gün · Çarşamba'ya ekleniyor" der, "Değiştir" Hangi güne?
// çekmecesini açar. "+" yeri seçili günün sonuna ekler; bildirim "{ad} bugüne eklendi" (başka günse "{ad} Cuma'ya eklendi").
import type { GunSecenegi } from '@/features/listem/listem';
import { t } from '@/i18n';
import { yonelmeEkli } from '@/lib/ek';
import { GUNLER, haftaGunu } from '@/lib/takvim';
import type { Durak, Gun } from '@/lib/tipler';
import { kacinciGun } from '@/lib/zaman';

/** Bildirim süresi (KK3: 4 sn). */
export const GUN_BILDIRIMI_MS = 4000;

type Tarihli = { start_date: string | null; end_date: string | null; tz: string };

/** KK1: gezi günündeyse bugünün gün sırası (seyahat saat dilimiyle, cihaz saatiyle değil); değilse null. */
export function bugununGunSirasi(seyahat: Tarihli, an: Date): number | null {
  return kacinciGun(seyahat, an);
}

/**
 * KK1: Yer ekle'de etkin gün. Açıkça seçilen gün (Plan'dan gelen `gun` ya da "Değiştir") önce; yoksa gezi günlerinde bugün.
 */
export function etkinGunSirasi(secilen: number | null, bugunSirasi: number | null): number | null {
  return secilen ?? bugunSirasi;
}

/** Gün adının yönelme hali ("Çarşamba'ya", "Pazar'a"); tarihsiz günde null. */
export function gunYonelme(g: Pick<Gun, 'date'>): string | null {
  if (!g.date) return null;
  return yonelmeEkli(GUNLER[haftaGunu(g.date)]);
}

/** KK2: hap metni — "2. gün · Çarşamba'ya ekleniyor"; tarihsiz günde "2. güne ekleniyor". */
export function gunHapiMetni(g: Pick<Gun, 'index' | 'date'>): string {
  const gun = gunYonelme(g);
  return gun ? t('kesfet.gunHapi', { n: g.index, gun }) : t('kesfet.gunHapiTarihsiz', { n: g.index });
}

/** KK3: bildirim — bugünse "{ad} bugüne eklendi", başka günse "{ad} Cuma'ya eklendi" (tarihsizse "{ad} 4. güne eklendi"). */
export function gunEklendiMetni(ad: string, g: Pick<Gun, 'index' | 'date'>, bugunSirasi: number | null): string {
  if (g.index === bugunSirasi) return t('kesfet.bugunEklendi', { ad });
  const gun = gunYonelme(g);
  return gun ? t('kesfet.gunEklendi', { ad, gun }) : t('kesfet.guneEklendi', { ad, n: g.index });
}

/** KK3: gün bağlamında "+" düğmesinin ekran okuyucu etiketi — "Bugüne ekle" / "Cuma'ya ekle" / "4. güne ekle". */
export function gunEkleEtiketi(g: Pick<Gun, 'index' | 'date'>, bugunSirasi: number | null): string {
  if (g.index === bugunSirasi) return t('kesfet.bugunEkle');
  const gun = gunYonelme(g);
  return gun ? t('kesfet.gunEkle', { gun }) : t('kesfet.guneEkle', { n: g.index });
}

/**
 * KK2: "Değiştir"in açtığı Hangi güne? çekmecesi için gün seçenekleri (belirli bir yer yok: mesafe ve öneri yok). Satır alt metni
 * çekmecenin kendi kuralıyla ("2 durak", "Boş gün", "Geçti") yazılır.
 */
export function baglamGunSecenekleri(gunler: Gun[], duraklar: Pick<Durak, 'day_id' | 'skipped'>[]): GunSecenegi[] {
  const sirali = [...gunler].sort((a, b) => a.index - b.index);
  const sonIndex = sirali.length ? sirali[sirali.length - 1].index : 0;
  return sirali.map((g) => ({
    gun: g,
    durakSayisi: duraklar.filter((d) => d.day_id === g.id && !d.skipped).length,
    enYakinM: null,
    yakindaki: 0,
    bitisDk: null,
    yeniBitisDk: 0,
    ekleIndeksi: 0,
    onerilen: false,
    sonGun: g.index === sonIndex && sirali.length > 1,
  }));
}
