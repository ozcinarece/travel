import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

type Oturum = {
  session: Session | null;
  /** İlk oturum okuması bitti mi (açılış ekranı bunu bekler). */
  hazir: boolean;
  /** Hesaplı kullanıcı: oturum var ve anonim (misafir) değil. */
  hesapli: boolean;
};

const Baglam = createContext<Oturum>({ session: null, hazir: false, hesapli: false });

export function OturumSaglayici({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [hazir, setHazir] = useState(false);
  const oncekiKullanici = useRef<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      oncekiKullanici.current = data.session?.user.id ?? null;
      setSession(data.session);
      setHazir(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_olay, yeni) => {
      const kullanici = yeni?.user.id ?? null;
      // Başka bir kullanıcıya geçildiyse ya da çıkış yapıldıysa önbellek sıfırlanır.
      if (kullanici !== oncekiKullanici.current) qc.clear();
      oncekiKullanici.current = kullanici;
      setSession(yeni);
    });
    return () => subscription.unsubscribe();
  }, [qc]);

  const hesapli = !!session && !session.user.is_anonymous;
  return <Baglam.Provider value={{ session, hazir, hesapli }}>{children}</Baglam.Provider>;
}

export function useOturum(): Oturum {
  return useContext(Baglam);
}
