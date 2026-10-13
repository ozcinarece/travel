// #137 KK6 (kanvas 16 · Grup): üstteki yüzlere dokununca açılan pencere — katılanlar (+ kaç mekan ekledi, #140 gezi
// sırasında "vardı: {mekan} · 12 dk önce"), "Davet linkini gönder" (profil onayıyla), Son değişiklikler, "Seyahatten ayrıl"
// (üye) ya da #174 "Seyahati sil" (sahip; aynı kırmızı metin düğmesi).
// #141 KK6: Son değişiklikler aynı işlemdeki alanları tek cümlede toplar ve "Geri al" düğmesi taşır (degisikligi_geri_al).
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AltPencere } from '@/components/ui/AltPencere';
import { Avatar } from '@/components/ui/Avatar';
import { Buton } from '@/components/ui/Buton';
import { useDavetPaylas } from '@/features/davet/paylas';
import { useSeyahattenAyril } from '@/features/davet/sorgular';
import { useDuraklar, useGunler } from '@/features/gunler/sorgular';
import { useDegisikligiGeriAl } from '@/features/listem/sorgular';
import { degisiklikGruplari, geriAlinabilir, grupMetni, zamanMetni } from '@/features/program/degisiklikMetni';
import { useDegisiklikler } from '@/features/program/sorgular';
import { useSimdi } from '@/features/program/useProgram';
import { silmeMetni } from '@/features/seyahatler/silme';
import { useSeyahatSil } from '@/features/seyahatler/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { useHafifYerler } from '@/features/yerler/api';
import { t } from '@/i18n';
import { onayIste } from '@/lib/onay';
import { useOturum } from '@/lib/oturum';
import type { Mekan, Seyahat, Uye } from '@/lib/tipler';
import { kose, minDokunma, olcek, renk, yazi, yuzRenkleri } from '@/theme';

import { ProfilOnayi } from './ProfilOnayi';

type Props = { acik: boolean; onKapat: () => void; seyahat: Seyahat; uyeler: Uye[]; mekanlar: Mekan[] };


export function GrupPenceresi({ acik, onKapat, seyahat, uyeler, mekanlar }: Props) {
  const { session } = useOturum();
  const degisiklikler = useDegisiklikler(seyahat.id, acik);
  const duraklar = useDuraklar(acik ? seyahat.id : undefined);
  const gunler = useGunler(acik ? seyahat.id : undefined);
  const geriAl = useDegisikligiGeriAl(seyahat.id);
  const an = useSimdi(acik);
  const yerler = useHafifYerler(acik ? mekanlar.map((m) => m.place_id) : []);
  const ayril = useSeyahattenAyril();
  const sil = useSeyahatSil();
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
  // #140 KK9: gezi sırasında son varış (koordinat değil, yalnız durak + an); gezi bitince sunucu siler.
  const sonVaris = (uid: string) => {
    const d = (duraklar.data ?? []).filter((x) => x.arrived_by === uid && x.arrived_at).sort((a, b) => (a.arrived_at! < b.arrived_at! ? 1 : -1))[0];
    if (!d || an.getTime() - Date.parse(d.arrived_at!) > 12 * 60 * 60 * 1000) return null;
    return t('davet.grup.vardi', { ad: mekanAdi(d.place_ref), zaman: zamanMetni(d.arrived_at!, an.getTime()) });
  };
  const gruplar = degisiklikGruplari(degisiklikler.data ?? []).slice(0, 5);
  const metinKaynagi = {
    mekanAdi,
    gunNo: (dayId: string) => gunler.data?.find((g) => g.id === dayId)?.index ?? null,
    durakMekani: (durakId: string) => duraklar.data?.find((d) => d.id === durakId)?.place_ref ?? null,
  };
  // Aynı satırda daha yeni bir değişiklik varsa eskisi geri alınmaz (sonuncusu geri alınır).
  const enYeni = new Set<string>();
  const sonMu = (entity: string, id: string) => {
    const k = `${entity}:${id}`;
    if (enYeni.has(k)) return false;
    enYeni.add(k);
    return true;
  };
  const geriAlBas = async (id: number) => {
    try {
      await geriAl.mutateAsync(id);
    } catch {
      setBildirim(t('davet.grup.geriAlHata'));
      setTimeout(() => setBildirim(null), 2500);
    }
  };
  const benUye = uyeler.find((u) => benim(u.user_id));
  const ayrilabilir = !!benUye && benUye.role !== 'owner';
  const silinebilir = benUye?.role === 'owner';

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

  // #174 KK2–KK4, KK9: onay (tek başına / başkaları da var), silince Seyahatler'e dönüş + "Seyahat silindi"; hata pencerede.
  const seyahatiSil = async () => {
    const onay = await onayIste(t('seyahatler.silOnay'), silmeMetni(uyeler.length), t('seyahatler.silEvet'), t('genel.vazgec'));
    if (!onay) return;
    try {
      await sil.mutateAsync(seyahat.id);
      onKapat();
      router.replace({ pathname: '/(tabs)/seyahatler', params: { bildirim: 'silindi' } });
    } catch {
      setBildirim(t('seyahatler.silHata'));
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
          const varis = sonVaris(u.user_id);
          return (
            <View key={u.user_id} style={s.uye}>
              <Avatar ad={u.display_name} url={u.photo_url} boyut={44} arkaPlan={yuzRenkleri[i % yuzRenkleri.length]} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={s.uyeAd}>
                  {u.display_name} {benim(u.user_id) ? <Text style={s.uyeSen}>{t('davet.grup.sen')}</Text> : null}
                </Text>
                {parcalar.length || varis ? (
                  <Text style={s.uyeAlt}>
                    {parcalar.join(' · ')}
                    {varis ? (
                      <Text style={s.varis}>
                        {parcalar.length ? ' · ' : ''}
                        {varis}
                      </Text>
                    ) : null}
                  </Text>
                ) : null}
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
        {gruplar.map((g) => {
          const geriAlinir = sonMu(g.entity, g.entity_id) && geriAlinabilir(g);
          return (
            <View key={g.id} style={s.degisiklik}>
              <Avatar ad={uyeAdi(g.kim)} url={uyeler.find((u) => u.user_id === g.kim)?.photo_url} boyut={28} arkaPlan={renk.anaAcik} />
              <View style={{ flex: 1 }}>
                <Text style={s.degisiklikMetin} numberOfLines={2}>
                  <Text style={s.kim}>{uyeAdi(g.kim)}</Text> {grupMetni(g, metinKaynagi)}
                </Text>
                <Text style={s.zaman}>{zamanMetni(g.at)}</Text>
              </View>
              {geriAlinir ? (
                <Pressable accessibilityRole="button" disabled={geriAl.isPending} onPress={() => geriAlBas(g.id)} style={({ pressed }) => [s.geriAl, pressed && { opacity: 0.8 }]}>
                  <Text style={s.geriAlMetin}>{t('davet.grup.geriAl')}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      {ayrilabilir ? (
        <Pressable accessibilityRole="button" onPress={seyahattenAyril} disabled={ayril.isPending} style={s.ayril}>
          <Text style={s.ayrilMetin}>{t('davet.grup.ayril')}</Text>
        </Pressable>
      ) : null}
      {silinebilir ? (
        <Pressable accessibilityRole="button" onPress={seyahatiSil} disabled={sil.isPending} style={s.ayril}>
          <Text style={s.ayrilMetin}>{t('davet.grup.sil')}</Text>
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
  degisiklik: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: kose.dugme, backgroundColor: renk.yuzey },
  geriAl: { height: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: renk.zemin, justifyContent: 'center' },
  geriAlMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
  varis: { fontFamily: yazi.ekstra, color: renk.basariMetin },
  degisiklikMetin: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.metin },
  kim: { fontFamily: yazi.kalin },
  zaman: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ayril: { alignSelf: 'center', minHeight: minDokunma, justifyContent: 'center', paddingHorizontal: 12 },
  ayrilMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.uyari },
  bildirim: { fontFamily: yazi.kalin, fontSize: 12, textAlign: 'center', color: renk.ikincil },
});
