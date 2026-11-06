"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import IconButton from "@mui/material/IconButton";
import { Arrow } from "@/components/site-shell";
import "./home-hero.css";

const inspirations = [
  { name: "Chico Lachowski", image: "/images/inspiration-chico.jpg", author: "Sara Cimino", source: "https://commons.wikimedia.org/wiki/File:Francisco_Lachowski_2011.jpg", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", position: "50% 34%", shareAlike: false },
  { name: "Jordan Barrett", image: "/images/inspiration-jordan.jpg", author: "Stefan Heesch / Nordfriisk Photography", source: "https://commons.wikimedia.org/wiki/File:Jordan-barrett-mbfw-march-2022-fashion-week-berlin.jpg", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", position: "50% 28%", shareAlike: true },
  { name: "Sean O’Pry", image: "/images/inspiration-sean-opry.jpg", author: "Sara Cimino", source: "https://commons.wikimedia.org/wiki/File:Sean_Opry.jpg", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", position: "50% 20%", shareAlike: false },
  { name: "David Gandy", image: "/images/inspiration-david.jpg", author: "Walterlan Papetti", source: "https://commons.wikimedia.org/wiki/File:David_Gandy.jpg", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", position: "50% 25%", shareAlike: true },
];

export default function HomeHero() {
  const [active, setActive] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const model = inspirations[active];
  const move = (direction: number) => setActive((current) => (current + direction + inspirations.length) % inspirations.length);

  return <section className="home-hero hero-famous" aria-label="Runway Models — вдохновение">
    <div className="hero-topline"><span>НЕЗАВИСИМАЯ ПЛАТФОРМА МОДЕЛЬНОЙ ИНДУСТРИИ</span><span>АЛМАТЫ / АСТАНА — EST. 2026</span></div>
    <div className="hero-grid">
      <div className="hero-copy">
        <p className="eyebrow"><span className="tiny-dot" /> NEW SEASON. NEW FACES.</p>
        <h1>ТВОЙ<br /><span>ВЫХОД.</span></h1>
        <p className="hero-description">Подиум начинается с характера.<br />Находи свой стиль, свою команду<br />и новые возможности.</p>
        <div className="hero-buttons"><Link href="/casting" className="button button-dark">Стать моделью <Arrow /></Link><Link href="/events" className="hero-secondary">Ближайшие показы <Arrow /></Link></div>
        <div className="hero-edition"><span>THE ICONS</span><span className="edition-line" /><span>INDIVIDUALITY IS EVERYTHING</span></div>
      </div>
      <div className="hero-famous-panel">
        <div className="hero-photo hero-famous-photo" id="hero-famous-photo">
          <Image key={model.image} src={model.image} alt={`${model.name} — фотография известной модели, визуальный референс`} fill priority={active === 0} sizes="(max-width: 600px) 92vw, 50vw" style={{ objectPosition: model.position }} />
          <span className="photo-vertical">THE ICONS / RUNWAY INSPIRATION</span>
          <div className="hero-photo-tag hero-famous-name"><div aria-live="polite"><small>ХАРАКТЕР ВНЕ ВРЕМЕНИ</small><strong>{model.name}</strong></div><div className="hero-famous-arrows"><IconButton aria-label="Предыдущая известная модель" onClick={() => move(-1)}>←</IconButton><IconButton aria-label="Следующая известная модель" onClick={() => move(1)}>→</IconButton></div></div>
        </div>
        <div className="hero-famous-tabs" role="group" aria-label="Выберите известную модель">{inspirations.map((item, index) => <button key={item.name} ref={element => { buttons.current[index] = element; }} onKeyDown={event => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            let next = index;
            if (event.key === "ArrowRight") next = (index + 1) % inspirations.length;
            else if (event.key === "ArrowLeft") next = (index - 1 + inspirations.length) % inspirations.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = inspirations.length - 1;
            else return;
            event.preventDefault(); setActive(next); buttons.current[next]?.focus();
          }} type="button" aria-pressed={active === index} aria-controls="hero-famous-photo" onClick={() => setActive(index)}><span>{String(index + 1).padStart(2, "0")}</span>{item.name}</button>)}</div>
        <div className="hero-famous-credits">
          <p>Визуальные референсы · не участники проекта</p>
          <small>Фото: {model.author} / <a href={model.source} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a> · <a href={model.licenseUrl} target="_blank" rel="noopener noreferrer">{model.license}</a>. Кадрировано, ч/б.{model.shareAlike && ` Адаптация: ${model.license}.`}</small>
        </div>
      </div>
    </div>
    <div className="hero-bottomline"><span>МОДЕЛИ. МОДА. ДВИЖЕНИЕ.</span><a href="#discover">ЛИСТАЙ И ОТКРЫВАЙ <span>↓</span></a><span>БОЛЬШЕ, ЧЕМ ВНЕШНОСТЬ</span></div>
  </section>;
}
