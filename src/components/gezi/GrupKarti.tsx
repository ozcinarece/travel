// #181 KK12 (kanvas 23b): gezi modunda grup kartı — konum paylaşan üyelerin son "vardı" durumu (stops.arrived_*, mevcut veri);
// son 12 saatte varışı olmayan üye için "konumunu paylaşmıyor". "Seyahattekiler ›" pencereyi açar.
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { yonelmeEki } from '@/features/davet/katilim';
import type { GrupDurumu } from '@/features/gezi/geziOzeti';
import { zamanMetni } from '@/features/program/degisiklikMetni';
import { t } from '@/i18n';
import { renk, yazi, yuzRenkleri } from '@/theme';

import { BolumBasligi, Kart } from './GeziParcalari';

type Props = {
  durumlar: GrupDurumu[];
  /** Üyenin uygulamadaki sırası (yüz rengi kapaktaki yığınla aynı). */
  sira: (userId: string) => number;
  mekanAdi: (mekanId: string) => string;
  an: Date;
  onSeyahattekiler: () => void;
};

export function GrupKarti({ durumlar, sira, mekanAdi, an, onSeyahattekiler }: Props) {
  if (durumlar.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      <BolumBasligi baslik={t('geziSayfasi.grup')} baglanti={t('geziSayfasi.seyahattekiler')} onBaglanti={onSeyahattekiler} />
      <Kart stil={{ padding: 12 }}>
        {durumlar.map(({ uye, varis }) => (
          <View key={uye.user_id} style={s.satir}>
            <Avatar ad={uye.display_name} url={uye.photo_url} boyut={36} arkaPlan={yuzRenkleri[sira(uye.user_id) % yuzRenkleri.length]} />
            <View style={{ flex: 1 }}>
              <Text style={s.metin}>
                <Text style={s.ad}>{`${uye.display_name} `}</Text>
                {varis ? (
                  <Text style={s.vardi}>{t('geziSayfasi.vardi', { yer: yonelmeEki(mekanAdi(varis.mekanId)) })}</Text>
                ) : (
                  <Text style={{ color: renk.ikincil }}>{t('geziSayfasi.konumYok')}</Text>
                )}
              </Text>
              {varis ? <Text style={s.zaman}>{zamanMetni(varis.at, an.getTime())}</Text> : null}
            </View>
          </View>
        ))}
      </Kart>
    </View>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metin: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.metin },
  ad: { fontFamily: yazi.ekstra },
  vardi: { fontFamily: yazi.ekstra, color: renk.basariMetin },
  zaman: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
});
