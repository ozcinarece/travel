import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { agFetch } from './agFetch';
import { bellekMi, webDepolama } from './depolama';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Web'de oturum localStorage'da kalır (PRD 3.10 KK3: misafir aynı tarayıcıda tekrar ad girmez);
// depolama kapalıysa bellekte (#537).
// PKCE: OAuth dönüşü ?code= ile gelir, tarayıcı geçmişinde token kalmaz.
// #293 KK3: 15 sn zaman aşımı; giriş sayfası (HTML) ağ hatası sayılır.
const webDepo = Platform.OS === 'web' ? webDepolama() : null;
/** #552: web'de oturum depolaması bellekteyse tam sayfa OAuth yönlendirmesi PKCE doğrulayıcısını ve daveti kaybeder. */
export const oturumKalici = !webDepo || !bellekMi(webDepo);

export const supabase = createClient(url, anonKey, {
  global: { fetch: agFetch() },
  auth: {
    storage: webDepo ?? AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});
