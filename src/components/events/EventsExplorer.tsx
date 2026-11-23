"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconButton, MenuItem, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { events, formatEventDate, getEventStatus } from "@/data/events";
import EventCard from "./EventCard";
import CalendarDownload from "./CalendarDownload";
import { defaultEventQuery, eventDetailHref, eventResultsHref, parseEventQuery, type EventPeriod, type EventQuery } from "./event-query";
import "./events.css";

const cities = Array.from(new Set(events.map(event => event.city))).sort();
function shiftCalendarMonth(month: string, direction: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + direction, 1)).toISOString().slice(0, 7);
}
function matchingEvents(state: EventQuery, today: string) {
  const invalidDates = !!state.from && !!state.to && state.from > state.to;
  return events.filter(event => {
    const status = getEventStatus(event, today);
    const past = event.date < today || status === "Завершено";
    return !invalidDates && `${event.title} ${event.venue} ${event.city} ${event.organizer}`.toLocaleLowerCase("ru").includes(state.q.toLocaleLowerCase("ru").trim()) &&
      (state.city === "all" || event.city === state.city) && (state.type === "all" || event.type === state.type) &&
      (state.status === "all" || status === state.status) && (state.period === "all" || (state.period === "past" ? past : !past)) &&
      (!state.from || event.date >= state.from) && (!state.to || event.date <= state.to);
  }).sort((a, b) => {
    const comparison = `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
    return state.sort === "asc" ? comparison : -comparison;
  });
}

export default function EventsExplorer({ today }: { today: string }) {
  const query = useSearchParams();
  const parsed = parseEventQuery(query, today, cities);
  const filtered = matchingEvents(parsed, today);
  // A shared search link without a month opens the first matching month. An explicit
  // month always wins, including a deliberately empty month reached by manual paging.
  const initialMonth = parsed.view === "calendar" && !query.has("month") && !filtered.some(event => event.date.startsWith(parsed.month)) && filtered[0] ? filtered[0].date.slice(0, 7) : parsed.month;
  const state = { ...parsed, month: initialMonth };
  const { q, city, type, status, period, from, to, sort, view, month } = state;
  const dateRangeError = !!from && !!to && from > to;
  const monthEvents = filtered.filter(event => event.date.startsWith(month));
  const visibleEvents = view === "calendar" ? monthEvents : filtered;
  const filterCount = Number(city !== "all") + Number(type !== "all") + Number(status !== "all") + Number(!!from) + Number(!!to) + Number(sort !== "asc");
  const returnTo = eventResultsHref(state, today);
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1, 12);
  const monthStart = (firstDay.getDay() + 6) % 7;
  const days = new Date(year, monthNumber, 0, 12).getDate();
  const calendarCells = Array.from({ length: Math.ceil((monthStart + days) / 7) * 7 }, (_, index) => index - monthStart + 1);
  const monthTitle = firstDay.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  function write(next: EventQuery) {
    window.history.replaceState(null, "", eventResultsHref(next, today));
  }
  function update(patch: Partial<EventQuery>, focusMatchingMonth = true) {
    const next = { ...state, ...patch };
    const matches = matchingEvents(next, today);
    if (focusMatchingMonth && next.view === "calendar" && !matches.some(event => event.date.startsWith(next.month)) && matches[0]) next.month = matches[0].date.slice(0, 7);
    write(next);
  }
  function reset() {
    const next = { ...defaultEventQuery(today), view };
    write(next);
  }
  function changePeriod(value: EventPeriod) {
    update({ period: value, sort: value === "past" ? "desc" : "asc" });
  }

  return (
    <main id="main-content" className="page-shell events-page">
      <header className="event-page-intro"><div className="event-heading-row"><h1 className="page-heading">Показы и <em>события</em></h1><p className="muted">Показы, кастинги и съёмки — в одном календаре.</p></div></header>
      <div className="events-period-toolbar"><ToggleButtonGroup value={period} exclusive onChange={(_, value: EventPeriod | null) => value && changePeriod(value)} size="small" aria-label="Период событий"><ToggleButton value="upcoming">Предстоящие</ToggleButton><ToggleButton value="past">Архив</ToggleButton><ToggleButton value="all">Все</ToggleButton></ToggleButtonGroup><p className="muted">Сегодня: {formatEventDate(today, { day: "numeric", month: "long", year: "numeric" })}</p></div>
      <section className="events-filter-panel" aria-label="Поиск и фильтры событий">
        <TextField className="events-search" label="Найти событие" placeholder="Название, город или площадка" value={q} onChange={event => update({ q: event.target.value })} size="small" slotProps={{ htmlInput: { maxLength: 120 } }} />
        <details className="events-advanced-filters" open={filterCount > 0 || undefined}><summary>Фильтры <span>{filterCount ? `(${filterCount})` : "+"}</span></summary><div className="events-advanced-grid">
          <TextField select label="Город" value={city} onChange={event => update({ city: event.target.value })} size="small"><MenuItem value="all">Все города</MenuItem>{cities.map(value => <MenuItem value={value} key={value}>{value}</MenuItem>)}</TextField>
          <TextField select label="Направление" value={type} onChange={event => update({ type: event.target.value })} size="small"><MenuItem value="all">Все события</MenuItem><MenuItem value="Показ">Показы</MenuItem><MenuItem value="Кастинг">Кастинги</MenuItem><MenuItem value="Съёмка">Съёмки</MenuItem></TextField>
          <TextField select label="Статус" value={status} onChange={event => update({ status: event.target.value })} size="small"><MenuItem value="all">Любой статус</MenuItem><MenuItem value="Открыт набор">Открыт набор</MenuItem><MenuItem value="Закрыто">Приём закрыт</MenuItem><MenuItem value="Отменено">Отменено</MenuItem><MenuItem value="Завершено">Завершено</MenuItem></TextField>
          <TextField select label="По дате" value={sort} onChange={event => update({ sort: event.target.value === "desc" ? "desc" : "asc" })} size="small"><MenuItem value="asc">Сначала ближайшие</MenuItem><MenuItem value="desc">Сначала поздние</MenuItem></TextField>
          <TextField label="С даты" type="date" value={from} error={dateRangeError} onChange={event => update({ from: event.target.value })} slotProps={{ inputLabel: { shrink: true }, htmlInput: { "aria-describedby": dateRangeError ? "event-date-error" : undefined } }} size="small" />
          <TextField label="По дату" type="date" value={to} error={dateRangeError} onChange={event => update({ to: event.target.value })} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from || undefined, "aria-describedby": dateRangeError ? "event-date-error" : undefined } }} size="small" />
        </div></details>
      </section>
      {dateRangeError && <p id="event-date-error" className="event-filter-error" role="alert">Дата окончания должна быть не раньше даты начала.</p>}
      <div className="events-view-toolbar"><p className="events-result-count" role="status" aria-live="polite">{view === "calendar" ? `В этом месяце: ${monthEvents.length}` : `Найдено событий: ${filtered.length}`}</p><ToggleButtonGroup value={view} exclusive onChange={(_, value: "list" | "calendar" | null) => value && update({ view: value })} size="small" aria-label="Вид событий"><ToggleButton value="list">Список</ToggleButton><ToggleButton value="calendar">Календарь</ToggleButton></ToggleButtonGroup></div>
      <details className="events-result-tools"><summary>Скачать даты и сбросить фильтры <span aria-hidden="true">+</span></summary><div className="events-utility-toolbar"><CalendarDownload events={visibleEvents} filename={view === "calendar" ? `runway-${month}` : "runway-results"} label={view === "calendar" ? `Скачать месяц (${monthEvents.length}) .ics` : `Скачать результаты (${filtered.length}) .ics`} /><button type="button" className="event-reset" onClick={reset}>Сбросить фильтры</button></div></details>
      <div id="event-results" className="events-results">
      {view === "list" ? filtered.length ? <div className="row g-4 g-xl-5">{filtered.map(event => <div key={event.id} className="col-md-6 col-xl-4"><EventCard event={event} today={today} returnTo={returnTo} /></div>)}</div> : <div className="events-empty"><h2>{period === "past" ? "Архив по этим условиям пуст." : "Пока ничего не нашлось."}</h2><p className="muted">Попробуйте другой город, статус или диапазон дат.</p><button type="button" className="button button-dark" onClick={reset}>Сбросить фильтры ↗</button></div> : <section className="events-calendar" aria-label="Календарь событий">
        <div className="calendar-month"><h2 id="calendar-month-title" aria-live="polite">{monthTitle}</h2><div className="calendar-controls"><button type="button" className="event-reset calendar-today" onClick={() => update({ month: today.slice(0, 7) }, false)}>Текущий месяц</button><IconButton aria-label="Предыдущий месяц" onClick={() => update({ month: shiftCalendarMonth(month, -1) }, false)}>←</IconButton><IconButton aria-label="Следующий месяц" onClick={() => update({ month: shiftCalendarMonth(month, 1) }, false)}>→</IconButton></div></div>
        <div className="calendar-weekdays" aria-hidden="true">{["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid" aria-labelledby="calendar-month-title">{calendarCells.map((day, index) => {
          const active = day > 0 && day <= days;
          const iso = `${month}-${String(day).padStart(2, "0")}`;
          const matches = active ? monthEvents.filter(event => event.date === iso) : [];
          const dateLabel = active ? formatEventDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
          return <div className={`calendar-day ${active ? "" : "calendar-day-empty"} ${matches.length ? "" : "calendar-day-no-events"} ${iso === today ? "calendar-day-today" : ""}`} key={index}>{active && <><time className="calendar-day-number" dateTime={iso} title={dateLabel}><span className="calendar-number-short">{String(day).padStart(2, "0")}</span><span className="calendar-mobile-date">{formatEventDate(iso, { weekday: "short", day: "numeric", month: "long" })}</span></time><div className="calendar-day-events">{matches.map(event => {
            const eventStatus = getEventStatus(event, today);
            const label = `${event.title}, ${dateLabel}, ${event.time}, ${event.city}, ${event.type}. ${eventStatus}.`;
            return <Link key={event.id} href={eventDetailHref(event.id, returnTo)} aria-label={label} title={label} className={`calendar-event ${eventStatus === "Отменено" ? "calendar-event-cancelled" : ""}`}><span>{event.time} · {event.city}</span><strong>{event.title}</strong><small>{event.type} · {eventStatus}</small></Link>;
          })}</div></>}</div>;
        })}</div>
        {monthEvents.length === 0 && <div className="calendar-empty" role="status"><h3>{filtered.length ? "В этом месяце событий не найдено." : "По этим фильтрам событий нет."}</h3><p>{filtered.length ? "Посмотрите другой месяц или измените фильтры." : "Измените запрос, город, период или диапазон дат."}</p>{filtered.length > 0 ? <button type="button" className="button button-light" onClick={() => update({ month: filtered[0].date.slice(0, 7) }, false)}>К первому результату ↗</button> : <button type="button" className="button button-light" onClick={reset}>Сбросить фильтры ↗</button>}</div>}
        <p className="calendar-mobile-note muted">В этом месяце: {monthEvents.length}. Всего по фильтрам: {filtered.length}. Скачивание .ics включает только события отображаемого месяца.</p>
      </section>}
      </div>
      <p className="events-demo-note muted">События, команды и площадки — редакционные примеры. Заявки сохраняются на сервере сайта; участие в реальном мероприятии требует отдельного подтверждения организатора.</p>
      <aside className="events-bottom-cta"><div><h2>Стать моделью</h2></div><Link href="/casting" className="button button-dark">Подать анкету модели <span aria-hidden="true">↗</span></Link></aside>
    </main>
  );
}
