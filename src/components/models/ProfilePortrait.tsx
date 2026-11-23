"use client";

import { useState } from "react";
import Image from "next/image";
import type { Model } from "@/data/models";
import FavoriteButton from "./FavoriteButton";
import PhotoDialog, { type GalleryFrame } from "./PhotoDialog";

export default function ProfilePortrait({ model }: { model: Model }) {
  const [active, setActive] = useState<number | null>(null);
  const items: GalleryFrame[] = [...new Set([model.image, ...model.gallery])].map((image, index) => ({
    image,
    title: `${model.name} / ${String(index + 1).padStart(2, "0")}`,
    alt: `Иллюстративная фотография ${index + 1} демо-профиля ${model.name}`,
    subtitle: "Фотографии иллюстрируют концепцию портфолио и могут изображать разных людей.",
  }));

  return <>
    <div className="profile-portrait">
      <button type="button" className="profile-portrait-trigger" aria-label={`Открыть фотографии: ${model.name}`} aria-haspopup="dialog" aria-expanded={active !== null} onClick={() => setActive(0)}>
        <Image src={model.image} alt={`Иллюстративный портрет для демо-профиля ${model.name}`} fill priority sizes="(max-width: 767px) 94vw, 60vw" />
        <span className="profile-portrait-view">Открыть фото <span aria-hidden="true">↗</span></span>
      </button>
      <FavoriteButton id={model.id} name={model.name} />
    </div>
    <PhotoDialog items={items} active={active} onClose={() => setActive(null)} onNavigate={setActive} />
  </>;
}
