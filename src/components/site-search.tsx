"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Dialog, DialogContent, DialogTitle, Fade, IconButton, TextField, useMediaQuery } from "@mui/material";
import { models } from "@/data/models";
import "./site-search.css";

const pages = [
  {href:"/models", name:"Каталог моделей", detail:"Портфолио, параметры и избранное"},
  {href:"/casting", name:"Стать моделью", detail:"Кастинги и общая анкета"},
  {href:"/events", name:"События и показы", detail:"Даты и календарь"},
  {href:"/shoots", name:"Съёмки", detail:"Работа перед камерой"},
  {href:"/academy", name:"Академия", detail:"Обучение и программы"},
  {href:"/backstage", name:"Backstage", detail:"По другую сторону подиума"},
  {href:"/contact", name:"Сотрудничество", detail:"Для брендов и фотографов"},
  {href:"/account", name:"Личный кабинет", detail:"Мои заявки и избранное"},
];
export default function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [motion, setMotion] = useState("closed");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const searchTiming = reducedMotion ? 0 : { enter: 420, exit: 220 };
  const [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(!event.repeat&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k") { event.preventDefault(); trigger.current?.click(); }
    };
    window.addEventListener("keydown",key); return ()=>window.removeEventListener("keydown",key);
  },[]);
  const normalized = query.trim().toLocaleLowerCase("ru").replaceAll("ё","е");
  const foundModels = models.filter(model=>(model.name+" "+model.city+" "+model.specialty).toLocaleLowerCase("ru").replaceAll("ё","е").includes(normalized));
  const foundPages = pages.filter(page=>(page.name+" "+page.detail).toLocaleLowerCase("ru").replaceAll("ё","е").includes(normalized));
  function openSearch() {
    if (open) return;
    setQuery("");
    setMotion("entering");
    setOpen(true);
  }

  function closeSearch() {
    setMotion("exiting");
    setOpen(false);
  }

  return <>
    <IconButton
      ref={trigger}
      className="site-search-trigger"
      aria-label="Поиск по сайту"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? "site-search-panel" : undefined}
      aria-keyshortcuts="Control+k Meta+k"
      onClick={openSearch}
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </IconButton>
    <Dialog
      open={open}
      onClose={closeSearch}
      maxWidth="md"
      fullWidth
      aria-labelledby="site-search-title"
      className="site-search-dialog"
      data-search-motion={motion}
      slots={{ transition: Fade }}
      transitionDuration={searchTiming}
      slotProps={{
        paper: { id: "site-search-panel" },
        backdrop: { transitionDuration: searchTiming },
        transition: { onEntered: () => setMotion("entered"), onExited: () => setMotion("closed") },
      }}
    >
      <DialogTitle id="site-search-title" className="search-dialog-title">
        Найти своё
        <IconButton onClick={closeSearch} aria-label="Закрыть поиск">×</IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField autoFocus label="Модель, город или раздел" type="search" value={query} onChange={event => setQuery(event.target.value)} fullWidth />
        <p className="search-results-count" role="status">Результатов: {foundModels.length + foundPages.length}</p>
        {foundModels.length > 0 && <>
          <h2 className="editorial-kicker">Модели</h2>
          <div className="site-search-models">
            {foundModels.map(model => (
              <Link key={model.id} href={`/models/${model.id}`} onClick={closeSearch}>
                <Image src={model.image} width={56} height={72} alt="" />
                <span>{model.name}<small>{model.specialty} / {model.city}</small></span>
              </Link>
            ))}
          </div>
        </>}
        {foundPages.length > 0 && <>
          <h2 className="editorial-kicker">Разделы</h2>
          <div className="site-search-pages">
            {foundPages.map(page => (
              <Link key={page.href} href={page.href} onClick={closeSearch}>
                {page.name}<small>{page.detail}</small>
              </Link>
            ))}
          </div>
        </>}
        {!foundModels.length && !foundPages.length && (
          <div className="search-empty">
            <h2>Пока ничего.</h2>
            <p>Попробуйте другое имя, город или название раздела.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  </>;
}
