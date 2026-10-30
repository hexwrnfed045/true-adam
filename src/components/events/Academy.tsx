"use client";

import Image from "next/image";
import Link from "next/link";
import { Accordion, AccordionDetails, AccordionSummary } from "@mui/material";
import { courses } from "@/data/courses";
import { formatEventDate } from "@/data/events";
import "./events.css";

export default function Academy() {
  return (
    <main id="main-content" className="page-shell academy-page">
      <header className="academy-intro"><p className="eyebrow">RUNWAY ACADEMY / ВАША НОВАЯ ГЛАВА</p><div className="event-heading-row"><h1 className="page-heading">Уверенность.<br /><span>В каждом движении.</span></h1><p className="muted">Техника, которая становится естественной.<br />Обучение для тех, кто готов проявиться.</p></div></header>
      <div className="academy-lead-photo image-wrap"><Image src="/images/academy-01.jpg" alt="Подготовка к работе на подиуме" fill sizes="100vw" priority /><div className="academy-photo-caption"><span className="eyebrow">PRACTICE. PRESENCE. PERSONALITY.</span><p>Не просто идти.<br />Оставлять впечатление.</p></div></div>
      <section className="academy-courses" aria-labelledby="courses-title"><div className="section-head"><div><p className="eyebrow">НАПРАВЛЕНИЯ ОБУЧЕНИЯ</p><h2 id="courses-title">Найдите свою опору.</h2></div><span className="muted">03 программы / Сезон 2026</span></div>{courses.map((course, index) => <article id={course.id} className="academy-course row g-4 g-lg-5" key={course.id}><div className="col-md-4"><div className="academy-course-photo image-wrap"><Image src={course.image} alt={`Программа «${course.title}»`} fill sizes="(max-width: 767px) 100vw, 33vw" /><span className="academy-course-number">0{index + 1}</span></div></div><div className="col-md-8"><div className="academy-course-top"><span className="eyebrow">{course.duration}</span><span className="academy-price">{course.price}</span></div><h2>{course.title}</h2><p className="academy-course-description">{course.description}</p><p className="muted">{course.format}<br />Преподаватель: {course.teacher}</p><Accordion disableGutters elevation={0} className="course-accordion"><AccordionSummary expandIcon={<span aria-hidden="true">+</span>}><span>Программа курса</span></AccordionSummary><AccordionDetails><ol>{course.program.map(item => <li key={item}>{item}</li>)}</ol></AccordionDetails></Accordion><Accordion disableGutters elevation={0} className="course-accordion"><AccordionSummary expandIcon={<span aria-hidden="true">+</span>}><span>Расписание и формат</span></AccordionSummary><AccordionDetails>{course.schedule.map(item => <p key={item}>{item}</p>)}<p>{course.format}</p></AccordionDetails></Accordion><div className="academy-course-footer"><span className="eyebrow">СТАРТ {formatEventDate(course.date)}</span><Link href={`/casting?course=${course.id}`} className="button button-dark">Записаться на курс ↗</Link></div></div></article>)}</section>
      <aside className="academy-info-note"><p className="eyebrow">С ЧЕГО НАЧАТЬ?</p><h2>Опыт необязателен.<br />Любопытство — да.</h2><p>Все программы подходят начинающим от 18 лет. Оставьте заявку на понравившийся курс, чтобы познакомиться с процессом записи.</p><p className="muted">Программы, преподаватели, расписание и цены — демонстрационные данные. Оплата в прототипе не предусмотрена.</p></aside>
    </main>
  );
}
