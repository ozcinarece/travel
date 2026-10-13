import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { Avatar } from '@/components/ui/Avatar';
import { Buton } from '@/components/ui/Buton';
import { Cip } from '@/components/ui/Cip';
import { MetinAlani } from '@/components/ui/MetinAlani';
import { kullaniciAdiDurumu } from '@/features/profil/kullaniciAdiDurumu';
import { fotografSecVeYukle, useKullaniciAdiMusait, useProfil, useProfilGuncelle } from '@/features/profil/sorgular';
import { t } from '@/i18n';
import { temizle } from '@/lib/kullaniciAdi';
import { useOturum } from '@/lib/oturum';
import type { HaritaGizliligi } from '@/lib/tipler';
import { bosluk, renk, yazi } from '@/theme';

const GIZLILIKLER: HaritaGizliligi[] = ['friends', 'everyone', 'me'];

/** #138 KK2–3: Profil › Düzenle — foto, ad, kullanıcı adı (300 ms müsaitlik), harita gizliliği. Otomatik profil buradan değişir. */
export default function ProfilDuzenle() {
  const { session } = useOturum();
  const profil = useProfil();
  const guncelle = useProfilGuncelle();
  const p = profil.data;
  const [ad, setAd] = useState(p?.name ?? '');
  const [kullaniciAdi, setKullaniciAdi] = useState(p?.username ?? '');
  const [gizlilik, setGizlilik] = useState<HaritaGizliligi>(p?.map_visibility ?? 'friends');
  const [foto, setFoto] = useState<string | null>(p?.photo_url ?? null);
  const [fotoMesgul, setFotoMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const kontrol = useKullaniciAdiMusait(kullaniciAdi);
  const durum = kullaniciAdiDurumu({ kullaniciAdi, mevcut: p?.username, ...kontrol });
  const adGecerli = ad.trim().length > 0 && ad.trim().length <= 60;
  const kullaniciAdiTamam = durum.tur === 'ayni' || durum.tur === 'musait';
  const degisti = !!p && (ad.trim() !== p.name || kullaniciAdi !== p.username || gizlilik !== p.map_visibility || foto !== p.photo_url);

  const fotoSec = async () => {
    if (!session) return;
    setFotoMesgul(true);
    try {
      const url = await fotografSecVeYukle(session.user.id);
      if (url) setFoto(url);
    } catch {
      setHata(t('profilKur.fotoHata'));
    } finally {
      setFotoMesgul(false);
    }
  };
  const kaydet = () => {
    setHata(null);
    guncelle.mutate(
      { name: ad.trim(), username: kullaniciAdi, map_visibility: gizlilik, photo_url: foto },
      {
        onSuccess: () => router.back(),
        // 23505: kontrol ile kayıt arasında başkası aynı adı aldı.
        onError: (e) => setHata((e as { code?: string }).code === '23505' ? t('profilKur.alinmis') : t('profil.hata')),
      },
    );
  };

  return (
    <SafeAreaView style={s.ekran}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.icerik} keyboardShouldPersistTaps="handled">
          <EkranBasligi baslik={t('profil.duzenleBaslik')} geri={() => router.back()} />
          <View style={s.fotoAlani}>
            <Pressable accessibilityRole="button" accessibilityLabel={foto ? t('profilKur.fotoDegistir') : t('profilKur.fotoEkle')} onPress={fotoSec} disabled={fotoMesgul} style={{ opacity: fotoMesgul ? 0.5 : 1 }}>
              <Avatar ad={ad || '?'} url={foto} boyut={88} arkaPlan={renk.vurgu} />
            </Pressable>
            <Text onPress={fotoSec} style={s.fotoMetin}>
              {foto ? t('profilKur.fotoDegistir') : t('profilKur.fotoEkle')}
            </Text>
          </View>
          <View style={s.form}>
            <MetinAlani etiket={t('profilKur.ad')} value={ad} onChangeText={setAd} autoCapitalize="words" autoComplete="name" textContentType="name" maxLength={60} />
            <MetinAlani
              etiket={t('profilKur.kullaniciAdi')}
              onEk="@"
              value={kullaniciAdi}
              onChangeText={(v) => setKullaniciAdi(temizle(v))}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              maxLength={24}
              vurgulu
              sagEk={durum.tur === 'musait' ? <Text style={s.onay}>✓</Text> : null}
              altMetin={durum.metin}
              altRenk={durum.renk}
            />
            <View style={{ gap: 8, paddingTop: 6 }}>
              <Text style={s.gizlilikBaslik}>{t('profil.gizlilikSec')}</Text>
              <View style={s.cipler}>
                {GIZLILIKLER.map((g) => (
                  <Cip key={g} baslik={t(`profilKur.gizlilik.${g}`)} secili={gizlilik === g} onPress={() => setGizlilik(g)} />
                ))}
              </View>
              <Text style={s.not}>{t('profil.gizlilikNot')}</Text>
            </View>
          </View>
          <View style={s.altKisim}>
            {hata ? <Text style={s.hata}>{hata}</Text> : null}
            <Buton baslik={t('profil.kaydet')} onPress={kaydet} pasif={!degisti || !adGecerli || !kullaniciAdiTamam} yukleniyor={guncelle.isPending} boy="buyuk" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { flexGrow: 1, paddingBottom: 16 },
  fotoAlani: { alignItems: 'center', gap: 10, paddingTop: 24 },
  fotoMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  form: { paddingHorizontal: bosluk.kenar, paddingTop: 22, gap: 12 },
  onay: { fontFamily: yazi.kalin, fontSize: 16, color: renk.basariMetin },
  gizlilikBaslik: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  cipler: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  not: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  altKisim: { marginTop: 'auto', paddingHorizontal: bosluk.kenar, paddingTop: 24, gap: 10 },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});
