import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { SeyahatKapagi } from '@/components/seyahatler/SeyahatKapagi';
import { seritAdimMetni, useSeritAdimi } from '@/features/anasayfa/serit';
import { useSeyahattenAyril } from '@/features/davet/sorgular';
import { useSeyahatDurumlari, type SeyahatDurumu } from '@/features/seyahatler/durum';
import { eylemlerMenusu, sahipMi, silmeMetni } from '@/features/seyahatler/silme';
import { useSeyahatSil } from '@/features/seyahatler/sorgular';
import { yeniGirisNo } from '@/features/sihirbaz/girisler';
import { gunFarki, seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { onayIste } from '@/lib/onay';
import { useOturum } from '@/lib/oturum';
import { ayAdi, tarihAraligi } from '@/lib/takvim';
import type { SeyahatOzet } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';
import { anaV5, renk, yazi, yuzRenkleri } from '@/theme';

/**
 * #275 KK4 → #405 KK2 (UX önerileri kanvası, `Ana_v6_Seyahatlerim`): Seyahatlerim sekmesinin listesi.
 * YAKLAŞAN — bitmemiş seyahatler ve taslaklar (tarih sırası, taslaklar sonda). En yakını büyük kapakla: "N gün kaldı"
 * etiketi, ad, "tarih · gün · durak", turuncu "Sıradaki adım: …" (`serit.ts`), sağda kişi yüzleri; diğerleri satır.
 * GEÇMİŞ — satır: "ay · gün · kişiler". Satır dokununca seyahati açar; sağda kanvastaki ok. Uzun basınca #174 menüsü: sahipte
 * "Seyahati sil", üyede "Seyahatten ayrıl"; onay, kısa bildirim. #405 inceleme 1: geçmişte "Tekrar kur" (aynı plan, yeni tarih)
 * aynı menünün ilk eylemi; ekran okuyucu için hepsi satırın `accessibilityActions`'ında (iç içe düğme yok).
 */
export function SeyahatlerimListesi({ yaklasan, gecmis, onBildirim }: { yaklasan: SeyahatOzet[]; gecmis: SeyahatOzet[]; onBildirim: (metin: string) => void }) {
  const durumlar = useSeyahatDurumlari();
  const { session } = useOturum();
  const sil = useSeyahatSil();
  const ayril = useSeyahattenAyril();

  const ac = (id: string) => router.push({ pathname: '/seyahat/[id]', params: { id } });
  const tekrarKur = (id: string) =>
    router.navigate({
      pathname: '/(tabs)/yeni',
      params: { tekrar: id, n: yeniGirisNo() },
    });
  /** Satırın eylemleri: geçmişte önce "Tekrar kur", sonra sahipte sil / üyede ayrıl. Uzun basma menüsü ve ekran okuyucu aynı listeyi kullanır. */
  const eylemler = (sy: SeyahatOzet, tekrar: boolean): Eylem[] => {
    const sahip = sahipMi(sy.members, session?.user.id);
    const ayrilSil: Eylem = { ad: 'sil', metin: t(sahip ? 'seyahatler.sil' : 'davet.grup.ayril'), yikici: sahip, calistir: () => silYaDaAyril(sy, sahip) };
    return tekrar ? [{ ad: 'tekrar', metin: t('seyahatler.tekrarKur'), calistir: () => tekrarKur(sy.id) }, ayrilSil] : [ayrilSil];
  };
  const uzunBas = async (sy: SeyahatOzet, tekrar = false) => {
    const liste = eylemler(sy, tekrar);
    const i = await eylemlerMenusu(seyahatAdi(sy), liste, t('genel.vazgec'));
    if (i !== null) await liste[i].calistir();
  };
  const silYaDaAyril = async (sy: SeyahatOzet, sahip: boolean) => {
    if (sahip) {
      if (!(await onayIste(t('seyahatler.silOnay'), silmeMetni(sy.members.length), t('seyahatler.silEvet'), t('genel.vazgec')))) return;
      try {
        await sil.mutateAsync(sy.id);
        onBildirim(t('seyahatler.silindi'));
      } catch {
        onBildirim(t('seyahatler.silHata'));
      }
      return;
    }
    if (!(await onayIste(t('davet.grup.ayrilOnay'), t('davet.grup.ayrilMetin'), t('davet.grup.ayrilEvet'), t('genel.vazgec')))) return;
    try {
      await ayril.mutateAsync(sy.id);
    } catch {
      onBildirim(t('davet.grup.ayrilHata'));
    }
  };

  // KK5 · inceleme 4: seyahat yoksa tek satır yazı (üstteki "+ Seyahat" düğmesi yeter).
  if (yaklasan.length === 0 && gecmis.length === 0)
    return (
      <Text style={s.bos}>
        {t('seyahatlerim.bosOnce')}
        <Text style={s.bosVurgu}>{t('seyahatlerim.bosVurgu')}</Text>
        {t('seyahatlerim.bosSonra')}
      </Text>
    );
  const [enYakin, ...digerYaklasan] = yaklasan;
  const benimId = session?.user.id;
  return (
    <View>
      {enYakin ? (
        <>
          <Text style={s.baslikYaklasan}>{t('seyahatler.yaklasan')}</Text>
          <BuyukKart seyahat={enYakin} eylemler={eylemler(enYakin, false)} onPress={() => ac(enYakin.id)} onUzunBas={() => uzunBas(enYakin)} />
          {digerYaklasan.length > 0 ? (
            <View style={{ paddingTop: 14 }}>
              {digerYaklasan.map((sy) => (
                <Satir key={sy.id} seyahat={sy} alt={yaklasanAlt(sy, durumlar.data?.get(sy.id))} eylemler={eylemler(sy, false)} onPress={() => ac(sy.id)} onUzunBas={() => uzunBas(sy)} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      {gecmis.length > 0 ? (
        <>
          <Text style={s.baslikGecmis}>{t('seyahatler.gecmis')}</Text>
          {gecmis.map((sy) => (
            <Satir key={sy.id} seyahat={sy} alt={gecmisAlt(sy, benimId)} eylemler={eylemler(sy, true)} onPress={() => ac(sy.id)} onUzunBas={() => uzunBas(sy, true)} />
          ))}
        </>
      ) : null}
    </View>
  );
}

/** Gün sayısı (iki tarih dahil); tarihsizde null. */
function gunSayisi(sy: Pick<SeyahatOzet, 'start_date' | 'end_date'>): number | null {
  return sy.start_date && sy.end_date ? gunFarki(sy.start_date, sy.end_date) + 1 : null;
}

/** "23–24 Kasım · 2 gün · 12 durak"; tarihsizde "Taslak · tarih yok · 12 durak". */
export function buyukKartAlt(sy: SeyahatOzet): string {
  const gun = gunSayisi(sy);
  const parcalar = sy.start_date && sy.end_date && gun ? [tarihAraligi(sy.start_date, sy.end_date), t('seyahatlerim.gun', { n: gun })] : [t('seyahatler.taslakTarihYok')];
  parcalar.push(t('seyahatlerim.durak', { n: sy.places[0]?.count ?? 0 }));
  return parcalar.join(' · ');
}

/** "5–7 Aralık · 3 gün · plan yarım" (planlanan gün < gün sayısı); planı tamamsa "N durak"; taslakta "Taslak · tarih yok". */
export function yaklasanAlt(sy: SeyahatOzet, d: SeyahatDurumu | undefined): string {
  const gun = gunSayisi(sy);
  if (!sy.start_date || !sy.end_date || !gun) return t('seyahatler.taslakTarihYok');
  const son = d && d.gun > 0 && d.planli_gun < d.gun ? t('seyahatlerim.planYarim') : t('seyahatlerim.durak', { n: sy.places[0]?.count ?? 0 });
  return [tarihAraligi(sy.start_date, sy.end_date), t('seyahatlerim.gun', { n: gun }), son].join(' · ');
}

/** "Eylül · 2 gün · Ayşe ile" (iki kişi), "Haziran · 3 gün · 4 kişi" (üç ve üstü); yalnızsan kişi yok. */
export function gecmisAlt(sy: SeyahatOzet, benimId: string | undefined): string {
  const parcalar = [sy.end_date ? ayAdi(sy.end_date) : t('seyahatler.tarihBelliDegil')];
  const gun = gunSayisi(sy);
  if (gun) parcalar.push(t('seyahatlerim.gun', { n: gun }));
  if (sy.members.length === 2) {
    const diger = sy.members.find((m) => m.user_id !== benimId) ?? sy.members[1];
    parcalar.push(t('seyahatlerim.ile', { ad: diger.display_name.trim().split(' ')[0] }));
  } else if (sy.members.length > 2) parcalar.push(t('seyahatler.kisi', { n: sy.members.length }));
  return parcalar.join(' · ');
}

/** "4 gün kaldı"; başladıysa #405 inceleme 4: "Gezide · N. gün" (ilk gün 1); tarihsizde null. Gün `trips.tz` ile. */
export function kalanEtiketi(sy: Pick<SeyahatOzet, 'start_date' | 'tz'>, simdi = new Date()): string | null {
  if (!sy.start_date) return null;
  const kalan = gunFarki(yerelTarih(simdi, sy.tz), sy.start_date);
  return kalan <= 0 ? t('seyahatlerim.gezide', { n: 1 - kalan }) : t('anasayfa.v5.kalan', { n: kalan });
}

type Eylem = { ad: string; metin: string; yikici?: boolean; calistir: () => void | Promise<void> };

const erisimEylemleri = (eylemler: Eylem[]) => eylemler.map((e) => ({ name: e.ad, label: e.metin }));
const erisimEylemi = (eylemler: Eylem[]) => (o: { nativeEvent: { actionName: string } }) => {
  void eylemler.find((e) => e.ad === o.nativeEvent.actionName)?.calistir();
};

function BuyukKart({ seyahat, eylemler, onPress, onUzunBas }: { seyahat: SeyahatOzet; eylemler: Eylem[]; onPress: () => void; onUzunBas: () => void }) {
  const adim = useSeritAdimi(seyahat);
  const adimMetni = adim ? seritAdimMetni(adim) : null;
  const kalan = kalanEtiketi(seyahat);
  const alt = buyukKartAlt(seyahat);
  const uyeler = seyahat.members.slice(0, 3);
  return (
    <Pressable
      testID="seyahatlerim-buyuk-kart"
      accessibilityRole="button"
      accessibilityLabel={[kalan, seyahatAdi(seyahat), alt, adimMetni].filter(Boolean).join(', ')}
      accessibilityActions={erisimEylemleri(eylemler)}
      onAccessibilityAction={erisimEylemi(eylemler)}
      onPress={onPress}
      onLongPress={onUzunBas}
      style={({ pressed }) => [s.buyuk, pressed && s.basili]}>
      <View>
        <SeyahatKapagi kimlik={seyahat.id} yukseklik={190} kose={16} />
        {kalan ? (
          <View style={s.kalan}>
            <Text style={s.kalanMetin}>{kalan}</Text>
          </View>
        ) : null}
      </View>
      <View style={s.buyukAlt}>
        <View style={s.metinler}>
          <Text style={s.buyukAd} numberOfLines={1}>
            {seyahatAdi(seyahat)}
          </Text>
          <Text style={s.buyukBilgi} numberOfLines={1}>
            {alt}
          </Text>
          {adimMetni ? (
            <Text style={s.adim} numberOfLines={1}>
              {adimMetni}
            </Text>
          ) : null}
        </View>
        <View style={s.yuzler} accessible={false}>
          {uyeler.map((u, i) => (
            <View key={u.user_id} style={[s.yuz, { marginLeft: i === 0 ? 0 : -8, backgroundColor: yuzRenkleri[i % yuzRenkleri.length] }]}>
              <Text style={[s.yuzHarf, { color: i % 3 === 0 ? renk.metin : i % 3 === 1 ? renk.zemin : renk.ana }]}>{u.display_name.trim().charAt(0).toLocaleUpperCase('tr') || '?'}</Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

function Satir({ seyahat, alt, eylemler, onPress, onUzunBas }: { seyahat: SeyahatOzet; alt: string; eylemler: Eylem[]; onPress: () => void; onUzunBas: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${seyahatAdi(seyahat)}, ${alt}`}
      accessibilityActions={erisimEylemleri(eylemler)}
      onAccessibilityAction={erisimEylemi(eylemler)}
      onPress={onPress}
      onLongPress={onUzunBas}
      style={({ pressed }) => [s.satir, pressed && s.basili]}>
      <SeyahatKapagi kimlik={seyahat.id} yukseklik={56} genislik={56} kose={12} />
      <View style={s.metinler}>
        <Text style={s.satirAd} numberOfLines={1}>
          {seyahatAdi(seyahat)}
        </Text>
        <Text style={s.satirAlt} numberOfLines={1}>
          {alt}
        </Text>
      </View>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={anaV5.ok} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M9 6l6 6-6 6" />
      </Svg>
    </Pressable>
  );
}

const s = StyleSheet.create({
  basili: { opacity: 0.85 },
  baslikYaklasan: { fontFamily: yazi.kalin, fontSize: 13, color: anaV5.ikincil, paddingTop: 14, paddingBottom: 8 },
  baslikGecmis: { fontFamily: yazi.kalin, fontSize: 13, color: anaV5.ikincil, paddingTop: 22, paddingBottom: 4 },
  buyuk: { gap: 10 },
  kalan: { position: 'absolute', left: 12, top: 12, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: renk.zemin, justifyContent: 'center' },
  kalanMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  buyukAlt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  metinler: { flex: 1, minWidth: 0, gap: 1 },
  buyukAd: { fontFamily: yazi.ekstra, fontSize: 18, color: renk.metin },
  buyukBilgi: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  adim: { fontFamily: yazi.kalin, fontSize: 14, color: anaV5.adim },
  yuzler: { flexDirection: 'row' },
  yuz: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  yuzHarf: { fontFamily: yazi.ekstra, fontSize: 11 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: anaV5.cizgi },
  satirAd: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  satirAlt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  bos: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 21, color: anaV5.ikincil, paddingTop: 14 },
  bosVurgu: { fontFamily: yazi.kalin, color: renk.metin },
});
