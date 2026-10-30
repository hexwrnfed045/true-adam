import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { events, formatEventDate, isEventAvailable } from "@/data/events";
import "@/components/events/events.css";

export function generateStaticParams() { return events.map(event => ({ id: event.id })); }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = events.find(item => item.id === id);
  return { title: event ? `${event.title}` : "Событие не найдено" };
}

export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = events.find(item => item.id === id);
  if (!event) notFound();
  const available = isEventAvailable(event);
  return (
    <main id="main-content" className="page-shell event-detail-page">
      <Link href="/events" className="text-link event-back-link">← Все события</Link>
      <div className="event-detail-heading"><p className="eyebrow">{event.type} / {event.city} / 2026</p><h1 className="page-heading">{event.title}</h1><span className="tag">{event.status}</span></div>
      <div className="row g-4 g-lg-5"><div className="col-lg-8"><div className="event-detail-photo image-wrap"><Image src={event.image} alt={`${event.title} — визуальная история события`} fill sizes="(max-width: 991px) 100vw, 66vw" priority /></div><section className="event-detail-copy"><p className="eyebrow">О СОБЫТИИ</p><h2>Мода — это встреча.</h2><p>{event.description}</p></section><section className="event-requirements"><p className="eyebrow">УСЛОВИЯ УЧАСТИЯ ДЛЯ МОДЕЛЕЙ</p><ol>{event.requirements.map((requirement, index) => <li key={requirement}><span>{String(index + 1).padStart(2, "0")}</span>{requirement}</li>)}</ol></section></div><aside className="col-lg-4"><div className="event-booking-panel"><p className="eyebrow">ДЕТАЛИ СОБЫТИЯ</p><dl><div><dt>Когда</dt><dd>{formatEventDate(event.date, { day: "numeric", month: "long", year: "numeric" })}<br />{event.time}</dd></div><div><dt>Где</dt><dd>{event.city}<br />{event.venue}</dd></div><div><dt>Организатор</dt><dd>{event.organizer}</dd></div><div><dt>Заявки до</dt><dd>{formatEventDate(event.deadline)}</dd></div></dl>{available ? <><Link href={`/casting?event=${event.id}`} className="button button-dark">Подать заявку модели <span aria-hidden="true">↗</span></Link>{event.openToPublic && event.seats > 0 ? <div className="event-viewer-block"><p className="eyebrow">ДЛЯ ЗРИТЕЛЕЙ</p><p>Открытый показ · {event.seats} мест</p><Link href={`/casting?event=${event.id}&role=viewer`} className="button button-light">Записаться зрителем ↗</Link></div> : <p className="muted event-small-note">Закрытое событие. Зрительская запись недоступна.</p>}</> : <div className="event-unavailable"><h3>Приём заявок закрыт</h3><p>{event.status === "Отменено" ? "Организатор отменил это мероприятие." : event.status === "Завершено" ? "Это событие уже состоялось." : "Команда проекта уже сформирована."}</p><Link href="/events" className="text-link">Выбрать другое событие ↗</Link></div>}<p className="muted event-small-note">Демонстрационное событие. Заявки в этом прототипе сохраняются только в вашем браузере.</p></div></aside></div>
    </main>
  );
}
