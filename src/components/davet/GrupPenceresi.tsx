// #137 KK6 (kanvas 16 · Grup): üstteki yüzlere dokununca açılan pencere — katılanlar (+ kaç mekan ekledi),
// "Davet linkini gönder" (profil onayıyla), Son değişiklikler, "Seyahatten ayrıl". Grup sekmesi kalktı.
// "Geri al" düğmeleri #141 ile gelir (changes geri alma). Mevcut görünüm; #136 ile yeni jetonlara geçer.
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AltPencere } from '@/components/ui/AltPencere';
import { Avatar } from '@/components/ui/Avatar';
import { Buton } from '@/components/ui/Buton';
import { useDavetPaylas } from '@/features/davet/paylas';
import { useSeyahattenAyril } from '@/features/davet/sorgular';
import { degisiklikMetni, zamanMetni } from '@/features/program/degisiklikMetni';
import { useDegisiklikler } from '@/features/program/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { useHafifYerler } from '@/features/yerler/api';
import { t } from '@/i18n';
import { onayIste } from '@/lib/onay';
import { useOturum } from '@/lib/oturum';
import type { Mekan, Seyahat, Uye } from '@/lib/tipler';
import { kose, minDokunma, olcek, renk, yazi } from '@/theme';

import { ProfilOnayi } from './ProfilOnayi';

type Props = { acik: boolean; onKapat: () => void; seyahat: Seyahat; uyeler: Uye[]; mekanlar: Mekan[] };

const YUZ_RENKLERI = [renk.vurgu, renk.ana, renk.anaAcik];

export function GrupPenceresi({ acik, onKapat, seyahat, uyeler, mekanlar }: Props) {
  const { session } = useOturum();
  const degisiklikler = useDegisiklikler(seyahat.id, acik);
  const yerler = useHafifYerler(acik ? mekanlar.map((m) => m.place_id) : []);
  const ayril = useSeyahattenAyril();
  const [bildirim, setBildirim] = useState<string | null>(null);
  const paylasim = useDavetPaylas(seyahat, (sonuc) => {
    if (sonuc === 'kopyalandi') {
      setBildirim(t('davet.linkKopyalandi'));
      setTimeout(() => setBildirim(null), 2500);
    }
  });

  const benim = (uid: string | null) => !!session && uid === session.user.id;
  const uyeAdi = (uid: string | null) => uyeler.find((u) => u.user_id === uid)?.display_name ?? '?';
  const mekanAdi = (placesId: string | null | undefined) => {
    const m = mekanlar.find((x) => x.id === placesId);
    return m ? (yerler.data?.[m.place_id]?.ad ?? '…') : '';
  };
  const eklediSayisi = (uid: string) => mekanlar.filter((m) => m.added_by === uid).length;
  const benUye = uyeler.find((u) => benim(u.user_id));
  const ayrilabilir = !!benUye && benUye.role !== 'owner';

  const seyahattenAyril = async () => {
    const onay = await onayIste(t('davet.grup.ayrilOnay'), t('davet.grup.ayrilMetin'), t('davet.grup.ayrilEvet'), t('genel.vazgec'));
    if (!onay) return;
    try {
      await ayril.mutateAsync(seyahat.id);
      onKapat();
      router.replace('/(tabs)/seyahatler');
    } catch {
      setBildirim(t('davet.grup.ayrilHata'));
      setTimeout(() => setBildirim(null), 2500);
    }
  };

  return (
    <>
      <AltPencere acik={acik && !paylasim.onayAcik} onKapat={onKapat} kapatEtiketi={t('genel.vazgec')} kaydirilir stil={{ paddingHorizontal: 22 }}>
      <View style={s.baslikSatiri}>
        <Text accessibilityRole="header" style={s.baslik}>
          {t('davet.grup.baslik', { n: uyeler.length })}
        </Text>
        <Text style={s.baslikAlt} numberOfLines={1}>
          {seyahatAdi(seyahat)}
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {uyeler.map((u, i) => {
          const n = eklediSayisi(u.user_id);
          const parcalar = [u.role === 'owner' ? t('davet.grup.kurdu') : null, n > 0 ? t('davet.grup.mekanEkledi', { n }) : null].filter(Boolean);
          return (
            <View key={u.user_id} style={s.uye}>
              <Avatar ad={u.display_name} url={u.photo_url} boyut={44} arkaPlan={YUZ_RENKLERI[i % YUZ_RENKLERI.length]} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={s.uyeAd}>
                  {u.display_name} {benim(u.user_id) ? <Text style={s.uyeSen}>{t('davet.grup.sen')}</Text> : null}
                </Text>
                {parcalar.length ? <Text style={s.uyeAlt}>{parcalar.join(' · ')}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>

      <View style={s.davetKart}>
        <Text style={s.davetBaslik}>{t('davet.grup.ekleKart')}</Text>
        <Text style={s.davetAlt}>{t('davet.grup.ekleAlt')}</Text>
        <Buton baslik={t('davet.grup.gonder')} onPress={paylasim.paylas} tur="vurgu" boy="kucuk" />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={s.bolum}>{t('davet.grup.degisiklikler')}</Text>
        {degisiklikler.isPending ? <ActivityIndicator color={renk.ikincil} /> : null}
        {degisiklikler.data?.length === 0 ? <Text style={s.not}>{t('davet.grup.degisiklikYok')}</Text> : null}
        {(degisiklikler.data ?? []).slice(0, 5).map((d) => (
          <View key={d.id} style={s.degisiklik}>
            <Avatar ad={uyeAdi(d.user_id)} url={uyeler.find((u) => u.user_id === d.user_id)?.photo_url} boyut={28} arkaPlan={renk.soluk} />
            <View style={{ flex: 1 }}>
              <Text style={s.degisiklikMetin} numberOfLines={2}>
                <Text style={s.kim}>{uyeAdi(d.user_id)}</Text> {degisiklikMetni(d, mekanAdi)}
              </Text>
              <Text style={s.zaman}>{zamanMetni(d.at)}</Text>
            </View>
          </View>
        ))}
      </View>

      {ayrilabilir ? (
        <Pressable accessibilityRole="button" onPress={seyahattenAyril} disabled={ayril.isPending} style={s.ayril}>
          <Text style={s.ayrilMetin}>{t('davet.grup.ayril')}</Text>
        </Pressable>
      ) : null}
      {bildirim ? <Text style={s.bildirim}>{bildirim}</Text> : null}
      </AltPencere>
      <ProfilOnayi acik={paylasim.onayAcik} onKapat={paylasim.onayKapat} onGonder={paylasim.onayla} />
    </>
  );
}

const s = StyleSheet.create({
  baslikSatiri: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  baslik: { fontFamily: yazi.baslik, fontSize: olcek.kart, letterSpacing: -0.6, color: renk.metin },
  baslikAlt: { flexShrink: 1, fontFamily: yazi.kalin, fontSize: 13, color: renk.ikincil },
  uye: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  uyeAd: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  uyeSen: { fontFamily: yazi.yari, color: renk.ikincil },
  uyeAlt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  davetKart: { padding: 14, borderRadius: 18, backgroundColor: renk.ana, gap: 10 },
  davetBaslik: { fontFamily: yazi.baslik, fontSize: 17, color: renk.zemin },
  davetAlt: { fontFamily: yazi.normal, fontSize: 13, color: renk.anaAcik },
  bolum: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  not: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  degisiklik: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: kose.dugme, backgroundColor: renk.yuzey },
  degisiklikMetin: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.metin },
  kim: { fontFamily: yazi.kalin },
  zaman: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ayril: { alignSelf: 'center', minHeight: minDokunma, justifyContent: 'center', paddingHorizontal: 12 },
  ayrilMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.uyari },
  bildirim: { fontFamily: yazi.kalin, fontSize: 12, textAlign: 'center', color: renk.ikincil },
});
