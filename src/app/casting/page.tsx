import Link from "next/link";
import { RequestForm, FormImage } from "@/components/request-form";
import { events, formatEventDate, getEventStatus, getToday, isEventAvailable, isViewerRegistrationAvailable } from "@/data/events";
import { courses, isCourseAvailable } from "@/data/courses";

export const metadata = { title: "Кастинги и заявки" };

export default async function CastingPage({ searchParams }: PageProps<"/casting">) {
  const { event: eventId, course: courseId, role } = await searchParams;
  const today = getToday();
  const viewer = role === "viewer";
  const event = events.find(item => item.id === eventId);
  const course = courses.find(item => item.id === courseId);

  if (viewer || eventId !== undefined || courseId !== undefined) {
    const invalid = (eventId !== undefined && !event) ||
      (courseId !== undefined && !course) || (eventId !== undefined && courseId !== undefined) ||
      (viewer && (!event || courseId !== undefined));
    const destination = courseId !== undefined && !viewer ? "/academy" : "/events";
    const backLabel = destination === "/academy" ? "Все программы" : "Все события";
    const canApply = !invalid && (event
      ? viewer ? isViewerRegistrationAvailable(event, today) : isEventAvailable(event, today)
      : !!course && isCourseAvailable(course, today));
    const status = event && getEventStatus(event, today);
    let unavailable = "Приём заявок завершён.";
    if (invalid) unavailable = "Проект не найден. Выберите доступный показ, кастинг или программу.";
    else if (status === "Отменено") unavailable = "Событие отменено.";
    else if (status === "Завершено") unavailable = "Событие уже прошло.";
    else if (viewer && status === "Открыт набор") unavailable = "Запись зрителей на это событие недоступна.";
    else if (course) unavailable = "Группа уже начала обучение.";

    return (
      <main id="main-content" className="page-shell form-page targeted-application">
        <header className="page-heading">
          {!invalid && <p className="eyebrow">{viewer ? "Запись зрителем" : course ? "Заявка на обучение" : "Заявка модели"}</p>}
          <h1>{invalid ? "Ссылка на заявку недоступна" : (viewer ? `Запись зрителем на ${event?.title}` : event?.title ?? course?.title)}</h1>
          {!invalid && event && <p><time dateTime={`${event.date}T${event.time}:00+05:00`}>{formatEventDate(event.date)} · {event.time}</time> · {event.city} · {event.venue}</p>}
          {!invalid && course && <p><time dateTime={course.date}>Старт {formatEventDate(course.date)}</time> · {course.format}</p>}
          {canApply && viewer && <p>После отправки записи её статус появится в личном кабинете.</p>}
        </header>
        {canApply ? <><Link className="editorial-link targeted-application-back" href={destination}>{backLabel}</Link><RequestForm /></> :
          <section className="targeted-application-notice">
            <p>{unavailable}</p>
            {!invalid && event && <Link className="editorial-link" href={`/events/${event.id}`}>О событии</Link>}
            <Link className="button button-dark" href={destination}>{backLabel}</Link>
          </section>}
      </main>
    );
  }

  const openCastings = events.filter(event => event.type === "Кастинг" && isEventAvailable(event, today));
  return (
    <main id="main-content" className="page-shell form-page">
      <header className="page-heading">
        <p className="eyebrow">Runway Casting</p>
        <h1>Подать анкету модели</h1>
        <p>Оставьте общую анкету или выберите открытый проект.</p>
      </header>
      <div className="form-layout">
        <aside className="form-aside">
          <h2>Что подготовить</h2>
          <p>Для первого знакомства достаточно естественных фотографий. Профессиональное портфолио необязательно.</p>
          {openCastings.length > 0 && <div className="contact-details">
            {openCastings.map(event => <div key={event.id}><small>{formatEventDate(event.date)} · {event.city}</small><Link className="text-link" href={`/events/${event.id}`}>{event.title}</Link></div>)}
          </div>}
          <FormImage />
        </aside>
        <RequestForm />
      </div>
    </main>
  );
}
