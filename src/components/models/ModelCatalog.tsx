"use client";

import { useState } from "react";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import { models } from "@/data/models";
import ModelCard from "./ModelCard";
import { useFavoriteModels } from "./FavoriteButton";
import "./models.css";

export default function ModelCatalog() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [saved, setSaved] = useState(false);
  const favorites = useFavoriteModels();
  const filtered = models.filter((model) => model.name.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru").trim()) && (!city || model.city === city) && (!specialty || model.specialty === specialty) && (!saved || favorites.includes(model.id)));
  const reset = () => { setQuery(""); setCity(""); setSpecialty(""); setSaved(false); };
  return <>
    <div className="model-filters row g-3">
      <div className="col-12 col-md-6 col-lg-5"><TextField fullWidth label="Поиск по имени" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти своё новое лицо" /></div>
      <div className="col-6 col-md-3"><TextField select fullWidth label="Город" value={city} onChange={(event) => setCity(event.target.value)}><MenuItem value="">Все города</MenuItem>{[...new Set(models.map((model) => model.city))].map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}</TextField></div>
      <div className="col-6 col-md-3 col-lg-4"><TextField select fullWidth label="Направление" value={specialty} onChange={(event) => setSpecialty(event.target.value)}><MenuItem value="">Все направления</MenuItem>{[...new Set(models.map((model) => model.specialty))].map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}</TextField></div>
    </div>
    <div className="model-results-bar"><p aria-live="polite">Найдено: {filtered.length} <span className="muted">/ {models.length} моделей</span></p><FormControlLabel control={<Checkbox checked={saved} onChange={(event) => setSaved(event.target.checked)} size="small" />} label="Только избранные" /></div>
    {filtered.length ? <div className="row g-4 g-lg-5">{filtered.map((model, index) => <div className="col-12 col-sm-6 col-lg-4" key={model.id}><ModelCard model={model} priority={index < 3} /></div>)}</div> : <div className="models-empty"><span className="eyebrow">Попробуем ещё раз</span><h2>Пока нет совпадений</h2><p>Измените имя, город или направление. Ваше новое лицо ещё впереди.</p><button className="button button-dark" onClick={reset}>Сбросить фильтры <span>↗</span></button></div>}
  </>;
}
