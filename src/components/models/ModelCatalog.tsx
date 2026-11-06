"use client";

import { useState } from "react";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { models } from "@/data/models";
import ModelCard from "./ModelCard";
import { useModelFavorites } from "./favorite-store";
import "./models.css";

const cities = [...new Set(models.map((model) => model.city))];
const specialties = [...new Set(models.map((model) => model.specialty))];

export default function ModelCatalog() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [sort, setSort] = useState("featured");
  const [saved, setSaved] = useState(false);
  const { ids: favorites, error, loading, pending, retry } = useModelFavorites();
  const normalizedQuery = query.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
  const filtered = models
    .filter((model) => model.name.toLocaleLowerCase("ru").replaceAll("ё", "е").includes(normalizedQuery)
      && (!city || model.city === city)
      && (!specialty || model.specialty === specialty)
      && (!saved || favorites.includes(model.id)))
    .sort((first, second) => {
      if (sort === "name") return first.name.localeCompare(second.name, "ru");
      if (sort === "height") return second.height - first.height;
      return 0;
    });
  const hasFilters = Boolean(query || city || specialty || saved || sort !== "featured");

  function reset() {
    setQuery(""); setCity(""); setSpecialty(""); setSaved(false); setSort("featured");
  }

  return <>
    <div className="model-filters row g-3" role="search" aria-label="Поиск моделей">
      <div className="col-12 col-md-6 col-lg-4">
        <TextField id="model-query" fullWidth label="Поиск по имени" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Введите имя модели" type="search" autoComplete="off" />
      </div>
      <div className="col-12 col-sm-6 col-md-3 col-lg-2">
        <TextField id="model-city" select fullWidth label="Город" value={city} onChange={(event) => setCity(event.target.value)}>
          <MenuItem value="">Все города</MenuItem>{cities.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
        </TextField>
      </div>
      <div className="col-12 col-sm-6 col-md-3">
        <TextField id="model-specialty" select fullWidth label="Направление" value={specialty} onChange={(event) => setSpecialty(event.target.value)}>
          <MenuItem value="">Все направления</MenuItem>{specialties.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
        </TextField>
      </div>
      <div className="col-12 col-md-6 col-lg-3">
        <TextField id="model-sort" select fullWidth label="Порядок" value={sort} onChange={(event) => setSort(event.target.value)}>
          <MenuItem value="featured">Выбор редакции</MenuItem><MenuItem value="name">По имени: А–Я</MenuItem><MenuItem value="height">По росту: сначала выше</MenuItem>
        </TextField>
      </div>
    </div>
    {error && <Alert severity="error" className="model-favorites-error" action={<Button color="inherit" size="small" onClick={retry}>Повторить</Button>}>{error}</Alert>}
    <div className="model-results-bar">
      <p role="status" aria-live="polite">{loading && saved ? "Загружаем избранное…" : `Найдено: ${filtered.length}`} <span className="muted">/ {models.length} моделей</span>{pending && <span className="model-saving"> · Сохраняем…</span>}</p>
      <div className="model-filter-actions">
        {hasFilters && <button type="button" className="model-reset" onClick={reset}>Сбросить фильтры</button>}
        <FormControlLabel control={<Checkbox checked={saved} onChange={(event) => setSaved(event.target.checked)} size="small" />} label={`Избранные (${favorites.length})`} />
      </div>
    </div>
    {filtered.length ? <div className="row g-4 g-lg-5">
      {filtered.map((model, index) => <div className="col-12 col-sm-6 col-lg-4" key={model.id}><ModelCard model={model} priority={index < 2} /></div>)}
    </div> : <div className="models-empty">
      <span className="eyebrow">{saved && !favorites.length ? "Ваша подборка" : "Попробуем ещё раз"}</span>
      <h2>{saved && loading ? "Загружаем подборку…" : saved && !favorites.length ? "Пока нет избранных" : "Пока нет совпадений"}</h2>
      <p>{saved && !favorites.length ? "Нажмите на сердце в карточке, чтобы сохранить интересующую модель." : "Измените имя, город или направление. Ваше новое лицо ещё впереди."}</p>
      <button type="button" className="button button-dark" onClick={reset}>Показать все модели <span aria-hidden="true">↗</span></button>
    </div>}
  </>;
}
