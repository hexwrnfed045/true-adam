import type { Metadata } from "next";
import BackstageGallery from "@/components/models/BackstageGallery";

export const metadata: Metadata = { title: "Backstage", description: "Визуальный дневник Runway Models: подиум, редакционные кадры и атмосфера за кулисами." };

export default function BackstagePage() {
  return <main id="main-content" className="page-shell backstage-page"><div className="models-heading-row"><div><p className="eyebrow">За пределами подиума / Visual diary</p><h1 className="page-heading">BACKSTAGE</h1></div><p className="models-intro">Моменты, которые остаются за кадром.<br />И делают историю настоящей.</p></div><p className="models-demo-note">Иллюстративная подборка из фотобанка. Это визуальное направление проекта, а не отчёт с мероприятий Runway Models.</p><BackstageGallery /></main>;
}
