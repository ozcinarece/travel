// #141 KK5 (kanvas 13b · Güne ekle): "{Mekan} · Hangi güne ekleyelim?" — önerilen gün en üstte Mandalina çerçeve + "ÖNERİLEN"
// ("Yakınında 2 mekan · 1,1 km", "4 mekan · biter 15:20 → 17:40"); diğer günler en yakın mesafe / boş gün bilgisiyle.
// Dokun = ekle (saatler Program'da yeniden hesaplanır). Mesafe koordinattan; istek yok.
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gunAdi } from '@/components/program/PlanHazirSayfasi';
import { AltPencere } from '@/components/ui/AltPencere';
import type { GunSecenegi } from '@/features/listem/listem';
import { t } from '@/i18n';
import { sureMetni } from '@/lib/kategori';
import { mesafeMetni } from '@/lib/mesafe';
import { dakikaSaat } from '@/schedule/tempo';
import { gunRengi, gunUstuMetin, olcek, renk, yazi } from '@/theme';

type Props = {
  acik: boolean;
  ad: string;
  foto: string | null;
  dakika: number;
  secenekler: GunSecenegi[];
  /** Günün ilk durağının adı ("Cumartesi · {ad} çevresi"). */
  ilkAd: (gunId: string) => string | null;
  mesgul: boolean;
  onSec: (s: GunSecenegi) => void;
  onKapat: () => void;
};

const km = (m: number) => mesafeMetni(m >= 1000 ? m : Math.round(m / 10) * 10);

export function GuneEkleSayfasi({ acik, ad, foto, dakika, secenekler, ilkAd, mesgul, onSec, onKapat }: Props) {
  return (
    <AltPencere acik={acik} onKapat={onKapat} kapatEtiketi={t('genel.vazgec')} kaydirilir stil={{ paddingHorizontal: 20, gap: 12 }}>
      <View style={s.ust}>
        <View style={s.foto}>{foto ? <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text accessibilityRole="header" style={s.ad} numberOfLines={2}>
            {ad}
          </Text>
          <Text style={s.alt}>{t('listem.guneEkle.alt', { sure: sureMetni(dakika) })}</Text>
        </View>
      </View>
      {secenekler.map((o) => {
        const rengi = gunRengi(o.gun.index);
        const ilk = ilkAd(o.gun.id);
        const baslik = ilk ? t('listem.gunBaslik', { gun: gunAdi(o.gun), ad: ilk }) : gunAdi(o.gun);
        const biter = o.bitisDk !== null ? t('listem.guneEkle.biter', { bas: dakikaSaat(o.bitisDk), bit: dakikaSaat(o.yeniBitisDk) }) : null;
        const satirlar =
          o.durakSayisi === 0
            ? [t(o.sonGun ? 'listem.guneEkle.bosDonus' : 'listem.guneEkle.bos')]
            : o.onerilen
              ? [t('listem.guneEkle.mekan', { n: o.durakSayisi }) + (biter ? ` · ${biter}` : '')]
              : [[t('listem.guneEkle.mekan', { n: o.durakSayisi }), o.enYakinM !== null ? t('listem.guneEkle.enYakin', { mesafe: km(o.enYakinM) }) : null, biter].filter(Boolean).join(' · ')];
        return (
          <Pressable
            key={o.gun.id}
            accessibilityRole="button"
            accessibilityLabel={`${baslik} · ${satirlar.join(' · ')}`}
            disabled={mesgul}
            onPress={() => onSec(o)}
            style={({ pressed }) => [s.secenek, o.onerilen && s.onerilen, pressed && { opacity: 0.8 }]}>
            <View style={[s.kare, { backgroundColor: rengi }]}>
              <Text style={[s.kareMetin, { color: gunUstuMetin(rengi) }]}>{o.gun.index}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.gunBaslik} numberOfLines={1}>
                {baslik}
              </Text>
              {o.onerilen && o.durakSayisi > 0 && o.enYakinM !== null ? (
                <Text style={s.yakin}>{o.yakindaki > 0 ? t('listem.guneEkle.yakininda', { n: o.yakindaki, mesafe: km(o.enYakinM) }) : t('listem.guneEkle.enYakin', { mesafe: km(o.enYakinM) })}</Text>
              ) : null}
              {satirlar.map((x) => (
                <Text key={x} style={s.bilgi}>
                  {x}
                </Text>
              ))}
            </View>
            {o.onerilen ? (
              <View style={s.rozet}>
                <Text style={s.rozetMetin}>{t('listem.guneEkle.onerilen')}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
      <Text style={s.not}>{t('listem.guneEkle.not')}</Text>
    </AltPencere>
  );
}

const s = StyleSheet.create({
  ust: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foto: { width: 48, height: 48, borderRadius: 14, overflow: 'hidden', backgroundColor: renk.yuzey },
  ad: { fontFamily: yazi.baslik, fontSize: olcek.bolum, letterSpacing: -0.4, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  secenek: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1.5, borderColor: renk.ayrac, backgroundColor: renk.zemin },
  onerilen: { borderWidth: 2, borderColor: renk.vurgu, backgroundColor: '#fff4ec' },
  kare: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  kareMetin: { fontFamily: yazi.ekstra, fontSize: 15 },
  gunBaslik: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  yakin: { fontFamily: yazi.ekstra, fontSize: 13, color: '#b5520a' },
  bilgi: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  rozet: { height: 24, paddingHorizontal: 8, borderRadius: 8, backgroundColor: renk.vurgu, justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.metin },
  not: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil, textAlign: 'center' },
});
