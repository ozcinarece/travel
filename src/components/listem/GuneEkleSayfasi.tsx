// #534 KK8 (UX önerileri kanvası `Plan_v7p_HangiGune`): "{Mekan} · Hangi güne? · ~45 dk". Bağlamdaki gün en üstte (#532 KK4);
// bağlam yoksa bugün. Her satırda gün renginde 4 pt dikey çizgi ve iki satır metin; en yakın güne küçük turuncu "EN YAKIN".
// Geçmiş günler en altta, %50 soluk. Alt bağlantı "Şimdilik listede kalsın". Dokun = ekle (saatler yeniden hesaplanır).
// Mesafe koordinattan; istek yok.
import { Foto } from '@/components/ui/Foto';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AltPencere } from '@/components/ui/AltPencere';
import { Ikon } from '@/components/ui/Ikon';
import { hangiGuneSirasi, type GunSecenegi } from '@/features/listem/listem';
import { t } from '@/i18n';
import { sureMetni } from '@/lib/kategori';
import { mesafeMetni } from '@/lib/mesafe';
import { GUNLER, haftaGunu, parcala } from '@/lib/takvim';
import { anaV5, gunRengi, renk, yazi } from '@/theme';

type Props = {
  acik: boolean;
  ad: string;
  foto: string | null;
  dakika: number;
  secenekler: GunSecenegi[];
  mesgul: boolean;
  /** #532 KK4: bir günün içinden açıldıysa o gün (en üstte). */
  baglamGunId?: string | null;
  /** Gezi modunda bugünün gün sırası (yoksa null): bağlam yoksa bugün en üstte, öncekiler "Geçti". */
  bugunIndex: number | null;
  onSec: (s: GunSecenegi) => void;
  onKapat: () => void;
};

const km = (m: number) => mesafeMetni(m >= 1000 ? m : Math.round(m / 10) * 10);

function gunBasligi(o: GunSecenegi, bugun: boolean): string {
  const g = o.gun;
  if (!g.date) return t('geziSayfasi.gunNo', { n: g.index });
  const gunAdi = GUNLER[haftaGunu(g.date)];
  return bugun ? t('listem.guneEkle.bugun', { gun: gunAdi }) : `${gunAdi} ${parcala(g.date).gun}`;
}

function gunAlti(o: GunSecenegi, gecti: boolean): string {
  if (gecti) return t('listem.guneEkle.gecti');
  if (o.durakSayisi === 0) return t(o.sonGun ? 'listem.guneEkle.bosDonus' : 'listem.guneEkle.bos');
  return [t('listem.guneEkle.durak', { n: o.durakSayisi }), o.enYakinM !== null ? t('listem.guneEkle.enYakin', { mesafe: km(o.enYakinM) }) : null].filter(Boolean).join(' · ');
}

export function GuneEkleSayfasi({ acik, ad, foto, dakika, secenekler, mesgul, baglamGunId, bugunIndex, onSec, onKapat }: Props) {
  const sirali = hangiGuneSirasi(secenekler, { baglamGunId, bugunIndex });
  return (
    <AltPencere acik={acik} onKapat={onKapat} kapatEtiketi={t('genel.vazgec')} kaydirilir stil={{ paddingHorizontal: 16 }}>
      <View style={s.ust}>
        <View style={s.foto}>{foto ? <Foto source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ikon ad="kamera" boyut={22} renk={anaV5.ok} kalinlik={1.8} />}</View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text accessibilityRole="header" style={s.ad} numberOfLines={2}>
            {ad}
          </Text>
          <Text style={s.alt}>{t('listem.guneEkle.alt', { sure: sureMetni(dakika) })}</Text>
        </View>
      </View>
      {sirali.map(({ secenek: o, gecti, enYakin }) => {
        const baslik = gunBasligi(o, o.gun.index === bugunIndex);
        const alt = gunAlti(o, gecti);
        return (
          <Pressable
            key={o.gun.id}
            accessibilityRole="button"
            accessibilityLabel={[baslik, alt, enYakin ? t('listem.guneEkle.enYakinRozet') : null].filter(Boolean).join(' · ')}
            disabled={mesgul}
            onPress={() => onSec(o)}
            style={({ pressed }) => [s.secenek, gecti && { opacity: 0.5 }, pressed && { opacity: gecti ? 0.4 : 0.8 }]}>
            <View style={[s.cizgi, { backgroundColor: gunRengi(o.gun.index) }]} />
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <Text style={s.gunBaslik} numberOfLines={1}>
                {baslik}
              </Text>
              <Text style={s.bilgi} numberOfLines={1}>
                {alt}
              </Text>
            </View>
            {enYakin ? <Text style={s.enYakin}>{t('listem.guneEkle.enYakinRozet')}</Text> : null}
          </Pressable>
        );
      })}
      <Pressable accessibilityRole="button" onPress={onKapat} style={s.kalsin}>
        <Text style={s.kalsinMetin}>{t('listem.guneEkle.kalsin')}</Text>
      </Pressable>
    </AltPencere>
  );
}

const s = StyleSheet.create({
  ust: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 8 },
  foto: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: anaV5.fotoYok, alignItems: 'center', justifyContent: 'center' },
  ad: { fontFamily: yazi.ekstra, fontSize: 18, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  secenek: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: anaV5.cizgi, minHeight: 44 },
  cizgi: { width: 4, height: 36, borderRadius: 2 },
  gunBaslik: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  bilgi: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  enYakin: { fontFamily: yazi.ekstra, fontSize: 12, color: anaV5.adim },
  kalsin: { paddingTop: 12, minHeight: 44, alignItems: 'center' },
  kalsinMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.ana },
});
