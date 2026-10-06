import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { GunProgrami } from '@/features/program/useProgram';
import type { HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import { sureMetni } from '@/lib/kategori';
import { GUNLER_KISA, haftaGunu } from '@/lib/takvim';
import type { Durak, Gun, Mekan, Seyahat } from '@/lib/tipler';
import { acilisDurumu, kapaliGunler } from '@/schedule/acilis';
import { saatAraligi, yuruyusDk } from '@/schedule/program';
import { dakikaSaat } from '@/schedule/tempo';
import { minDokunma, renk, yazi } from '@/theme';

import { SurukleListe } from './SurukleListe';

const SATIR_YUKSEKLIGI = 84;

/** Google periyot günü (0 = Pazar) ← takvim günü (0 = Pazartesi). */
const googleGunu = (tarih: string) => (haftaGunu(tarih) + 1) % 7;

export function mesafeMetni(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${m} m`;
}

export type CizelgeListesiProps = {
  seyahat: Seyahat;
  gun: Gun;
  gunler: Gun[];
  gunDurak: Durak[];
  mekanIle: Map<string, Mekan>;
  yerler: Record<string, HafifYer> | undefined;
  uyeAdi: (uid: string | null) => string;
  prog: GunProgrami;
  matrisYukleniyor: boolean;
  rotaYukleniyor: boolean;
  /** Konumla: kullanıcı 60 m içinde olduğu durak (#43 KK4); yoksa null. Konum yoksa undefined. */
  buradaId: string | null | undefined;
  duzenle: boolean;
  baslangicSaati: string;
  onTamamla: (d: Durak, geriAl?: boolean) => void;
  /** #45: tamamlanan satıra dokununca puanlama sayfası. */
  onPuanla: (d: Durak) => void;
  /** Gelecek satıra dokununca mekan detayı (3.8). */
  onDetay: (d: Durak) => void;
  /** Kendi puanım (mekan places.id → puan); yoksa null. */
  puanim: (mekanId: string) => { stars: number } | null;
  /** Sıradaki durağın ilk Google fotoğrafı (52 px kart). */
  siradakiFoto: string | null | undefined;
  onYolTarifi: (d: Durak, mod?: 'yuruyus' | 'taksi') => void;
  onMenu: (d: Durak) => void;
  onGunSec: (d: Durak) => void;
  onTasi: (from: number, to: number) => void;
  onSure: (d: Durak, fark: number) => void;
  onBaslangic: (fark: number) => void;
};

/**
 * PRD 3.7 çizelge listesi — Program alt panelinin yarı açık / tam ekran hâli. #45 §4 kompakt satırlar:
 * saat · ince ray üstünde nokta (tamamlanan yeşil ✓, sıradaki turuncu halka, gelecek boş) · ad · süre; yürüyüş/taksi iki
 * satır arasında küçük metin, yoldaysa mavi "Şu an yolda · N dk kaldı". Sıradaki durak gri zeminli tek satır kart
 * (52 px foto, "süre · bitiş", turuncu "Bitti"; dokun → Yol tarifi, uzun bas → menü). Tamamlanan üstü çizili değil,
 * yanında "☆ puanla" ya da verilen yıldızlar; dokununca puanlama sayfası.
 */
export function CizelgeListesi(p: CizelgeListesiProps) {
  const { gun, gunler, gunDurak, mekanIle, yerler, uyeAdi, prog, duzenle } = p;
  const satirlar = prog.canli.satirlar;
  const satirIle = (durakId: string) => satirlar.find((x) => x.durak.id === durakId);

  if (gunDurak.length === 0) return <Text style={s.bos}>{t('program.bos')}</Text>;

  if (duzenle) {
    return (
      <ScrollView contentContainerStyle={s.icerik} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        <View style={s.araclar}>
          <View style={s.arac}>
            <Pressable accessibilityRole="button" accessibilityLabel="−15" onPress={() => p.onBaslangic(-15)} hitSlop={8} style={s.aracAdim}>
              <Text style={s.aracAdimMetin}>−</Text>
            </Pressable>
            <Text style={s.aracMetin}>{t('program.baslangic', { saat: p.baslangicSaati })}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="+15" onPress={() => p.onBaslangic(15)} hitSlop={8} style={s.aracAdim}>
              <Text style={s.aracAdimMetin}>+</Text>
            </Pressable>
          </View>
        </View>
        <SurukleListe
          veriler={gunDurak}
          anahtar={(d) => d.id}
          yukseklik={SATIR_YUKSEKLIGI}
          onTasi={p.onTasi}
          cizim={(d, i, tutamac, aktif) => {
            const satir = satirIle(d.id);
            const m = mekanIle.get(d.place_ref);
            return (
              <View style={[s.duzenSatir, aktif && s.duzenSatirAktif]}>
                <View {...tutamac} style={s.tutamac} accessibilityLabel={t('program.surukle')}>
                  <Text style={s.tutamacMetin}>⋮⋮</Text>
                </View>
                <View style={[s.numara, d.skipped && { backgroundColor: renk.soluk }]}>
                  <Text style={s.numaraMetin}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[s.ad, d.skipped && s.cizili]} numberOfLines={1}>
                    {m ? (yerler?.[m.place_id]?.ad ?? '…') : '…'}
                  </Text>
                  <Text style={s.satirAlt} numberOfLines={1}>
                    {satir && !d.skipped ? saatAraligi(satir.varisDk, satir.ayrilisDk) : t('program.atlandi')}
                    {m?.added_by ? ` · ${uyeAdi(m.added_by)}` : ''}
                    {satir?.yuruyus ? ` · ${yuruyusDk(satir.yuruyus)} dk${satir.yuruyus.kestirim ? '~' : ''} · ${mesafeMetni(satir.yuruyus.m)}` : ''}
                  </Text>
                </View>
                <View style={s.sureKontrol}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('program.azalt')} onPress={() => p.onSure(d, -15)} style={s.sureDugme}>
                    <Text style={s.sureIsaret}>−</Text>
                  </Pressable>
                  <Text style={s.sureMetin}>{sureMetni(d.minutes)}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('program.artir')} onPress={() => p.onSure(d, 15)} style={s.sureDugme}>
                    <Text style={s.sureIsaret}>+</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
        <View style={s.ozetSatir}>
          <Text style={s.ozet}>
            {t('program.gunBitisi')} <Text style={s.ozetKalin}>{dakikaSaat(prog.canli.bitisDk)}</Text>
          </Text>
          <Text style={s.ozet}>
            {t('program.toplamYuruyus')}{' '}
            <Text style={s.ozetKalin}>
              {Math.round(prog.canli.yuruyusSn / 60)} dk · {mesafeMetni(prog.canli.yuruyusM)}
            </Text>
            {prog.canli.taksiSn > 0 ? (
              <>
                {' · '}
                {t('program.toplamTaksi')} <Text style={s.ozetKalin}>{Math.round(prog.canli.taksiSn / 60)} dk</Text>
              </>
            ) : null}
          </Text>
        </View>
      </ScrollView>
    );
  }


  return (
    <ScrollView contentContainerStyle={s.icerik} nestedScrollEnabled>
      {satirlar.map((satir, i) => {
        const d = satir.durak;
        const durak = gunDurak.find((x) => x.id === d.id)!;
        const m = mekanIle.get(durak.place_ref);
        const yer = m ? yerler?.[m.place_id] : undefined;
        const ad = yer?.ad ?? '…';
        const acilis = gun.date ? acilisDurumu(yer?.periyotlar, googleGunu(gun.date), satir.varisDk) : null;
        const kapali = acilis && acilis.durum !== 'acik' && acilis.durum !== 'bilinmiyor' && satir.durum !== 'atlandi' && satir.durum !== 'gecildi';
        const haftaKapali = !gun.date ? kapaliGunler(yer?.periyotlar) : [];
        const uzunBas = () => p.onMenu(durak);
        const aktif = satir.durum === 'siradaki' || satir.durum === 'buradasin';
        const tamam = satir.durum === 'gecildi';
        const puan = m ? p.puanim(m.id) : null;
        // #45 §4: iki satır arasında küçük yürüyüş/taksi metni; yoldaysa mavi.
        let ara: ReactNode = null;
        if (satir.yuruyus && i > 0) {
          const onceki = satirlar.slice(0, i).reverse().find((x) => x.durum === 'gecildi');
          const yolda = prog.bugun && prog.simdiDk !== null && aktif && !!onceki && satir.durum !== 'buradasin';
          const dk = yuruyusDk(satir.yuruyus);
          const yukleniyor = (satir.yuruyus.mod === 'taksi' ? p.matrisYukleniyor || p.rotaYukleniyor : p.matrisYukleniyor) && satir.yuruyus.kestirim;
          const metin = `${satir.yuruyus.mod === 'taksi' ? '🚕' : '🚶'} ${yukleniyor ? '…' : `${dk} dk${satir.yuruyus.kestirim ? ' ~' : ''}`}`;
          ara = (
            <View style={s.araSatir}>
              <View style={s.ray} />
              {yolda ? (
                <Text style={s.yolda}>{Math.max(0, satir.varisDk - prog.simdiDk!) > 0 ? t('program.suAnYolda', { n: Math.max(0, satir.varisDk - prog.simdiDk!) }) : t('program.suAnYoldaGec')}</Text>
              ) : satir.yuruyus.mod === 'taksi' ? (
                <Pressable accessibilityRole="button" onPress={() => p.onYolTarifi(durak, 'taksi')} hitSlop={6}>
                  <Text style={s.araMetin}>
                    {metin} · <Text style={s.araBaglanti}>{t('program.taksiYolTarifi')}</Text>
                  </Text>
                </Pressable>
              ) : (
                <Text style={s.araMetin}>{metin}</Text>
              )}
            </View>
          );
        }
        return (
          <View key={d.id}>
            {ara}
            {aktif ? (
              // Sıradaki durak: gri zeminli tek satır kart — 52 px foto, ad, "süre · bitiş", turuncu "Bitti".
              <Pressable accessibilityRole="button" onPress={() => p.onYolTarifi(durak)} onLongPress={uzunBas} style={s.aktifKart}>
                <Text style={[s.saat, s.saatKalin]}>{dakikaSaat(satir.varisDk)}</Text>
                {p.siradakiFoto ? (
                  <View>
                    <Image source={{ uri: p.siradakiFoto }} style={s.foto} contentFit="cover" />
                    <Text style={s.atif}>Google</Text>
                  </View>
                ) : (
                  <View style={[s.nokta, s.noktaSiradaki]} />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.adKalin} numberOfLines={1}>
                    {ad}
                  </Text>
                  <Text style={s.alt} numberOfLines={1}>
                    {satir.durum === 'buradasin' ? `${t('program.buradasin')} · ` : ''}
                    {t('program.sureBitis', { sure: sureMetni(durak.minutes), saat: dakikaSaat(satir.ayrilisDk) })}
                  </Text>
                </View>
                {prog.bugun ? (
                  <Pressable accessibilityRole="button" onPress={() => p.onTamamla(durak)} hitSlop={6} style={s.bittiDugme}>
                    <Text style={s.bittiMetin}>{t('program.bitti')}</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => (tamam && m ? p.onPuanla(durak) : p.onDetay(durak))}
                onLongPress={uzunBas}
                style={[s.satir, kapali && s.satirKapali]}>
                <Text style={[s.saat, satir.durum === 'atlandi' && s.soluk]}>{satir.durum === 'atlandi' ? '—' : dakikaSaat(satir.varisDk)}</Text>
                <View style={s.noktaKap}>
                  <View style={s.rayTam} />
                  {tamam ? (
                    <View style={[s.nokta, s.noktaTamam]}>
                      <Text style={s.tik}>✓</Text>
                    </View>
                  ) : (
                    <View style={[s.nokta, satir.durum === 'atlandi' && { borderColor: renk.soluk }]} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[s.ad, satir.durum === 'atlandi' && [s.soluk, s.cizili]]} numberOfLines={1}>
                    {ad}
                  </Text>
                  {tamam ? (
                    puan ? (
                      <Text style={s.yildizlar}>{'★'.repeat(puan.stars)}</Text>
                    ) : (
                      <Text style={s.puanla}>{t('program.puanla')}</Text>
                    )
                  ) : null}
                  {kapali ? (
                    <Text style={s.kapaliMetin} numberOfLines={1}>
                      {acilis!.durum === 'kapali_gun'
                        ? t('program.kapaliGun')
                        : acilis!.durum === 'kapali_saat' && acilis!.sonrakiAcilis
                          ? t('program.kapaliSaat', { saat: acilis!.sonrakiAcilis })
                          : t('program.kapaliSaatBelirsiz')}
                    </Text>
                  ) : haftaKapali.length > 0 ? (
                    <Text style={s.alt} numberOfLines={1}>
                      {t('program.kapaliHafta', { gunler: haftaKapali.map((g) => GUNLER_KISA[(g + 6) % 7]).join(', ') })}
                    </Text>
                  ) : null}
                </View>
                <Text style={s.sure}>{satir.durum === 'atlandi' ? t('program.atlandi') : sureMetni(durak.minutes)}</Text>
                {kapali && gunler.length > 1 ? (
                  <Pressable accessibilityRole="button" onPress={() => p.onGunSec(durak)} hitSlop={6} style={s.kapaliDugme}>
                    <Text style={s.kapaliDugmeMetin}>{t('program.baskaGuneAl')}</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            )}
          </View>
        );
      })}
      {prog.canli.oteleDonus ? (
        <View style={s.araSatir}>
          <View style={s.ray} />
          <Text style={s.araMetin}>
            {prog.canli.oteleDonus.mod === 'taksi' ? '🚕' : '🏠'}{' '}
            {t(prog.canli.oteleDonus.mod === 'taksi' ? 'program.oteleDonusTaksi' : 'program.oteleDonus', { n: yuruyusDk(prog.canli.oteleDonus) })}
            {prog.canli.oteleDonus.kestirim ? ' ~' : ''} · {dakikaSaat(prog.canli.bitisDk)}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const RAY_X = 50 + 10 + 9;

const s = StyleSheet.create({
  bos: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil, paddingTop: 12 },
  icerik: { paddingTop: 6, paddingBottom: 24 },
  // #45 §4: kompakt satır (~36 px): saat · ray üstünde nokta · ad · süre.
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  satirKapali: { backgroundColor: renk.uyariZemin, borderRadius: 10, paddingRight: 6 },
  saat: { width: 50, textAlign: 'right', fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  saatKalin: { fontFamily: yazi.ekstra },
  soluk: { color: renk.soluk },
  noktaKap: { width: 18, height: 36, alignItems: 'center', justifyContent: 'center' },
  rayTam: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: renk.ayrac },
  ray: { position: 'absolute', left: RAY_X - 1, top: 0, bottom: 0, width: 2, backgroundColor: renk.ayrac },
  nokta: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: renk.ikincil, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  noktaTamam: { backgroundColor: renk.basari, borderColor: renk.basari },
  noktaSiradaki: { borderColor: renk.vurgu, borderWidth: 3 },
  tik: { fontFamily: yazi.ekstra, fontSize: 8, lineHeight: 10, color: renk.zemin },
  ad: { fontFamily: yazi.yari, fontSize: 14, color: renk.metin, flexShrink: 1 },
  adKalin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  cizili: { textDecorationLine: 'line-through' },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  sure: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  puanla: { fontFamily: yazi.normal, fontSize: 11, color: renk.soluk },
  yildizlar: { fontFamily: yazi.kalin, fontSize: 11, color: renk.vurgu },
  araSatir: { minHeight: 22, justifyContent: 'center', paddingLeft: RAY_X + 12 },
  araMetin: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  araBaglanti: { fontFamily: yazi.kalin, color: renk.metin },
  yolda: { fontFamily: yazi.kalin, fontSize: 12, color: '#2563eb' },
  aktifKart: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingLeft: 0, borderRadius: 14, backgroundColor: renk.yuzey, marginVertical: 2 },
  foto: { width: 52, height: 52, borderRadius: 10, backgroundColor: renk.ayrac },
  atif: { position: 'absolute', bottom: 2, left: 4, fontFamily: yazi.kalin, fontSize: 8, color: renk.zemin },
  bittiDugme: { height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.vurgu, justifyContent: 'center' },
  bittiMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.zemin },
  kapaliMetin: { fontFamily: yazi.yari, fontSize: 11, color: renk.uyari, flexShrink: 1 },
  kapaliDugme: { height: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: renk.uyari, justifyContent: 'center' },
  kapaliDugmeMetin: { fontFamily: yazi.kalin, fontSize: 10, color: renk.zemin },
  araclar: { flexDirection: 'row', gap: 8, paddingBottom: 12, flexWrap: 'wrap' },
  arac: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 6 },
  aracMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  aracAdim: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  aracAdimMetin: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  duzenSatir: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: renk.ayrac, backgroundColor: renk.zemin },
  duzenSatirAktif: { backgroundColor: renk.yuzey, borderRadius: 14, borderTopWidth: 0, paddingHorizontal: 6 },
  tutamac: { width: 24, height: minDokunma, alignItems: 'center', justifyContent: 'center' },
  tutamacMetin: { fontFamily: yazi.kalin, fontSize: 16, color: '#c4c4c4' },
  numara: { width: 30, height: 30, borderRadius: 15, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  numaraMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.zemin },
  satirAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  sureKontrol: { flexDirection: 'row', alignItems: 'center', height: 36, borderRadius: 999, backgroundColor: renk.yuzey, paddingHorizontal: 2 },
  sureDugme: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sureIsaret: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  sureMetin: { width: 44, textAlign: 'center', fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  ozetSatir: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14 },
  ozet: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ozetKalin: { fontFamily: yazi.kalin, color: renk.metin },
});
