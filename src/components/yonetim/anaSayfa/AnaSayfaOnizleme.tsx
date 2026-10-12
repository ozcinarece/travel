import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GeziKarti } from '@/components/icerik/GeziKarti';
import { YerKarosu } from '@/components/icerik/YerKarosu';
import { Ikon } from '@/components/ui/Ikon';
import type { TaslakBolum } from '@/features/yonetim/anaSayfa';
import type { YonetimGeziOzeti, YonetimSehri } from '@/features/yonetim/geziSorgulari';
import type { YonetimYeri } from '@/features/yonetim/yerSorgulari';
import { t } from '@/i18n';
import { bolumKimlikleri, cizimBloklari, gorunenBolumler } from '@/lib/anaSayfa';
import type { Gezi } from '@/lib/tipler';
import { bosluk, renk, yazi } from '@/theme';

export const ANA_SAYFA_TELEFON = { genislik: 390, yukseklik: 1180 } as const;

type Props = {
  bolumler: readonly TaslakBolum[];
  geziler: readonly YonetimGeziOzeti[];
  yerler: readonly YonetimYeri[];
  sehirler: readonly YonetimSehri[];
  enCokAlinan: string | null;
  ad: string;
};

/**
 * KK5 (kanvas "ÖNİZLEME · ANA SAYFA"): uygulama ana sayfası taslakla — selam, arama ve sabit kart (uygulamanın
 * "İlk seyahatini kur" kartı; kullanıcının seyahati önizlemede yok), sonra açık ve aralıktaki bölümler `cizimBloklari`
 * ile. Kartlar uygulamanın `GeziKarti` / `YerKarosu` bileşenleri; metinler uygulamanın tr.json'undan. Yalnız yayınlı
 * içerik gösterilir (uygulama da yalnız onu görür).
 */
export function AnaSayfaOnizleme({ bolumler, geziler, yerler, sehirler, enCokAlinan, ad }: Props) {
  const yayinliGeziler = geziler.filter((g) => g.yayin && (!g.yayin_at || new Date(g.yayin_at) <= new Date()));
  const yayinliYerler = yerler.filter((y) => y.yayin);
  const kaynak = { geziler: yayinliGeziler, yerler: yayinliYerler, sehirler: sehirler.filter((s) => s.yayin) };
  const gezi = (id: string) => yayinliGeziler.find((g) => g.id === id) as unknown as Gezi | undefined;
  const bloklar = cizimBloklari(gorunenBolumler(bolumler));

  return (
    <View style={s.telefon}>
      <ScrollView contentContainerStyle={s.icerik}>
        <View style={s.ust}>
          <View style={{ flex: 1 }}>
            <Text style={s.merhaba}>{t('anasayfa.merhaba', { ad })}</Text>
            <Text style={s.soru}>{t('anasayfa.soru')}</Text>
          </View>
          <View style={s.avatar}>
            <Text style={s.avatarHarf}>{ad.charAt(0).toLocaleUpperCase('tr-TR')}</Text>
          </View>
        </View>
        <View style={s.arama}>
          <Ikon ad="ara" boyut={18} renk={renk.ikincil} kalinlik={2.2} />
          <Text style={s.aramaMetin}>{t('anasayfa.ara')}</Text>
        </View>
        <View style={s.kart}>
          <Text style={s.kartAd}>{t('anasayfa.ilkBaslik')}</Text>
          <Text style={s.kartAlt}>{t('anasayfa.ilkAlt')}</Text>
          <View style={s.kartDugme}>
            <Text style={s.kartDugmeMetin}>{`${t('anasayfa.ilkDugme')} →`}</Text>
          </View>
        </View>
        {bloklar.map((blok) => (
          <View key={blok.bolumler[0].id} style={s.bolum}>
            <View style={s.bolumSatir}>
              <Text style={s.bolumBaslik}>{blok.baslik}</Text>
              <Text style={s.tumu}>{t('anasayfa.tumu')}</Text>
            </View>
            {blok.bolumler.map((b) => {
              const idler = bolumKimlikleri(b.tur === 'tek_kart' && b.kaynak === 'otomatik' ? { ...b, icerik: { gezi_id: enCokAlinan } } : b, kaynak);
              if (b.tur === 'tek_kart') {
                const g = idler[0] ? gezi(idler[0]) : undefined;
                return g ? <GeziKarti key={b.id} gezi={g} buyuk onPress={() => {}} /> : <Text key={b.id} style={s.bos}>{t('anasayfa.bos')}</Text>;
              }
              if (b.tur === 'serit') {
                return (
                  <ScrollView key={b.id} horizontal showsHorizontalScrollIndicator={false} style={s.seritKaydirma} contentContainerStyle={s.serit}>
                    {idler.map((id, i) => {
                      const g = gezi(id);
                      return g ? <GeziKarti key={id} gezi={g} sira={i + 1} onPress={() => {}} /> : null;
                    })}
                  </ScrollView>
                );
              }
              if (b.tur === 'mozaik') {
                const liste = idler.map((id) => yayinliYerler.find((y) => y.id === id)).filter((y): y is YonetimYeri => !!y);
                return (
                  <View key={b.id} style={s.mozaik}>
                    {[0, 1].map((sutun) => (
                      <View key={sutun} style={s.sutun}>
                        {liste
                          .filter((_, i) => i % 2 === sutun)
                          .map((y, i) => (
                            <YerKarosu
                              key={y.id}
                              ad={y.ad}
                              sehir={y.sehirler?.ad ?? null}
                              kategori={y.kategori}
                              fotoUri={y.kapak_url}
                              puan={null}
                              yorum={null}
                              yukseklik={(i + sutun) % 2 === 0 ? 190 : 150}
                              listede={false}
                              onEkle={() => {}}
                              onAc={() => {}}
                            />
                          ))}
                      </View>
                    ))}
                  </View>
                );
              }
              // Şehir seçkisi: uygulamada henüz bileşeni yok (tasarım bekliyor) — şehir adları.
              return (
                <Text key={b.id} style={s.bos}>
                  {idler.map((id) => sehirler.find((sh) => sh.id === id)?.ad).filter(Boolean).join(' · ') || t('anasayfa.bos')}
                </Text>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// Uygulama ana sayfasının ölçüleri (src/app/(tabs)/index.tsx) — aynı görünüm; üst güvenli alan 56 px (kanvas önizlemesi).
const s = StyleSheet.create({
  telefon: { width: ANA_SAYFA_TELEFON.genislik, height: ANA_SAYFA_TELEFON.yukseklik, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: renk.ayrac, backgroundColor: renk.zemin },
  icerik: { paddingTop: 42, paddingBottom: 28 },
  ust: { paddingHorizontal: bosluk.kenar, paddingTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  merhaba: { fontFamily: yazi.kalin, fontSize: 13, color: renk.ikincil },
  soru: { fontFamily: yazi.ekstra, fontSize: 28, letterSpacing: -0.9, color: renk.metin },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  avatarHarf: { fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin },
  arama: { marginHorizontal: bosluk.kenar, marginTop: 14, height: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 10 },
  aramaMetin: { fontFamily: yazi.yari, fontSize: 14, color: renk.soluk },
  kart: { marginHorizontal: bosluk.kenar, marginTop: 16, padding: 18, borderRadius: 22, backgroundColor: renk.metin, gap: 4 },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 22, letterSpacing: -0.5, color: renk.zemin },
  kartAlt: { fontFamily: yazi.normal, fontSize: 12, color: '#c4c4c4' },
  kartDugme: { alignSelf: 'flex-start', marginTop: 10, height: 38, paddingHorizontal: 16, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center' },
  kartDugmeMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  bolum: { paddingTop: 24, paddingHorizontal: bosluk.kenar, gap: 12 },
  bolumSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bolumBaslik: { fontFamily: yazi.ekstra, fontSize: 18, letterSpacing: -0.4, color: renk.metin },
  tumu: { fontFamily: yazi.kalin, fontSize: 13, color: renk.ikincil },
  seritKaydirma: { marginHorizontal: -bosluk.kenar },
  serit: { gap: 10, paddingHorizontal: bosluk.kenar },
  mozaik: { flexDirection: 'row', gap: 10 },
  sutun: { flex: 1, gap: 10 },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 12 },
});
