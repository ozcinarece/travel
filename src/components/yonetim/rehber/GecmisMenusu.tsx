import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { View } from 'react-native';

import { saatMetni } from '@/features/yonetim/gezi';
import { ty } from '@/features/yonetim/metin';
import { useRehberSurumleri, type RehberSurumu } from '@/features/yonetim/sehirSorgulari';
import { AYLAR_KISA } from '@/lib/takvim';
import { yazi } from '@/theme';

import { Hap } from '../Hap';
import { yRenk } from '../tema';

/**
 * #156 KK9 "Geçmiş": son 20 taslak sürümü (tarih · yazan · neden · bölüm sayısı) ve "Bu sürüme dön". Kanvasta yalnız düğme
 * var; açılır liste ··· menüsünün ölçüleriyle (14 köşe, 38 px satırlar).
 */
export function GecmisMenusu({ sehirId, onDon }: { sehirId: string; onDon: (s: RehberSurumu) => void }) {
  const [acik, setAcik] = useState(false);
  const surumler = useRehberSurumleri(sehirId, acik);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!acik) return;
    const disari = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAcik(false);
    const t = setTimeout(() => document.addEventListener('mousedown', disari));
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', disari);
    };
  }, [acik]);
  return (
    <View style={{ position: 'relative', zIndex: 20 }}>
      <Hap baslik={ty('rehberEditor.gecmis.dugme')} onPress={() => setAcik((a) => !a)} />
      {acik ? (
        <div ref={ref} role="menu" style={c.menu}>
          <div style={c.baslik}>{ty('rehberEditor.gecmis.baslik')}</div>
          {surumler.data?.length === 0 ? <div style={c.bos}>{ty('rehberEditor.gecmis.bos')}</div> : null}
          {(surumler.data ?? []).map((s) => {
            const t = new Date(s.created_at);
            return (
              <div key={s.id} style={c.satir}>
                <span style={c.metin}>
                  <span style={c.ana}>{ty('rehberEditor.gecmis.satir', { tarih: `${t.getDate()} ${AYLAR_KISA[t.getMonth()]} ${saatMetni(t)}`, yazan: s.yazan ?? '—' })}</span>
                  <span style={c.alt}>{`${ty(`rehberEditor.gecmis.neden.${s.neden}`)} · ${ty('rehberEditor.gecmis.bolum', { n: s.bolumler.length })}`}</span>
                </span>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAcik(false);
                    onDon(s);
                  }}
                  style={c.don}>
                  {ty('rehberEditor.gecmis.don')}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </View>
  );
}

const c: Record<string, CSSProperties> = {
  menu: { position: 'absolute', right: 0, top: 46, zIndex: 30, width: 340, maxHeight: 420, overflowY: 'auto', padding: 6, borderRadius: 14, background: yRenk.zemin, boxShadow: '0 16px 40px rgba(14,20,48,0.18)', display: 'flex', flexDirection: 'column', gap: 2 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 11, letterSpacing: '0.06em', color: yRenk.ikincil, padding: '6px 10px' },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: yRenk.ikincil, padding: '6px 10px' },
  satir: { minHeight: 38, padding: '6px 10px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 10 },
  metin: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  ana: { fontFamily: yazi.kalin, fontSize: 13, color: yRenk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: yRenk.ikincil },
  don: { height: 30, padding: '0 10px', border: `1.5px solid ${yRenk.ayrac}`, borderRadius: 9, background: yRenk.zemin, color: yRenk.ana, fontFamily: yazi.ekstra, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' },
};
