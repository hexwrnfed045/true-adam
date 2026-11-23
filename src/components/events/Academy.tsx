"use client";

import Image from "next/image";
import Link from "next/link";
import { Accordion, AccordionDetails, AccordionSummary } from "@mui/material";
import { courses, isCourseAvailable } from "@/data/courses";
import { formatEventDate } from "@/data/events";
import "./events.css";

export default function Academy({ today }: { today: string }) {
  const availableCourses = courses.filter(course => isCourseAvailable(course, today));
  return (
    <main id="main-content" className="page-shell academy-page">
      <header className="academy-intro"><div className="event-heading-row"><h1 className="page-heading">Академия <em>Runway</em></h1><p className="muted">Дефиле, позирование и работа перед камерой.</p></div></header>
      {availableCourses.length === 0 && <section className="academy-enrollment-status" aria-labelledby="academy-enrollment-title"><div><p className="eyebrow">СТАТУС НАБОРА</p><h2 id="academy-enrollment-title">Сейчас набор закрыт.</h2><p>Все опубликованные группы уже начали обучение. Ниже — программы прошедшего набора; новые даты появятся в этом разделе.</p></div><Link href="/events" className="button button-light">Посмотреть события ↗</Link></section>}
      <div className="academy-lead-photo image-wrap"><Image src="/images/academy-01.jpg" alt="Визуальный референс: пластика и работа перед камерой" fill sizes="100vw" priority /></div>
      <section className="academy-courses" aria-labelledby="courses-title">
        <div className="section-head"><div><h2 id="courses-title">Программы</h2></div><span className="muted">{availableCourses.length ? `${availableCourses.length} открытых программ` : "Программы прошедшего набора"}</span></div>
        {courses.map(course => {
          const available = isCourseAvailable(course, today);
          return <article id={course.id} aria-labelledby={`${course.id}-title`} className="academy-course row g-4 g-lg-5" key={course.id}>
            <div className="col-md-4"><div className="academy-course-photo image-wrap"><Image src={course.image} alt={`Визуальная концепция программы «${course.title}»`} fill sizes="(max-width: 767px) 100vw, 33vw" /></div></div>
            <div className="col-md-8">
              <div className="academy-course-top"><span className="eyebrow">{course.duration}</span><span className="academy-price">{course.price}</span></div>
              <h2 id={`${course.id}-title`}>{course.title}</h2>
              <p className="academy-course-description">{course.description}</p>
              <p className="muted">{course.format}<br />Преподаватель: {course.teacher}</p>
              <Accordion disableGutters elevation={0} className="course-accordion"><AccordionSummary id={`${course.id}-program-heading`} aria-controls={`${course.id}-program`} expandIcon={<span aria-hidden="true">+</span>}><span>Программа курса</span></AccordionSummary><AccordionDetails id={`${course.id}-program`}><ol>{course.program.map(item => <li key={item}>{item}</li>)}</ol></AccordionDetails></Accordion>
              <Accordion disableGutters elevation={0} className="course-accordion"><AccordionSummary id={`${course.id}-schedule-heading`} aria-controls={`${course.id}-schedule`} expandIcon={<span aria-hidden="true">+</span>}><span>Расписание и формат</span></AccordionSummary><AccordionDetails id={`${course.id}-schedule`}>{course.schedule.map(item => <p key={item}>{item}</p>)}<p>{course.format}</p><p>Время занятий — местное, Казахстан (UTC+5). Запись принимается до даты начала группы включительно.</p></AccordionDetails></Accordion>
              <div className="academy-course-footer"><div><p className="eyebrow">СТАРТ <time dateTime={course.date}>{formatEventDate(course.date, { day: "numeric", month: "long", year: "numeric" })}</time></p><span className="tag">{available ? "Открыта запись" : "Набор завершён"}</span>{!available && <p className="academy-next-dates">Новые даты обучения появятся в этом разделе.</p>}</div>{available ? <Link href={`/casting?course=${course.id}`} className="button button-dark" aria-label={`Записаться на курс «${course.title}»`}>Записаться на курс ↗</Link> : <Link href="/events" className="button button-light">Посмотреть события ↗</Link>}</div>
            </div>
          </article>;
        })}
      </section>
      <aside className="academy-info-note"><h2>Условия обучения</h2><p>{availableCourses.length ? "Все программы подходят начинающим от 18 лет. Выберите доступную группу и оставьте заявку. Статус и выбранная программа появятся в личном кабинете." : "Все программы рассчитаны на участников от 18 лет. Пока новый набор не объявлен, изучите программу и расписание прошедших групп. Приём заявок возобновится после публикации новых дат."}</p><p className="muted">Курсы, преподаватели, расписание и цены — редакционные примеры. Заявки сохраняются на сервере сайта. Это не подтверждение реального обучения; онлайн-оплата не предусмотрена.</p></aside>
    </main>
  );
}
