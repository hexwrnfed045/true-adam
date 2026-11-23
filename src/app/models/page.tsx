import type { Metadata } from "next";
import { Suspense } from "react";
import ModelCatalog from "@/components/models/ModelCatalog";
import { models } from "@/data/models";

export const metadata: Metadata = { title: "Модели", description: "Каталог демонстрационных портфолио: runway, editorial и commercial. Поиск моделей по имени, городу и направлению." };

export default function ModelsPage() {
  return (
    <main id="main-content" className="page-shell models-page">
      <header className="page-heading">
        <h1>Модели</h1>
        <p>{models.length} демонстрационных портфолио.</p>
      </header>
      <Suspense fallback={<div className="catalog-loading" aria-busy="true" role="status">Загружаем каталог и фильтры…</div>}>
        <ModelCatalog />
      </Suspense>
    </main>
  );
}
