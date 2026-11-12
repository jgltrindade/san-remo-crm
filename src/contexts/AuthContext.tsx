import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase/client';
import { AppError } from '@/services/supabase/errors';
import { getProfile } from '@/services/profiles/profiles.service';
import type { Profile } from '@/types/domain';

type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'no-profile';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const loadProfile = useCallback(async (next: Session | null) => {
    setSession(next);
    if (!next) {
      setProfile(null);
      setStatus('signed-out');
      return;
    }
    try {
      const p = await getProfile(next.user.id);
      setProfile(p);
      setStatus(p ? 'signed-in' : 'no-profile');
    } catch {
      setProfile(null);
      setStatus('no-profile');
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) void loadProfile(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      // TOKEN_REFRESHED não muda o usuário: evita recarregar o perfil à toa.
      if (event === 'TOKEN_REFRESHED') {
        setSession(next);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Fora do callback, como recomenda o supabase-js (evita deadlock de lock interno).
        setTimeout(() => void loadProfile(next), 0);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      const invalid = error.message.toLowerCase().includes('invalid');
      throw new AppError(invalid ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Tente novamente.');
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, profile, signIn, signOut }),
    [status, session, profile, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
