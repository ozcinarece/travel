import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { Avatar } from '@/components/ui/Avatar';
import { Buton } from '@/components/ui/Buton';
import { Cip } from '@/components/ui/Cip';
import { MetinAlani } from '@/components/ui/MetinAlani';
import { cikis } from '@/features/auth/giris';
import { fotografSecVeYukle, useKullaniciAdiMusait, useProfilOlustur } from '@/features/profil/sorgular';
import { t } from '@/i18n';
import { addanOner, temizle } from '@/lib/kullaniciAdi';
import { useOturum } from '@/lib/oturum';
import type { HaritaGizliligi } from '@/lib/tipler';
import { bosluk, renk, yazi } from '@/theme';

const GIZLILIKLER: HaritaGizliligi[] = ['friends', 'everyone', 'me'];

type SaglayiciMeta = { full_name?: string; name?: string; picture?: string; avatar_url?: string };

// PRD 0.2 Profilini kur. KK1 ad + benzersiz kullanıcı adı (300 ms kontrol), KK2 harita gizliliği, KK3 fotoğraf.
export default function ProfilKurEkrani() {
  const { session } = useOturum();
  const meta = (session?.user.user_metadata ?? {}) as SaglayiciMeta;
  const [ad, setAd] = useState(meta.full_name ?? meta.name ?? '');
  const [kullaniciAdi, setKullaniciAdi] = useState(() => addanOner(meta.full_name ?? meta.name ?? ''));
  const [gizlilik, setGizlilik] = useState<HaritaGizliligi>('friends');
  const [foto, setFoto] = useState<string | null>(meta.picture ?? meta.avatar_url ?? null);
  const [fotoMesgul, setFotoMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const { guncel, gecerli, musait, kontrolEdiliyor } = useKullaniciAdiMusait(kullaniciAdi);
  const olustur = useProfilOlustur();

  const durum = kullaniciAdiDurumu({ kullaniciAdi, guncel, gecerli, musait, kontrolEdiliyor });
  const hazir = ad.trim().length > 0 && durum.tur === 'musait' && !olustur.isPending;

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
    olustur.mutate(
      { name: ad.trim(), username: kullaniciAdi, map_visibility: gizlilik, photo_url: foto },
      {
        // 23505: kontrol ile kayıt arasında başkası aynı adı aldı.
        onError: (e) => setHata((e as { code?: string }).code === '23505' ? t('profilKur.alinmis') : t('profilKur.hata')),
      },
    );
  };

  return (
    <SafeAreaView style={s.ekran}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.icerik} keyboardShouldPersistTaps="handled">
          <EkranBasligi baslik={t('profilKur.baslik')} alt={t('profilKur.alt')} geri={cikis} />

          <View style={s.fotoAlani}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={foto ? t('profilKur.fotoDegistir') : t('profilKur.fotoEkle')}
              onPress={fotoSec}
              disabled={fotoMesgul}
              style={{ opacity: fotoMesgul ? 0.5 : 1 }}>
              <Avatar ad={ad || '?'} url={foto} boyut={88} />
              <View style={s.fotoArti}>
                <Text style={s.fotoArtiIsaret}>+</Text>
              </View>
            </Pressable>
            <Text style={s.fotoMetin}>{foto ? t('profilKur.fotoDegistir') : t('profilKur.fotoEkle')}</Text>
          </View>

          <View style={s.form}>
            <MetinAlani
              etiket={t('profilKur.ad')}
              value={ad}
              onChangeText={setAd}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              maxLength={60}
            />
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
            <View style={s.gizlilik}>
              <Text style={s.gizlilikBaslik}>{t('profilKur.gizlilikBaslik')}</Text>
              <View style={s.cipler}>
                {GIZLILIKLER.map((g) => (
                  <Cip key={g} baslik={t(`profilKur.gizlilik.${g}`)} secili={gizlilik === g} onPress={() => setGizlilik(g)} />
                ))}
              </View>
              <Text style={s.gizlilikNot}>{t('profilKur.gizlilikNot')}</Text>
            </View>
          </View>

          <View style={s.altKisim}>
            {hata ? <Text style={s.hata}>{hata}</Text> : null}
            <Buton baslik={t('profilKur.devam')} onPress={kaydet} pasif={!hazir} yukleniyor={olustur.isPending} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type Durum = { tur: 'bos' | 'gecersiz' | 'kontrol' | 'musait' | 'alinmis'; metin?: string; renk?: string };

function kullaniciAdiDurumu(g: {
  kullaniciAdi: string;
  guncel: boolean;
  gecerli: boolean;
  musait: boolean | undefined;
  kontrolEdiliyor: boolean;
}): Durum {
  if (g.kullaniciAdi.length === 0) return { tur: 'bos' };
  if (!g.guncel || g.kontrolEdiliyor) return { tur: 'kontrol', metin: t('profilKur.kontrol'), renk: renk.ikincil };
  if (!g.gecerli) return { tur: 'gecersiz', metin: t('profilKur.kural'), renk: renk.ikincil };
  if (g.musait === true) return { tur: 'musait', metin: t('profilKur.musait'), renk: renk.basari };
  if (g.musait === false) return { tur: 'alinmis', metin: t('profilKur.alinmis'), renk: renk.uyari };
  return { tur: 'kontrol', metin: t('profilKur.kontrol'), renk: renk.ikincil };
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { flexGrow: 1, paddingBottom: 16 },
  fotoAlani: { alignItems: 'center', gap: 10, paddingTop: 26 },
  fotoArti: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: renk.vurgu,
    borderWidth: 3,
    borderColor: renk.zemin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoArtiIsaret: { fontFamily: yazi.kalin, fontSize: 16, lineHeight: 18, color: renk.zemin },
  fotoMetin: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  form: { paddingHorizontal: bosluk.kenar, paddingTop: 22, gap: 12 },
  onay: { fontFamily: yazi.kalin, fontSize: 16, color: renk.basari },
  gizlilik: { gap: 8, paddingTop: 6 },
  gizlilikBaslik: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  cipler: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  gizlilikNot: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  altKisim: { marginTop: 'auto', paddingHorizontal: bosluk.kenar, paddingTop: 24, gap: 10 },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});
