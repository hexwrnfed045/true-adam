import Image from "next/image";
import Link from "next/link";
import type { Model } from "@/data/models";
import FavoriteButton from "./FavoriteButton";
import "./models.css";

export default function ModelCard({ model, priority = false }: { model: Model; priority?: boolean }) {
  return (
    <article className="model-card">
      <div className="model-card-image">
        <Link href={`/models/${model.id}`} aria-label={`Открыть портфолио: ${model.name}`}>
          <Image
            src={model.image}
            alt={`Иллюстративный портрет для демонстрационного профиля ${model.name}`}
            fill
            sizes="(max-width: 575px) 90vw, (max-width: 991px) 45vw, 30vw"
            priority={priority}
          />
          <span className="model-open" aria-hidden="true">PORTFOLIO <span>↗</span></span>
        </Link>
        <FavoriteButton id={model.id} name={model.name} />
      </div>
      <div className="model-card-meta">
        <h2><Link href={`/models/${model.id}`}>{model.name}</Link></h2>
        <span aria-hidden="true">↗</span>
      </div>
      <p className="model-card-details"><span>{model.city} / {model.specialty}</span><span>{model.height} CM</span></p>
    </article>
  );
}
