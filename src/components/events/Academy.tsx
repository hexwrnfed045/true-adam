"use client";

import Image from "next/image";
import Link from "next/link";
import { Accordion, AccordionDetails, AccordionSummary } from "@mui/material";
import { courses, isCourseAvailable } from "@/data/courses";
import { formatEventDate } from "@/data/events";
import "./events.css";

export default function Academy({ today }: { today: string }) {
  return (
    <main id="main-content" className="page-shell academy-page">
      <header className="academy-intro"><p className="eyebrow">RUNWAY ACADEMY / ВАША НОВАЯ ГЛАВА</p><div className="event-heading-row"><h1 className="page-heading">Уверенность.<br /><span>В каждом движении.</span></h1><p className="muted">Техника, которая становится естественной.<br />Обучение для тех, кто готов проявиться.</p></div></header>
      <div className="academy-lead-photo image-wrap"><Image src="/images/academy-01.jpg" alt="Визуальный референс: пластика и работа перед камерой" fill sizes="100vw" priority /><div className="academy-photo-caption"><span className="eyebrow">PRACTICE. PRESENCE. PERSONALITY.</span><p>Не просто идти.<br />Оставлять впечатление.</p></div></div>
      <section className="academy-courses" aria-labelledby="courses-title">
        <div className="section-head"><div><p className="eyebrow">НАПРАВЛЕНИЯ ОБУЧЕНИЯ</p><h2 id="courses-title">Найдите свою опору.</h2></div><span className="muted">{String(courses.length).padStart(2, "0")} программы / Сезон 2026</span></div>
        {courses.map((course, index) => {
          const available = isCourseAvailable(course, today);
          return <article id={course.id} aria-labelledby={`${course.id}-title`} className="academy-course row g-4 g-lg-5" key={course.id}>
            <div className="col-md-4"><div className="academy-course-photo image-wrap"><Image src={course.image} alt={`Визуальная концепция программы «${course.title}»`} fill sizes="(max-width: 767px) 100vw, 33vw" /><span className="academy-course-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span></div></div>
            <div className="col-md-8">
              <div className="academy-course-top"><span className="eyebrow">{course.duration}</span><span className="academy-price">{course.price}</span></div>
              <h2 id={`${course.id}-title`}>{course.title}</h2>
              <p className="academy-course-description">{course.description}</p>
              <p className="muted">{course.format}<br />Преподаватель: {course.teacher}</p>
              <Accordion disableGutters elevation={0} className="course-accordion"><AccordionSummary id={`${course.id}-program-heading`} aria-controls={`${course.id}-program`} expandIcon={<span aria-hidden="true">+</span>}><span>Программа курса</span></AccordionSummary><AccordionDetails id={`${course.id}-program`}><ol>{course.program.map(item => <li key={item}>{item}</li>)}</ol></AccordionDetails></Accordion>
              <Accordion disableGutters elevation={0} className="course-accordion"><AccordionSummary id={`${course.id}-schedule-heading`} aria-controls={`${course.id}-schedule`} expandIcon={<span aria-hidden="true">+</span>}><span>Расписание и формат</span></AccordionSummary><AccordionDetails id={`${course.id}-schedule`}>{course.schedule.map(item => <p key={item}>{item}</p>)}<p>{course.format}</p><p>Время занятий — местное, Казахстан (UTC+5). Запись принимается до даты начала группы включительно.</p></AccordionDetails></Accordion>
              <div className="academy-course-footer"><div><p className="eyebrow">СТАРТ <time dateTime={course.date}>{formatEventDate(course.date, { day: "numeric", month: "long", year: "numeric" })}</time></p><span className="tag">{available ? "Открыта запись" : "Группа уже начала обучение"}</span></div>{available ? <Link href={`/casting?course=${course.id}`} className="button button-dark" aria-label={`Записаться на курс «${course.title}»`}>Записаться на курс ↗</Link> : <Link href="/contact" className="button button-light">Узнать о следующем наборе ↗</Link>}</div>
            </div>
          </article>;
        })}
      </section>
      <aside className="academy-info-note"><p className="eyebrow">С ЧЕГО НАЧАТЬ?</p><h2>Опыт необязателен.<br />Любопытство — да.</h2><p>Все программы подходят начинающим от 18 лет. Выберите направление и оставьте заявку на доступную группу. Её статус и выбранная программа будут доступны в личном кабинете.</p><p className="muted">Курсы, преподаватели, расписание и цены — редакционные примеры. Заявки сохраняются на сервере сайта. Это не подтверждение реального обучения; онлайн-оплата не предусмотрена.</p></aside>
    </main>
  );
}
