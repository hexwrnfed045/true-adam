"use client";

import { useId } from "react";
import Image from "next/image";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";

export type GalleryFrame = {
  image: string;
  title: string;
  alt: string;
  subtitle: string;
  category?: string;
  credit?: string;
  source?: string;
};

export default function PhotoDialog({ items, active, onClose, onNavigate }: {
  items: GalleryFrame[];
  active: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const frame = active === null ? null : items[active];
  function move(direction: number) {
    if (active !== null && items.length > 1) onNavigate((active + direction + items.length) % items.length);
  }

  return <Dialog open={Boolean(frame)} onClose={onClose} maxWidth="lg" fullWidth aria-labelledby={titleId} aria-describedby={descriptionId}
    onKeyDown={(event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1);
      }
    }} slotProps={{ paper: { className: "backstage-dialog" } }}>
    <DialogContent>{frame && <>
      <div className="backstage-dialog-bar"><span>{frame.category || "Портфолио"} / Иллюстративная подборка</span><IconButton type="button" aria-label="Закрыть фотографию" onClick={onClose} autoFocus>×</IconButton></div>
      <div className="backstage-dialog-image"><Image src={frame.image} alt={frame.alt} fill sizes="90vw" style={{ objectFit: "contain" }} /></div>
      <div className="backstage-dialog-caption">
        <div><h2 id={titleId} aria-live="polite">{frame.title}</h2><p id={descriptionId}>{frame.subtitle}<span className="visually-hidden"> Используйте стрелки влево и вправо для смены фотографии. Escape закрывает просмотр.</span></p>
          {frame.credit && <p className="photo-credit">Фото: {frame.credit}{frame.source && <> · <a href={frame.source} target="_blank" rel="noopener noreferrer">Источник</a></>}</p>}
        </div>
        <div className="backstage-controls"><IconButton type="button" aria-label="Предыдущая фотография" onClick={() => move(-1)} disabled={items.length < 2}>←</IconButton><span role="status">{String((active ?? 0) + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</span><IconButton type="button" aria-label="Следующая фотография" onClick={() => move(1)} disabled={items.length < 2}>→</IconButton></div>
      </div>
    </>}</DialogContent>
  </Dialog>;
}
