import type { Metadata } from "next";
import ModelCatalog from "@/components/models/ModelCatalog";
import { models } from "@/data/models";

export const metadata: Metadata = { title: "Модели", description: "Каталог демонстрационных портфолио: runway, editorial и commercial. Поиск моделей по имени, городу и направлению." };

export default function ModelsPage() {
  return (
    <main id="main-content" className="page-shell models-page">
      <header className="models-heading-row">
        <div>
          <p className="eyebrow">RUNWAY MODELS / THE TALENT</p>
          <h1 className="page-heading">NEW FACES<span className="models-count">({String(models.length).padStart(2, "0")})</span></h1>
        </div>
        <p className="models-intro">Индивидуальность в каждом кадре.<br />Найдите лицо для следующей истории.</p>
      </header>
      <p className="models-demo-note">Демонстрационный каталог: вымышленные имена, параметры и опыт. Стоковые фотографии иллюстрируют визуальную концепцию.</p>
      <ModelCatalog />
    </main>
  );
}
