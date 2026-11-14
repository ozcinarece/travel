// #181 KK11 (kanvas 23b): gezi modunda Sıradaki adım satırının yerine bugünün durak kartı — başlık ("Bugün · tema" + "1 / 3
// gezildi"), ilerleme çizgisi, sıradaki durak (numara, saat, ad, kalan süre ve mesafe, foto), Yol tarifi (birincil) · Haritada gör
// · ⋯ (Atla, Başka güne al) ve "Sonra:" satırı. Saatler eldeki plandan; ad ve fotoğraf istek atılmadan (bilinenMekanlar).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { kartSaati, type DurakKarti } from '@/features/program/durakKarti';
import { t } from '@/i18n';
import { sureMetni } from '@/lib/kategori';
import { dakikaSaat } from '@/schedule/tempo';
import { renk, yazi } from '@/theme';

import { FotoKutusu, geziStil } from './GeziParcalari';

type Props = {
  baslik: string;
  kartlar: DurakKarti[];
  odak: DurakKarti | null;
  sonraki: DurakKarti | null;
  gunRenk: string;
  /** Sıradaki durağa kalan yürüyüş (konum izni varsa): "4 dk kaldı · 300 m". */
  kalan: string | null;
  foto: (placeId: string) => string | null;
  tip: (mekanId: string) => string | null;
  onYolTarifi: (k: DurakKarti) => void;
  onHarita: (k: DurakKarti) => void;
  onMenu: (k: DurakKarti) => void;
  onPlan: () => void;
};

export function BugunKarti({ baslik, kartlar, odak, sonraki, gunRenk, kalan, foto, tip, onYolTarifi, onHarita, onMenu, onPlan }: Props) {
  const etkin = kartlar.filter((k) => k.numara !== null);
  const gezilen = etkin.filter((k) => k.tamamlandi || k.durum === 'gecildi').length;
  const saat = odak ? kartSaati(odak) : null;
  const bitti = etkin.length > 0 && gezilen === etkin.length;
  return (
    <View style={s.kart}>
      <View style={s.ust}>
        <Text style={s.baslik} numberOfLines={1}>
          {baslik}
        </Text>
        {etkin.length > 0 ? <Text style={s.sayac}>{t('geziSayfasi.gezildi', { n: gezilen, toplam: etkin.length })}</Text> : null}
      </View>
      {etkin.length > 0 ? (
        <View accessibilityLabel={odak?.numara ? t('geziSayfasi.durakSirasi', { n: odak.numara, toplam: etkin.length }) : undefined} style={s.ilerleme}>
          {etkin.map((k) => (
            <View key={k.durakId} style={[s.parca, { backgroundColor: k.tamamlandi || k.durum === 'gecildi' ? renk.basari : k.durakId === odak?.durakId && !bitti ? gunRenk : renk.yuzey }]} />
          ))}
        </View>
      ) : null}
      {!odak || etkin.length === 0 || bitti ? (
        <View style={s.bos}>
          <Text style={s.bosMetin}>{etkin.length === 0 ? t('geziSayfasi.bugunBos') : t('geziSayfasi.bugunBitti')}</Text>
          <Pressable accessibilityRole="button" onPress={onPlan} style={({ pressed }) => [geziStil.dugme, { backgroundColor: renk.yuzey }, pressed && { opacity: 0.85 }]}>
            <Text style={[geziStil.dugmeMetin, { color: renk.ana }]}>{t('geziSayfasi.planiAc')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={s.durak}>
            <View style={s.no}>
              <Text style={s.noMetin}>{odak.numara ?? '–'}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.saatSatiri}>
                {saat ? <Text style={s.saat}>{saat}</Text> : null}
                <Text style={s.sure}>{sureMetni(odak.dakika)}</Text>
              </View>
              <Text style={s.ad} numberOfLines={2}>
                {odak.ad}
              </Text>
              <View style={s.durumSatiri}>
                <Ikon ad="yuru" boyut={14} renk={renk.ikincil} kalinlik={2.4} />
                <Text style={s.durum} numberOfLines={1}>
                  {[odak.durum === 'buradasin' ? t('geziSayfasi.buradasin') : t('geziSayfasi.siradaki'), kalan].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
            <FotoKutusu uri={foto(odak.placeId)} tip={tip(odak.mekanId)} boyut={60} kose={14} />
          </View>
          <View style={s.dugmeler}>
            <Pressable accessibilityRole="button" onPress={() => onYolTarifi(odak)} style={({ pressed }) => [geziStil.dugme, s.dugme40, { backgroundColor: renk.ana, flex: 1.15 }, pressed && { opacity: 0.85 }]}>
              <Ikon ad="pusulaCizgi" boyut={16} renk={renk.zemin} kalinlik={2.3} />
              <Text style={[geziStil.dugmeMetin, { color: renk.zemin }]}>{t('geziSayfasi.yolTarifi')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onHarita(odak)} style={({ pressed }) => [geziStil.dugme, s.dugme40, { backgroundColor: renk.yuzey, flex: 1 }, pressed && { opacity: 0.85 }]}>
              <Ikon ad="harita" boyut={16} renk={renk.ana} kalinlik={2.3} />
              <Text style={[geziStil.dugmeMetin, { color: renk.ana }]}>{t('geziSayfasi.haritadaGor')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('geziSayfasi.durakMenu')} onPress={() => onMenu(odak)} style={({ pressed }) => [s.daha, pressed && { opacity: 0.85 }]}>
              <Ikon ad="daha" boyut={18} renk={renk.ana} kalinlik={2.3} />
            </Pressable>
          </View>
          {sonraki ? (
            <View style={s.sonra}>
              <Text style={s.sonraMetin} numberOfLines={1}>
                <Text style={s.sonraEtiket}>{`${t('geziSayfasi.sonra')} `}</Text>
                {sonraki.varisDk !== null ? t('geziSayfasi.sonraMetin', { ad: sonraki.ad, saat: dakikaSaat(sonraki.varisDk) }) : sonraki.ad}
              </Text>
              {sonraki.gelis ? (
                <View style={s.bacak}>
                  <Ikon ad={sonraki.gelis.mod === 'taksi' ? 'araba' : 'yuru'} boyut={14} renk={renk.ana} kalinlik={2.4} />
                  <Text style={s.bacakMetin}>{t('geziSayfasi.dk', { n: sonraki.gelis.dk })}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  kart: { padding: 14, borderRadius: 20, backgroundColor: renk.zemin, gap: 12 },
  ust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  baslik: { flex: 1, fontFamily: yazi.baslik, fontSize: 18, letterSpacing: -0.36, color: renk.metin },
  sayac: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ikincil },
  ilerleme: { flexDirection: 'row', gap: 4 },
  parca: { flex: 1, height: 4, borderRadius: 2 },
  durak: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  no: { width: 34, height: 34, borderRadius: 10, backgroundColor: renk.vurgu, borderWidth: 2.5, borderColor: renk.ana, alignItems: 'center', justifyContent: 'center' },
  noMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  saatSatiri: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  saat: { fontFamily: yazi.baslik, fontSize: 17, color: renk.metin },
  sure: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ikincil },
  ad: { fontFamily: yazi.baslik, fontSize: 21, letterSpacing: -0.42, lineHeight: 24, color: renk.metin },
  durumSatiri: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  durum: { flexShrink: 1, fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  dugmeler: { flexDirection: 'row', gap: 8 },
  dugme40: { height: 40 },
  daha: { width: 40, height: 40, borderRadius: 12, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  sonra: { paddingTop: 10, borderTopWidth: 1, borderTopColor: renk.ayrac, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sonraMetin: { flex: 1, fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  sonraEtiket: { fontFamily: yazi.ekstra, color: renk.metin },
  bacak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bacakMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  bos: { gap: 10 },
  bosMetin: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 20, color: renk.ikincil },
});
