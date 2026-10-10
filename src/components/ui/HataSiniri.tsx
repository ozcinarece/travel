import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { hataBildir } from '@/lib/hataRaporu';
import { bosluk, renk, yazi } from '@/theme';

type Props = { children: ReactNode };
type Durum = { hata: Error | null };

/**
 * #85 KK3: uygulama kökünde hata sınırı — yakalanmamış render hatasında gri boş ekran yerine "Bir şeyler ters gitti ·
 * Yeniden dene" kartı; hata Sentry'ye gider (hataBildir). "Yeniden dene" ağacı yeniden kurar (durum sıfırlanır).
 */
export class HataSiniri extends Component<Props, Durum> {
  state: Durum = { hata: null };

  static getDerivedStateFromError(hata: Error): Durum {
    return { hata };
  }

  componentDidCatch(hata: Error, bilgi: ErrorInfo) {
    hataBildir(hata, `hata-siniri${bilgi.componentStack ? `: ${bilgi.componentStack.split('\n').filter(Boolean)[0]?.trim() ?? ''}` : ''}`);
  }

  yenidenDene = () => this.setState({ hata: null });

  render() {
    if (!this.state.hata) return this.props.children;
    return (
      <View style={s.ekran}>
        <View style={s.kart}>
          <Text style={s.baslik}>{t('genel.hataBaslik')}</Text>
          <Text style={s.metin}>{t('genel.hataMetin')}</Text>
          <Pressable accessibilityRole="button" onPress={this.yenidenDene} style={({ pressed }) => [s.dugme, pressed && { opacity: 0.85 }]}>
            <Text style={s.dugmeMetin}>{t('genel.yenidenDene')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center', padding: bosluk.kenar },
  kart: { width: '100%', maxWidth: 360, padding: 20, borderRadius: 18, backgroundColor: renk.zemin, gap: 10 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 18, letterSpacing: -0.3, color: renk.metin },
  metin: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 19, color: renk.ikincil },
  dugme: { marginTop: 6, height: 48, borderRadius: 999, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  dugmeMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.zemin },
});
