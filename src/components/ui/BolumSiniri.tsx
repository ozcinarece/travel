import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { hataBildir } from '@/lib/hataRaporu';
import { hataOzeti, ilkBilesen, sonHatayiSakla } from '@/lib/izler';
import { renk, yazi } from '@/theme';

type Props = {
  /** Raporda ve son hata kaydında bölümün adı (ör. "gezi-harita"). */
  ad: string;
  children: ReactNode;
  /** Kart yerine gösterilecek yedek (ör. üstte açılan pencerede kapatılabilir kart); yoksa küçük "açılamadı" kartı. */
  yedek?: (yenidenDene: () => void) => ReactNode;
  /** Değişince hata unutulur ve bölüm yeniden denenir (ör. haritada seçili gün). */
  sifirla?: string | number;
};
type Durum = { hata: Error | null };

/**
 * #199 KK3: sayfa BÖLÜMÜ hata sınırı — bir bölüm (harita, plan, yazı…) render'da hata verirse yalnız o bölüm küçük bir
 * "açılamadı · Yeniden dene" kartına döner, sayfanın geri kalanı çalışır. Hata Sentry'ye gider ve cihazda son hata olarak
 * saklanır (Profil → Son hata); kartta kısa özet görünür (ekran görüntüsüyle iletilir). Kökteki HataSiniri'nin bölüm hali.
 */
export class BolumSiniri extends Component<Props, Durum> {
  state: Durum = { hata: null };

  static getDerivedStateFromError(hata: Error): Durum {
    return { hata };
  }

  componentDidCatch(hata: Error, bilgi: ErrorInfo) {
    const bilesen = ilkBilesen(bilgi.componentStack);
    hataBildir(hata, `bolum: ${this.props.ad}${bilesen ? ` · ${bilesen}` : ''}`);
    sonHatayiSakla(hata, `${this.props.ad}${bilesen ? ` · ${bilesen}` : ''}`, bilgi.componentStack ?? null);
  }

  componentDidUpdate(onceki: Props) {
    if (this.state.hata && onceki.sifirla !== this.props.sifirla) this.setState({ hata: null });
  }

  yenidenDene = () => this.setState({ hata: null });

  render() {
    if (!this.state.hata) return this.props.children;
    if (this.props.yedek) return this.props.yedek(this.yenidenDene);
    return (
      <View style={s.kart} testID={`bolum-hata:${this.props.ad}`}>
        <Text style={s.metin}>{t('genel.bolumHata')}</Text>
        <Text style={s.kod} selectable>
          {hataOzeti(this.state.hata)}
        </Text>
        <Pressable accessibilityRole="button" onPress={this.yenidenDene} hitSlop={8}>
          <Text style={s.dugme}>{t('genel.yenidenDene')}</Text>
        </Pressable>
      </View>
    );
  }
}

const s = StyleSheet.create({
  kart: { padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: renk.ayrac, backgroundColor: renk.zemin, gap: 6 },
  metin: { fontFamily: yazi.yari, fontSize: 13, color: renk.metin },
  kod: { fontFamily: yazi.normal, fontSize: 11, lineHeight: 15, color: renk.ikincil },
  dugme: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
});
