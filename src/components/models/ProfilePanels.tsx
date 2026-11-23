"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Fade from "@mui/material/Fade";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { Model } from "@/data/models";

const panelEvent = "runway-profile-panel-change";
const panelNames = { measurements: "Параметры", bio: "О модели" };
type Panel = keyof typeof panelNames;

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  window.addEventListener(panelEvent, callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
    window.removeEventListener(panelEvent, callback);
  };
}

export default function ProfilePanels({ model, measurements }: { model: Model; measurements: string[][] }) {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  const active = hash === "#measurements" ? "measurements" : hash === "#bio" ? "bio" : null;
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const trigger = useRef<Partial<Record<Panel, HTMLButtonElement | null>>>({});
  const closingPanel = useRef<Panel | null>(null);
  const closing = useRef(false);

  useEffect(() => { if (active === null) closing.current = false; }, [active]);

  function open(panel: Panel) {
    closing.current = false;
    const url = `${window.location.pathname}${window.location.search}#${panel}`;
    if (active) window.history.replaceState(window.history.state, "", url);
    else window.history.pushState({ runwayProfilePanel: model.id }, "", url);
    window.dispatchEvent(new Event(panelEvent));
  }

  function close() {
    if (!active || closing.current) return;
    closing.current = true;
    closingPanel.current = active;
    if (window.history.state?.runwayProfilePanel === model.id) window.history.back();
    else {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      window.dispatchEvent(new Event(panelEvent));
    }
  }

  function restoreFocus() {
    if (closingPanel.current) trigger.current[closingPanel.current]?.focus({ preventScroll: true });
    closingPanel.current = null;
  }

  return <>
    <nav className="profile-section-nav profile-panel-controls" aria-label="Разделы портфолио">
      {(Object.keys(panelNames) as Panel[]).map(panel => <button
        type="button"
        key={panel}
        ref={element => { trigger.current[panel] = element; }}
        onClick={() => open(panel)}
        aria-haspopup="dialog"
        aria-expanded={active === panel}
        aria-controls={active === panel ? `${model.id}-${panel}-dialog` : undefined}
      >{panelNames[panel]} <span aria-hidden="true">+</span></button>)}
      <a href="#portfolio">Портфолио</a>
    </nav>
    {(Object.keys(panelNames) as Panel[]).map(panel => <Dialog
      key={panel}
      id={`${model.id}-${panel}-dialog`}
      className="profile-details-modal"
      open={active === panel}
      onClose={close}
      maxWidth="sm"
      fullWidth
      aria-labelledby={`${model.id}-${panel}-name ${model.id}-${panel}-title`}
      aria-describedby={`${model.id}-${panel}-description`}
      slots={{ transition: Fade }}
      transitionDuration={reduceMotion ? 0 : { enter: 260, exit: 180 }}
      slotProps={{ paper: { className: "profile-details-paper" }, transition: { onExited: restoreFocus } }}
    >
      <DialogContent className="profile-panel-body">
        <div className="profile-panel-top"><span>RUNWAY MODELS</span><IconButton type="button" aria-label={`Закрыть: ${panelNames[panel]}`} onClick={close} autoFocus>×</IconButton></div>
        <p className="profile-panel-model" id={`${model.id}-${panel}-name`}>{model.name}</p>
        <h2 id={`${model.id}-${panel}-title`}>{panelNames[panel]}</h2>
        {panel === "measurements" ? <>
          <p className="profile-panel-description" id={`${model.id}-${panel}-description`}>Параметры демонстрационного профиля · {model.city}</p>
          <dl className="profile-panel-measurements">{measurements.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </> : <>
          <p className="profile-panel-description" id={`${model.id}-${panel}-description`}>{model.specialty} · {model.city}</p>
          <p className="profile-panel-bio">{model.experience}</p>
        </>}
        <Link className="profile-panel-booking" href={`/contact?model=${model.id}`}>Пригласить на съёмку <span aria-hidden="true">↗</span></Link>
        <p className="profile-panel-note">Имя, параметры и опыт вымышлены. Фотографии служат визуальными примерами.</p>
      </DialogContent>
    </Dialog>)}
  </>;
}
