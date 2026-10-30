import Image from "next/image";
import Link from "next/link";
import type { Model } from "@/data/models";
import FavoriteButton from "./FavoriteButton";
import "./models.css";

export default function ModelCard({ model, priority = false }: { model: Model; priority?: boolean }) {
  return <article className="model-card">
    <div className="model-card-image">
      <Link href={`/models/${model.id}`} aria-label={`Портфолио: ${model.name}`}>
        <Image src={model.image} alt={`Портрет для демо-профиля ${model.name}`} fill sizes="(max-width: 575px) 100vw, (max-width: 991px) 50vw, 33vw" priority={priority} />
        <span className="model-open" aria-hidden="true">Смотреть портфолио <span>↗</span></span>
      </Link>
      <FavoriteButton id={model.id} name={model.name} />
      <span className="model-specialty">{model.specialty}</span>
    </div>
    <div className="model-card-meta"><h2><Link href={`/models/${model.id}`}>{model.name}</Link></h2><span aria-hidden="true">↗</span></div>
    <p className="model-card-details">{model.city}<span>Рост {model.height} см</span></p>
  </article>;
}
