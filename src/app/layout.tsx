import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Runway Models — показы, съёмки и обучение",
  description:
    "Runway Models — проект о модных показах, моделях, съёмках, кастингах и обучении.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
