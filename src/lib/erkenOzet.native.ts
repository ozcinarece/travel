// #643: erken özet yalnız web'de (HTML'deki satır içi betik); native'de özet sorgusu isteği her zaman kendisi atar.
export const ERKEN_OZET = '__tripmateErkenOzet';

export async function erkenOzetiAl(
  _rpc: string,
  _argumanlar: Record<string, unknown>,
  _uygulamaYetkisi?: () => Promise<string | null>,
): Promise<{ data: unknown } | null> {
  return null;
}
