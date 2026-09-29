import { Alert, Platform } from 'react-native';

/** Yıkıcı işlem onayı. Web'de Alert çalışmadığı için window.confirm kullanılır. */
export function onayIste(baslik: string, metin: string, onayla: string, vazgec: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${baslik}\n\n${metin}`));
  return new Promise((coz) =>
    Alert.alert(
      baslik,
      metin,
      [
        { text: vazgec, style: 'cancel', onPress: () => coz(false) },
        { text: onayla, style: 'destructive', onPress: () => coz(true) },
      ],
      { cancelable: true, onDismiss: () => coz(false) },
    ),
  );
}
