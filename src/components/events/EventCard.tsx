import Image from "next/image";
import Link from "next/link";
import { formatEventDate, getEventStatus, getToday, type RunwayEvent } from "@/data/events";

export default function EventCard({ event, today = getToday() }: { event: RunwayEvent; today?: string }) {
  const status = getEventStatus(event, today);
  return (
    <article className="event-card">
      <Link href={`/events/${event.id}`} className="event-card-photo image-wrap" aria-label={`${event.title} — подробности события`}>
        <Image src={event.image} alt={`Визуальная концепция: ${event.title}`} fill sizes="(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 33vw" />
        <span className="event-card-type tag">{event.type}</span>
        <span className={`event-card-state ${status === "Открыт набор" ? "event-card-state-open" : ""}`}>{status === "Закрыто" ? "Приём закрыт" : status}</span>
      </Link>
      <div className="event-card-meta"><time dateTime={`${event.date}T${event.time}:00+05:00`}>{formatEventDate(event.date)} · {event.time}</time><span>{event.city}</span></div>
      <Link href={`/events/${event.id}`} className="event-card-title"><h2>{event.title}</h2><span aria-hidden="true">↗</span></Link>
      <p className="muted">{event.venue}</p>
    </article>
  );
}
