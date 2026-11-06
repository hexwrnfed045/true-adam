"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconButton, MenuItem, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { events, formatEventDate, getEventStatus, type RunwayEvent } from "@/data/events";
import EventCard from "./EventCard";
import "./events.css";

type Period = "upcoming" | "past" | "all";

function shiftCalendarMonth(month: string, direction: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + direction, 1)).toISOString().slice(0, 7);
}

export default function EventsExplorer({ today }: { today: string }) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState<Period>("upcoming");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("asc");
  const [view, setView] = useState("list");
  const [month, setMonth] = useState(today.slice(0, 7));
  const dateRangeError = !!from && !!to && from > to;
  const filtered = useMemo(() => events.filter(event => {
    const effectiveStatus = getEventStatus(event, today);
    const isPast = event.date < today || effectiveStatus === "Завершено";
    return !dateRangeError &&
      `${event.title} ${event.venue} ${event.city} ${event.organizer}`.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru").trim()) &&
      (city === "all" || event.city === city) && (type === "all" || event.type === type) &&
      (status === "all" || effectiveStatus === status) &&
      (period === "all" || (period === "past" ? isPast : !isPast)) &&
      (!from || event.date >= from) && (!to || event.date <= to);
  }).sort((a, b) => {
    const comparison = `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
    return sort === "asc" ? comparison : -comparison;
  }), [query, city, type, status, period, from, to, sort, today, dateRangeError]);
  const monthEvents = filtered.filter(event => event.date.startsWith(month));
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1, 12);
  const monthStart = (firstDay.getDay() + 6) % 7;
  const days = new Date(year, monthNumber, 0, 12).getDate();
  const calendarCells = Array.from({ length: Math.ceil((monthStart + days) / 7) * 7 }, (_, index) => index - monthStart + 1);
  const monthTitle = firstDay.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  function reset() {
    setQuery(""); setCity("all"); setType("all"); setStatus("all"); setPeriod("upcoming");
    setFrom(""); setTo(""); setSort("asc"); setMonth(today.slice(0, 7));
  }
  function changePeriod(value: Period) {
    setPeriod(value); setSort(value === "past" ? "desc" : "asc");
    const archive = events.filter(event => event.date < today || getEventStatus(event, today) === "Завершено").sort((a, b) => b.date.localeCompare(a.date));
    setMonth(value === "past" && archive[0] ? archive[0].date.slice(0, 7) : (from || today).slice(0, 7));
  }

  return (
    <main id="main-content" className="page-shell events-page">
      <header className="event-page-intro">
        <p className="eyebrow">THE CALENDAR / RUNWAY MODELS</p>
        <div className="event-heading-row"><h1 className="page-heading">Моменты,<br /><span>которые ждут.</span></h1><p className="muted">Показы, кастинги и съёмки.<br />Найдите своё место в новом сезоне.</p></div>
      </header>
      <div className="events-period-toolbar">
        <ToggleButtonGroup value={period} exclusive onChange={(_, value: Period | null) => value && changePeriod(value)} size="small" aria-label="Период событий"><ToggleButton value="upcoming">Предстоящие</ToggleButton><ToggleButton value="past">Архив</ToggleButton><ToggleButton value="all">Все</ToggleButton></ToggleButtonGroup>
        <p className="muted">Сегодня: {formatEventDate(today, { day: "numeric", month: "long", year: "numeric" })} · время Казахстана</p>
      </div>
      <div className="events-filter-grid" aria-label="Фильтры событий">
        <TextField label="Найти событие" placeholder="Название, город или площадка" value={query} onChange={event => setQuery(event.target.value)} size="small" />
        <TextField select label="Город" value={city} onChange={event => setCity(event.target.value)} size="small"><MenuItem value="all">Все города</MenuItem>{Array.from(new Set(events.map(event => event.city))).sort().map(value => <MenuItem value={value} key={value}>{value}</MenuItem>)}</TextField>
        <TextField select label="Направление" value={type} onChange={event => setType(event.target.value)} size="small"><MenuItem value="all">Все события</MenuItem><MenuItem value="Показ">Показы</MenuItem><MenuItem value="Кастинг">Кастинги</MenuItem><MenuItem value="Съёмка">Съёмки</MenuItem></TextField>
        <TextField select label="Статус" value={status} onChange={event => setStatus(event.target.value)} size="small"><MenuItem value="all">Любой статус</MenuItem><MenuItem value="Открыт набор">Открыт набор</MenuItem><MenuItem value="Закрыто">Приём закрыт</MenuItem><MenuItem value="Отменено">Отменено</MenuItem><MenuItem value="Завершено">Завершено</MenuItem></TextField>
        <TextField label="С даты" type="date" value={from} error={dateRangeError} onChange={event => { setFrom(event.target.value); if (event.target.value) setMonth(event.target.value.slice(0, 7)); }} slotProps={{ inputLabel: { shrink: true } }} size="small" />
        <TextField label="По дату" type="date" value={to} error={dateRangeError} onChange={event => setTo(event.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from || undefined } }} size="small" />
        <TextField select label="По дате" value={sort} onChange={event => setSort(event.target.value)} size="small"><MenuItem value="asc">Сначала ближайшие</MenuItem><MenuItem value="desc">Сначала поздние</MenuItem></TextField>
      </div>
      {dateRangeError && <p className="event-filter-error" role="alert">Дата окончания должна быть не раньше даты начала.</p>}
      <div className="events-view-toolbar"><span className="eyebrow" role="status" aria-live="polite">Найдено событий: {filtered.length}</span><div className="d-flex align-items-center gap-3"><button type="button" className="event-reset" onClick={reset}>Сбросить фильтры</button><ToggleButtonGroup value={view} exclusive onChange={(_, value: string | null) => value && setView(value)} size="small" aria-label="Вид событий"><ToggleButton value="list">Список</ToggleButton><ToggleButton value="calendar">Календарь</ToggleButton></ToggleButtonGroup></div></div>
      {view === "list" ? filtered.length ? <div className="row g-4 g-xl-5">{filtered.map(event => <div key={event.id} className="col-md-6 col-xl-4"><EventCard event={event} today={today} /></div>)}</div> : <div className="events-empty"><h2>{period === "past" ? "Архив по этим условиям пуст." : "Пока ничего не нашлось."}</h2><p className="muted">Попробуйте другой город, статус или диапазон дат.</p><button type="button" className="button button-dark" onClick={reset}>Сбросить фильтры ↗</button></div> : <section className="events-calendar" aria-label="Календарь событий">
        <div className="calendar-month"><h2 id="calendar-month-title" aria-live="polite">{monthTitle}</h2><div className="calendar-controls"><button type="button" className="event-reset calendar-today" onClick={() => setMonth(today.slice(0, 7))}>Текущий месяц</button><IconButton aria-label="Предыдущий месяц" onClick={() => setMonth(value => shiftCalendarMonth(value, -1))}>←</IconButton><IconButton aria-label="Следующий месяц" onClick={() => setMonth(value => shiftCalendarMonth(value, 1))}>→</IconButton></div></div>
        <div className="calendar-weekdays" aria-hidden="true">{["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map(day => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid" aria-labelledby="calendar-month-title">{calendarCells.map((day, index) => {
          const active = day > 0 && day <= days;
          const iso = `${month}-${String(day).padStart(2, "0")}`;
          const matches: RunwayEvent[] = active ? monthEvents.filter(event => event.date === iso) : [];
          const dateLabel = active ? formatEventDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
          return <div className={`calendar-day ${active ? "" : "calendar-day-empty"} ${matches.length ? "" : "calendar-day-no-events"} ${iso === today ? "calendar-day-today" : ""}`} key={index}>{active && <><time className="calendar-day-number" dateTime={iso} title={dateLabel}><span className="calendar-number-short">{String(day).padStart(2, "0")}</span><span className="calendar-mobile-date">{formatEventDate(iso, { weekday: "short", day: "numeric", month: "long" })}</span></time><div className="calendar-day-events">{matches.map(event => {
            const eventStatus = getEventStatus(event, today);
            const label = `${event.title}, ${dateLabel}, ${event.time}, ${event.city}, ${event.type}. ${eventStatus}.`;
            return <Link key={event.id} href={`/events/${event.id}`} aria-label={label} title={label} className={`calendar-event ${eventStatus === "Отменено" ? "calendar-event-cancelled" : ""}`}><span>{event.time} · {event.city}</span><strong>{event.title}</strong><small>{event.type} · {eventStatus}</small></Link>;
          })}</div></>}</div>;
        })}</div>
        {monthEvents.length === 0 && <div className="calendar-empty" role="status"><h3>В этом месяце событий не найдено.</h3><p>Измените фильтры или перейдите к другому месяцу.</p>{filtered.length > 0 && <button type="button" className="button button-light" onClick={() => setMonth(filtered[0].date.slice(0, 7))}>К ближайшему результату ↗</button>}</div>}
        <p className="calendar-mobile-note muted">{monthEvents.length ? `Событий в этом месяце: ${monthEvents.length}. ` : ""}Выберите событие, чтобы узнать подробности и условия участия.</p>
      </section>}
      <p className="events-demo-note muted">События, команды и площадки — редакционные примеры. Заявки сохраняются на сервере сайта; участие в реальном мероприятии требует отдельного подтверждения организатора.</p>
      <aside className="events-bottom-cta"><div><p className="eyebrow">NEXT STEP</p><h2>Ваш выход — следующий.</h2></div><Link href="/casting" className="button button-dark">Подать анкету модели <span aria-hidden="true">↗</span></Link></aside>
    </main>
  );
}
