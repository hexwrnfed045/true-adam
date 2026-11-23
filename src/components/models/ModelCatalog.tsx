"use client";

import { usePathname, useSearchParams } from "next/navigation";
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

export default function ModelCatalog({ mode = "catalog" }: { mode?: "catalog" | "home" }) {
  const home = mode === "home";
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const queryKey = home ? "talent_q" : "q";
  const query = (searchParams.get(queryKey) || "").slice(0, 120);
  const city = !home && cities.includes(searchParams.get("city") || "") ? searchParams.get("city")! : "";
  const specialty = !home && specialties.includes(searchParams.get("specialty") || "") ? searchParams.get("specialty")! : "";
  const requestedSort = home ? null : searchParams.get("sort");
  const sort = requestedSort === "name" || requestedSort === "height" ? requestedSort : "featured";
  const saved = !home && searchParams.get("saved") === "1";
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
  const catalogParams = new URLSearchParams();
  if (query) catalogParams.set(queryKey, query);
  if (city) catalogParams.set("city", city);
  if (specialty) catalogParams.set("specialty", specialty);
  if (sort !== "featured") catalogParams.set("sort", sort);
  if (saved) catalogParams.set("saved", "1");
  const catalogUrl = `${pathname}${catalogParams.size ? `?${catalogParams}` : ""}${home ? "#talent" : ""}`;

  function setFilter(name: "q" | "city" | "specialty" | "sort" | "saved", value: string) {
    // Read the current address at interaction time so rapid edits merge correctly.
    const next = new URLSearchParams(window.location.search);
    if (!home) {
      for (const key of [...next.keys()]) {
        if (!["q", "city", "specialty", "sort", "saved"].includes(key)) next.delete(key);
      }
    }
    const key = home && name === "q" ? "talent_q" : name;
    if (value) next.set(key, value);
    else next.delete(key);
    window.history.replaceState(null, "", `${pathname}${next.size ? `?${next}` : ""}${home ? "#talent" : ""}`);
  }

  function reset() {
    if (home) {
      setFilter("q", "");
      return;
    }
    window.history.replaceState(null, "", pathname);
  }

  if (home) return (
    <div className="home-talent-index">
      <div className="home-talent-toolbar">
        <div className="home-talent-search" role="search" aria-label="Поиск моделей на главной">
          <TextField
            id="home-talent-query"
            variant="standard"
            size="small"
            fullWidth
            label="Найти модель"
            placeholder="Имя модели"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setFilter("q", event.target.value)}
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />
          {query && <button type="button" onClick={reset}>Очистить</button>}
        </div>
        <p className="home-talent-count" role="status" aria-live="polite">{query ? `Найдено: ${filtered.length}` : `${filtered.length} моделей`}</p>
      </div>
      {error && <Alert severity="error" className="model-favorites-error" action={<Button color="inherit" size="small" onClick={retry}>Повторить</Button>}>{error}</Alert>}
      {filtered.length ? (
        <div className="home-talent-grid">
          {filtered.map((model) => <ModelCard key={model.id} model={model} catalogUrl={catalogUrl} imageSizes="(max-width: 650px) 45vw, 30vw" />)}
        </div>
      ) : (
        <div className="home-talent-empty">
          <h3>Не нашли это имя.</h3>
          <p>Попробуйте другой запрос или откройте все модели.</p>
          <button type="button" onClick={reset}>Показать все модели</button>
        </div>
      )}
    </div>
  );

  return <>
    <div className="model-filters row g-3" role="search" aria-label="Поиск моделей">
      <div className="col-12 col-md-6 col-lg-4">
        <TextField id="model-query" size="small" fullWidth label="Поиск по имени" value={query} onChange={(event) => setFilter("q", event.target.value)} placeholder="Введите имя модели" type="search" autoComplete="off" slotProps={{ htmlInput: { maxLength: 120 } }} />
      </div>
      <div className="col-12 col-sm-6 col-md-3 col-lg-2">
        <TextField id="model-city" size="small" select fullWidth label="Город" value={city} onChange={(event) => setFilter("city", event.target.value)}>
          <MenuItem value="">Все города</MenuItem>{cities.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
        </TextField>
      </div>
      <div className="col-12 col-sm-6 col-md-3">
        <TextField id="model-specialty" size="small" select fullWidth label="Направление" value={specialty} onChange={(event) => setFilter("specialty", event.target.value)}>
          <MenuItem value="">Все направления</MenuItem>{specialties.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
        </TextField>
      </div>
      <div className="col-12 col-md-6 col-lg-3">
        <TextField id="model-sort" size="small" select fullWidth label="Порядок" value={sort} onChange={(event) => setFilter("sort", event.target.value === "featured" ? "" : event.target.value)}>
          <MenuItem value="featured">Выбор редакции</MenuItem><MenuItem value="name">По имени: А–Я</MenuItem><MenuItem value="height">По росту: сначала выше</MenuItem>
        </TextField>
      </div>
    </div>
    {error && <Alert severity="error" className="model-favorites-error" action={<Button color="inherit" size="small" onClick={retry}>Повторить</Button>}>{error}</Alert>}
    <div className="model-results-bar">
      <p role="status" aria-live="polite">{loading && saved ? "Загружаем избранное…" : `Найдено: ${filtered.length}`} <span className="muted">/ {models.length} моделей</span>{pending && <span className="model-saving"> · Сохраняем…</span>}</p>
      <div className="model-filter-actions">
        {hasFilters && <button type="button" className="model-reset" onClick={reset}>Сбросить фильтры</button>}
        <FormControlLabel control={<Checkbox checked={saved} onChange={(event) => setFilter("saved", event.target.checked ? "1" : "")} size="small" />} label={`Избранные (${favorites.length})`} />
      </div>
    </div>
    {filtered.length ? <div className="row g-4 g-lg-5">
      {filtered.map((model, index) => <div className="col-12 col-sm-6 col-lg-4" key={model.id}><ModelCard model={model} priority={index < 2} catalogUrl={catalogUrl} /></div>)}
    </div> : <div className="models-empty">
      <span className="eyebrow">{saved && !favorites.length ? "Ваша подборка" : "Попробуем ещё раз"}</span>
      <h2>{saved && loading ? "Загружаем подборку…" : saved && !favorites.length ? "Пока нет избранных" : "Пока нет совпадений"}</h2>
      <p>{saved && !favorites.length ? "Нажмите на сердце в карточке, чтобы сохранить интересующую модель." : "Измените имя, город или направление. Ваше новое лицо ещё впереди."}</p>
      <button type="button" className="button button-dark" onClick={reset}>Показать все модели <span aria-hidden="true">↗</span></button>
    </div>}
  </>;
}
