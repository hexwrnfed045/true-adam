import type { Metadata } from "next";
import ModelCatalog from "@/components/models/ModelCatalog";

export const metadata: Metadata = { title: "Модели", description: "Каталог демонстрационных портфолио: runway, editorial и commercial. Поиск моделей по имени, городу и направлению." };

export default function ModelsPage() {
  return <main id="main-content" className="page-shell models-page">
    <div className="models-heading-row"><div><p className="eyebrow">Лица нового поколения / The talent</p><h1 className="page-heading">МОДЕЛИ<span className="models-count">06</span></h1></div><p className="models-intro">Характер. Присутствие. Индивидуальность.<br />Найдите лицо для своей следующей истории.</p></div>
    <p className="models-demo-note">Демонстрационный каталог. Имена, параметры и опыт вымышлены; фотографии — иллюстрации из фотобанка.</p>
    <ModelCatalog />
  </main>;
}
