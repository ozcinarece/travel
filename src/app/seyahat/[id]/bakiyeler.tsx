// #183 KK6 (kanvas 25c): Bakiyeler — kişi başına net durum kartları; "Kim kime" sadeleştirilmiş (en az transfer); alan kişi
// "Ödendi işaretle", veren kişi "Ödedim" → ödeşme kaydı; "Ödeşmeler" geçmişi (iki taraf geri alabilir). KK7: borçluya alacaklının
// IBAN'ı yazılır; IBAN profil ayarlarından eklenir. Hatırlatma şimdilik uygulama içi (yerel bildirim yeni build ister).
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeriHapi } from '@/components/harita/HaritaEkrani';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { ibanBicimle, netBakiyeler, paraMetni, sadelestir, type Odesme, type Transfer } from '@/features/harcama/hesap';
import { kisiKisa, kisiler as kisiKaynagi } from '@/features/harcama/metin';
import { useHarcamalar, useIbanlar, useOdesmeEkle, useOdesmeler, useOdesmeSil } from '@/features/harcama/sorgular';
import { useUyeler } from '@/features/mekanlar/sorgular';
import { zamanMetni } from '@/features/program/degisiklikMetni';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { t } from '@/i18n';
import { onayIste } from '@/lib/onay';
import { useOturum } from '@/lib/oturum';
import { renk, yazi } from '@/theme';

const BEYAZ_14 = 'rgba(255,255,255,0.14)';

export default function BakiyelerEkrani() {
  const id = useSeyahatId();
  const uyeler = useUyeler(id);
  const harcamalar = useHarcamalar(id);
  const odesmeler = useOdesmeler(id);
  const { session } = useOturum();
  const benId = session?.user.id ?? null;
  const kenar = useSafeAreaInsets();
  const odesmeEkle = useOdesmeEkle(id ?? '');
  const odesmeSil = useOdesmeSil(id ?? '');
  const [bildirim, setBildirim] = useState<string | null>(null);

  const k = useMemo(() => kisiKaynagi(uyeler.data ?? []), [uyeler.data]);
  const net = useMemo(() => netBakiyeler(harcamalar.data ?? [], odesmeler.data ?? []), [harcamalar.data, odesmeler.data]);
  const transferler = useMemo(() => sadelestir(net), [net]);
  // Kişi kartları: üyeler + bakiyesi kalan ayrılmış kişiler; ben önde.
  const kisiler = useMemo(() => {
    const ids = (uyeler.data ?? []).map((u) => u.user_id);
    for (const [kid, n] of net) if (n !== 0 && !ids.includes(kid)) ids.push(kid);
    return ids.sort((a, b) => (a === benId ? -1 : b === benId ? 1 : 0));
  }, [uyeler.data, net, benId]);
  const alacaklilar = transferler.filter((x) => x.kimden === benId).map((x) => x.kime);
  const ibanlar = useIbanlar([...alacaklilar, ...(benId ? [benId] : [])]);
  const benimIban = benId ? ibanlar.data?.get(benId) : undefined;

  if (!id || !uyeler.data || !harcamalar.data || !odesmeler.data) {
    return <SeyahatYukleme sorgular={[uyeler, harcamalar, odesmeler]} kimlikYok={!id} />;
  }

  const geri = () => (router.canGoBack() ? router.back() : router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/harcama', params: { id } }));
  const bildir = (m: string) => {
    setBildirim(m);
    setTimeout(() => setBildirim(null), 2500);
  };
  const odendi = (x: Transfer) => {
    odesmeEkle.mutate({ kimden: x.kimden, kime: x.kime, tl_kurus: x.tutar }, { onSuccess: () => bildir(t('harcama.bakiye.kaydedildi')), onError: () => bildir(t('harcama.form.kaydedilemedi')) });
  };
  const geriAl = async (o: Odesme) => {
    const onay = await onayIste(t('harcama.bakiye.geriAlBaslik'), t('harcama.bakiye.geriAlMetin'), t('harcama.bakiye.geriAl'), t('genel.vazgec'));
    if (onay) odesmeSil.mutate(o.id, { onError: () => bildir(t('harcama.form.kaydedilemedi')) });
  };

  return (
    <View style={s.ekran}>
      <ScrollView contentContainerStyle={[s.icerik, { paddingTop: kenar.top + 12, paddingBottom: kenar.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={s.ust}>
          <View style={{ flexShrink: 1 }}>
            <GeriHapi baslik={t('harcama.baslik')} onPress={geri} duz />
          </View>
          <View style={s.yuzler}>
            {(uyeler.data ?? []).slice(0, 4).map((u, i) => (
              <View key={u.user_id} style={[s.yuz, i > 0 && { marginLeft: -8 }]}>
                <Avatar ad={u.display_name} url={u.photo_url} boyut={28} arkaPlan={k.renk(u.user_id)} />
              </View>
            ))}
          </View>
        </View>
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={s.baslik}>
            {t('harcama.bakiyeler')}
          </Text>
          <Text style={s.altBaslik}>{t('harcama.bakiye.alt')}</Text>
        </View>

        <View style={s.kartlar}>
          {kisiler.map((kid) => {
            const n = net.get(kid) ?? 0;
            return (
              <View key={kid} style={s.kisiKart}>
                <Avatar ad={k.ad(kid)} url={k.foto(kid)} boyut={32} arkaPlan={k.renk(kid)} />
                <Text style={s.kisiAd} numberOfLines={1}>
                  {kid === benId ? t('harcama.form.sen') : k.ad(kid)}
                </Text>
                <Text style={[s.kisiNet, n > 0 && { color: renk.basariMetin }, n < 0 && { color: renk.uyari }]}>{paraMetni(n, 'TRY', true)}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={s.bolum}>{t('harcama.bakiye.kimKime')}</Text>
          {transferler.length === 0 ? (
            <View style={s.satir}>
              <Ikon ad="tik" boyut={18} renk={renk.basariMetin} kalinlik={2.4} />
              <Text style={s.satirMetin}>{harcamalar.data.length ? t('harcama.bakiye.herkesOdesti') : t('harcama.bakiye.henuzYok')}</Text>
            </View>
          ) : (
            transferler.map((x) => {
              const alan = x.kime === benId;
              const veren = x.kimden === benId;
              const iban = veren ? ibanlar.data?.get(x.kime) : undefined;
              return (
                <View key={`${x.kimden}>${x.kime}`} style={s.satir}>
                  <Avatar ad={k.ad(veren ? x.kime : x.kimden)} url={k.foto(veren ? x.kime : x.kimden)} boyut={36} arkaPlan={k.renk(veren ? x.kime : x.kimden)} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.satirMetin} numberOfLines={1}>
                      <Text style={s.kalin}>{kisiKisa(x.kimden, benId, k, 'yalin')}</Text> → <Text style={s.kalin}>{kisiKisa(x.kime, benId, k, 'yonelme')}</Text>
                    </Text>
                    <Text style={s.satirAlt}>{paraMetni(x.tutar)}</Text>
                    {iban ? (
                      <Text style={s.iban} selectable>
                        {ibanBicimle(iban)}
                      </Text>
                    ) : null}
                  </View>
                  {alan || veren ? (
                    <Pressable accessibilityRole="button" disabled={odesmeEkle.isPending} onPress={() => odendi(x)} style={({ pressed }) => [s.buz, pressed && { opacity: 0.8 }]}>
                      <Ikon ad="tik" boyut={14} renk={renk.ana} kalinlik={2.6} />
                      <Text style={s.buzMetin}>{alan ? t('harcama.bakiye.odendiIsaretle') : t('harcama.bakiye.odedim')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {odesmeler.data.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={s.bolum}>{t('harcama.bakiye.odesmeler')}</Text>
            {odesmeler.data.map((o) => {
              const benim = o.kimden === benId || o.kime === benId;
              return (
                <View key={o.id} style={[s.satir, { backgroundColor: renk.basariZemin }]}>
                  <Ikon ad="tik" boyut={18} renk={renk.basariMetin} kalinlik={2.4} />
                  <Text style={[s.satirMetin, { flex: 1, fontSize: 13 }]}>
                    <Text style={s.kalin}>
                      {kisiKisa(o.kimden, benId, k, 'yalin')} → {kisiKisa(o.kime, benId, k, 'yonelme')}
                    </Text>{' '}
                    {paraMetni(o.tl_kurus)} <Text style={{ color: renk.ikincil }}>· {zamanMetni(o.created_at)} · {t('harcama.bakiye.odendi')}</Text>
                  </Text>
                  {benim ? (
                    <Pressable accessibilityRole="button" onPress={() => void geriAl(o)} hitSlop={8}>
                      <Text style={s.geriAl}>{t('harcama.bakiye.geriAl')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={s.gece}>
          <Text style={s.geceBaslik}>{t('harcama.bakiye.hatirlatmaBaslik')}</Text>
          <Text style={s.geceMetin}>{t('harcama.bakiye.hatirlatmaMetin')}</Text>
          {benimIban ? <Text style={[s.geceMetin, { color: renk.zemin }]}>{t('harcama.bakiye.ibaninVar', { iban: ibanBicimle(benimIban) })}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/profil-duzenle')} style={({ pressed }) => [s.geceDugme, { backgroundColor: benimIban ? BEYAZ_14 : renk.vurgu }, pressed && { opacity: 0.85 }]}>
              <Text style={[s.geceDugmeMetin, { color: benimIban ? renk.zemin : renk.metin }]}>{benimIban ? t('harcama.bakiye.ibanDegistir') : t('harcama.bakiye.ibanEkle')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      {bildirim ? (
        <View style={[s.bildirim, { bottom: kenar.bottom + 16 }]} pointerEvents="none">
          <Text style={s.bildirimMetin}>{bildirim}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.haritaZemin },
  icerik: { paddingHorizontal: 20, gap: 16 },
  ust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  yuzler: { flexDirection: 'row' },
  yuz: { borderRadius: 11, borderWidth: 2, borderColor: renk.zemin },
  baslik: { fontFamily: yazi.baslik, fontSize: 28, letterSpacing: -0.84, color: renk.metin },
  altBaslik: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  kartlar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kisiKart: { flexGrow: 1, flexBasis: '30%', padding: 12, borderRadius: 16, backgroundColor: renk.zemin, gap: 6, alignItems: 'flex-start' },
  kisiAd: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  kisiNet: { fontFamily: yazi.baslik, fontSize: 18, letterSpacing: -0.36, color: renk.metin },
  bolum: { fontFamily: yazi.baslik, fontSize: 18, letterSpacing: -0.36, color: renk.metin },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: renk.zemin },
  satirMetin: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 18, color: renk.metin },
  satirAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  kalin: { fontFamily: yazi.ekstra },
  iban: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin, marginTop: 2 },
  buz: { height: 34, paddingHorizontal: 12, borderRadius: 12, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  buzMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  geriAl: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
  gece: { padding: 14, borderRadius: 20, backgroundColor: renk.ana, gap: 8 },
  geceBaslik: { fontFamily: yazi.baslik, fontSize: 16, color: renk.zemin },
  geceMetin: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.anaAcik },
  geceDugme: { height: 36, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  geceDugmeMetin: { fontFamily: yazi.ekstra, fontSize: 14 },
  bildirim: { position: 'absolute', left: 20, right: 20, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: renk.metin },
  bildirimMetin: { fontFamily: yazi.yari, fontSize: 14, color: renk.zemin, textAlign: 'center' },
});
