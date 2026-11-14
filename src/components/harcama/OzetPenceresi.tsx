// #183 KK1 "Özet": kategori dağılımı (basit liste + oran çubuğu) ve kim ne ödedi.
import { StyleSheet, Text, View } from 'react-native';

import { AltPencere } from '@/components/ui/AltPencere';
import { Avatar } from '@/components/ui/Avatar';
import { kategoriOzeti, paraMetni, type Harcama } from '@/features/harcama/hesap';
import type { Kisiler } from '@/features/harcama/metin';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

import { KategoriKutusu } from './HarcamaSatiri';
import { KATEGORI_GORUNUMU } from './kategori';

export function OzetPenceresi({ acik, onKapat, harcamalar, k, benId }: { acik: boolean; onKapat: () => void; harcamalar: Harcama[]; k: Kisiler; benId: string | null }) {
  const toplam = harcamalar.reduce((a, h) => a + h.tl_kurus, 0);
  const kategoriler = kategoriOzeti(harcamalar);
  const odeyenler = new Map<string, number>();
  for (const h of harcamalar) odeyenler.set(h.odeyen_id, (odeyenler.get(h.odeyen_id) ?? 0) + h.tl_kurus);
  return (
    <AltPencere acik={acik} onKapat={onKapat} kapatEtiketi={t('harcama.form.kapat')} kaydirilir>
      <Text accessibilityRole="header" style={s.baslik}>
        {t('harcama.ozet.baslik')}
      </Text>
      <Text style={s.alt}>{t('harcama.ozet.alt', { tutar: paraMetni(toplam), n: harcamalar.length })}</Text>
      <View style={{ gap: 12 }}>
        {kategoriler.map((x) => {
          const oran = toplam ? x.toplam / toplam : 0;
          return (
            <View key={x.kategori} style={s.satir}>
              <KategoriKutusu kategori={x.kategori} boyut={36} />
              <View style={{ flex: 1, gap: 5 }}>
                <View style={s.ust}>
                  <Text style={s.ad}>{t(`harcama.kategori.${x.kategori}`)}</Text>
                  <Text style={s.tutar}>
                    {paraMetni(x.toplam)} <Text style={s.yuzde}>· %{Math.round(oran * 100)}</Text>
                  </Text>
                </View>
                <View style={s.cubuk}>
                  <View style={[s.dolu, { width: `${Math.max(2, oran * 100)}%`, backgroundColor: KATEGORI_GORUNUMU[x.kategori].renk }]} />
                </View>
              </View>
            </View>
          );
        })}
      </View>
      {odeyenler.size > 0 ? (
        <View style={{ gap: 10 }}>
          <Text style={s.bolum}>{t('harcama.ozet.kimOdedi')}</Text>
          {[...odeyenler.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id, tutar]) => (
              <View key={id} style={s.satir}>
                <Avatar ad={k.ad(id)} url={k.foto(id)} boyut={30} arkaPlan={k.renk(id)} />
                <Text style={[s.ad, { flex: 1 }]} numberOfLines={1}>
                  {id === benId ? t('harcama.form.sen') : k.ad(id)}
                </Text>
                <Text style={s.tutar}>{paraMetni(tutar)}</Text>
              </View>
            ))}
        </View>
      ) : null}
    </AltPencere>
  );
}

const s = StyleSheet.create({
  baslik: { fontFamily: yazi.baslik, fontSize: 22, letterSpacing: -0.5, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, marginTop: -8 },
  bolum: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.5, color: renk.ikincil, textTransform: 'uppercase' },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ust: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  ad: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  tutar: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  yuzde: { fontFamily: yazi.yari, fontSize: 12, color: renk.ikincil },
  cubuk: { height: 6, borderRadius: 3, backgroundColor: renk.yuzey, overflow: 'hidden' },
  dolu: { height: 6, borderRadius: 3 },
});
