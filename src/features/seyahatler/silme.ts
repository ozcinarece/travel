// #174 Seyahat silme (yalnız sahip; DB: trips_delete = is_owner, bağlı tablolar on delete cascade). Saf yardımcılar burada
// (test edilir); kanca sorgular.ts'te.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { OTEL_SERIT_ONEKI } from '@/features/konaklama/otelSeridi';
import { t } from '@/i18n';
import type { UyeOzet } from '@/lib/tipler';

/** KK1–KK2: silme yalnız sahipte; üye "Seyahatten ayrıl" görür. */
export function sahipMi(uyeler: Pick<UyeOzet, 'user_id' | 'role'>[], kullaniciId: string | undefined): boolean {
  return !!kullaniciId && uyeler.some((u) => u.user_id === kullaniciId && u.role === 'owner');
}

/** KK3: onay metni — sahip tek başınaysa kalıcılık, başkaları da varsa onlar için de silineceği. */
export function silmeMetni(uyeSayisi: number): string {
  const digerleri = Math.max(0, uyeSayisi - 1);
  return digerleri === 0 ? t('seyahatler.silMetinTek') : t('seyahatler.silMetinCok', { n: digerleri });
}

/** KK5: tek seyahat sorgusu satır bulamadıysa (silindi ya da artık üye değil) PostgREST PGRST116 döner. */
export function seyahatYokMu(hata: unknown): boolean {
  return (hata as { code?: string } | null)?.code === 'PGRST116';
}

/**
 * Bu cihazda sahibin sildiği seyahatler: seyahat ekranındaki "Bu seyahat silindi" bekçisi kendi silmemizde ikinci kez
 * uyarmasın (sahip zaten "Seyahat silindi" bildirimini görür).
 */
export const kendiSildiklerim = new Set<string>();

/** Seyahate bağlı yerel kayıtlar (KK7). Zamanlanmış bildirim ve arka plan konumu yok; ön plan konumu ekranla kapanır. */
const YEREL_ONEKLER = [OTEL_SERIT_ONEKI];
export async function yerelKayitlariTemizle(seyahatId: string): Promise<void> {
  await Promise.all(YEREL_ONEKLER.map((o) => AsyncStorage.removeItem(o + seyahatId).catch(() => undefined)));
}

/**
 * KK1: platformun eylem menüsü (iOS ActionSheet, Android Alert); seçilirse true. Web'de menü yok — ardından gelen onay
 * penceresi (window.confirm) seçimi karşılar.
 */
export function eylemMenusu(baslik: string, eylem: { metin: string; yikici?: boolean }, vazgec: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(true);
  return new Promise((coz) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: baslik, options: [eylem.metin, vazgec], destructiveButtonIndex: eylem.yikici ? 0 : undefined, cancelButtonIndex: 1 },
        (i) => coz(i === 0),
      );
      return;
    }
    Alert.alert(
      baslik,
      undefined,
      [
        { text: vazgec, style: 'cancel', onPress: () => coz(false) },
        { text: eylem.metin, style: eylem.yikici ? 'destructive' : 'default', onPress: () => coz(true) },
      ],
      { cancelable: true, onDismiss: () => coz(false) },
    );
  });
}
