import Image from "next/image";
import Link from "next/link";
import { formatEventDate, type RunwayEvent } from "@/data/events";

export default function EventCard({ event }: { event: RunwayEvent }) {
  return (
    <article className="event-card">
      <Link href={`/events/${event.id}`} className="event-card-photo image-wrap" aria-label={`${event.title} — подробности события`}>
        <Image src={event.image} alt={`${event.type}: ${event.title}`} fill sizes="(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 33vw" />
        <span className="event-card-type tag">{event.type}</span>
        {(event.status !== "Открыт набор") && <span className="event-card-state">{event.status}</span>}
      </Link>
      <div className="event-card-meta"><span>{formatEventDate(event.date)} · {event.time}</span><span>{event.city}</span></div>
      <Link href={`/events/${event.id}`} className="event-card-title"><h2>{event.title}</h2><span aria-hidden="true">↗</span></Link>
      <p className="muted">{event.venue}</p>
    </article>
  );
}
