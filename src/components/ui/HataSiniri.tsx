import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { hataBildir } from '@/lib/hataRaporu';
import { hataOzeti, ilkBilesen, sonIzler } from '@/lib/izler';
import { bosluk, renk, yazi } from '@/theme';

type Props = { children: ReactNode };
type Durum = { hata: Error | null; bilesen: string | null };

/**
 * #85 KK3: uygulama kökünde hata sınırı — yakalanmamış render hatasında gri boş ekran yerine "Bir şeyler ters gitti ·
 * Yeniden dene" kartı; hata Sentry'ye gider (hataBildir). "Yeniden dene" ağacı yeniden kurar (durum sıfırlanır).
 */
export class HataSiniri extends Component<Props, Durum> {
  state: Durum = { hata: null, bilesen: null };

  static getDerivedStateFromError(hata: Error): Partial<Durum> {
    return { hata };
  }

  componentDidCatch(hata: Error, bilgi: ErrorInfo) {
    const bilesen = ilkBilesen(bilgi.componentStack);
    this.setState({ bilesen });
    hataBildir(hata, `hata-siniri${bilesen ? `: ${bilesen}` : ''}`);
  }

  yenidenDene = () => this.setState({ hata: null, bilesen: null });

  render() {
    if (!this.state.hata) return this.props.children;
    // #85: DSN yokken tek kanıt bu kart — hata mesajı + bileşen + son 5 iz (küçük gri yazı; ekran görüntüsüyle iletilir).
    const izler = sonIzler(5);
    return (
      <View style={s.ekran}>
        <View style={s.kart}>
          <Text style={s.baslik}>{t('genel.hataBaslik')}</Text>
          <Text style={s.metin}>{t('genel.hataMetin')}</Text>
          <Text style={s.kod} selectable testID="hata-kodu">
            {hataOzeti(this.state.hata)}
            {this.state.bilesen ? ` · ${this.state.bilesen}` : ''}
          </Text>
          {izler.length > 0 ? (
            <Text style={s.izler} selectable testID="hata-izler">
              {izler.map((i) => `${new Date(i.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ${i.kategori}: ${i.mesaj}`).join('\n')}
            </Text>
          ) : null}
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
  kod: { fontFamily: yazi.yari, fontSize: 11, lineHeight: 15, color: renk.ikincil },
  izler: { fontFamily: yazi.normal, fontSize: 10, lineHeight: 14, color: renk.soluk },
  dugme: { marginTop: 6, height: 48, borderRadius: 999, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  dugmeMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.zemin },
});
