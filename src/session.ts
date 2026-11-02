import { useCallback, useEffect, useState } from 'react';
import { forgetAccessToken } from './drive';

export type Session = { state: 'loading' } | { state: 'disabled' } | { state: 'signedOut' } | { state: 'signedIn'; email: string };

export const login = () => {
  window.location.href = '/api/auth/login';
};

export function useSession() {
  const [session, setSession] = useState<Session>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? (res.json() as Promise<{ enabled: boolean; email: string | null }>) : Promise.reject()))
      .then(({ enabled, email }) => {
        if (cancelled) return;
        setSession(!enabled ? { state: 'disabled' } : email ? { state: 'signedIn', email } : { state: 'signedOut' });
      })
      .catch(() => !cancelled && setSession({ state: 'disabled' }));
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    forgetAccessToken();
    setSession({ state: 'signedOut' });
  };

  const expire = useCallback(() => {
    forgetAccessToken();
    setSession({ state: 'signedOut' });
  }, []);

  return { session, signOut, expire };
}
