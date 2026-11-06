"use client";

import { useState } from "react";
import Image from "next/image";
import PhotoDialog, { type GalleryFrame } from "./PhotoDialog";

export default function PortfolioGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState<number | null>(null);
  const items: GalleryFrame[] = images.map((image, index) => ({ image, title: `${name} / визуальная концепция ${String(index + 1).padStart(2, "0")}`, alt: `Иллюстративный кадр ${index + 1} демонстрационного портфолио ${name}`, subtitle: "Фотографии из фотобанка иллюстрируют концепцию портфолио и могут изображать разных людей." }));
  return <>
    <div className="row g-4">{items.map((item, index) => <div className="col-6" key={item.image}>
      <button type="button" className="profile-gallery-image profile-gallery-trigger" onClick={() => setActive(index)} aria-label={`Открыть кадр ${index + 1} портфолио ${name}`} aria-haspopup="dialog"><Image src={item.image} alt={item.alt} fill sizes="45vw" /><span className="backstage-expand" aria-hidden="true">↗</span></button>
    </div>)}</div>
    <PhotoDialog items={items} active={active} onClose={() => setActive(null)} onNavigate={setActive} />
  </>;
}
