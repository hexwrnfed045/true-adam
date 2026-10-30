"use client";

import { useState, useSyncExternalStore } from "react";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";

const key = "runway-favorites";
const eventName = "runway-favorites-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(eventName, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(eventName, callback);
  };
}

function snapshot() {
  try { return localStorage.getItem(key) || "[]"; } catch { return "[]"; }
}

export function useFavoriteModels(): string[] {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

export default function FavoriteButton({ id, name, className = "" }: { id: string; name: string; className?: string }) {
  const favorites = useFavoriteModels();
  const active = favorites.includes(id);
  const [error, setError] = useState(false);
  function toggle() {
    try {
      localStorage.setItem(key, JSON.stringify(active ? favorites.filter((item) => item !== id) : [...favorites, id]));
      window.dispatchEvent(new Event(eventName));
    } catch { setError(true); }
  }
  return <>
    <IconButton className={`model-favorite ${className}`} aria-label={`${active ? "Убрать" : "Добавить"} ${name} ${active ? "из избранного" : "в избранное"}`} aria-pressed={active} onClick={toggle} title={active ? "В избранном" : "Сохранить модель"}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>
    </IconButton>
    <Snackbar open={error} autoHideDuration={5000} onClose={() => setError(false)} message="Разрешите локальное хранилище браузера, чтобы сохранить избранное." />
  </>;
}
