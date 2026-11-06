"use client";

import { useState } from "react";
import Image from "next/image";
import PhotoDialog, { type GalleryFrame } from "./PhotoDialog";
import "./models.css";

const frames: GalleryFrame[] = [
  { image: "/images/backstage-01.jpg", title: "До первого выхода", category: "Backstage", subtitle: "Подготовка образов за кулисами", alt: "Дизайнеры готовят одежду за кулисами показа", credit: "Mihaela Claudia Puscas / Unsplash", source: "https://unsplash.com/photos/fashion-designers-prepare-backstage-for-a-show-LY4iUq8IKFg" },
  { image: "/images/hero-runway.jpg", title: "Линия движения", category: "Runway", subtitle: "Ритм, свет и силуэты", alt: "Модели идут по подиуму на показе", credit: "Ben Iwara / Unsplash", source: "https://unsplash.com/photos/a-group-of-women-walking-down-a-runway-01W4Xbz3Ayk" },
  { image: "/images/editorial-01.jpg", title: "Вне привычного кадра", category: "Editorial", subtitle: "Редакционная история", alt: "Мужская fashion-съёмка в чёрном костюме", credit: "Nicolas Ladino Silva / Unsplash", source: "https://unsplash.com/photos/a-man-in-a-black-suit-and-sunglasses-holding-a-bag-etgBglCmpg8" },
  { image: "/images/backstage-02.jpg", title: "Последние детали", category: "Backstage", subtitle: "Работа команды перед показом", alt: "Специалисты осматривают платья перед показом", credit: "Mihaela Claudia Puscas / Unsplash", source: "https://unsplash.com/photos/fashion-professionals-inspect-dresses-before-a-show-7bfUz5T9JLE" },
  { image: "/images/model-03.jpg", title: "Пауза перед вспышкой", category: "Editorial", subtitle: "Присутствие в моменте", alt: "Чёрно-белый женский fashion-портрет", credit: "Jay Soundo / Unsplash", source: "https://unsplash.com/photos/a-stylish-woman-poses-for-a-portrait-in-black-and-white-Pkocq2NKJeg" },
  { image: "/images/model-04.jpg", title: "Новая перспектива", category: "Editorial", subtitle: "Исследуя индивидуальность", alt: "Мужской портрет в пиджаке и водолазке", credit: "Zahir Namane / Unsplash", source: "https://unsplash.com/photos/man-wearing-brown-blazer-photo-Q2315trSznw" },
];
const categories = ["Все кадры", "Backstage", "Runway", "Editorial"];

export default function BackstageGallery() {
  const [category, setCategory] = useState("Все кадры");
  const [active, setActive] = useState<number | null>(null);
  const filtered = frames.filter((frame) => category === "Все кадры" || frame.category === category);

  return <>
    <div className="backstage-tabs" role="group" aria-label="Категории галереи">{categories.map((name) => <button type="button" className={category === name ? "active" : ""} key={name} onClick={() => { setCategory(name); setActive(null); }} aria-pressed={category === name} aria-controls="backstage-grid">{name}<span>{name === "Все кадры" ? frames.length : frames.filter((item) => item.category === name).length}</span></button>)}</div>
    <p className="visually-hidden" role="status">Показано фотографий: {filtered.length}</p>
    <div className="backstage-grid" id="backstage-grid">{filtered.map((item, index) => <figure key={item.title} className={index % 3 === 0 ? "backstage-wide" : ""}>
      <button type="button" className="backstage-frame" onClick={() => setActive(index)} aria-label={`Открыть фотографию «${item.title}»`} aria-haspopup="dialog"><Image src={item.image} alt={item.alt} fill sizes={index % 3 === 0 ? "90vw" : "45vw"} /><span className="backstage-expand" aria-hidden="true">↗</span></button>
      <figcaption><div><h2>{item.title}</h2><p>{item.subtitle}</p></div><span>{item.category}</span></figcaption>
    </figure>)}</div>
    <PhotoDialog items={filtered} active={active} onClose={() => setActive(null)} onNavigate={setActive} />
  </>;
}
