import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SecimMenusu } from '@/components/program/SecimMenusu';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { cikis } from '@/features/auth/giris';
import { useProfil, useProfilGuncelle, useProfilSayilari } from '@/features/profil/sorgular';
import { t } from '@/i18n';
import { sonHatayiOku, sonHatayiSil, type SonHata } from '@/lib/izler';
import type { HaritaGizliligi } from '@/lib/tipler';
import { bosluk, kose, renk, yazi } from '@/theme';

const GIZLILIKLER: HaritaGizliligi[] = ['friends', 'everyone', 'me'];
/** Yardım ve geri bildirim e-postası (ortam değişkeni; yoksa satır gösterilmez). */
const DESTEK_EPOSTA = process.env.EXPO_PUBLIC_DESTEK_EPOSTA ?? '';

/**
 * #138 → #144 (kanvas 22 · Profil): foto, ad, @kullanıcı adı, Düzenle; sayılar seyahat · mekan gezildi · şehir (KK5 kuralı
 * `profil_sayilari`); ayarlar: Haritanı kimler görsün, Bildirimler, Konum (Gezi günlerinde), Dil, Yardım ve geri bildirim, Çıkış
 * yap; Hesabı sil.
 */
export default function ProfilEkrani() {
  const profil = useProfil();
  const sayilar = useProfilSayilari();
  const guncelle = useProfilGuncelle();
  // Konum yalnız gezi günlerinde (Program) istenir; burada iznin durumu, dokununca telefon ayarları.
  const konumIzni = useQuery({ queryKey: ['konum-izni'], queryFn: async () => (await Location.getForegroundPermissionsAsync()).status });
  useFocusEffect(
    useCallback(() => {
      konumIzni.refetch();
      sayilar.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const ayarlar = () => Linking.openSettings().catch(() => {});
  const [gizlilikAcik, setGizlilikAcik] = useState(false);
  // #120 KK4: hata kartının kaydı — "Bir şeyler ters gitti" sonrası kök neden burada okunur (seçilebilir metin).
  const [sonHata, setSonHata] = useState<SonHata | null>(null);
  const [taniAcik, setTaniAcik] = useState(false);
  useEffect(() => {
    sonHatayiOku().then(setSonHata);
  }, []);
  const p = profil.data;
  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView contentContainerStyle={s.icerik}>
        {p ? (
          <View style={s.kimlik}>
            <Avatar ad={p.name} url={p.photo_url} boyut={72} arkaPlan={renk.vurgu} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.ad} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={s.kullaniciAdi} numberOfLines={1}>
                @{p.username}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push('/profil-duzenle')} style={s.duzenle}>
              <Text style={s.duzenleMetin}>{t('profil.duzenle')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={s.sayilar}>
          <Sayi n={sayilar.data?.seyahat} etiket={t('profil.sayiSeyahat')} />
          <Sayi n={sayilar.data?.gezilen} etiket={t('profil.sayiGezilen')} />
          <Sayi n={sayilar.data?.sehir} etiket={t('profil.sayiSehir')} />
        </View>

        <View>
          <Satir baslik={t('profil.gizlilik')} deger={p ? t(`profilKur.gizlilik.${p.map_visibility}`) : ''} onPress={() => setGizlilikAcik(true)} />
          <Satir baslik={t('profil.bildirimler')} onPress={ayarlar} />
          <Satir
            baslik={t('profil.konum')}
            deger={konumIzni.data === 'granted' ? t('profil.konumAcik') : konumIzni.data === 'denied' ? t('profil.konumKapali') : konumIzni.data ? t('profil.konumSorulmadi') : ''}
            onPress={ayarlar}
          />
          <Satir baslik={t('profil.dil')} deger={t('profil.dilDeger')} okYok />
          {DESTEK_EPOSTA ? <Satir baslik={t('profil.yardim')} onPress={() => Linking.openURL(`mailto:${DESTEK_EPOSTA}?subject=${encodeURIComponent(t('profil.yardimKonu'))}`).catch(() => {})} /> : null}
          <Satir baslik={t('profil.cikis')} tehlike onPress={cikis} okYok />
        </View>

        {sonHata ? (
          <View style={s.tani}>
            <Pressable accessibilityRole="button" onPress={() => setTaniAcik((a) => !a)} style={s.taniBaslikSatir}>
              <Text style={s.taniBaslik}>{t('profil.sonHata', { zaman: new Date(sonHata.zaman).toLocaleString('tr-TR') })}</Text>
              <Text style={s.taniOk}>{taniAcik ? '˅' : '›'}</Text>
            </Pressable>
            {taniAcik ? (
              <ScrollView style={s.taniKutu} nestedScrollEnabled>
                <Text style={s.taniMetin} selectable>
                  {`${sonHata.ozet}${sonHata.bilesen ? ` · ${sonHata.bilesen}` : ''}\n\n${sonHata.izler.map((i) => `${new Date(i.zaman).toLocaleTimeString('tr-TR')} ${i.kategori}: ${i.mesaj}`).join('\n')}${sonHata.yigin ? `\n\n${sonHata.yigin}` : ''}`}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    sonHatayiSil();
                    setSonHata(null);
                  }}
                  hitSlop={8}>
                  <Text style={s.taniSil}>{t('profil.sonHataSil')}</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        <Link href="/hesap-sil" asChild>
          <Pressable accessibilityRole="button" hitSlop={10} style={s.silSatir}>
            <Text style={s.sil}>{t('profil.hesapSil')}</Text>
          </Pressable>
        </Link>
      </ScrollView>
      <SecimMenusu
        acik={gizlilikAcik}
        baslik={t('profil.gizlilikSec')}
        secenekler={GIZLILIKLER.map((g) => ({ etiket: `${t(`profilKur.gizlilik.${g}`)}${p?.map_visibility === g ? ' ✓' : ''}`, onPress: () => guncelle.mutate({ map_visibility: g }) }))}
        onKapat={() => setGizlilikAcik(false)}
      />
    </SafeAreaView>
  );
}

function Sayi({ n, etiket }: { n: number | undefined; etiket: string }) {
  return (
    <View style={s.sayi}>
      <Text style={s.sayiDeger}>{n ?? '–'}</Text>
      <Text style={s.sayiEtiket} numberOfLines={1}>
        {etiket}
      </Text>
    </View>
  );
}

function Satir({ baslik, deger, onPress, tehlike, okYok }: { baslik: string; deger?: string; onPress?: () => void; tehlike?: boolean; okYok?: boolean }) {
  return (
    <Pressable accessibilityRole={onPress ? 'button' : 'text'} disabled={!onPress} onPress={onPress} style={({ pressed }) => [s.satir, pressed && { opacity: 0.7 }]}>
      <Text style={[s.satirBaslik, tehlike && { color: renk.uyari }]}>{baslik}</Text>
      {deger ? <Text style={s.satirDeger}>{deger}</Text> : null}
      {okYok ? null : (
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <Ikon ad="geri" boyut={16} renk="#b4bbd3" kalinlik={2.8} />
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 24, paddingBottom: 32, gap: 18 },
  kimlik: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ad: { fontFamily: yazi.baslik, fontSize: 24, letterSpacing: -0.5, color: renk.metin },
  kullaniciAdi: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil },
  duzenle: { height: 38, paddingHorizontal: 12, borderRadius: kose.alan, backgroundColor: renk.yuzey, justifyContent: 'center' },
  duzenleMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  sayilar: { flexDirection: 'row', gap: 8 },
  sayi: { flex: 1, padding: 12, borderRadius: 16, backgroundColor: renk.yuzey, gap: 2 },
  sayiDeger: { fontFamily: yazi.baslik, fontSize: 22, color: renk.metin },
  sayiEtiket: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ikincil },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: renk.ayrac },
  satirBaslik: { flex: 1, fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  satirDeger: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil },
  tani: { gap: 6 },
  taniBaslikSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  taniBaslik: { fontFamily: yazi.kalin, fontSize: 13, color: renk.uyari },
  taniOk: { fontFamily: yazi.kalin, fontSize: 20, color: renk.ikincil },
  taniKutu: { maxHeight: 220, borderRadius: kose.alan, backgroundColor: renk.yuzey, padding: 12 },
  taniMetin: { fontFamily: yazi.normal, fontSize: 11, lineHeight: 15, color: renk.metin },
  taniSil: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil, paddingTop: 10 },
  silSatir: { alignSelf: 'center', paddingVertical: 10 },
  sil: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ikincil },
});
