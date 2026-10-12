import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { Buton } from '@/components/ui/Buton';
import { cikis } from '@/features/auth/giris';
import { useProfil } from '@/features/profil/sorgular';
import { t } from '@/i18n';
import { sonHatayiOku, sonHatayiSil, type SonHata } from '@/lib/izler';
import { bosluk, renk, yazi } from '@/theme';

// PRD §4 v1 Profil: ad, kullanıcı adı, çıkış, hesap silme (önizlemeli, ayrı ekran).
export default function ProfilEkrani() {
  const profil = useProfil();
  // #120 KK4: hata kartının kaydı — "Bir şeyler ters gitti" sonrası kök neden burada okunur (seçilebilir metin).
  const [sonHata, setSonHata] = useState<SonHata | null>(null);
  const [taniAcik, setTaniAcik] = useState(false);
  useEffect(() => {
    sonHatayiOku().then(setSonHata);
  }, []);
  return (
    <SafeAreaView style={s.ekran}>
      <EkranBasligi baslik={t('profil.baslik')} />
      {profil.data ? (
        <View style={s.kimlik}>
          <Avatar ad={profil.data.name} url={profil.data.photo_url} boyut={72} />
          <View style={{ gap: 4 }}>
            <Text style={s.ad}>{profil.data.name}</Text>
            <Text style={s.kullaniciAdi}>@{profil.data.username}</Text>
          </View>
        </View>
      ) : null}
      {/* #100 A KK1: Kaydettiklerim satırı → iki çipli sayfa. */}
      <Link href="/kaydettiklerim" asChild>
        <Pressable accessibilityRole="button" style={({ pressed }) => [s.satir, pressed && { opacity: 0.8 }]}>
          <View style={s.satirIkon}>
            <Ikon ad="kalp" boyut={20} renk={renk.metin} kalinlik={2.2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.satirBaslik}>{t('profil.kaydettiklerim')}</Text>
            <Text style={s.satirAlt}>{t('profil.kaydettiklerimAlt')}</Text>
          </View>
          <Text style={s.ok}>›</Text>
        </Pressable>
      </Link>
      {sonHata ? (
        <View style={s.tani}>
          <Pressable accessibilityRole="button" onPress={() => setTaniAcik((a) => !a)} style={s.taniBaslikSatir}>
            <Text style={s.taniBaslik}>{t('profil.sonHata', { zaman: new Date(sonHata.zaman).toLocaleString('tr-TR') })}</Text>
            <Text style={s.ok}>{taniAcik ? '˅' : '›'}</Text>
          </Pressable>
          {taniAcik ? (
            <ScrollView style={s.taniKutu}>
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
      <View style={s.altKisim}>
        <Buton baslik={t('profil.cikis')} tur="ikincil" onPress={cikis} />
        <Link href="/hesap-sil" asChild>
          <Pressable accessibilityRole="button" hitSlop={10} style={s.silSatir}>
            <Text style={s.sil}>{t('profil.hesapSil')}</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  kimlik: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: bosluk.kenar, paddingTop: 18 },
  ad: { fontFamily: yazi.ekstra, fontSize: 26, letterSpacing: -0.8, lineHeight: 28, color: renk.metin },
  kullaniciAdi: { fontFamily: yazi.kalin, fontSize: 15, color: renk.ikincil },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, marginHorizontal: bosluk.kenar, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: renk.ayrac },
  satirIkon: { width: 40, height: 40, borderRadius: 12, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  satirBaslik: { fontFamily: yazi.ekstra, fontSize: 14.5, color: renk.metin },
  satirAlt: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  ok: { fontFamily: yazi.kalin, fontSize: 20, color: renk.ikincil },
  tani: { marginTop: 12, marginHorizontal: bosluk.kenar, gap: 6 },
  taniBaslikSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  taniBaslik: { fontFamily: yazi.kalin, fontSize: 13, color: renk.uyari },
  taniKutu: { maxHeight: 220, borderRadius: 12, backgroundColor: renk.yuzey, padding: 12 },
  taniMetin: { fontFamily: yazi.normal, fontSize: 11, lineHeight: 15, color: renk.metin },
  taniSil: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil, paddingTop: 10 },
  altKisim: { marginTop: 'auto', paddingHorizontal: bosluk.kenar, paddingBottom: 16, gap: 8 },
  silSatir: { alignItems: 'center', paddingVertical: 10 },
  sil: { fontFamily: yazi.kalin, fontSize: 13, color: renk.uyari },
});
