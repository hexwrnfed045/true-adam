import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import "bootstrap/dist/css/bootstrap-grid.min.css";
import "bootstrap/dist/css/bootstrap-utilities.min.css";
import "./globals.css";
import "./editorial.css";
import { Providers } from "@/components/providers";
import { Header, Footer } from "@/components/site-shell";

const editorialFont = localFont({ src: [{path:"../../public/fonts/CormorantGaramond-Variable.ttf",weight:"300 700",style:"normal"},{path:"../../public/fonts/CormorantGaramond-Italic-Variable.ttf",weight:"300 700",style:"italic"}], variable:"--font-runway", display:"swap" });

export const metadata: Metadata = {
  title: { default: "Runway Models — модели, показы и кастинги", template: "%s | Runway Models" },
  description:
    "Runway Models — проект о модных показах, моделях, съёмках, кастингах и обучении.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={editorialFont.variable} data-scroll-behavior="smooth">
      <body><AppRouterCacheProvider options={{ key: "runway", enableCssLayer: false }}><Providers><a className="skip-link" href="#main-content">К содержимому</a><Header />{children}<Footer /></Providers></AppRouterCacheProvider></body>
    </html>
  );
}
