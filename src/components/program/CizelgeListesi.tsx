import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import type { GunProgrami } from '@/features/program/useProgram';
import type { HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import { sureMetni } from '@/lib/kategori';
import { GUNLER_KISA, haftaGunu } from '@/lib/takvim';
import type { Durak, Gun, Mekan, Seyahat } from '@/lib/tipler';
import { acilisDurumu, kapaliGunler } from '@/schedule/acilis';
import { saatAraligi, yuruyusDk, type ProgramSatiri } from '@/schedule/program';
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
  onYolTarifi: (d: Durak, mod?: 'yuruyus' | 'taksi') => void;
  onMenu: (d: Durak) => void;
  onGunSec: (d: Durak) => void;
  onTasi: (from: number, to: number) => void;
  onSure: (d: Durak, fark: number) => void;
  onBaslangic: (fark: number) => void;
};

/**
 * PRD 3.7 çizelge listesi — #42 ile Program alt panelinin açık hâli. KK1–KK10 (PR #23) + #43 "Tamamlandı":
 * sıradaki durak kartında ✓ Tamamlandı (turuncu) ve "Planlanan bitiş HH:MM · dokunmazsan otomatik tamamlanır";
 * tamamlananlar üstü çizili + ✓ saat; bugün duraklar arasında mavi "Şu an yolda · N dk kaldı" / "Şu an X'de".
 */
export function CizelgeListesi(p: CizelgeListesiProps) {
  const { seyahat, gun, gunler, gunDurak, mekanIle, yerler, uyeAdi, prog, duzenle } = p;
  const satirlar = prog.canli.satirlar;
  const satirIle = (durakId: string) => satirlar.find((x) => x.durak.id === durakId);
  const ac = (m: Mekan | undefined) => m && router.push({ pathname: '/seyahat/[id]/mekan/[placeId]', params: { id: seyahat.id, placeId: m.place_id } });

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

  const siradaki = satirlar.find((x) => x.durum === 'siradaki' || x.durum === 'buradasin');
  // #42 KK8: önceki tamamlandı, sıradakine yürüyüş sürüyor → mavi satır (konum yoksa da plana göre).
  const yoldaSatiri = (satir: ProgramSatiri, i: number) => {
    if (!prog.bugun || prog.simdiDk === null || !siradaki || satir.durak.id !== siradaki.durak.id || i === 0) return null;
    const onceki = satirlar.slice(0, i).reverse().find((x) => x.durum === 'gecildi');
    if (!onceki) return null;
    if (satir.durum === 'buradasin') {
      const m = mekanIle.get(satir.durak.id) ?? mekanIle.get(gunDurak.find((x) => x.id === satir.durak.id)?.place_ref ?? '');
      return <Text style={s.yolda}>{t('program.suAnBurada', { ad: (m && yerler?.[m.place_id]?.ad) || '…' })}</Text>;
    }
    const kalan = Math.max(0, satir.varisDk - prog.simdiDk);
    return <Text style={s.yolda}>{p.buradaId === undefined || kalan > 0 ? t('program.suAnYolda', { n: kalan }) : t('program.suAnYoldaGec')}</Text>;
  };

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
        const aktifKart = satir.durum === 'siradaki' || satir.durum === 'buradasin';
        return (
          <View key={d.id}>
            {satir.yuruyus && i > 0 ? (
              satir.yuruyus.mod === 'taksi' ? (
                // #33: 40 dk üstü bacak araçla — "🚕 9 dk · Yol tarifi" Google Maps'i araç moduyla açar.
                <Pressable accessibilityRole="button" onPress={() => p.onYolTarifi(durak, 'taksi')} style={s.yuruyusSatir}>
                  <View style={s.noktaCizgi} />
                  <Text style={s.yuruyusMetin}>
                    🚕 {(p.matrisYukleniyor || p.rotaYukleniyor) && satir.yuruyus.kestirim ? '…' : `${t('program.taksi', { n: yuruyusDk(satir.yuruyus) })}${satir.yuruyus.kestirim ? ' ~' : ''}`}
                    {' · '}
                    <Text style={s.yuruyusBaglanti}>{t('program.taksiYolTarifi')}</Text>
                  </Text>
                </Pressable>
              ) : (
                <View style={s.yuruyusSatir}>
                  <View style={s.noktaCizgi} />
                  <Text style={s.yuruyusMetin}>
                    🚶 {p.matrisYukleniyor && satir.yuruyus.kestirim ? '…' : `${t('program.yuruyus', { n: yuruyusDk(satir.yuruyus) })}${satir.yuruyus.kestirim ? ' ~' : ''}`}
                  </Text>
                </View>
              )
            ) : null}
            {yoldaSatiri(satir, i)}
            <View style={s.satir}>
              <View style={s.saatSutun}>
                <Text style={[s.saat, aktifKart && s.saatBuyuk, satir.durum === 'gecildi' && s.soluk]}>{satir.durum === 'atlandi' ? '—' : dakikaSaat(satir.varisDk)}</Text>
                {satir.durum === 'siradaki' ? <Text style={s.siradakiEtiket}>{t('program.siradaki')}</Text> : null}
                {satir.durum === 'buradasin' ? <Text style={s.siradakiEtiket}>{t('program.buradasin')}</Text> : null}
              </View>
              {aktifKart ? (
                <Pressable accessibilityRole="button" onPress={() => ac(m)} onLongPress={uzunBas} style={s.siyahKart}>
                  <View style={s.kartUst}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={s.kartAd} numberOfLines={2}>
                        {ad}
                      </Text>
                      <Text style={s.kartAlt} numberOfLines={1}>
                        {sureMetni(durak.minutes)}
                        {yer?.puan !== null && yer?.puan !== undefined ? ` · ★ ${yer.puan.toLocaleString('tr-TR')}` : ''}
                        {yer?.acik === true ? ` · ${t('mekan.acik')}` : yer?.acik === false ? ` · ${t('mekan.kapali')}` : ''}
                      </Text>
                    </View>
                    {m?.added_by ? <Avatar ad={uyeAdi(m.added_by) || '?'} boyut={24} arkaPlan="#4c6ef5" /> : null}
                  </View>
                  {m?.note ? (
                    <Text style={s.kartNot} numberOfLines={2}>
                      {`“${m.note}”`} <Text style={s.kartNotKim}>— {uyeAdi(m.added_by)}</Text>
                    </Text>
                  ) : null}
                  <View style={s.kartDugmeler}>
                    <Pressable accessibilityRole="button" onPress={() => p.onYolTarifi(durak)} style={s.kartDugmeBeyaz}>
                      <Text style={s.kartDugmeBeyazMetin}>{t('program.yolTarifi')}</Text>
                    </Pressable>
                    {prog.bugun ? (
                      // #43 KK1: ✓ Tamamlandı (turuncu) + planlanan bitiş notu.
                      <Pressable accessibilityRole="button" onPress={() => p.onTamamla(durak)} style={s.kartDugmeTuruncu}>
                        <Text style={s.kartDugmeTuruncuMetin}>✓ {t('program.tamamlandi')}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {prog.bugun ? <Text style={s.kartNotKim}>{t('program.tamamlandiAlt', { saat: dakikaSaat(satir.ayrilisDk) })}</Text> : null}
                </Pressable>
              ) : kapali ? (
                <Pressable accessibilityRole="button" onPress={() => ac(m)} onLongPress={uzunBas} style={s.kapaliKart}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={s.ad} numberOfLines={1}>
                      {ad}
                    </Text>
                    <Text style={s.kapaliMetin} numberOfLines={1}>
                      {acilis!.durum === 'kapali_gun'
                        ? t('program.kapaliGun')
                        : acilis!.durum === 'kapali_saat' && acilis!.sonrakiAcilis
                          ? t('program.kapaliSaat', { saat: acilis!.sonrakiAcilis })
                          : t('program.kapaliSaatBelirsiz')}
                      {m?.added_by ? ` · ${uyeAdi(m.added_by)}` : ''}
                    </Text>
                  </View>
                  {gunler.length > 1 ? (
                    <Pressable accessibilityRole="button" onPress={() => p.onGunSec(durak)} style={s.kapaliDugme}>
                      <Text style={s.kapaliDugmeMetin}>{t('program.baskaGuneAl')}</Text>
                    </Pressable>
                  ) : null}
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => ac(m)} onLongPress={uzunBas} style={s.duzSatir}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={[s.ad, (satir.durum === 'gecildi' || satir.durum === 'atlandi') && s.cizili, satir.durum === 'gecildi' && s.soluk]} numberOfLines={1}>
                      {ad}
                    </Text>
                    <Text style={[s.satirAlt, satir.durum === 'gecildi' && s.soluk]} numberOfLines={1}>
                      {satir.durum === 'atlandi' ? t('program.atlandi') : satir.durum === 'gecildi' ? `✓ ${dakikaSaat(satir.ayrilisDk)}${satir.otomatik ? ` · ${t('program.otomatik')}` : ''}` : sureMetni(durak.minutes)}
                      {m?.added_by ? ` · ${uyeAdi(m.added_by)}` : ''}
                      {haftaKapali.length > 0 ? ` · ${t('program.kapaliHafta', { gunler: haftaKapali.map((g) => GUNLER_KISA[(g + 6) % 7]).join(', ') })}` : ''}
                      {m?.note ? ` · “${m.note}”` : ''}
                    </Text>
                  </View>
                  {satir.durum === 'gecildi' ? <Text style={s.tik}>✓</Text> : null}
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
      {prog.canli.oteleDonus ? (
        <View style={s.yuruyusSatir}>
          <View style={s.noktaCizgi} />
          <Text style={s.yuruyusMetin}>
            {prog.canli.oteleDonus.mod === 'taksi' ? '🚕' : '🏠'}{' '}
            {t(prog.canli.oteleDonus.mod === 'taksi' ? 'program.oteleDonusTaksi' : 'program.oteleDonus', { n: yuruyusDk(prog.canli.oteleDonus) })}
            {prog.canli.oteleDonus.kestirim ? ' ~' : ''} · {dakikaSaat(prog.canli.bitisDk)}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  bos: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil, paddingTop: 12 },
  icerik: { paddingTop: 6, paddingBottom: 24 },
  satir: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  saatSutun: { width: 50, alignItems: 'flex-end', paddingTop: 12 },
  saat: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  saatBuyuk: { fontFamily: yazi.ekstra, fontSize: 16 },
  soluk: { color: renk.soluk },
  siradakiEtiket: { fontFamily: yazi.kalin, fontSize: 10, color: renk.vurgu },
  duzSatir: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, minHeight: minDokunma },
  ad: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  cizili: { textDecorationLine: 'line-through' },
  satirAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  tik: { fontFamily: yazi.kalin, fontSize: 16, color: renk.basari },
  yuruyusSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 30, paddingLeft: 64 },
  noktaCizgi: { width: 2, height: '100%', borderLeftWidth: 2, borderLeftColor: '#c4c4c4', borderStyle: 'dotted' },
  yuruyusMetin: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  yuruyusBaglanti: { fontFamily: yazi.kalin, color: renk.metin },
  yolda: { fontFamily: yazi.kalin, fontSize: 12, color: '#2563eb', paddingLeft: 64, paddingBottom: 6 },
  siyahKart: { flex: 1, padding: 14, borderRadius: 18, backgroundColor: renk.metin, gap: 10 },
  kartUst: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 18, letterSpacing: -0.4, color: renk.zemin },
  kartAlt: { fontFamily: yazi.normal, fontSize: 12, color: '#a3a3a3' },
  kartNot: { fontFamily: yazi.normal, fontSize: 13, color: '#d4d4d4' },
  kartNotKim: { fontFamily: yazi.normal, fontSize: 11, color: '#8a8a8a' },
  kartDugmeler: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  kartDugmeBeyaz: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center' },
  kartDugmeBeyazMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  kartDugmeTuruncu: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.vurgu, justifyContent: 'center' },
  kartDugmeTuruncuMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.zemin },
  kapaliKart: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: renk.uyariZemin },
  kapaliMetin: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari },
  kapaliDugme: { height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.uyari, justifyContent: 'center' },
  kapaliDugmeMetin: { fontFamily: yazi.kalin, fontSize: 11, color: renk.zemin },
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
  sureKontrol: { flexDirection: 'row', alignItems: 'center', height: 36, borderRadius: 999, backgroundColor: renk.yuzey, paddingHorizontal: 2 },
  sureDugme: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sureIsaret: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  sureMetin: { width: 44, textAlign: 'center', fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  ozetSatir: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14 },
  ozet: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ozetKalin: { fontFamily: yazi.kalin, color: renk.metin },
});
