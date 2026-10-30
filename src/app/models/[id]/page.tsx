import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { models } from "@/data/models";
import FavoriteButton from "@/components/models/FavoriteButton";
import "@/components/models/models.css";

export function generateStaticParams() { return models.map((model) => ({ id: model.id })); }
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const model = models.find((item) => item.id === id);
  return { title: model ? `${model.name}` : "Модель не найдена" };
}

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = models.find((item) => item.id === id);
  if (!model) notFound();
  return <main id="main-content" className="page-shell model-profile">
    <Link className="text-link model-back" href="/models">← Все модели</Link>
    <div className="row g-4 g-lg-5 align-items-start">
      <div className="col-md-6"><div className="profile-portrait"><Image src={model.image} alt={`Иллюстрация для демо-профиля ${model.name}`} fill priority sizes="(max-width: 767px) 100vw, 50vw" /><FavoriteButton id={model.id} name={model.name} /></div></div>
      <div className="col-md-6 profile-copy"><p className="eyebrow">{model.specialty} / {model.city}</p><h1>{model.name}</h1><p className="profile-demo">Демонстрационный профиль</p><p className="profile-description">{model.experience}</p>
        <dl className="profile-stats">{[["Рост", `${model.height} см`], ["Параметры", model.measurements], ["Обувь", String(model.shoe)], ["Волосы", model.hair], ["Глаза", model.eyes], ["Город", model.city]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <Link className="button button-dark profile-invite" href={`/contact?model=${model.id}`}>Пригласить на съёмку <span>↗</span></Link><p className="profile-small muted">Откроется форма запроса с выбранной моделью.</p>
      </div>
    </div>
    <section className="profile-gallery"><div className="section-head"><div><p className="eyebrow">Selected frames</p><h2>В кадре</h2></div><span className="muted">Иллюстративное портфолио / 02</span></div><div className="row g-4">{model.gallery.map((image, index) => <div className="col-6" key={image}><div className="profile-gallery-image"><Image src={image} alt={`Иллюстративный кадр ${index + 1} портфолио ${model.name}`} fill sizes="50vw" /></div></div>)}</div><p className="profile-small muted">Фотографии служат визуальными примерами и могут изображать разных людей. Реальные портфолио будут добавлены командой.</p></section>
  </main>;
}
