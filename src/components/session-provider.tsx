'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, jsonRequest } from '@/lib/client-api';
import type { User } from '@/types/api';

type Session = {
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<User | null>;
  acceptUser: (user: User | null) => void;
  logout: () => Promise<void>;
};
const Context = createContext<Session | null>(null);
const sessionSignalKey = 'runway-session-signal';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentUser = useRef<User | null>(null);
  const generation = useRef(0);
  const resolved = useRef(false);
  const refreshing = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);

  const broadcast = useCallback(() => {
    // Signals contain no identity, email, credentials, or session token.
    const nonce = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}:${Math.random()}`;
    try { channel.current?.postMessage({ type: 'session-changed', nonce }); } catch { /* Other transports remain available. */ }
    try { window.localStorage.setItem(sessionSignalKey, nonce); } catch { /* Restricted storage is supported. */ }
    window.dispatchEvent(new Event('runway-session-change'));
  }, []);

  const refresh = useCallback(async () => {
    const version = ++generation.current;
    refreshing.current = true;
    try {
      const data = await api<{ user: User | null }>('/api/auth/me');
      if (version === generation.current) {
        currentUser.current = data.user;
        setUser(data.user);
        setError('');
      }
      return data.user;
    } catch (problem) {
      if (version === generation.current) setError(problem instanceof Error ? problem.message : 'Не удалось проверить вход.');
      return null;
    } finally {
      if (version === generation.current) {
        refreshing.current = false;
        resolved.current = true;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const version = ++generation.current;
    refreshing.current = true;
    api<{ user: User | null }>('/api/auth/me', { signal: controller.signal })
      .then(data => {
        if (version === generation.current) {
          currentUser.current = data.user;
          setUser(data.user);
          setError('');
        }
      })
      .catch(problem => {
        if (!controller.signal.aborted && version === generation.current) setError(problem instanceof Error ? problem.message : 'Не удалось проверить вход.');
      })
      .finally(() => {
        if (!controller.signal.aborted && version === generation.current) {
          refreshing.current = false;
          resolved.current = true;
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let scheduled: ReturnType<typeof setTimeout> | null = null;

    function receiveChange() {
      if (scheduled !== null) return;
      // A change may arrive through both BroadcastChannel and the storage event.
      scheduled = setTimeout(() => {
        scheduled = null;
        if (!controller.signal.aborted) void refresh();
      }, 30);
    }
    function onStorage(event: StorageEvent) {
      if (event.key === sessionSignalKey && event.newValue !== event.oldValue) receiveChange();
    }
    async function checkOnFocus() {
      if (!resolved.current || refreshing.current || document.visibilityState === 'hidden') return;
      const version = generation.current;
      try {
        const data = await api<{ user: User | null }>('/api/auth/me', { signal: controller.signal });
        // Expiration alone must not unmount a filled application. Its inline re-login preserves files.
        if (!controller.signal.aborted && version === generation.current && !refreshing.current && data.user
          && JSON.stringify(data.user) !== JSON.stringify(currentUser.current)) {
          generation.current++;
          currentUser.current = data.user;
          setUser(data.user);
          setError('');
        }
      } catch { /* Explicit actions display connection and authorization errors. */ }
    }

    try {
      channel.current = new BroadcastChannel('runway-session');
      channel.current.onmessage = event => {
        if (event.data?.type === 'session-changed') receiveChange();
      };
    } catch { channel.current = null; }
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', checkOnFocus);
    document.addEventListener('visibilitychange', checkOnFocus);
    return () => {
      controller.abort();
      if (scheduled !== null) clearTimeout(scheduled);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', checkOnFocus);
      document.removeEventListener('visibilitychange', checkOnFocus);
      channel.current?.close();
      channel.current = null;
    };
  }, [refresh]);

  const acceptUser = useCallback((next: User | null) => {
    generation.current++;
    currentUser.current = next;
    refreshing.current = false;
    resolved.current = true;
    setUser(next);
    setLoading(false);
    setError('');
    broadcast();
  }, [broadcast]);

  const logout = useCallback(async () => {
    await jsonRequest('/api/auth/logout', 'POST', {});
    acceptUser(null);
  }, [acceptUser]);

  return <Context.Provider value={{ user, loading, error, refresh, acceptUser, logout }}>{children}</Context.Provider>;
}

export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider is required.');
  return value;
}
