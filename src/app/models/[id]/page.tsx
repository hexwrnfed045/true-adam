import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { models } from "@/data/models";
import FavoriteButton from "@/components/models/FavoriteButton";
import PortfolioGallery from "@/components/models/PortfolioGallery";
import CompCard from "@/components/models/CompCard";
import "@/components/models/models.css";

export function generateStaticParams() {
  return models.map((model) => ({ id: model.id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const model = models.find((item) => item.id === id);
  return { title: model?.name || "Модель не найдена", description: model ? `Демонстрационное портфолио ${model.name}: параметры, фотографии и запрос на сотрудничество.` : undefined };
}

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const index = models.findIndex((item) => item.id === id);
  const model = models[index];
  if (!model) notFound();
  const [firstName, ...lastName] = model.name.split(" ");
  const [chest, waist, hips] = model.measurements.split("/").map((value) => value.trim());
  const previous = models[(index - 1 + models.length) % models.length];
  const next = models[(index + 1) % models.length];
  const measurements = [
    ["HEIGHT / РОСТ", `${model.height} CM`],
    ["CHEST / ГРУДЬ", `${chest} CM`],
    ["WAIST / ТАЛИЯ", `${waist} CM`],
    ["HIPS / БЁДРА", `${hips} CM`],
    ["SHOE / ОБУВЬ", String(model.shoe)],
    ["HAIR / ВОЛОСЫ", model.hair],
    ["EYES / ГЛАЗА", model.eyes],
  ];

  return (
    <main id="main-content" className="page-shell model-profile">
      <div className="profile-topline">
        <Link href="/models" className="model-back">← ALL TALENT / ВСЕ МОДЕЛИ</Link>
        <span>{String(index + 1).padStart(2, "0")} / {String(models.length).padStart(2, "0")}</span>
      </div>
      <header className="profile-name-header">
        <p className="eyebrow">{model.city} / {model.specialty}</p>
        <h1><span>{firstName}</span><span>{lastName.join(" ")}</span></h1>
        <nav className="profile-section-nav" aria-label="Разделы портфолио">
          <a href="#measurements">MEASUREMENTS</a><a href="#bio">BIO</a><a href="#portfolio">PORTFOLIO</a>
        </nav>
      </header>
      <div className="profile-layout">
        <div className="profile-visual">
          <div className="profile-portrait">
            <Image src={model.image} alt={`Иллюстративный портрет для демо-профиля ${model.name}`} fill priority sizes="(max-width: 767px) 94vw, 60vw" />
            <FavoriteButton id={model.id} name={model.name} />
          </div>
          <p className="profile-photo-caption"><span>01 / PORTRAIT</span><span>Иллюстративное фото</span></p>
        </div>
        <aside className="profile-rail" aria-label="Параметры и сотрудничество">
          <section id="measurements" className="profile-measurements">
            <h2>MEASUREMENTS <span>/ ПАРАМЕТРЫ</span></h2>
            <dl className="profile-stats">{measurements.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </section>
          <section id="bio" className="profile-bio">
            <h2>BIO <span>/ О МОДЕЛИ</span></h2>
            <p>{model.experience}</p>
          </section>
          <Link className="profile-booking" href={`/contact?model=${model.id}`}><span>BOOK {firstName}</span><span aria-hidden="true">↗</span></Link>
          <p className="profile-action-hint">Запрос на съёмку с выбранной моделью.</p>
          <CompCard model={model} />
          <p className="profile-demo">DEMO PROFILE / Имя, параметры и опыт вымышлены. Фотографии иллюстрируют концепцию.</p>
        </aside>
      </div>
      <section className="profile-gallery" id="portfolio" aria-labelledby="portfolio-heading">
        <div className="profile-gallery-heading"><h2 id="portfolio-heading">PORTFOLIO<span>({String(model.gallery.length).padStart(2, "0")})</span></h2><p>SELECTED FRAMES / ИЛЛЮСТРАТИВНАЯ ПОДБОРКА</p></div>
        <PortfolioGallery images={model.gallery} name={model.name} />
        <p className="profile-gallery-note">Фотографии служат визуальными примерами и могут изображать разных людей. Они не подтверждают участие в проектах.</p>
      </section>
      <nav className="profile-pagination" aria-label="Другие модели">
        <Link href={`/models/${previous.id}`}><span>← PREVIOUS</span><strong>{previous.name}</strong></Link>
        <Link href={`/models/${next.id}`}><span>NEXT TALENT ↗</span><strong>{next.name}</strong></Link>
      </nav>
    </main>
  );
}
