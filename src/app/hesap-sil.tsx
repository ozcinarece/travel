import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { Buton } from '@/components/ui/Buton';
import { hesabiSil, useHesapSilmeOnizleme } from '@/features/profil/sorgular';
import { t } from '@/i18n';
import { onayIste } from '@/lib/onay';
import { useOturum } from '@/lib/oturum';
import { bosluk, renk, yazi } from '@/theme';

// v1 Profil — hesap silme. Ürün şartı: hangi seyahatin kime devredileceği / silineceği SİLMEDEN ÖNCE gösterilir.
export default function HesapSilEkrani() {
  const { session } = useOturum();
  const onizleme = useHesapSilmeOnizleme();
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const sil = async () => {
    if (!session) return;
    const onay = await onayIste(t('hesapSil.onayBaslik'), t('hesapSil.onayMetin'), t('hesapSil.onayla'), t('genel.vazgec'));
    if (!onay) return;
    setHata(null);
    setMesgul(true);
    try {
      await hesabiSil(session.user.id);
      // Oturum kapanınca yönlendirme koruması 0.1'e döndürür.
    } catch {
      setHata(t('hesapSil.hata'));
      setMesgul(false);
    }
  };

  return (
    <SafeAreaView style={s.ekran}>
      <EkranBasligi baslik={t('hesapSil.baslik')} geri={() => router.back()} />
      <View style={s.icerik}>
        <Text style={s.aciklama}>{t('hesapSil.aciklama')}</Text>

        <Text style={s.bolum}>{t('hesapSil.sahipBaslik')}</Text>
        {onizleme.isPending ? (
          <ActivityIndicator color={renk.metin} />
        ) : onizleme.isError ? (
          <Text style={s.hata}>{t('hesapSil.onizlemeHata')}</Text>
        ) : onizleme.data.length === 0 ? (
          <Text style={s.satirAlt}>{t('hesapSil.sahipYok')}</Text>
        ) : (
          onizleme.data.map((sy) => (
            <View key={sy.trip_id} style={s.satir}>
              <Text style={s.satirBaslik}>{sy.city_label}</Text>
              <Text style={[s.satirAlt, sy.outcome === 'delete' && { color: renk.uyari }]}>
                {sy.outcome === 'transfer' ? t('hesapSil.devir', { ad: sy.new_owner_name ?? '' }) : t('hesapSil.silinir')}
              </Text>
            </View>
          ))
        )}

        <Text style={s.not}>{t('hesapSil.uyeNot')}</Text>
      </View>

      <View style={s.altKisim}>
        {hata ? <Text style={s.hata}>{hata}</Text> : null}
        <Buton
          baslik={t('hesapSil.dugme')}
          tur="tehlike"
          onPress={sil}
          yukleniyor={mesgul}
          pasif={onizleme.isPending || onizleme.isError}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 20, gap: 12 },
  aciklama: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 21, color: renk.metin },
  bolum: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil, paddingTop: 8 },
  satir: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: renk.ayrac, gap: 2 },
  satirBaslik: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  satirAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  not: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 18, color: renk.ikincil, paddingTop: 8 },
  altKisim: { marginTop: 'auto', paddingHorizontal: bosluk.kenar, paddingBottom: 16, gap: 10 },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});
