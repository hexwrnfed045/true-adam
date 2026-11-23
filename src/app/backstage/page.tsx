import type { Metadata } from "next";
import BackstageGallery from "@/components/models/BackstageGallery";

export const metadata: Metadata = { title: "Backstage", description: "Иллюстративная подборка фотографий со съёмок и показов." };

export default function BackstagePage() {
  return (
    <main id="main-content" className="page-shell backstage-page">
      <header className="page-heading">
        <h1>Backstage</h1>
        <p>Иллюстративная подборка фотографий со съёмок и показов.</p>
      </header>
      <BackstageGallery />
    </main>
  );
}
