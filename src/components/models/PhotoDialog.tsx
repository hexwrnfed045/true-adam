"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Fade from "@mui/material/Fade";
import useMediaQuery from "@mui/material/useMediaQuery";

export type GalleryFrame = {
  image: string;
  title: string;
  alt: string;
  subtitle: string;
  category?: string;
  credit?: string;
  source?: string;
};

function PhotoFrame({ frame, onStep }: { frame: GalleryFrame; onStep: (direction: number) => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  return <div
    className="backstage-dialog-image photo-viewer-frame"
    aria-busy={!loaded && !failed}
    onTouchStart={event => {
      const touch = event.touches[0];
      start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    }}
    onTouchEnd={event => {
      const touch = event.changedTouches[0];
      if (touch && start.current) {
        const dx = touch.clientX - start.current.x;
        const dy = touch.clientY - start.current.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onStep(dx < 0 ? 1 : -1);
      }
      start.current = null;
    }}
    onTouchCancel={() => { start.current = null; }}
  >
    {!loaded && !failed && <span className="photo-viewer-loading" role="status">Загружаем фотографию…</span>}
    {!failed && <Image
      src={frame.image}
      alt={frame.alt}
      fill
      sizes="90vw"
      loading="eager"
      className={loaded ? "photo-viewer-image is-loaded" : "photo-viewer-image"}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      style={{ objectFit: "contain" }}
    />}
    {failed && <div className="photo-viewer-error" role="alert"><p>Фотография не загрузилась.</p><a href={frame.image} target="_blank" rel="noopener noreferrer">Открыть отдельно</a></div>}
  </div>;
}

export default function PhotoDialog({ items, active, onClose, onNavigate }: {
  items: GalleryFrame[];
  active: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const currentFrame = active === null ? null : items[active] ?? null;
  const [lastView, setLastView] = useState({ frame: currentFrame, index: active ?? 0, total: items.length });
  // Keep the rendered photo and geometry intact until the closing transition finishes.
  if (currentFrame && (lastView.frame !== currentFrame || lastView.index !== active || lastView.total !== items.length)) {
    setLastView({ frame: currentFrame, index: active!, total: items.length });
  }
  const frame = currentFrame ?? lastView.frame;
  const visibleIndex = active ?? lastView.index;
  const visibleTotal = active === null ? lastView.total : items.length;
  function move(direction: number) {
    if (active !== null && items.length > 1) onNavigate((active + direction + items.length) % items.length);
  }

  return <Dialog open={active !== null && Boolean(currentFrame)} onClose={onClose} maxWidth="lg" fullWidth aria-labelledby={titleId} aria-describedby={descriptionId}
    className="photo-viewer-modal"
    slots={{ transition: Fade }}
    transitionDuration={reduceMotion ? 0 : { enter: 260, exit: 180 }}
    onKeyDown={(event) => {
      if (active === null || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1);
      }
      if (items.length > 1 && (event.key === "Home" || event.key === "End")) {
        event.preventDefault(); onNavigate(event.key === "Home" ? 0 : items.length - 1);
      }
    }} slotProps={{ paper: { className: "backstage-dialog photo-viewer-paper" } }}>
    <DialogContent>{frame && <>
      <div className="backstage-dialog-bar"><span>{frame.category || "Портфолио"} / Иллюстративная подборка</span><IconButton type="button" aria-label="Закрыть фотографию" onClick={onClose} autoFocus>×</IconButton></div>
      <PhotoFrame key={frame.image} frame={frame} onStep={move} />
      <div className="backstage-dialog-caption">
        <div><h2 id={titleId} aria-live="polite">{frame.title}</h2><p id={descriptionId}>{frame.subtitle}<span className="visually-hidden"> Стрелки влево и вправо или свайп меняют фотографию. Home — первый кадр, End — последний. Escape закрывает просмотр.</span></p>
          {frame.credit && <p className="photo-credit">Фото: {frame.credit}{frame.source && <> · <a href={frame.source} target="_blank" rel="noopener noreferrer">Источник</a></>}</p>}
        </div>
        <div className="backstage-controls"><IconButton type="button" aria-label="Предыдущая фотография" onClick={() => move(-1)} disabled={visibleTotal < 2}>←</IconButton><span role="status">{String(visibleIndex + 1).padStart(2, "0")} / {String(visibleTotal).padStart(2, "0")}</span><IconButton type="button" aria-label="Следующая фотография" onClick={() => move(1)} disabled={visibleTotal < 2}>→</IconButton></div>
      </div>
    </>}</DialogContent>
  </Dialog>;
}
