import type { ExpoConfig } from 'expo/config';

// Anahtarlar ve alan adı ortam değişkeninden gelir (bkz. .env.example); repoya yazılmaz.
const appDomain = process.env.APP_DOMAIN;
// Apple girişi Apple Developer hesabı gelene kadar kapalı; açılınca iOS yetkisi ve eklentisi devreye girer.
const appleAcik = process.env.EXPO_PUBLIC_APPLE_SIGN_IN === '1';

// EAS projesi: @eceoz1/gezi (https://expo.dev/accounts/eceoz1/projects/gezi). Kimlik gizli değildir.
const easProjectId = process.env.EAS_PROJECT_ID ?? 'ce63656a-1090-42c8-9de9-8c9a8388a3fe';

const config: ExpoConfig = {
  name: 'gezi',
  slug: 'gezi',
  owner: 'eceoz1',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'gezi',
  userInterfaceStyle: 'light',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: process.env.IOS_BUNDLE_ID ?? 'app.gezi.dev',
    usesAppleSignIn: appleAcik,
    associatedDomains: appDomain ? [`applinks:${appDomain}`] : [],
  },
  android: {
    package: process.env.ANDROID_PACKAGE ?? 'app.gezi.dev',
    adaptiveIcon: {
      backgroundColor: '#ffffff',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    intentFilters: appDomain
      ? [
          {
            action: 'VIEW',
            autoVerify: true,
            data: [{ scheme: 'https', host: appDomain, pathPrefix: '/r/' }],
            category: ['BROWSABLE', 'DEFAULT'],
          },
        ]
      : [],
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-localization',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#ffffff',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      // iOS'ta da Google haritası: Places verisi Google haritası dışında gösterilemez (teknik not §1).
      'react-native-maps',
      {
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY,
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Profil fotoğrafın için galerine erişmek istiyoruz.',
        cameraPermission: false,
      },
    ],
    ...(appleAcik ? ['expo-apple-authentication'] : []),
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: { eas: { projectId: easProjectId } },
};

export default config;
