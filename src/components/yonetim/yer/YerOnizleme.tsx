import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MdYazi } from '@/components/icerik/MdYazi';
import type { YerAlanlari } from '@/features/yonetim/yer';
import type { HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni, varsayilanDakika } from '@/lib/kategori';
import { yorumKisa } from '@/lib/pinIkonu';
import { yazi } from '@/theme';

import { TELEFON } from '../gezi/GeziOnizleme';
import { yRenk } from '../tema';

/**
 * KK6 (kanvas "ÖNİZLEME · MEKAN PANELİ › REHBER"): uygulamanın mekan paneli (#80) Rehber sekmesi açık — başlık (64 px
 * kapak, ad, kategori · süre, ★ puan · yorum, ★ Öne çıkan), sekmeler, içerik uygulamanın `MdYazi`'si, alt çubuk.
 * Panelin arkasındaki harita çizilmez (düz harita zemini); metinler uygulamanın tr.json'undan.
 */
export function YerOnizleme({ yer, canli }: { yer: YerAlanlari; canli: HafifYer | undefined }) {
  const md = yer.rehber_md?.trim();
  const tur = canli?.primary_type ?? yer.kategori;
  return (
    <View style={s.telefon}>
      <View style={s.panel}>
        <View style={s.ust}>
          <View style={s.tutamac} />
          <View style={s.baslik}>
            <View style={s.kapak}>{yer.kapak_url ? <Image source={{ uri: yer.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
            <View style={s.baslikMetin}>
              <Text style={s.ad} numberOfLines={1}>
                {yer.ad}
              </Text>
              <Text style={s.alt}>{`${kategoriEtiketi(tur)} · ${sureMetni(varsayilanDakika(tur))}`}</Text>
              <View style={s.puanSatir}>
                {canli?.puan != null ? (
                  <Text style={s.puan}>
                    <Text style={s.yildiz}>★ </Text>
                    <Text style={s.puanKalin}>{canli.puan.toLocaleString('tr-TR')}</Text>
                    {canli.puan_sayisi ? `  ${t('mekan.panel.yorumSayisi', { n: yorumKisa(canli.puan_sayisi) ?? '' })}` : ''}
                  </Text>
                ) : null}
                {yer.one_cikan_sira ? (
                  <View style={s.rozet}>
                    <Text style={s.rozetMetin}>{t('mekan.panel.oneCikan')}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={s.kapat}>
              <Text style={s.kapatMetin}>×</Text>
            </View>
          </View>
        </View>
        <View style={s.sekmeler}>
          {(['sekmeGenel', 'sekmeYorumlar', 'sekmeRehber'] as const).map((k) => (
            <View key={k} style={[s.sekme, k === 'sekmeRehber' && s.sekmeSecili]}>
              <Text style={[s.sekmeMetin, k === 'sekmeRehber' && s.sekmeMetinSecili]}>{t(`mekan.panel.${k}`)}</Text>
            </View>
          ))}
        </View>
        <ScrollView style={s.govde} contentContainerStyle={s.govdeIc}>
          {md ? (
            <MdYazi kaynak={md} />
          ) : (
            <View style={s.bos}>
              <Text style={s.bosBaslik}>{t('mekan.panel.rehberBaslik')}</Text>
              <Text style={s.alt}>{t('mekan.panel.rehberMetin')}</Text>
            </View>
          )}
        </ScrollView>
        <View style={s.altCubuk}>
          <View style={[s.dugme, s.dugmeSiyah]}>
            <Text style={[s.dugmeMetin, { color: yRenk.zemin }]}>{t('mekan.panel.listeyeEkle')}</Text>
          </View>
          <View style={[s.dugme, s.dugmeGri]}>
            <Text style={s.dugmeMetin}>{t('mekan.panel.yolTarifi')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  telefon: { width: TELEFON.genislik, height: TELEFON.yukseklik, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: yRenk.ayrac, backgroundColor: '#f3f3f0' },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 120, backgroundColor: yRenk.zemin, borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: '0 -10px 30px rgba(15,15,15,0.15)', gap: 14 },
  ust: { paddingTop: 8, paddingHorizontal: 20, gap: 12 },
  tutamac: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0' },
  baslik: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kapak: { width: 64, height: 64, borderRadius: 14, backgroundColor: '#d9d9d6', overflow: 'hidden' },
  baslikMetin: { flex: 1, minWidth: 0, gap: 3 },
  ad: { fontFamily: yazi.ekstra, fontSize: 18, letterSpacing: -0.36, lineHeight: 21, color: yRenk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: yRenk.ikincil },
  puanSatir: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  puan: { fontFamily: yazi.normal, fontSize: 13, color: yRenk.ikincil },
  yildiz: { color: '#ff5a1f' },
  puanKalin: { fontFamily: yazi.kalin, color: yRenk.metin },
  rozet: { height: 20, paddingHorizontal: 8, borderRadius: 999, backgroundColor: '#ff5a1f', justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 10.5, color: yRenk.zemin },
  kapat: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f4f4f2', alignItems: 'center', justifyContent: 'center' },
  kapatMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: yRenk.metin },
  sekmeler: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 12, backgroundColor: '#f4f4f2', marginHorizontal: 20 },
  sekme: { flex: 1, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sekmeSecili: { backgroundColor: yRenk.zemin, boxShadow: '0 1px 4px rgba(15,15,15,0.12)' },
  sekmeMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.ikincil },
  sekmeMetinSecili: { color: yRenk.metin },
  govde: { flex: 1 },
  govdeIc: { paddingBottom: 16 },
  bos: { paddingHorizontal: 20, gap: 4 },
  bosBaslik: { fontFamily: yazi.ekstra, fontSize: 15, color: yRenk.metin },
  altCubuk: { flexDirection: 'row', gap: 10, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 28, borderTopWidth: 1, borderTopColor: yRenk.ayrac, backgroundColor: yRenk.zemin },
  dugme: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  dugmeSiyah: { flex: 1, backgroundColor: yRenk.metin },
  dugmeGri: { backgroundColor: '#f4f4f2' },
  dugmeMetin: { fontFamily: yazi.kalin, fontSize: 14, color: yRenk.metin },
});
