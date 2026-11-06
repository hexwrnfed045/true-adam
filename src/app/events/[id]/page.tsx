import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { events, formatEventDate, getEventStatus, getToday, isEventAvailable, isViewerRegistrationAvailable } from "@/data/events";
import "@/components/events/events.css";

export const dynamicParams = false;

export function generateStaticParams() { return events.map(event => ({ id: event.id })); }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = events.find(item => item.id === id);
  return { title: event ? event.title : "Событие не найдено" };
}

export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = events.find(item => item.id === id);
  if (!event) notFound();
  await connection();
  const today = getToday();
  const status = getEventStatus(event, today);
  const available = isEventAvailable(event, today);
  const viewerAvailable = isViewerRegistrationAvailable(event, today);
  const closedReason = status === "Отменено" ? "Организатор отменил это мероприятие." : status === "Завершено" ? "Это событие уже состоялось. Новые заявки не принимаются." : event.deadline < today ? `Срок подачи заявок истёк ${formatEventDate(event.deadline)}.` : "Набор участников на этот проект закрыт.";
  return (
    <main id="main-content" className="page-shell event-detail-page">
      <Link href="/events" className="text-link event-back-link">← Все события</Link>
      <div className="event-detail-heading"><p className="eyebrow">{event.type} / {event.city} / {event.date.slice(0, 4)}</p><h1 className="page-heading">{event.title}</h1><span className="tag">{status === "Закрыто" ? "Приём закрыт" : status}</span></div>
      <div className="row g-4 g-lg-5">
        <div className="col-lg-8">
          <div className="event-detail-photo image-wrap"><Image src={event.image} alt={`${event.title} — визуальная концепция события`} fill sizes="(max-width: 991px) 100vw, 66vw" priority /></div>
          <section className="event-detail-copy"><p className="eyebrow">О СОБЫТИИ</p><h2>Мода — это встреча.</h2><p>{event.description}</p></section>
          <section className="event-requirements" aria-labelledby="event-requirements-title"><h2 id="event-requirements-title" className="eyebrow">УСЛОВИЯ УЧАСТИЯ ДЛЯ МОДЕЛЕЙ</h2><ol>{event.requirements.map((requirement, index) => <li key={requirement}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{requirement}</li>)}</ol></section>
        </div>
        <aside className="col-lg-4"><div className="event-booking-panel"><p className="eyebrow">ДЕТАЛИ СОБЫТИЯ</p><dl><div><dt>Когда</dt><dd><time dateTime={`${event.date}T${event.time}:00+05:00`}>{formatEventDate(event.date, { day: "numeric", month: "long", year: "numeric" })}<br />{event.time} · время Казахстана</time></dd></div><div><dt>Где</dt><dd>{event.city}<br />{event.venue}</dd></div><div><dt>Организатор</dt><dd>{event.organizer}</dd></div><div><dt>Заявки до</dt><dd><time dateTime={event.deadline}>{formatEventDate(event.deadline, { day: "numeric", month: "long", year: "numeric" })}</time>, включительно</dd></div></dl>
          {available ? <><Link href={`/casting?event=${event.id}`} className="button button-dark">Подать заявку модели <span aria-hidden="true">↗</span></Link>{viewerAvailable ? <div className="event-viewer-block"><p className="eyebrow">ДЛЯ ЗРИТЕЛЕЙ</p><p>Открытый показ · вместимость {event.seats} мест</p><Link href={`/casting?event=${event.id}&role=viewer`} className="button button-light">Записаться зрителем ↗</Link><p className="muted event-small-note">Посещение показа и участие в составе моделей — разные записи. Статус вашей заявки появится в кабинете.</p></div> : <p className="muted event-small-note">{event.openToPublic ? "Зрительские места на этот показ недоступны." : "Закрытое событие. Зрительская запись недоступна."}</p>}</> : <div className="event-unavailable"><h3>Приём заявок закрыт</h3><p>{closedReason}</p><Link href="/events" className="text-link">Выбрать другое событие ↗</Link></div>}
          <p className="muted event-small-note">Событие, команда и площадка — редакционный пример. Заявка сохраняется на сервере сайта; она не подтверждает участие в реальном мероприятии.</p>
        </div></aside>
      </div>
    </main>
  );
}
