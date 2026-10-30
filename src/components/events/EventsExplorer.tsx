"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MenuItem, TextField, ToggleButton, ToggleButtonGroup, IconButton } from "@mui/material";
import { events, type RunwayEvent } from "@/data/events";
import EventCard from "./EventCard";
import "./events.css";

export default function EventsExplorer() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [sort, setSort] = useState("asc");
  const [view, setView] = useState("list");
  const [month, setMonth] = useState(new Date(2026, 10, 1));
  const filtered = useMemo(() => events.filter(event =>
    `${event.title} ${event.venue}`.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru").trim()) &&
    (city === "all" || event.city === city) && (type === "all" || event.type === type) && (!from || event.date >= from)
  ).sort((a, b) => sort === "asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)), [query, city, type, from, sort]);
  const reset = () => { setQuery(""); setCity("all"); setType("all"); setFrom(""); setSort("asc"); };
  const shiftMonth = (direction: number) => setMonth(current => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  const monthStart = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const calendarCells = Array.from({ length: Math.ceil((monthStart + days) / 7) * 7 }, (_, index) => index - monthStart + 1);

  return (
    <main id="main-content" className="page-shell events-page">
      <header className="event-page-intro">
        <p className="eyebrow">THE CALENDAR / 2026</p>
        <div className="event-heading-row"><h1 className="page-heading">Моменты,<br /><span>которые ждут.</span></h1><p className="muted">Показы, кастинги и съёмки.<br />Найдите своё место в новом сезоне.</p></div>
      </header>
      <div className="events-filter-grid" aria-label="Фильтры событий">
        <TextField label="Найти событие" placeholder="Название или площадка" value={query} onChange={event => setQuery(event.target.value)} size="small" />
        <TextField select label="Город" value={city} onChange={event => setCity(event.target.value)} size="small"><MenuItem value="all">Все города</MenuItem><MenuItem value="Алматы">Алматы</MenuItem><MenuItem value="Астана">Астана</MenuItem></TextField>
        <TextField select label="Направление" value={type} onChange={event => setType(event.target.value)} size="small"><MenuItem value="all">Все события</MenuItem><MenuItem value="Показ">Показы</MenuItem><MenuItem value="Кастинг">Кастинги</MenuItem><MenuItem value="Съёмка">Съёмки</MenuItem></TextField>
        <TextField label="Начиная с даты" type="date" value={from} onChange={event => setFrom(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} size="small" />
        <TextField select label="По дате" value={sort} onChange={event => setSort(event.target.value)} size="small"><MenuItem value="asc">Сначала ближайшие</MenuItem><MenuItem value="desc">Сначала поздние</MenuItem></TextField>
      </div>
      <div className="events-view-toolbar"><span className="eyebrow" role="status">Найдено событий: {filtered.length}</span><div className="d-flex align-items-center gap-3"><button className="event-reset" onClick={reset}>Сбросить фильтры</button><ToggleButtonGroup value={view} exclusive onChange={(_, value: string | null) => value && setView(value)} size="small" aria-label="Вид событий"><ToggleButton value="list">Список</ToggleButton><ToggleButton value="calendar">Календарь</ToggleButton></ToggleButtonGroup></div></div>
      {filtered.length === 0 ? <div className="events-empty"><h2>Пока ничего не нашлось.</h2><p className="muted">Попробуйте другой город, дату или название.</p><button className="button button-dark" onClick={reset}>Сбросить фильтры ↗</button></div> : view === "list" ? <div className="row g-4 g-xl-5">{filtered.map(event => <div key={event.id} className="col-md-6 col-xl-4"><EventCard event={event} /></div>)}</div> : <section className="events-calendar" aria-label="Календарь событий"><div className="calendar-month"><h2>{month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</h2><div><IconButton aria-label="Предыдущий месяц" onClick={() => shiftMonth(-1)}>←</IconButton><IconButton aria-label="Следующий месяц" onClick={() => shiftMonth(1)}>→</IconButton></div></div><div className="calendar-weekdays">{["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{calendarCells.map((day, index) => { const active = day > 0 && day <= days; const iso = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const matches: RunwayEvent[] = active ? filtered.filter(event => event.date === iso) : []; return <div className={`calendar-day ${active ? "" : "calendar-day-empty"}`} key={index}>{active && <><span className="calendar-day-number">{String(day).padStart(2, "0")}</span>{matches.map(event => <Link key={event.id} href={`/events/${event.id}`} className={`calendar-event ${event.status === "Отменено" ? "calendar-event-cancelled" : ""}`}><span>{event.time} · {event.city}</span><strong>{event.title}</strong><small>{event.type}</small></Link>)}</>}</div>; })}</div><p className="calendar-mobile-note muted">Нажмите на событие, чтобы узнать подробности.</p></section>}
      <p className="events-demo-note muted">Демо-сезон: 30 октября 2026. События, площадки и доступные места приведены для знакомства с интерфейсом.</p>
      <aside className="events-bottom-cta"><div><p className="eyebrow">NEXT STEP</p><h2>Ваш выход — следующий.</h2></div><Link href="/casting" className="button button-dark">Открытые кастинги <span aria-hidden="true">↗</span></Link></aside>
    </main>
  );
}
