"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import "./home-hero.css";

const icons = [
  { name: "Francisco Lachowski", short: "Chico", image: "/images/inspiration-chico.jpg", author: "Sara Cimino", source: "https://commons.wikimedia.org/wiki/File:Francisco_Lachowski_2011.jpg", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", position: "50% 28%" },
  { name: "Jordan Barrett", short: "Jordan", image: "/images/inspiration-jordan.jpg", author: "Stefan Heesch / Nordfriisk Photography", source: "https://commons.wikimedia.org/wiki/File:Jordan-barrett-mbfw-march-2022-fashion-week-berlin.jpg", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", position: "50% 30%" },
  { name: "Sean O’Pry", short: "Sean", image: "/images/inspiration-sean-opry.jpg", author: "Sara Cimino", source: "https://commons.wikimedia.org/wiki/File:Sean_Opry.jpg", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", position: "50% 24%" },
  { name: "David Gandy", short: "David", image: "/images/inspiration-david.jpg", author: "Walterlan Papetti", source: "https://commons.wikimedia.org/wiki/File:David_Gandy.jpg", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", position: "50% 24%" },
];

export default function HomeHero() {
  const [active, setActive] = useState(0);
  const model = icons[active];
  const secondary = icons[(active + 1) % icons.length];
  return <section className="chapter-hero page-shell" aria-label="The Icons — вдохновение Runway">
    <div className="chapter-hero-kicker"><span>Independent minds. Distinctive faces.</span><span>Almaty / Astana</span></div>
    <div className="chapter-hero-heading"><h1>ЛИЦА.<br /><em>ХАРАКТЕР.</em></h1><div><p>Внешность привлекает.<br />Индивидуальность остаётся.</p><Link className="editorial-link" href="/models">Открыть каталог моделей</Link></div></div>
    <div className="chapter-photo-story">
      <div className="chapter-portrait" id="icon-portrait"><Image key={model.image} src={model.image} alt={model.name + " — визуальный референс Runway"} fill priority sizes="(max-width: 650px) 92vw, 57vw" style={{objectPosition:model.position}} /><span className="chapter-image-label">THE ICONS / FASHION INSPIRATION</span></div>
      <div className="chapter-secondary"><div className="chapter-secondary-image"><Image key={secondary.image} src={secondary.image} alt={secondary.name + " — визуальный референс Runway"} fill sizes="(max-width: 650px) 38vw, 28vw" style={{objectPosition:secondary.position}} /></div><p>Присутствие.<br />Не требует объяснений.</p><Link href="/casting" className="editorial-link">Стать новым лицом</Link></div>
      <div className="chapter-icon-name" aria-live="polite"><span>{model.name.split(' ')[0]}</span><span>{model.name.split(' ').slice(1).join(' ')}</span></div>
    </div>
    <div className="chapter-icon-controls"><div className="chapter-icon-select" role="group" aria-label="Выбрать известную модель">{icons.map((icon,index)=><button type="button" key={icon.name} aria-pressed={index===active} aria-controls="icon-portrait" onClick={()=>setActive(index)}>{icon.short}</button>)}</div><p>Визуальные ориентиры. Не участники агентства.</p></div>
    <details className="chapter-photo-credits"><summary>Об авторах фотографий</summary><p>На экране: {model.name} и {secondary.name}. Фото кадрированы и показаны в чёрно-белой обработке.</p>{[model,secondary].map(icon=><p key={icon.name}>{icon.name}: {icon.author} · <a href={icon.source} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a> · <a href={icon.licenseUrl} target="_blank" rel="noopener noreferrer">{icon.license}</a>{icon.license.includes('SA') ? ". Адаптация: " + icon.license + "." : '.'}</p>)}</details>
  </section>;
}
