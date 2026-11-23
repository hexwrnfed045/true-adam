import { connection } from "next/server";
import HomeHero from "@/components/home-hero";
import ModelCatalog from "@/components/models/ModelCatalog";

export default async function Home() {
  await connection();
  return (
    <main id="main-content" className="runway-home">
      <HomeHero />
      <section id="talent" className="page-shell runway-talent" aria-labelledby="talent-title" tabIndex={-1}>
        <div className="runway-talent-heading">
          <h2 id="talent-title">Модели</h2>
          <p>Демонстрационные портфолио</p>
        </div>
        <ModelCatalog mode="home" />
      </section>
    </main>
  );
}
