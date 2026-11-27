// #578 Profil v12 (UX önerileri kanvası "Profil v12 · ONAYLI": `Profil_v12_Arkadas`, `Profil_v12_Kendi` ve not kartı).
// Üstte geri oku ve kendi profilinde "Düzenle"; 76 pt yuvarlak yüz, 26/800 ad, "N il · N yol arkadaşı"; #F6F7FA kartta
// "N / 81 il" ve il il Türkiye haritası (KK2, KK3), lejant; kendi profilinde gizlilik satırı (KK6); gitmek istenen il çipleri
// (KK4); rozetler (KK5); geziler (KK6: arkadaşta yalnız geçmiş); arkadaşta altta sabit turuncu "{Ad} ile gezi planla" (KK7).
// Gezi oluşturma (#574) bugünkü sihirbazla açılır: il `sehir` (rehberli şehir) ya da `metin` olarak, ayrıca `il` ve `arkadas`
// parametreleri geçer (#574 bağlayacak). Google'a istek yok.
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { PaylasimCekmecesi } from '@/components/paylasim/PaylasimCekmecesi';
import { SecimMenusu } from '@/components/program/SecimMenusu';
import { SeyahatKapagi } from '@/components/seyahatler/SeyahatKapagi';
import { Avatar } from '@/components/ui/Avatar';
import { Buton } from '@/components/ui/Buton';
import { useSehirler } from '@/features/icerik/sorgular';
import { ilkAd } from '@/features/paylasim/baslik';
import {
  ilAdi,
  istekSirasi,
  rozetListesi,
  useIstekDegistir,
  useProfilOzeti,
  type ProfilGezisi,
  type ProfilOzeti,
  type RozetAdi,
} from '@/features/profil/profilV12';
import { useProfilGuncelle } from '@/features/profil/sorgular';
import { yeniGirisNo } from '@/features/sihirbaz/girisler';
import { gunFarki } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { useCevrimdisi } from '@/lib/baglanti';
import { useOturum } from '@/lib/oturum';
import { ayAdi } from '@/lib/takvim';
import type { HaritaGizliligi, Sehir } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';
import { yazi } from '@/theme';

import { IlSecici } from './IlSecici';
import { TurkiyeHaritasi } from './TurkiyeHaritasi';

/** Kanvastaki renkler (`Profil_v12_*`). */
export const profilRenk = {
  metin: '#0E1430',
  ikincil: '#5B6178',
  lacivert: '#152A6B',
  turuncu: '#FF7A1A',
  kart: '#F6F7FA',
  istekZemin: '#C9D2F2',
  beyaz: '#FFFFFF',
  /** Arkadaşın yüzü (kanvasta Deniz). */
  arkadasZemin: '#E3F4EC',
  arkadasHarf: '#0E7A52',
} as const;

/** Gezideki kişi yüzleri: [zemin, harf] (kanvas: E turuncu, M açık mavi, A lacivert). Sunucu kişiye bağlı sabit sırayı (`renk`) verir. */
const YUZLER: readonly (readonly [string, string])[] = [
  [profilRenk.turuncu, profilRenk.metin],
  [profilRenk.istekZemin, profilRenk.lacivert],
  [profilRenk.lacivert, profilRenk.beyaz],
];

const GIZLILIKLER: HaritaGizliligi[] = ['friends', 'everyone', 'me'];
/** Kanvas: 2 satır ve "Tümü" (kendi profilinde Seyahatlerim'e gider, arkadaşta hepsini açar). */
const ILK_GEZI = 2;

type GeziGirisi = { plaka?: number; arkadas?: string };

/**
 * KK4 · KK7: gezi oluşturma. #574 gelene kadar bugünkü sihirbaz açılır: il rehberli bir şehirse seçili (`sehir`), değilse
 * Nereye adımında aranmış (`metin`) gelir; `il` ve `arkadas` parametreleri de geçer.
 */
export function geziOlusturParametreleri(sehirler: Sehir[] | undefined, { plaka, arkadas }: GeziGirisi): Record<string, string> {
  const p: Record<string, string> = { n: yeniGirisNo() };
  if (plaka) {
    const ad = ilAdi(plaka);
    const sehir = sehirler?.find((s) => s.ad.toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr'));
    if (sehir) p.sehir = sehir.id;
    else p.metin = ad;
    p.il = String(plaka);
  }
  if (arkadas) p.arkadas = arkadas;
  return p;
}

/** Gezi satırının alt metni: geçmişte ay ("Kasım"), yaklaşanda "N gün kaldı", sürende "Bugün · N. gün" (seyahat saat dilimi). */
export function geziAltMetni(g: ProfilGezisi, an: Date = new Date()): string {
  if (g.bitti) return ayAdi(g.start_date);
  const bugun = yerelTarih(an, g.tz);
  if (bugun < g.start_date) return t('profilV12.geziler.kaldi', { n: gunFarki(bugun, g.start_date) });
  return t('profilV12.geziler.bugun', { n: gunFarki(g.start_date, bugun) + 1 });
}

export function ProfilV12({ kisi }: { kisi: string }) {
  const ozet = useProfilOzeti(kisi);
  const kenar = useSafeAreaInsets();
  // Hata ya da çevrimdışıyken de kendi profilinde "Düzenle" (Ayarlar, Çıkış, Hesabı sil) kalır.
  const { session } = useOturum();
  const kendiMi = !!session && session.user.id === kisi;
  if (ozet.isPending) {
    return (
      <View style={[s.ekran, s.orta]}>
        <ActivityIndicator color={profilRenk.lacivert} accessibilityLabel={t('profilV12.yukleniyor')} />
      </View>
    );
  }
  if (ozet.isError || !ozet.data) {
    return (
      <View style={[s.ekran, { paddingTop: kenar.top + 8 }]}>
        <UstSatir kendi={kendiMi} />
        <View style={s.hata}>
          <Text style={s.hataMetin}>{ozet.isError ? t('profilV12.hata') : t('profilV12.yok')}</Text>
          {ozet.isError ? <Buton baslik={t('profilV12.tekrarDene')} tur="ikincil" onPress={() => void ozet.refetch()} yukleniyor={ozet.isFetching} /> : null}
        </View>
      </View>
    );
  }
  return <ProfilIcerigi o={ozet.data} />;
}

function UstSatir({ kendi }: { kendi: boolean }) {
  return (
    <View style={s.ust}>
      {router.canGoBack() ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('profilV12.geri')} onPress={() => router.back()} hitSlop={11} testID="profil-geri">
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={profilRenk.metin} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
        </Pressable>
      ) : (
        <View />
      )}
      {kendi ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/ayarlar')} hitSlop={12} testID="profil-duzenle">
          <Text style={s.duzenle}>{t('profilV12.duzenle')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ProfilIcerigi({ o }: { o: ProfilOzeti }) {
  const kenar = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sehirler = useSehirler();
  const istekDegistir = useIstekDegistir(o.id);
  const profilGuncelle = useProfilGuncelle();
  const cevrimdisi = useCevrimdisi();
  const [gizlilikAcik, setGizlilikAcik] = useState(false);
  const [secimAcik, setSecimAcik] = useState(false);
  const [tumu, setTumu] = useState(false);
  const [paylasilan, setPaylasilan] = useState<ProfilGezisi | null>(null);

  const ad = ilkAd(o.ad) ?? o.ad;
  const gidilen = o.gidilen ?? [];
  const altParcalar = [o.harita_acik ? t('profilV12.ilSayisi', { n: gidilen.length }) : null, o.yol_arkadasi === null ? null : t('profilV12.yolArkadasi', { n: o.yol_arkadasi })].filter(Boolean);
  const istekler = istekSirasi(o.istek, o.benim_istek);
  const rozetler = rozetListesi(o.rozetler, o.kendi);
  const geziler = tumu ? o.geziler : o.geziler.slice(0, ILK_GEZI);
  const tumuVar = o.kendi ? o.geziler.length > 0 : o.geziler.length > ILK_GEZI && !tumu;

  const geziOlustur = (giris: GeziGirisi) => router.push({ pathname: '/(tabs)/yeni', params: geziOlusturParametreleri(sehirler.data, giris) });
  // Profil özeti önbelleğini `useProfilGuncelle` geçersiz kılar (Ayarlar'dan değişince de).
  const gizlilikSec = (g: HaritaGizliligi) => profilGuncelle.mutate({ map_visibility: g });
  const altBosluk = o.kendi ? 40 : 52 + 12 + Math.max(30, kenar.bottom) + 16;

  return (
    <View style={s.ekran}>
      <ScrollView contentContainerStyle={{ paddingTop: kenar.top + 8, paddingBottom: altBosluk }}>
        <UstSatir kendi={o.kendi} />

        <View style={s.kimlik}>
          <Avatar
            ad={o.ad}
            url={o.foto}
            boyut={76}
            yuvarlak
            harfBoyutu={28}
            arkaPlan={o.kendi ? profilRenk.turuncu : profilRenk.arkadasZemin}
            harfRengi={o.kendi ? profilRenk.metin : profilRenk.arkadasHarf}
          />
          <View style={s.kimlikMetin}>
            <Text accessibilityRole="header" style={s.ad} numberOfLines={1}>
              {o.ad}
            </Text>
            {altParcalar.length > 0 ? (
              <Text style={s.kimlikAlt} numberOfLines={1}>
                {altParcalar.join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>

        {o.harita_acik ? (
          <View style={s.haritaKart} testID="profil-harita">
            <View style={s.sayiSatiri}>
              <Text style={s.sayi}>{gidilen.length}</Text>
              <Text style={s.sayiAlt}>{t('profilV12.haritaSayi')}</Text>
            </View>
            <TurkiyeHaritasi
              genislik={width - 48}
              gidilen={gidilen}
              istek={o.istek}
              etiket={t('profilV12.haritaEtiket', { gidilen: gidilen.length, istek: o.istek.filter((p) => !gidilen.includes(p)).length })}
            />
            <View style={s.lejant}>
              <View style={s.lejantOge}>
                <View style={[s.kare, { backgroundColor: profilRenk.turuncu }]} />
                <Text style={s.lejantMetin}>{t(o.kendi ? 'profilV12.lejant.gittigin' : 'profilV12.lejant.gittigi')}</Text>
              </View>
              <View style={s.lejantOge}>
                <View style={[s.kare, s.kareIstek]} />
                <Text style={s.lejantMetin}>{t(o.kendi ? 'profilV12.lejant.istedigin' : 'profilV12.lejant.istedigi')}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {o.kendi && o.gizlilik ? (
          <Pressable accessibilityRole="button" onPress={() => setGizlilikAcik(true)} hitSlop={{ top: 8, bottom: 12 }} style={s.gizlilik} testID="profil-gizlilik">
            <Text style={s.gizlilikMetin}>
              {t(`profilV12.gizlilik.${o.gizlilik}`)} · <Text style={s.gizlilikDegistir}>{t('profilV12.gizlilik.degistir')}</Text>
            </Text>
          </Pressable>
        ) : null}

        {/* #600: arkadaş haritasını "yalnız ben"e çektiyse istekler, rozetler ve yol arkadaşı sayısı da gizli (sunucu boş döner). */}
        {o.kendi || (o.harita_acik && istekler.length > 0) ? (
          <>
            <Bolum
              baslik={t(o.kendi ? 'profilV12.istek.baslikKendi' : 'profilV12.istek.baslik')}
              sag={o.kendi ? t('profilV12.istek.ekle') : undefined}
              sagEtiket={t('profilV12.istek.ekleEtiket')}
              onSag={() => setSecimAcik(true)}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cipler}>
              {istekler.map(({ plaka, ortak }) => (
                <Pressable
                  key={plaka}
                  accessibilityRole="button"
                  accessibilityLabel={t(ortak ? 'profilV12.istek.cipOrtakEtiket' : 'profilV12.istek.cipEtiket', { il: ilAdi(plaka) })}
                  onPress={() => geziOlustur({ plaka, arkadas: o.kendi ? undefined : o.id })}
                  hitSlop={{ top: 3, bottom: 3 }}
                  style={({ pressed }) => [s.cip, ortak ? s.cipOrtak : s.cipBos, pressed && { opacity: 0.8 }]}
                  testID={`istek-${plaka}`}>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={ortak ? profilRenk.beyaz : profilRenk.lacivert} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" />
                    <Circle cx={12} cy={10} r={2.5} />
                  </Svg>
                  <Text style={[s.cipMetin, { color: ortak ? profilRenk.beyaz : profilRenk.lacivert }]}>{ilAdi(plaka)}</Text>
                  {ortak ? <Text style={s.ikiniz}>{t('profilV12.istek.ikinizDe')}</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {(o.kendi || o.harita_acik) && rozetler.length > 0 ? (
          <>
            <Bolum baslik={t(o.kendi ? 'profilV12.rozet.baslikKendi' : 'profilV12.rozet.baslik')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rozetler}>
              {rozetler.map((r) => (
                <View
                  key={r.ad}
                  accessible
                  accessibilityLabel={`${t(`profilV12.rozet.${r.ad}`)}, ${r.alt}`}
                  style={[s.rozet, !r.kazanildi && s.soluk]}
                  testID={`rozet-${r.ad}${r.kazanildi ? '' : '-yok'}`}>
                  <View style={s.rozetDaire}>
                    <RozetIkonu ad={r.ad} />
                  </View>
                  <Text style={s.rozetAd}>{t(`profilV12.rozet.${r.ad}`)}</Text>
                  <Text style={s.rozetAlt}>{r.alt}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}

        {o.harita_acik && o.geziler.length > 0 ? (
          <>
            <Bolum
              baslik={t(o.kendi ? 'profilV12.geziler.baslikKendi' : 'profilV12.geziler.baslik')}
              sag={tumuVar ? t('profilV12.geziler.tumu') : undefined}
              onSag={() => (o.kendi ? router.navigate('/(tabs)/seyahatler') : setTumu(true))}
            />
            {geziler.map((g) => (
              <GeziSatiri
                key={g.id}
                g={g}
                kendi={o.kendi}
                onAc={() => router.push({ pathname: '/seyahat/[id]', params: { id: g.id } })}
                onPaylas={() => setPaylasilan(g)}
                onRotayiAl={() => router.navigate({ pathname: '/(tabs)/yeni', params: { tekrar: g.id, n: yeniGirisNo() } })}
              />
            ))}
          </>
        ) : null}
      </ScrollView>

      {o.kendi ? null : (
        <View style={[s.altSabit, { paddingBottom: Math.max(30, kenar.bottom) }]} pointerEvents="box-none">
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
            <Defs>
              <LinearGradient id="profilAltGecis" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={profilRenk.beyaz} stopOpacity={0} />
                <Stop offset="0.3" stopColor={profilRenk.beyaz} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#profilAltGecis)" />
          </Svg>
          <Pressable
            accessibilityRole="button"
            onPress={() => geziOlustur({ arkadas: o.id })}
            style={({ pressed }) => [s.planla, pressed && { opacity: 0.9 }]}
            testID="profil-planla">
            <Text style={s.planlaMetin}>{t('profilV12.planla', { ad })}</Text>
          </Pressable>
        </View>
      )}

      {o.kendi ? (
        <>
          <SecimMenusu
            acik={gizlilikAcik}
            baslik={t('profil.gizlilikSec')}
            secenekler={GIZLILIKLER.map((g) => ({ etiket: `${t(`profilKur.gizlilik.${g}`)}${o.gizlilik === g ? ' ✓' : ''}`, onPress: () => gizlilikSec(g) }))}
            onKapat={() => setGizlilikAcik(false)}
          />
          <IlSecici acik={secimAcik} onKapat={() => setSecimAcik(false)} secili={o.istek} onDegistir={(plaka, ekle) => istekDegistir.mutate({ plaka, ekle })} />
          {paylasilan ? (
            <PaylasimCekmecesi
              acik
              onKapat={() => setPaylasilan(null)}
              seyahat={{ id: paylasilan.id, city_label: paylasilan.sehir, name: paylasilan.ad }}
              benimAdim={o.ad}
              gunSayisi={paylasilan.gun_sayisi}
              durakSayisi={paylasilan.durak_sayisi}
              kisiSayisi={paylasilan.kisi_sayisi}
              kisiKip="gezdi"
              onArkadasEkle={() => {
                const id = paylasilan.id;
                setPaylasilan(null);
                router.push({ pathname: '/seyahat/[id]', params: { id } });
              }}
              cevrimdisi={cevrimdisi}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Bolum({ baslik, sag, sagEtiket, onSag }: { baslik: string; sag?: string; sagEtiket?: string; onSag?: () => void }) {
  return (
    <View style={s.bolum}>
      <Text accessibilityRole="header" style={s.bolumBaslik}>
        {baslik}
      </Text>
      {sag ? (
        <Pressable accessibilityRole="button" accessibilityLabel={sagEtiket} onPress={onSag} hitSlop={{ left: 12, right: 12 }} style={s.dokunma}>
          <Text style={s.bolumSag}>{sag}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function GeziSatiri({ g, kendi, onAc, onPaylas, onRotayiAl }: { g: ProfilGezisi; kendi: boolean; onAc: () => void; onPaylas: () => void; onRotayiAl: () => void }) {
  const baslik = t('profilV12.geziler.satir', { sehir: g.sehir, n: g.gun_sayisi });
  // Kendi gezin: yaklaşan/süren "Aç", geçmiş "Paylaş". Arkadaşın gezisi: "Rotayı al" yalnız izleyen de o gezideyse (planını
  // okuyabildiği gezi; başkasının gezisini kopyalamak tasarım bekliyor).
  const eylem: { metin: string; onPress: () => void } | null = kendi
    ? g.bitti
      ? { metin: t('profilV12.geziler.paylas'), onPress: onPaylas }
      : { metin: t('profilV12.geziler.ac'), onPress: onAc }
    : g.uyesiyim
      ? { metin: t('profilV12.geziler.rotayiAl'), onPress: onRotayiAl }
      : null;
  const icerik: ReactNode = (
    <>
      <SeyahatKapagi kimlik={g.id} genislik={64} yukseklik={64} kose={14} />
      <View style={s.geziMetin}>
        <Text style={s.geziBaslik} numberOfLines={1}>
          {baslik}
        </Text>
        <View style={s.geziAltSatir}>
          {g.kisiler.length > 0 ? (
            <View style={s.yuzler}>
              {g.kisiler.slice(0, 3).map((k, i) => (
                <View key={i} style={[s.yuz, i > 0 && { marginLeft: -6 }]}>
                  <Avatar ad={k.harf} url={k.foto} boyut={22} yuvarlak harfBoyutu={10} arkaPlan={YUZLER[k.renk % YUZLER.length][0]} harfRengi={YUZLER[k.renk % YUZLER.length][1]} />
                </View>
              ))}
            </View>
          ) : null}
          <Text style={s.geziAlt}>{geziAltMetni(g)}</Text>
        </View>
      </View>
    </>
  );
  return (
    <View style={s.geziSatir} testID={`gezi-${g.id}`}>
      {kendi ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${baslik}, ${geziAltMetni(g)}`} onPress={onAc} style={s.geziSol}>
          {icerik}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={`${baslik}, ${geziAltMetni(g)}`} style={s.geziSol}>
          {icerik}
        </View>
      )}
      {eylem ? (
        <Pressable accessibilityRole="button" onPress={eylem.onPress} hitSlop={{ left: 12, right: 12 }} style={s.dokunmaSatir}>
          <Text style={s.geziEylem}>{eylem.metin}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const IKON = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: profilRenk.lacivert, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function RozetIkonu({ ad }: { ad: RozetAdi }) {
  switch (ad) {
    case 'lezzet':
      return (
        <Svg {...IKON}>
          <Path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9" />
        </Svg>
      );
    case 'doga':
      return (
        <Svg {...IKON}>
          <Path d="M3 20l6-10 4 6 3-4 5 8z" />
        </Svg>
      );
    case 'kultur':
      return (
        <Svg {...IKON}>
          <Path d="M4 20h16M6 20V10M10 20V10M14 20V10M18 20V10M3 10l9-6 9 6z" />
        </Svg>
      );
    case 'ekip':
      return (
        <Svg {...IKON}>
          <Circle cx={9} cy={8} r={3.5} />
          <Circle cx={17} cy={9} r={2.8} />
          <Path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5M15 14.6c2.6.2 4.6 2 5.5 5.4" />
        </Svg>
      );
    case 'planci':
      return (
        <Svg {...IKON}>
          <Rect x={4} y={5} width={16} height={15} rx={2} />
          <Path d="M4 10h16M9 3v4M15 3v4M8 14h3" />
        </Svg>
      );
  }
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: profilRenk.beyaz },
  orta: { alignItems: 'center', justifyContent: 'center' },
  hata: { paddingHorizontal: 16, paddingTop: 24, gap: 12, alignItems: 'flex-start' },
  hataMetin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 21, color: profilRenk.metin },
  ust: { paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 22 },
  duzenle: { fontFamily: yazi.kalin, fontSize: 15, color: profilRenk.lacivert },
  kimlik: { paddingTop: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  kimlikMetin: { flex: 1, minWidth: 0, gap: 3 },
  ad: { fontFamily: yazi.ekstra, fontSize: 26, letterSpacing: -0.26, color: profilRenk.metin },
  kimlikAlt: { fontFamily: yazi.normal, fontSize: 14, color: profilRenk.ikincil },
  haritaKart: { marginTop: 16, marginHorizontal: 16, borderRadius: 18, backgroundColor: profilRenk.kart, paddingTop: 14, paddingHorizontal: 8, paddingBottom: 12 },
  sayiSatiri: { paddingHorizontal: 8, paddingBottom: 6, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  sayi: { fontFamily: yazi.ekstra, fontSize: 26, color: profilRenk.metin },
  sayiAlt: { fontFamily: yazi.normal, fontSize: 15, color: profilRenk.ikincil },
  lejant: { flexDirection: 'row', gap: 16, paddingTop: 6, paddingHorizontal: 8 },
  lejantOge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kare: { width: 12, height: 12, borderRadius: 3 },
  kareIstek: { backgroundColor: profilRenk.istekZemin, borderWidth: 2, borderColor: profilRenk.lacivert },
  lejantMetin: { fontFamily: yazi.normal, fontSize: 13, color: profilRenk.ikincil },
  gizlilik: { paddingTop: 8, paddingHorizontal: 16 },
  gizlilikMetin: { fontFamily: yazi.normal, fontSize: 13, color: profilRenk.ikincil },
  gizlilikDegistir: { fontFamily: yazi.kalin, color: profilRenk.lacivert },
  bolum: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  bolumBaslik: { fontFamily: yazi.ekstra, fontSize: 19, color: profilRenk.metin },
  bolumSag: { fontFamily: yazi.kalin, fontSize: 14, color: profilRenk.lacivert },
  /** 44 pt dokunma alanı; satır yüksekliği değişmesin diye taşan kısım negatif payla geri alınır. */
  dokunma: { minHeight: 44, justifyContent: 'center', marginVertical: -10 },
  dokunmaSatir: { minHeight: 44, justifyContent: 'center' },
  cipler: { gap: 8, paddingHorizontal: 16 },
  cip: { height: 38, paddingHorizontal: 14, borderRadius: 19, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cipOrtak: { backgroundColor: profilRenk.lacivert },
  cipBos: { borderWidth: 1.5, borderColor: profilRenk.lacivert },
  cipMetin: { fontFamily: yazi.kalin, fontSize: 14 },
  ikiniz: { fontFamily: yazi.ekstra, fontSize: 11, color: profilRenk.turuncu },
  rozetler: { gap: 8, paddingHorizontal: 10 },
  rozet: { width: 104, alignItems: 'center', gap: 6 },
  soluk: { opacity: 0.38 },
  rozetDaire: { width: 56, height: 56, borderRadius: 28, backgroundColor: profilRenk.kart, alignItems: 'center', justifyContent: 'center' },
  rozetAd: { fontFamily: yazi.kalin, fontSize: 14, color: profilRenk.metin },
  rozetAlt: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 15, color: profilRenk.ikincil, textAlign: 'center' },
  geziSatir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  geziSol: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  geziMetin: { flex: 1, minWidth: 0, gap: 4 },
  geziBaslik: { fontFamily: yazi.kalin, fontSize: 16, color: profilRenk.metin },
  geziAltSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  yuzler: { flexDirection: 'row' },
  yuz: { width: 25, height: 25, borderRadius: 12.5, borderWidth: 1.5, borderColor: profilRenk.beyaz, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  geziAlt: { fontFamily: yazi.normal, fontSize: 13, color: profilRenk.ikincil },
  geziEylem: { fontFamily: yazi.kalin, fontSize: 14, color: profilRenk.lacivert },
  altSabit: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16 },
  planla: { height: 52, borderRadius: 26, backgroundColor: profilRenk.turuncu, alignItems: 'center', justifyContent: 'center' },
  planlaMetin: { fontFamily: yazi.kalin, fontSize: 16, color: profilRenk.metin },
});
