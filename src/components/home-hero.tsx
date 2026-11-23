"use client";

import { useState } from "react";
import Image from "next/image";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Fade from "@mui/material/Fade";
import IconButton from "@mui/material/IconButton";
import useMediaQuery from "@mui/material/useMediaQuery";
import "./home-hero.css";

const portraits = [
  {
    name: "Francisco «Chico» Lachowski",
    image: "/images/inspiration-chico.jpg",
    author: "Sara Cimino",
    source: "https://commons.wikimedia.org/wiki/File:Francisco_Lachowski_2011.jpg",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    position: "50% 32%",
  },
  {
    name: "Jordan Barrett",
    image: "/images/inspiration-jordan.jpg",
    author: "Stefan Heesch / Nordfriisk Photography",
    source: "https://commons.wikimedia.org/wiki/File:Jordan-barrett-mbfw-march-2022-fashion-week-berlin.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    position: "50% 26%",
  },
  {
    name: "Sean O’Pry",
    image: "/images/inspiration-sean-opry.jpg",
    author: "Sara Cimino",
    source: "https://commons.wikimedia.org/wiki/File:Sean_Opry.jpg",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    position: "50% 25%",
  },
  {
    name: "David Gandy",
    image: "/images/inspiration-david.jpg",
    author: "Walterlan Papetti",
    source: "https://commons.wikimedia.org/wiki/File:David_Gandy.jpg",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    position: "50% 26%",
  },
];

const spreads = [
  { label: "Chico и Jordan", portraits: portraits.slice(0, 2) },
  { label: "Sean и David", portraits: portraits.slice(2) },
];

export default function HomeHero() {
  const [spread, setSpread] = useState(0);
  const [showCredits, setShowCredits] = useState(false);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  return (
    <section className="runway-cover" aria-labelledby="runway-cover-title">
      <div className="runway-cover-inner">
        <div className="runway-cover-content">
          <p className="runway-cover-location">Модельная платформа <span>Алматы · Астана</span></p>
          <h1 id="runway-cover-title">Runway <em>Models</em></h1>
          <a className="runway-cover-action" href="#talent">Смотреть моделей</a>
        </div>
        <div className="runway-cover-gallery">
          <div className="runway-cover-spreads" id="runway-cover-spreads">
            {spreads.map((item, index) => (
              <div key={item.label} className="runway-cover-spread" data-active={spread === index} inert={spread !== index}>
                {item.portraits.map((portrait) => (
                  <figure key={portrait.name} className="runway-cover-portrait">
                    <div className="runway-cover-image">
                      <Image
                        fill
                        src={portrait.image}
                        alt={portrait.name}
                        sizes="(max-width: 700px) 45vw, (max-width: 1500px) 24vw, 360px"
                        preload={index === 0}
                        style={{ objectPosition: portrait.position }}
                      />
                    </div>
                    <figcaption>{portrait.name}</figcaption>
                  </figure>
                ))}
              </div>
            ))}
          </div>
          <div className="runway-cover-tools">
            <div className="runway-cover-switch" role="group" aria-label="Портреты известных моделей">
              {spreads.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  aria-controls="runway-cover-spreads"
                  aria-pressed={spread === index}
                  onClick={() => setSpread(index)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button className="runway-cover-credits" type="button" aria-haspopup="dialog" onClick={() => setShowCredits(true)}>
              Фотографии и источники
            </button>
          </div>
        </div>
      </div>
      <Dialog
        className="runway-credits-dialog"
        open={showCredits}
        onClose={() => setShowCredits(false)}
        aria-labelledby="runway-credits-title"
        aria-describedby="runway-credits-intro"
        slots={{ transition: Fade }}
        transitionDuration={reduceMotion ? 0 : { enter: 320, exit: 180 }}
        fullWidth
      >
        <div className="runway-credits-header">
          <DialogTitle id="runway-credits-title">Фотографии на обложке</DialogTitle>
          <IconButton aria-label="Закрыть сведения о фотографиях" onClick={() => setShowCredits(false)} autoFocus>
            <span aria-hidden="true">×</span>
          </IconButton>
        </div>
        <DialogContent className="runway-credits-content">
          <p id="runway-credits-intro">Редакционная подборка известных моделей. Фотографии кадрированы и переведены в чёрно-белый цвет.</p>
          <ul className="runway-credits-list">
            {spreads[spread].portraits.map((portrait) => (
              <li key={portrait.name}>
                <h3>{portrait.name}</h3>
                <p>Фото {portrait.author}</p>
                <div className="runway-credits-links">
                  <a href={portrait.source} aria-label={`Оригинал фото ${portrait.name}`}>Оригинал фото</a>
                  <a href={portrait.licenseUrl}>{portrait.license}</a>
                  {portrait.license.includes("SA") && <span>Обработка под той же лицензией</span>}
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  );
}
