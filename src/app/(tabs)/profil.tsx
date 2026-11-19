import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Gezilerim } from '@/components/profil/Gezilerim';
import { SecimMenusu } from '@/components/program/SecimMenusu';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { KesfetHapi } from '@/components/ui/KesfetHapi';
import { KisaBildirim, useKisaBildirim } from '@/components/ui/KisaBildirim';
import { cikis } from '@/features/auth/giris';
import { useProfil, useProfilGuncelle } from '@/features/profil/sorgular';
import { biten, bitmemis, siniflandir } from '@/features/seyahatler/siniflandir';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { t } from '@/i18n';
import { sonHatayiOku, sonHatayiSil, type SonHata } from '@/lib/izler';
import type { HaritaGizliligi } from '@/lib/tipler';
import { baslikStili, bosluk, kose, renk, yazi } from '@/theme';

const GIZLILIKLER: HaritaGizliligi[] = ['friends', 'everyone', 'me'];
/** Yardım ve geri bildirim e-postası (ortam değişkeni; yoksa satır gösterilmez). */
const DESTEK_EPOSTA = process.env.EXPO_PUBLIC_DESTEK_EPOSTA ?? '';
const OSM_TELIF = 'https://www.openstreetmap.org/copyright';

/**
 * #138 → #144 (kanvas 22 · Profil): foto, ad, @kullanıcı adı, Düzenle; ayarlar: Haritanı kimler görsün, Bildirimler, Konum (Gezi günlerinde), Dil, Yardım ve geri bildirim, Çıkış
 * yap; Hesabı sil.
 * #275 KK4 (kanvas 29d): en üstte "‹ Keşfet"; kimliğin altında iki sekme — Gezilerim · N (YAKLAŞAN: bitmemiş seyahatler ve
 * taslaklar; GEÇMİŞ: biten seyahatler; N ikisinin toplamı) ve Ayarlar (ayar satırları). Açılışta Gezilerim seçili; 29d'de
 * sayı kutuları yok, kalktı.
 */
export default function ProfilEkrani() {
  const parametre = useLocalSearchParams<{ sekme?: string }>();
  const [sekme, setSekme] = useState<'gezilerim' | 'ayarlar'>(parametre.sekme === 'ayarlar' ? 'ayarlar' : 'gezilerim');
  const seyahatler = useSeyahatler();
  // Bitmemiş = bugün süren + yaklaşan + planlanan (tarihsiz taslak dahil); tarih sırası, taslaklar sonda.
  // #276 KK1: GEÇMİŞ = yeniBiten + geçmiş (seyahat bitişin ertesi günü iner, kanvas 29d).
  const { yaklasan, gecmis } = useMemo(() => {
    const sinif = siniflandir(seyahatler.data ?? []);
    return { yaklasan: bitmemis(sinif), gecmis: biten(sinif) };
  }, [seyahatler.data]);
  // Profil yığında açıkken /seyahatler?sekme=… ile yeniden gelinirse sekme parametreye uyar (parametre değişince, render
  // sırasında ayarlanır; efektte setState lint kuralına takılır).
  const [oncekiParametre, setOncekiParametre] = useState(parametre.sekme);
  if (parametre.sekme !== oncekiParametre) {
    setOncekiParametre(parametre.sekme);
    if (parametre.sekme === 'ayarlar' || parametre.sekme === 'gezilerim') setSekme(parametre.sekme);
  }
  const bildirim = useKisaBildirim();
  const profil = useProfil();
  const guncelle = useProfilGuncelle();
  // Konum yalnız gezi günlerinde (Program) istenir; burada iznin durumu, dokununca telefon ayarları.
  const konumIzni = useQuery({ queryKey: ['konum-izni'], queryFn: async () => (await Location.getForegroundPermissionsAsync()).status });
  useFocusEffect(
    useCallback(() => {
      konumIzni.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const ayarlar = () => Linking.openSettings().catch(() => {});
  const [gizlilikAcik, setGizlilikAcik] = useState(false);
  // #120 KK4: hata kartının kaydı — "Bir şeyler ters gitti" sonrası kök neden burada okunur (seçilebilir metin).
  const [sonHata, setSonHata] = useState<SonHata | null>(null);
  const [taniAcik, setTaniAcik] = useState(false);
  useEffect(() => {
    // #388 KK6 (#385): "Son hata" yalnız geliştirmede; yayında Sentry var, kullanıcıya ham yığın gösterilmez.
    if (__DEV__) sonHatayiOku().then(setSonHata);
  }, []);
  const p = profil.data;
  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView contentContainerStyle={s.icerik}>
        <KesfetHapi />

        {p ? (
          <View style={s.kimlik}>
            <Avatar ad={p.name} url={p.photo_url} boyut={72} arkaPlan={renk.vurgu} />
            {/* #164 KK10: uzun ad taşmaz — 20 px, tek satır, sığmazsa "…"; Düzenle düğmesi küçülmez. */}
            <View style={s.adKutu}>
              <Text style={s.ad} numberOfLines={1} ellipsizeMode="tail">
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

        <View accessibilityRole="tablist" style={s.sekmeler}>
          {(['gezilerim', 'ayarlar'] as const).map((k) => {
            const secili = sekme === k;
            return (
              <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: secili }} onPress={() => setSekme(k)} style={[s.sekme, secili && s.sekmeSecili]}>
                <Text style={[s.sekmeMetin, secili && { color: renk.metin }]}>{k === 'gezilerim' ? t('profil.gezilerim', { n: yaklasan.length + gecmis.length }) : t('profil.ayarlar')}</Text>
              </Pressable>
            );
          })}
        </View>

        {sekme === 'gezilerim' ? <Gezilerim yaklasan={yaklasan} gecmis={gecmis} onBildirim={bildirim.goster} /> : null}

        <AyarlarSekmesi gorunur={sekme === 'ayarlar'}>
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

          {__DEV__ && sonHata ? (
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

          {/* #205 KK5: OSM atfı (ODbL) — kanvas 22 · Profil, "Hesabı sil"in altında; 12 px, dokunma alanı ≥ 44. */}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${t('profil.osmAtif')} ${t('profil.osmAtifKaynak')}`}
            onPress={() => Linking.openURL(OSM_TELIF).catch(() => {})}
            style={s.osmSatir}>
            <Text style={s.osm}>
              {t('profil.osmAtif')} <Text style={s.osmKaynak}>{t('profil.osmAtifKaynak')}</Text>
            </Text>
          </Pressable>
        </AyarlarSekmesi>
      </ScrollView>
      <KisaBildirim metin={bildirim.metin} />
      <SecimMenusu
        acik={gizlilikAcik}
        baslik={t('profil.gizlilikSec')}
        secenekler={GIZLILIKLER.map((g) => ({ etiket: `${t(`profilKur.gizlilik.${g}`)}${p?.map_visibility === g ? ' ✓' : ''}`, onPress: () => guncelle.mutate({ map_visibility: g }) }))}
        onKapat={() => setGizlilikAcik(false)}
      />
    </SafeAreaView>
  );
}

/** Ayarlar sekmesinin gövdesi: ayar satırları, son hata, Hesabı sil ve OSM atfı alt alta (aralık ekranla aynı). */
function AyarlarSekmesi({ gorunur, children }: { gorunur: boolean; children: ReactNode }) {
  return gorunur ? <View style={{ gap: 18 }}>{children}</View> : null;
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
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 8, paddingBottom: 32, gap: 18 },
  sekmeler: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: renk.yuzey },
  sekme: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sekmeSecili: { backgroundColor: renk.zemin, shadowColor: renk.metin, shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  sekmeMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ikincil },
  kimlik: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  adKutu: { flex: 1, minWidth: 0, gap: 2 },
  ad: { ...baslikStili(20), color: renk.metin },
  kullaniciAdi: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil },
  duzenle: { flexShrink: 0, height: 38, paddingHorizontal: 12, borderRadius: kose.alan, backgroundColor: renk.yuzey, justifyContent: 'center' },
  duzenleMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
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
  osmSatir: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  osm: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  osmKaynak: { textDecorationLine: 'underline' },
});
