import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { events, formatEventDate, getEventStatus, getToday, isEventAvailable } from "@/data/events";
import "@/components/events/events.css";

export const metadata: Metadata = { title: "Съёмки", description: "Editorial, fashion и коммерческие проекты. Найдите следующую историю для своего портфолио." };

export default async function ShootsPage() {
  await connection();
  const today = getToday();
  const shoots = events.filter(event => event.type === "Съёмка").sort((a, b) => Number(isEventAvailable(b, today)) - Number(isEventAvailable(a, today)) || a.date.localeCompare(b.date));
  return (
    <main id="main-content" className="page-shell shoots-page">
      <header className="event-page-intro"><p className="eyebrow">IN FOCUS / СЪЁМОЧНЫЕ ПРОЕКТЫ</p><div className="event-heading-row"><h1 className="page-heading">У каждого кадра<br /><span>есть история.</span></h1><p className="muted">Editorial, fashion и коммерческие съёмки.<br />Станьте частью следующей.</p></div></header>
      <section aria-label="Проекты съёмок">{shoots.map((shoot, index) => {
        const available = isEventAvailable(shoot, today);
        const status = getEventStatus(shoot, today);
        return <article key={shoot.id} className="shoot-project row g-4 g-lg-5">
          <div className="col-md-6"><Link href={`/events/${shoot.id}`} className="shoot-project-photo image-wrap" aria-label={`${shoot.title} — условия съёмки`}><Image src={shoot.image} alt={`Визуальная концепция съёмки ${shoot.title}`} fill sizes="(max-width: 767px) 100vw, 50vw" /><span className="tag">{shoot.id === "monochrome-stories" ? "EDITORIAL / TFP" : "COMMERCIAL"}</span></Link></div>
          <div className="col-md-6 shoot-project-info"><div className="d-flex justify-content-between align-items-center gap-3"><p className="eyebrow">{String(index + 1).padStart(2, "0")} / {shoot.city}</p><span className="tag">{status === "Закрыто" ? "Приём закрыт" : status}</span></div><h2>{shoot.title}</h2><p>{shoot.description}</p><dl className="shoot-facts"><div><dt>Съёмка</dt><dd><time dateTime={`${shoot.date}T${shoot.time}:00+05:00`}>{formatEventDate(shoot.date)} · {shoot.time}</time></dd></div><div><dt>Локация</dt><dd>{shoot.venue}</dd></div><div><dt>Команда</dt><dd>{shoot.organizer}</dd></div><div><dt>Заявки до</dt><dd><time dateTime={shoot.deadline}>{formatEventDate(shoot.deadline)}</time>, включительно</dd></div></dl><div className="d-flex flex-wrap align-items-center gap-3">{available && <Link href={`/casting?event=${shoot.id}`} className="button button-dark">Подать заявку ↗</Link>}<Link href={`/events/${shoot.id}`} className="text-link">Условия проекта ↗</Link></div>{!available && <p className="muted event-small-note">{status === "Завершено" ? "Съёмка уже состоялась." : status === "Отменено" ? "Проект отменён." : "Приём новых заявок завершён."}</p>}</div>
        </article>;
      })}</section>
      <p className="events-demo-note muted">Съёмки, команды, даты и условия — редакционные примеры. Отправленные заявки сохраняются на сервере сайта; реальное сотрудничество требует отдельного согласования.</p>
      <aside className="events-bottom-cta"><div><p className="eyebrow">ДЛЯ БРЕНДОВ И ФОТОГРАФОВ</p><h2>Ваша идея. Наши лица.</h2></div><Link href="/contact" className="button button-dark">Подобрать модель ↗</Link></aside>
    </main>
  );
}
