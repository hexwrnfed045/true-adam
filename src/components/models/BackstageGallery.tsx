"use client";

import { useState } from "react";
import Image from "next/image";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import "./models.css";

const frames = [
  { image: "/images/backstage-01.jpg", title: "До первого выхода", category: "Backstage", subtitle: "Между репетицией и подиумом" },
  { image: "/images/hero-runway.jpg", title: "Линия движения", category: "Runway", subtitle: "Ритм, свет и силуэты" },
  { image: "/images/editorial-01.jpg", title: "Вне привычного кадра", category: "Editorial", subtitle: "Редакционная история" },
  { image: "/images/academy-01.jpg", title: "Язык тела", category: "Backstage", subtitle: "Внимание к каждому движению" },
  { image: "/images/model-03.jpg", title: "Пауза перед вспышкой", category: "Editorial", subtitle: "Присутствие в моменте" },
  { image: "/images/model-04.jpg", title: "Новая перспектива", category: "Editorial", subtitle: "Исследуя индивидуальность" },
];

export default function BackstageGallery() {
  const [category, setCategory] = useState("Все кадры");
  const [active, setActive] = useState<number | null>(null);
  const filtered = frames.filter((frame) => category === "Все кадры" || frame.category === category);
  const frame = active !== null ? filtered[active] : null;
  const move = (direction: number) => setActive((current) => current === null ? null : (current + direction + filtered.length) % filtered.length);
  return <>
    <div className="backstage-tabs" aria-label="Категории галереи">{["Все кадры", "Backstage", "Runway", "Editorial"].map((name) => <button className={category === name ? "active" : ""} key={name} onClick={() => { setCategory(name); setActive(null); }} aria-pressed={category === name}>{name}<span>{name === "Все кадры" ? frames.length : frames.filter((item) => item.category === name).length}</span></button>)}</div>
    <div className="backstage-grid">{filtered.map((item, index) => <figure key={item.title} className={index % 3 === 0 ? "backstage-wide" : ""}><button className="backstage-frame" onClick={() => setActive(index)} aria-label={`Открыть фотографию «${item.title}»`}><Image src={item.image} alt={item.title} fill sizes="(max-width: 767px) 100vw, 50vw" /><span className="backstage-expand" aria-hidden="true">↗</span></button><figcaption><div><h2>{item.title}</h2><p>{item.subtitle}</p></div><span>{item.category}</span></figcaption></figure>)}</div>
    <Dialog open={frame !== null} onClose={() => setActive(null)} maxWidth="lg" fullWidth aria-label={frame?.title || "Фотография галереи"} onKeyDown={(event) => { if (event.key === "ArrowRight") move(1); if (event.key === "ArrowLeft") move(-1); }} slotProps={{ paper: { className: "backstage-dialog" } }}>
      <DialogContent>{frame && <><div className="backstage-dialog-bar"><span>{frame.category} / Иллюстративная подборка</span><IconButton aria-label="Закрыть фотографию" onClick={() => setActive(null)}>×</IconButton></div><div className="backstage-dialog-image"><Image src={frame.image} alt={frame.title} fill sizes="90vw" style={{ objectFit: "contain" }} /></div><div className="backstage-dialog-caption"><div><h2>{frame.title}</h2><p>{frame.subtitle}</p></div><div className="backstage-controls"><IconButton aria-label="Предыдущая фотография" onClick={() => move(-1)}>←</IconButton><span>{String((active ?? 0) + 1).padStart(2, "0")} / {String(filtered.length).padStart(2, "0")}</span><IconButton aria-label="Следующая фотография" onClick={() => move(1)}>→</IconButton></div></div></>}</DialogContent>
    </Dialog>
  </>;
}
