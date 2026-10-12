// #106 KK1: yönetim paneli (src/app/(yonetim)) yalnız `YONETIM=1` ile derlenir. Expo Router'ın require.context'i
// `.web.tsx` rotalarını da android/ios paketine aldığından platform uzantısı yetmez; değişken yoksa grup Metro'nun
// dosya haritasından çıkarılır → mobil paketin (expo export --platform android) çıktısı değişmez.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (process.env.YONETIM !== '1') {
  const mevcut = config.resolver.blockList;
  config.resolver.blockList = [
    ...(Array.isArray(mevcut) ? mevcut : mevcut ? [mevcut] : []),
    /[\\/]src[\\/]app[\\/]\(yonetim\)[\\/].*/,
  ];
}

module.exports = config;
