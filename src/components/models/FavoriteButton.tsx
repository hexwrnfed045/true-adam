"use client";

import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import { useModelFavorites } from "./favorite-store";

export { useFavoriteModels } from "./favorite-store";

export default function FavoriteButton({ id, name, className = "" }: {
  id: string;
  name: string;
  className?: string;
}) {
  const { ids, loading, pending, toggle } = useModelFavorites();
  const active = ids.includes(id);
  const [message, setMessage] = useState("");

  return <>
    <IconButton
      type="button"
      className={`model-favorite ${className}`}
      aria-label={`${active ? "Убрать" : "Добавить"} ${name} ${active ? "из избранного" : "в избранное"}`}
      aria-pressed={active}
      aria-busy={pending}
      disabled={loading}
      onClick={async () => setMessage(await toggle(id))}
      title={loading ? "Загрузка избранного" : active ? "В избранном" : "Сохранить модель"}
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
    </IconButton>
    <Snackbar open={Boolean(message)} autoHideDuration={7000} onClose={() => setMessage("")} message={message} />
  </>;
}
