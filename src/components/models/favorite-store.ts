"use client";

import { useEffect, useSyncExternalStore } from "react";
import { models } from "@/data/models";
import { api } from "@/lib/client-api";
import { useSession } from "@/components/session-provider";

type FavoriteState = {
  ids: string[];
  loading: boolean;
  pending: boolean;
  error: string;
  notice: string;
};
type FavoriteStore = {
  key: string;
  userId: string | null;
  state: FavoriteState;
  confirmed: string[];
  revision: number;
  loaded: boolean;
  request: Promise<boolean> | null;
  saving: Promise<void> | null;
  controller: AbortController | null;
  listeners: Set<() => void>;
  subscribe: (callback: () => void) => () => void;
};

const initialState: FavoriteState = { ids: [], loading: true, pending: false, error: "", notice: "" };
const stores = new Map<string, FavoriteStore>();
const validIds = new Set(models.map((model) => model.id));
const changeEvent = "runway-favorites-change";
let activeKey: string | null = null;

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "Сервер не ответил вовремя. Повторите попытку.";
  }
  return error instanceof Error ? error.message : fallback;
}

function sanitize(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && validIds.has(item)))];
}

function storageKey(store: FavoriteStore) {
  return store.userId ? `runway-favorites:${store.userId}` : "runway-favorites";
}

function update(store: FavoriteStore, changes: Partial<FavoriteState>) {
  store.state = { ...store.state, ...changes };
  store.listeners.forEach((listener) => listener());
}

function getStore(userId: string | null) {
  const key = userId ? `user:${userId}` : "guest";
  const existing = stores.get(key);
  if (existing) return existing;
  const store: FavoriteStore = {
    key, userId, state: initialState, confirmed: [], revision: 0, loaded: false,
    request: null, saving: null, controller: null, listeners: new Set(),
    subscribe(callback) {
      store.listeners.add(callback);
      function onStorage(event: StorageEvent) {
        if (event.key !== storageKey(store) && event.key !== null) return;
        if (store.state.pending) return;
        if (store.userId) {
          store.loaded = false;
          void load(store);
          return;
        }
        try {
          const ids = sanitize(JSON.parse(window.localStorage.getItem(storageKey(store)) || "[]"));
          store.confirmed = ids;
          update(store, { ids });
        } catch { /* Keep the last usable in-memory selection. */ }
      }
      window.addEventListener("storage", onStorage);
      return () => {
        store.listeners.delete(callback);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
  stores.set(key, store);
  return store;
}

function activate(store: FavoriteStore) {
  if (activeKey === store.key) return;
  if (activeKey) {
    const previous = stores.get(activeKey);
    previous?.controller?.abort();
    if (previous?.userId) {
      // A later login must reload this account from its authenticated server session.
      previous.loaded = false;
      previous.state = initialState;
      previous.request = null;
      previous.saving = null;
    }
  }
  activeKey = store.key;
  store.controller = new AbortController();
}

export function syncFavoriteSession(userId: string | null) {
  activate(getStore(userId));
}

function requestSignal(signal: AbortSignal | undefined) {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000);
}

async function load(store: FavoriteStore): Promise<boolean> {
  if (activeKey !== store.key) return false;
  if (store.loaded) return true;
  if (store.request) return store.request;
  update(store, { loading: true, error: "" });
  const signal = store.controller?.signal;
  const request = (async () => {
    try {
      let ids: string[];
      if (store.userId) {
        const result = await api<{ ids: string[]; userId: string }>("/api/favorites", { signal: requestSignal(signal) });
        if (result.userId !== store.userId) {
          store.confirmed = [];
          update(store, { ids: [] });
          throw new Error("Аккаунт в другой вкладке изменился. Обновите страницу, чтобы загрузить его избранное.");
        }
        ids = sanitize(result.ids);
      } else {
        try {
          ids = sanitize(JSON.parse(window.localStorage.getItem(storageKey(store)) || "[]"));
        } catch {
          ids = store.state.ids;
        }
      }
      if (signal?.aborted || activeKey !== store.key) return false;
      store.loaded = true;
      store.confirmed = ids;
      update(store, { ids, loading: false, error: "" });
      return true;
    } catch (error) {
      if (!signal?.aborted && activeKey === store.key) {
        update(store, { loading: false, error: errorMessage(error, "Не удалось загрузить избранное. Повторите попытку.") });
      }
      return false;
    }
  })();
  store.request = request;
  void request.finally(() => { if (store.request === request) store.request = null; });
  return request;
}

function cache(store: FavoriteStore) {
  try {
    window.localStorage.setItem(storageKey(store), JSON.stringify(store.state.ids));
  } catch {
    if (!store.userId) update(store, { notice: "Избранное сохранено до перезагрузки страницы: браузер ограничил постоянное хранение." });
  }
  window.dispatchEvent(new Event(changeEvent));
}

async function save(store: FavoriteStore) {
  if (store.saving) return store.saving;
  const signal = store.controller?.signal;
  const saving = (async () => {
    while (activeKey === store.key && !signal?.aborted) {
      const revision = store.revision;
      const ids = [...store.state.ids];
      try {
        const result = await api<{ ids: string[] }>("/api/favorites", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, expectedUserId: store.userId }), signal: requestSignal(signal),
        });
        if (signal?.aborted || activeKey !== store.key) return;
        store.confirmed = sanitize(result.ids);
        if (revision === store.revision) {
          update(store, { ids: store.confirmed, pending: false, error: "" });
          cache(store);
          return;
        }
      } catch (error) {
        if (signal?.aborted || activeKey !== store.key) return;
        if (revision === store.revision) {
          update(store, { ids: store.confirmed, pending: false, error: errorMessage(error, "Не удалось сохранить избранное. Изменение отменено.") });
          return;
        }
      }
    }
  })();
  store.saving = saving;
  void saving.finally(() => { if (store.saving === saving) store.saving = null; });
  return saving;
}

async function toggleStore(store: FavoriteStore, id: string, sessionLoading: boolean) {
    if (!validIds.has(id) || sessionLoading || !await load(store)) return store.state.error;
    const current = store.state.ids;
    const ids = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    store.revision += 1;
    update(store, { ids, pending: Boolean(store.userId), error: "", notice: "" });
    if (store.userId) await save(store);
    else cache(store);
    return store.state.error || store.state.notice;
}

function retryStore(store: FavoriteStore) {
  store.loaded = false;
  void load(store);
}

export function useModelFavorites() {
  const { user, loading: sessionLoading } = useSession();
  const store = getStore(user?.id ?? null);
  const state = useSyncExternalStore(store.subscribe, () => store.state, () => initialState);

  useEffect(() => {
    if (sessionLoading) return;
    activate(store);
    void load(store);
  }, [store, sessionLoading]);

  return {
    ...state,
    loading: sessionLoading || state.loading,
    toggle: (id: string) => toggleStore(store, id, sessionLoading),
    retry: () => retryStore(store),
  };
}

export function useFavoriteModels() {
  return useModelFavorites().ids;
}
