"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { Model } from "@/data/models";

export default function CompCard({ model }: { model: Model }) {
  const image = useRef<HTMLImageElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const measurements = [
    ["HEIGHT / РОСТ", `${model.height} cm`],
    ["CHEST / WAIST / HIPS", model.measurements],
    ["SHOE / ОБУВЬ", String(model.shoe)],
    ["HAIR / ВОЛОСЫ", model.hair],
    ["EYES / ГЛАЗА", model.eyes],
    ["BASED IN / ГОРОД", model.city],
  ];

  async function print() {
    if (preparing) return;
    setPreparing(true);
    setError("");
    try {
      if (!image.current) throw new Error("Фотография ещё не готова.");
      await image.current.decode();
      await document.fonts.ready;
      window.print();
    } catch {
      setError("Не удалось подготовить фотографию к печати. Повторите попытку.");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div className="comp-card">
      <button type="button" className="profile-print" onClick={() => void print()} disabled={preparing} aria-describedby="comp-card-hint">
        <span>{preparing ? "PREPARING…" : "PRINT COMP CARD"}</span><span aria-hidden="true">↓</span>
      </button>
      <p className="profile-action-hint" id="comp-card-hint">Печать или сохранение карточки в PDF.</p>
      {error && <p className="comp-card-error" role="alert">{error}</p>}
      <article className="comp-card-paper" aria-hidden="true">
        <header className="comp-card-heading"><span>RUNWAY<br />MODELS</span><span>COMP CARD / {model.specialty}</span></header>
        <h2>{model.name}</h2>
        <div className="comp-card-body">
          <Image ref={image} src={model.image} alt="" width={720} height={960} unoptimized loading="eager" />
          <div><p className="comp-card-specialty">{model.specialty}</p><dl>{measurements.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
        </div>
        <footer><p>BOOKING / ЗАПРОС НА СЪЁМКУ</p><a href={`/contact?model=${model.id}`}>/contact?model={model.id}</a><p>Демонстрационный профиль. Имя и параметры вымышлены. Фотография из фотобанка.</p></footer>
      </article>
    </div>
  );
}
