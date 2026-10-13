import { Image } from 'expo-image';
import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Ikon, type IkonAdi } from '@/components/ui/Ikon';
import { ty } from '@/features/yonetim/metin';
import { mekanBaglari, rehberGovdesi, type RehberBolumu } from '@/features/yonetim/sehir';
import { useHafifYerler, type HafifYer } from '@/features/yerler/api';
import { kategoriEtiketi, sureMetni, varsayilanDakika } from '@/lib/kategori';
import { markdownAyristir } from '@/lib/markdown';
import { kategoriPini, yorumKisa } from '@/lib/pinIkonu';
import { yazi } from '@/theme';

import { TELEFON } from '../gezi/GeziOnizleme';
import { yRenk } from '../tema';

const SEKMELER: { ikon: IkonAdi; anahtar: string }[] = [
  { ikon: 'kesfet', anahtar: 'kesfet' },
  { ikon: 'program', anahtar: 'program' },
  { ikon: 'kitap', anahtar: 'rehber' },
  { ikon: 'grup', anahtar: 'grup' },
];

/**
 * Kanvas RehberEditor22 "ÖNİZLEME · REHBER SEKMESİ" (390 × 844): üstte "<Şehir> rehberi" + "Öneriler ›" ve bölüm çipleri
 * (seçili siyah), seçili bölümden başlayarak "02 Ne yenir" başlıkları, 150 px görsel, paragraflar (bağlantı kalın + alt
 * çizgi), mekan kartları (56 px, ad, "kategori · süre", ★ puan · yorum — canlı Google, saklanmaz, "Listeye ekle"); altta
 * 4 sekmeli çubuk (Rehber seçili). Uygulamadaki ekran henüz bu düzende değil (mobil tarafı); önizleme kanvası izler.
 */
export function RehberOnizleme({ sehirAdi, bolumler, seciliId }: { sehirAdi: string; bolumler: RehberBolumu[]; seciliId: string | undefined }) {
  const ilk = Math.max(0, bolumler.findIndex((b) => b.id === seciliId));
  const gorunen = bolumler.slice(ilk);
  const idler = [...new Set(gorunen.flatMap((b) => mekanBaglari(b.yazi_md).map((m) => m.place_id)))];
  const canli = useHafifYerler(idler);

  return (
    <View style={s.telefon}>
      <ScrollView style={s.govde} contentContainerStyle={s.govdeIc}>
        {gorunen.map((b, i) => (
          <Fragment key={b.id}>
            <View style={s.bolumBaslik}>
              <Text style={s.no}>{String(ilk + i + 1).padStart(2, '0')}</Text>
              <Text style={s.baslik}>{b.baslik}</Text>
            </View>
            {markdownAyristir(rehberGovdesi(b.yazi_md)).map((blok, j) => {
              switch (blok.tur) {
                case 'fotolar':
                  return <Image key={j} source={{ uri: blok.fotolar[0].url }} style={s.gorsel} contentFit="cover" accessibilityLabel={blok.fotolar[0].alt} />;
                case 'mekan':
                  return <MekanKarti key={j} yer={canli.data?.[blok.place_id]} />;
                case 'madde':
                  return (
                    <View key={j} style={s.metinKap}>
                      {blok.ogeler.map((o, k) => (
                        <Text key={k} style={s.paragraf}>{`•  ${o}`}</Text>
                      ))}
                    </View>
                  );
                case 'baslik':
                  return (
                    <Text key={j} style={[s.metinKap, s.araBaslik]}>
                      {blok.metin}
                    </Text>
                  );
                default:
                  return (
                    <Text key={j} style={[s.metinKap, s.paragraf, blok.tur === 'alinti' && s.alinti]}>
                      {(blok.parcalar ?? [{ metin: blok.metin }]).map((p, k) => (
                        <Text key={k} style={[p.kalin && s.kalin, p.italik && s.italik, p.place_id ? s.bag : null]}>
                          {p.metin}
                        </Text>
                      ))}
                    </Text>
                  );
              }
            })}
          </Fragment>
        ))}
      </ScrollView>
      <View style={s.ust}>
        <View style={s.ustSatir}>
          <Text style={s.ustBaslik}>{ty('rehber.onizleme.baslik', { ad: sehirAdi })}</Text>
          <Text style={s.oneriler}>{ty('rehber.onizleme.oneriler')}</Text>
        </View>
        <View style={s.cipler}>
          {bolumler.map((b) => (
            <View key={b.id} style={[s.cip, b.id === seciliId && s.cipSecili]}>
              <Text style={[s.cipMetin, b.id === seciliId && s.cipMetinSecili]}>{ty(`rehber.cip.${b.bolum}`)}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={s.alt}>
        {SEKMELER.map((k) => {
          const secili = k.anahtar === 'rehber';
          return (
            <View key={k.anahtar} style={s.sekme}>
              <Ikon ad={k.ikon} boyut={22} renk={secili ? yRenk.metin : yRenk.soluk} kalinlik={2.2} />
              <Text style={[s.sekmeMetin, secili && s.sekmeSecili]}>{ty(`rehber.onizleme.sekme.${k.anahtar}`)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MekanKarti({ yer }: { yer: HafifYer | undefined }) {
  const tip = yer?.primary_type;
  const yorum = yorumKisa(yer?.puan_sayisi);
  return (
    <View style={s.kartKap}>
      <View style={s.kart}>
        <View style={[s.kartKare, { backgroundColor: kategoriPini(tip).kategoriRenk }]} />
        <View style={s.kartMetin}>
          <Text style={s.kartAd} numberOfLines={1}>
            {yer?.ad ?? '…'}
          </Text>
          <Text style={s.kartAlt} numberOfLines={1}>{`${kategoriEtiketi(tip)} · ${sureMetni(varsayilanDakika(tip))}`}</Text>
          {yer?.puan != null ? (
            <Text style={s.kartAlt} numberOfLines={1}>
              <Text style={s.yildiz}>★</Text>
              {` ${yer.puan.toLocaleString('tr-TR')}${yorum ? ` · ${ty('rehber.onizleme.yorum', { n: yorum })}` : ''}`}
            </Text>
          ) : null}
        </View>
        <View style={s.ekle}>
          <Text style={s.ekleMetin}>{ty('rehber.onizleme.listeyeEkle')}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  telefon: { width: TELEFON.genislik, height: TELEFON.yukseklik, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: yRenk.ayrac, backgroundColor: yRenk.zemin },
  govde: { position: 'absolute', left: 0, right: 0, top: 112, bottom: 84 },
  govdeIc: { gap: 12, paddingTop: 14, paddingBottom: 16 },
  bolumBaslik: { paddingTop: 6, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  no: { fontFamily: yazi.ekstra, fontSize: 12, color: yRenk.ikincil },
  baslik: { flexShrink: 1, fontFamily: yazi.ekstra, fontSize: 21, letterSpacing: -0.42, color: yRenk.metin },
  gorsel: { width: TELEFON.genislik, height: 150, backgroundColor: yRenk.yuzey },
  metinKap: { paddingHorizontal: 20 },
  paragraf: { fontFamily: yazi.normal, fontSize: 14.5, lineHeight: 23.2, color: yRenk.metin },
  araBaslik: { fontFamily: yazi.ekstra, fontSize: 16, color: yRenk.metin },
  alinti: { fontFamily: yazi.kalin },
  kalin: { fontFamily: yazi.kalin },
  italik: { fontStyle: 'italic' },
  bag: { fontFamily: yazi.kalin, textDecorationLine: 'underline', textDecorationColor: yRenk.yerTutucu },
  kartKap: { paddingHorizontal: 20 },
  kart: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: yRenk.ayrac, backgroundColor: yRenk.zemin, boxShadow: '0 2px 8px rgba(14,20,48,0.05)' },
  kartKare: { width: 56, height: 56, borderRadius: 10 },
  kartMetin: { flex: 1, minWidth: 0, gap: 3 },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 14, color: yRenk.metin },
  kartAlt: { fontFamily: yazi.yari, fontSize: 11.5, color: yRenk.ikincil },
  yildiz: { color: yRenk.vurgu },
  ekle: { height: 32, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1.5, borderColor: yRenk.metin, justifyContent: 'center' },
  ekleMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: yRenk.metin },
  ust: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 25, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 10, backgroundColor: 'rgba(255,255,255,0.97)', borderBottomWidth: 1, borderBottomColor: yRenk.ayrac, gap: 8 },
  ustSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ustBaslik: { fontFamily: yazi.ekstra, fontSize: 17, letterSpacing: -0.34, color: yRenk.metin },
  oneriler: { fontFamily: yazi.ekstra, fontSize: 12, color: yRenk.ikincil },
  cipler: { flexDirection: 'row', gap: 6, overflow: 'hidden' },
  cip: { height: 30, paddingHorizontal: 11, borderRadius: 999, backgroundColor: yRenk.yuzey, justifyContent: 'center', flexShrink: 0 },
  cipSecili: { backgroundColor: yRenk.metin },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: yRenk.metin },
  cipMetinSecili: { color: yRenk.zemin },
  alt: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30, flexDirection: 'row', paddingTop: 10, paddingBottom: 28, borderTopWidth: 1, borderTopColor: yRenk.ayrac, backgroundColor: yRenk.zemin },
  sekme: { flex: 1, alignItems: 'center', gap: 4 },
  sekmeMetin: { fontFamily: yazi.yari, fontSize: 10.5, color: yRenk.soluk },
  sekmeSecili: { fontFamily: yazi.ekstra, color: yRenk.metin },
});
