import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { GeziPlani } from '@/components/icerik/GeziPlani';
import { MdYazi } from '@/components/icerik/MdYazi';
import { t } from '@/i18n';
import { okumaSuresiDk } from '@/lib/markdown';
import { AYLAR, parcala } from '@/lib/takvim';
import type { GeziDetay } from '@/lib/tipler';
import { yazi } from '@/theme';

import { yRenk } from '../tema';

export const TELEFON = { genislik: 390, yukseklik: 844 } as const;

type Props = { gezi: GeziDetay; sehirAdi: string; sayfa: 0 | 1 };

/**
 * KK6: telefon önizlemesi — uygulamanın gezi sayfası (#97). Yazı `MdYazi`, plan `GeziPlani` (uygulamanın bileşenleri,
 * aynı kod); kapak, yazar satırı ve alt çubuk kanvastaki önizleme çizimi. Metinler uygulamanın tr.json'undan.
 */
export function GeziOnizleme({ gezi, sehirAdi, sayfa }: Props) {
  return <View style={s.telefon}>{sayfa === 0 ? <YaziSayfasi gezi={gezi} sehirAdi={sehirAdi} /> : <PlanSayfasi gezi={gezi} sehirAdi={sehirAdi} />}</View>;
}

/** Ölçekli çerçeve (kanvas: 390 × 844, 0,62 → 242 × 524, 18 yarıçap). */
export function OlcekliTelefon({ olcek, children }: { olcek: number; children: React.ReactNode }) {
  return (
    <View style={[s.olcekKap, { width: TELEFON.genislik * olcek, height: TELEFON.yukseklik * olcek }]}>
      <View style={[s.olcekIc, { transform: [{ scale: olcek }] }]}>{children}</View>
    </View>
  );
}

function YaziSayfasi({ gezi, sehirAdi }: { gezi: GeziDetay; sehirAdi: string }) {
  const tarih = parcala(gezi.created_at.slice(0, 10));
  const yazar = gezi.yazar_ad ?? '';
  return (
    <>
      <ScrollView style={s.govde} contentContainerStyle={s.govdeIc}>
        <View style={s.kapak}>
          {gezi.kapak_url ? <Image source={{ uri: gezi.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <View style={s.kapakGolge} />
          <View style={[s.yuvarlak, s.solUst]}>
            <CizgiIkon d="M15 18l-6-6 6-6" />
          </View>
          <View style={s.sagUst}>
            <View style={s.yuvarlak}>
              <CizgiIkon d="M12 20.5l-7.5-7.6a4.4 4.4 0 0 1 6.2-6.2L12 8l1.3-1.3a4.4 4.4 0 0 1 6.2 6.2z" />
            </View>
            <View style={s.yuvarlak}>
              <CizgiIkon d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5" />
            </View>
          </View>
          <View style={s.kapakMetin}>
            <Text style={s.rozet}>{t('gezi.rozet', { n: gezi.gun_sayisi, sehir: sehirAdi.toLocaleUpperCase('tr-TR'), mekan: gezi.mekan_sayisi })}</Text>
            <Text style={s.baslik}>{gezi.baslik}</Text>
          </View>
        </View>
        <View style={s.yazar}>
          <View style={s.avatar}>
            <Text style={s.avatarHarf}>{yazar.charAt(0).toLocaleUpperCase('tr-TR')}</Text>
          </View>
          <Text style={s.yazarMetin}>
            <Text style={s.yazarAd}>{yazar}</Text>
            {` · ${AYLAR[tarih.ay - 1]} ${tarih.yil} · ${t('gezi.okuma', { n: okumaSuresiDk(gezi.yazi_md) })}`}
          </Text>
        </View>
        <MdYazi kaynak={gezi.yazi_md} />
      </ScrollView>
      <View style={s.altCubuk}>
        <View style={{ flex: 1 }}>
          <Text style={s.altOzet}>{t('gezi.gunMekan', { gun: gezi.gun_sayisi, mekan: gezi.mekan_sayisi })}</Text>
          <Text style={s.altSayfa}>{t('gezi.sayfa1')}</Text>
        </View>
        <View style={s.siyahDugme}>
          <Text style={s.siyahMetin}>{t('gezi.planiGor')}</Text>
          <CizgiIkon d="M9 6l6 6-6 6" renk={yRenk.zemin} boyut={14} kalinlik={2.6} />
        </View>
      </View>
    </>
  );
}

function PlanSayfasi({ gezi, sehirAdi }: { gezi: GeziDetay; sehirAdi: string }) {
  const [gunSira, setGunSira] = useState(0);
  return (
    <>
      <ScrollView style={s.govde} contentContainerStyle={s.planIc}>
        {/* Kanvas BekleyenTasarim21 ekran 5: 36 px gri geri dairesi + başlık 20 / 800 + alt satır. */}
        <View style={s.planUst}>
          <View style={[s.yuvarlak, s.griYuvarlak]}>
            <CizgiIkon d="M15 18l-6-6 6-6" />
          </View>
          <View style={s.planMetin}>
            <Text style={s.planBaslik}>{`${sehirAdi} · ${t('gezi.gunAdet', { n: gezi.gun_sayisi })}`}</Text>
            <Text style={s.altOzet}>{t('gezi.sayfa2', { gun: gezi.gun_sayisi, mekan: gezi.mekan_sayisi })}</Text>
          </View>
        </View>
        <GeziPlani gezi={gezi} gunSira={gunSira} onGunSira={setGunSira} canli={undefined} onDurakEkle={() => {}} listede={() => false} mesgulId={null} />
      </ScrollView>
      <View style={s.altCubuk}>
        <View style={[s.siyahDugme, { flex: 1 }]}>
          <Text style={s.siyahMetin}>{t('gezi.al')}</Text>
        </View>
      </View>
    </>
  );
}

function CizgiIkon({ d, renk = yRenk.metin, boyut = 18, kalinlik = 2.2 }: { d: string; renk?: string; boyut?: number; kalinlik?: number }) {
  return (
    <Svg width={boyut} height={boyut} viewBox="0 0 24 24" fill="none" stroke={renk} strokeWidth={kalinlik} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d={d} />
    </Svg>
  );
}

const s = StyleSheet.create({
  olcekKap: { borderRadius: 18, overflow: 'hidden' },
  olcekIc: { position: 'absolute', left: 0, top: 0, width: TELEFON.genislik, height: TELEFON.yukseklik, transformOrigin: 'top left' },
  telefon: { width: TELEFON.genislik, height: TELEFON.yukseklik, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: yRenk.ayrac, backgroundColor: yRenk.zemin },
  govde: { flex: 1 },
  govdeIc: { paddingBottom: 20, gap: 12 },
  kapak: { height: 300, backgroundColor: '#2f6fed', justifyContent: 'flex-end' },
  kapakGolge: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' },
  yuvarlak: { width: 36, height: 36, borderRadius: 18, backgroundColor: yRenk.zemin, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(14,20,48,0.12)' },
  solUst: { position: 'absolute', left: 20, top: 56 },
  sagUst: { position: 'absolute', right: 20, top: 56, flexDirection: 'row', gap: 8 },
  kapakMetin: { paddingHorizontal: 20, paddingBottom: 20, gap: 6 },
  rozet: { fontFamily: yazi.ekstra, fontSize: 11, letterSpacing: 0.88, color: 'rgba(255,255,255,0.9)' },
  baslik: { fontFamily: yazi.ekstra, fontSize: 30, lineHeight: 31, letterSpacing: -0.9, color: yRenk.zemin, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 1 } },
  yazar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 2, paddingHorizontal: 20 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: yRenk.metin, alignItems: 'center', justifyContent: 'center' },
  avatarHarf: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.zemin },
  yazarMetin: { fontFamily: yazi.yari, fontSize: 12, color: yRenk.ikincil },
  yazarAd: { fontFamily: yazi.kalin, color: yRenk.metin },
  altCubuk: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, paddingHorizontal: 20, paddingBottom: 30, borderTopWidth: 1, borderTopColor: yRenk.ayrac, backgroundColor: yRenk.zemin },
  altOzet: { fontFamily: yazi.yari, fontSize: 12, color: yRenk.ikincil },
  altSayfa: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.metin },
  siyahDugme: { height: 50, paddingHorizontal: 22, borderRadius: 999, backgroundColor: yRenk.metin, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  siyahMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: yRenk.zemin },
  planIc: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  planUst: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planMetin: { flex: 1, minWidth: 0 },
  griYuvarlak: { backgroundColor: yRenk.yuzey, boxShadow: 'none' },
  planBaslik: { fontFamily: yazi.ekstra, fontSize: 20, lineHeight: 21, letterSpacing: -0.6, color: yRenk.metin },
});
