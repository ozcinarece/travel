// #277 (#237 v2, kanvas 29a · 29b): Keşfet akışının tek kart türü — gezi kartı. Tam genişlikte 190 px kapak, sol üstte
// "Tripmate" rozeti; altta "Şehir · N gün · M durak", gün renkli rota şeridi, tek cümle not ve 3 eylem: ♥ Kaydet,
// WhatsApp'ta paylaş, Seyahatime al. ⋯ menüsü (şikâyet, gizle, engelle) bu işte yok. Akışın sonunda "Kendi gezini kur" kartı.
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useKayitli } from '@/components/icerik/Kalp';
import { Logo } from '@/components/ui/Logo';
import { kartEtiketi, type AkisGezisi } from '@/features/icerik/kesfetAkisi';
import { useKaydet } from '@/features/icerik/sorgular';
import { t } from '@/i18n';
import { gunRengi, gunUstuMetin, kose, renk, yazi } from '@/theme';

/** Fotoğrafı olmayan gezide kapak zemini (kanvas 29a: Buz koyusu, açık Mandalina, açık mavi). */
const ZEMINLER = ['#c9d2f2', '#ffe2cc', '#dce6ff'];
/** Kart notu (kanvas 29a, MdYazi paragrafıyla aynı). */
const NOT_RENGI = '#232b48';

type Props = {
  gezi: AkisGezisi;
  sira: number;
  onAc: () => void;
  onPaylas: () => void;
  onAl: () => void;
};

export function KesfetKarti({ gezi, sira, onAc, onPaylas, onAl }: Props) {
  const kayitli = useKayitli('gezi', gezi.id);
  const kaydet = useKaydet();
  const baslik = t('kesfetAkisi.kartBaslik', {
    sehir: gezi.sehirler?.ad ?? gezi.baslik,
    gun: gezi.gun_sayisi,
    durak: gezi.mekan_sayisi,
  });
  return (
    <View style={s.kart}>
      <Pressable accessibilityRole="button" accessibilityLabel={kartEtiketi(gezi)} onPress={onAc} style={({ pressed }) => pressed && s.basili}>
        <View style={[s.kapak, { backgroundColor: ZEMINLER[sira % ZEMINLER.length] }]}>
          {gezi.kapak_url ? <Image source={{ uri: gezi.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
          <View style={s.rozet}>
            <Logo boyut={20} koyuZemin />
            <Text style={s.rozetMetin}>{t('kesfetAkisi.tripmate')}</Text>
          </View>
        </View>
        <View style={s.ustGovde}>
          <Text style={s.baslik} numberOfLines={2}>
            {baslik}
          </Text>
          <RotaSeridi gunler={gezi.gunDuraklari} />
          {gezi.ozet ? (
            <Text style={s.not} numberOfLines={2}>
              {gezi.ozet}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View style={s.eylemler}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={kayitli ? t('gezi.kaydedildi') : t('gezi.kaydet')}
          accessibilityState={{ selected: kayitli }}
          onPress={() => kaydet.mutate({ tur: 'gezi', hedef_id: gezi.id, kayitli })}
          style={({ pressed }) => [s.kalp, kayitli && s.kalpDolu, pressed && s.basili]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill={kayitli ? renk.vurgu : 'none'} stroke={kayitli ? renk.vurgu : renk.ana} strokeWidth={kayitli ? 2.2 : 2.4} strokeLinejoin="round">
            <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
          </Svg>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('kesfetAkisi.paylasEtiket')} onPress={onPaylas} style={({ pressed }) => [s.paylas, pressed && s.basili]}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={renk.ana} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 15V4M7 9l5-5 5 5M5 14v5h14v-5" />
          </Svg>
          <Text style={s.paylasMetin}>{t('kesfetAkisi.whatsapp')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onAl} style={({ pressed }) => [s.al, pressed && s.basili]}>
          <Text style={s.alMetin}>{t('kesfetAkisi.seyahatimeAl')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Gün renkli küçük rota şeridi: gün numarası karosu + o günün durak sayısı kadar halka; genişlik durak sayısıyla orantılı. */
export function RotaSeridi({ gunler }: { gunler: number[] }) {
  const dolu = gunler.filter((n) => n > 0);
  if (dolu.length === 0) return null;
  const etiket = t('kesfetAkisi.rotaEtiket', {
    gunler: gunler.map((n, i) => t('kesfetAkisi.rotaGun', { gun: i + 1, durak: n })).join(', '),
  });
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiket} style={s.rota}>
      {gunler.map((n, i) => {
        if (n === 0) return null;
        const r = gunRengi(i + 1);
        return (
          <View key={i} style={[s.rotaGun, { flex: n }]}>
            <View style={[s.gunKaro, { backgroundColor: r }]}>
              <Text style={[s.gunNo, { color: gunUstuMetin(r) }]}>{i + 1}</Text>
            </View>
            <View style={s.hat}>
              <View style={[s.cizgi, { backgroundColor: r }]} />
              {Array.from({ length: n }, (_, k) => (
                <View key={k} style={[s.halka, { borderColor: r }]} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** KK5: akışın sonunda boşluk yerine kesik çizgili "Kendi gezini kur" kartı; "Başla" yeni seyahat sihirbazını açar. */
export function KendiGeziniKur({ onPress }: { onPress: () => void }) {
  return (
    <View style={s.kendi}>
      <View style={{ gap: 4 }}>
        <Text style={s.kendiBaslik}>{t('kesfetAkisi.kendiBaslik')}</Text>
        <Text style={s.kendiAlt}>{t('kesfetAkisi.kendiAlt')}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('kesfetAkisi.kendiEtiket')} onPress={onPress} style={({ pressed }) => [s.basla, pressed && s.basili]}>
        <Text style={s.baslaMetin}>{t('kesfetAkisi.basla')}</Text>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={renk.zemin} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M5 12h14M13 6l6 6-6 6" />
        </Svg>
      </Pressable>
    </View>
  );
}

/** KK7: yüklenirken iskelet kart (kartla aynı ölçüler, Buz yüzey). */
export function IskeletKart() {
  return (
    <View style={s.kart} accessible accessibilityLabel={t('kesfetAkisi.yukleniyor')}>
      <View style={[s.kapak, { backgroundColor: renk.yuzey }]} />
      <View style={s.ustGovde}>
        <View style={[s.iskelet, { width: '70%', height: 20 }]} />
        <View style={[s.iskelet, { width: '100%', height: 10 }]} />
        <View style={[s.iskelet, { width: '85%', height: 14 }]} />
      </View>
      <View style={s.eylemler}>
        <View style={[s.iskelet, { width: 44, height: 44, borderRadius: 12 }]} />
        <View style={[s.iskelet, { flexGrow: 1, height: 44, borderRadius: 12 }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kart: {
    borderRadius: kose.kart,
    borderWidth: 1,
    borderColor: renk.ayrac,
    backgroundColor: renk.zemin,
    overflow: 'hidden',
  },
  basili: { opacity: 0.85 },
  kapak: { height: 190, overflow: 'hidden' },
  rozet: {
    position: 'absolute',
    left: 12,
    top: 12,
    height: 26,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: kose.rozet,
    backgroundColor: renk.ana,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.zemin },
  ustGovde: { paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  baslik: {
    fontFamily: yazi.baslik,
    fontSize: 19,
    lineHeight: 23,
    letterSpacing: -0.38,
    color: renk.metin,
  },
  not: {
    fontFamily: yazi.normal,
    fontSize: 14,
    lineHeight: 20,
    color: NOT_RENGI,
  },
  rota: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rotaGun: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  gunKaro: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gunNo: { fontFamily: yazi.ekstra, fontSize: 11 },
  hat: {
    flexGrow: 1,
    height: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cizgi: { position: 'absolute', left: 0, right: 0, top: 4, height: 2 },
  halka: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    backgroundColor: renk.zemin,
  },
  eylemler: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  kalp: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: renk.yuzey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kalpDolu: { backgroundColor: renk.vurguZemin },
  paylas: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: renk.yuzey,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paylasMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  al: {
    flexGrow: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: renk.vurgu,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  kendi: {
    borderRadius: kose.kart,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: renk.yerTutucu,
    padding: 20,
    gap: 12,
    alignItems: 'flex-start',
  },
  kendiBaslik: {
    fontFamily: yazi.baslik,
    fontSize: 19,
    letterSpacing: -0.38,
    color: renk.metin,
  },
  kendiAlt: {
    fontFamily: yazi.normal,
    fontSize: 14,
    lineHeight: 20,
    color: renk.ikincil,
  },
  basla: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: renk.ana,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  baslaMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.zemin },
  iskelet: { borderRadius: 6, backgroundColor: renk.yuzey },
});
