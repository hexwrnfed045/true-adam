import Image from "next/image";
import Link from "next/link";
import type { Model } from "@/data/models";
import FavoriteButton from "./FavoriteButton";
import "./models.css";

export default function ModelCard({
  model,
  priority = false,
  catalogUrl,
  imageSizes = "(max-width: 575px) 90vw, (max-width: 991px) 45vw, 30vw",
}: {
  model: Model;
  priority?: boolean;
  catalogUrl?: string;
  imageSizes?: string;
}) {
  const href = `/models/${model.id}${catalogUrl ? `?from=${encodeURIComponent(catalogUrl)}` : ""}`;
  return (
    <article className="model-card">
      <div className="model-card-image">
        <Link href={href} aria-label={`Открыть портфолио: ${model.name}`}>
          <Image
            src={model.image}
            alt={`Иллюстративный портрет для демонстрационного профиля ${model.name}`}
            fill
            sizes={imageSizes}
            priority={priority}
          />
          <span className="model-open" aria-hidden="true">PORTFOLIO <span>↗</span></span>
        </Link>
        <FavoriteButton id={model.id} name={model.name} />
      </div>
      <div className="model-card-meta">
        <h2><Link href={href}>{model.name}</Link></h2>
        <span aria-hidden="true">↗</span>
      </div>
      <p className="model-card-details"><span>{model.city} / {model.specialty}</span><span>{model.height} CM</span></p>
    </article>
  );
}
