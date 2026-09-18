/**
 * main.js - Orquestador de la presentación TED Talk Fórum UPB
 * Manejo de estados de diapositivas, navegación por teclado/táctil,
 * conmutación de idioma (ES/PT), modo pantalla completa y scrubber interactivo.
 */

import "./config.js";
import "./moments.js";
import "./visualSystem.js";

const canvas = document.querySelector("#visual-canvas");
const stage = document.querySelector("#stage");
const titleEl = document.querySelector("#moment-title");
const kickerEl = document.querySelector("#moment-kicker");
const subtitleEl = document.querySelector("#moment-subtitle");
const numberEl = document.querySelector("#moment-number");
const totalEl = document.querySelector("#moment-total");
const copyLayer = document.querySelector(".editorial-layer");
const progressTrack = document.querySelector("#progress-track");
const qrDock = document.querySelector("#qr-dock");
const qrMemoryLink = document.querySelector("#qr-memory-link");
const qrSocialLink = document.querySelector("#qr-social-link");
const qrMemoryLabel = document.querySelector("#qr-memory-label");
const qrSocialLabel = document.querySelector("#qr-social-label");
const langButtons = [...document.querySelectorAll("[data-language]")];
const fullscreenBtn = document.querySelector("#fullscreen-btn");
const helpBtn = document.querySelector("#help-btn");
const helpHud = document.querySelector("#help-hud");
const helpCloseBtn = document.querySelector("#help-close-btn");
const helpBackdrop = document.querySelector("#help-backdrop");
const resetBtn = document.querySelector("#reset-btn");
const endBtn = document.querySelector("#end-btn");
const prevBtn = document.querySelector("#prev-btn");
const nextBtn = document.querySelector("#next-btn");

let activeIndex = 0;
let activeLanguage = localStorage.getItem("forum-language") || CONFIG.defaultLanguage || "pt";
let transitionTimer = 0;
let showHelp = false;

// Instanciar el motor generativo
const visualSystem = new VisualSystem(canvas);

// Diccionario de resaltados cromáticos para términos clave
const TITLE_HIGHLIGHTS = {
  "relevo-generacional": {
    es: [{ text: "RELEVO GENERACIONAL", tone: "cyan" }],
    pt: [{ text: "RELEVO GERACIONAL", tone: "cyan" }],
  },
  "universidad-mundo": {
    es: [{ text: "La Universidad decidió encontrarse con el mundo.", tone: "cyan" }],
    pt: [{ text: "A Universidade decidiu se encontrar com o mundo.", tone: "cyan" }],
  },
  impacto: {
    es: [{ text: "El impacto sí.", tone: "red" }],
    pt: [{ text: "O impacto, sim.", tone: "red" }],
  },
  comunidad: {
    es: [
      { text: "comunidad", tone: "cyan" },
      { text: "transformación", tone: "magenta" },
    ],
    pt: [
      { text: "comunidade", tone: "cyan" },
      { text: "transformação", tone: "magenta" },
    ],
  },
  confianza: {
    es: [{ text: "confianza", tone: "magenta" }],
    pt: [{ text: "confiança", tone: "magenta" }],
  },
  "nuevas-rutas": {
    es: [
      { text: "experiencia", tone: "cyan" },
      { text: "camino", tone: "magenta" },
      { text: "nuevas rutas", tone: "red" },
    ],
    pt: [
      { text: "experiência", tone: "cyan" },
      { text: "caminho", tone: "magenta" },
      { text: "novas rotas", tone: "red" },
    ],
  },
  "vision-generaciones": {
    es: [{ text: "Dos generaciones", tone: "cyan" }],
    pt: [{ text: "Duas gerações", tone: "cyan" }],
  },
  "trabajan-juntas": {
    es: [
      { text: "crecimiento", tone: "cyan" },
      { text: "trabajan juntas", tone: "magenta" },
    ],
    pt: [
      { text: "crescimento", tone: "cyan" },
      { text: "trabalham juntas", tone: "magenta" },
    ],
  },
  "presente-joven": {
    es: [{ text: "presente", tone: "red" }],
    pt: [{ text: "presente", tone: "red" }],
  },
  "futuro-construido": {
    es: [
      { text: "futuro", tone: "cyan" },
      { text: "Se construye", tone: "red" },
    ],
    pt: [
      { text: "futuro", tone: "cyan" },
      { text: "constrói", tone: "red" },
    ],
  },
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function copyFor(moment) {
  return moment.copy?.[activeLanguage] || moment.copy?.[CONFIG.defaultLanguage] || moment.copy?.es || moment;
}

function highlightsFor(moment) {
  return TITLE_HIGHLIGHTS[moment.id]?.[activeLanguage] || TITLE_HIGHLIGHTS[moment.id]?.[CONFIG.defaultLanguage] || [];
}

function renderTitle(moment, copy) {
  titleEl.replaceChildren();
  const rawText = copy.title || "";
  const highlights = highlightsFor(moment);

  if (!highlights.length) {
    titleEl.textContent = rawText;
    return;
  }

  const lower = rawText.toLocaleLowerCase(activeLanguage);
  const ordered = [...highlights].sort((a, b) => b.text.length - a.text.length);
  let cursor = 0;

  while (cursor < rawText.length) {
    let bestMatch = null;
    for (const h of ordered) {
      const idx = lower.indexOf(h.text.toLocaleLowerCase(activeLanguage), cursor);
      if (idx !== -1) {
        if (!bestMatch || idx < bestMatch.idx || (idx === bestMatch.idx && h.text.length > bestMatch.text.length)) {
          bestMatch = { ...h, idx };
        }
      }
    }

    if (!bestMatch) {
      titleEl.append(document.createTextNode(rawText.slice(cursor)));
      break;
    }

    if (bestMatch.idx > cursor) {
      titleEl.append(document.createTextNode(rawText.slice(cursor, bestMatch.idx)));
    }

    const span = document.createElement("span");
    span.className = `title-highlight title-highlight--${bestMatch.tone}`;
    span.textContent = rawText.slice(bestMatch.idx, bestMatch.idx + bestMatch.text.length);
    titleEl.append(span);

    cursor = bestMatch.idx + bestMatch.text.length;
  }
}

// Inicializar scrubber interactivo de 13 hitos
function initScrubber() {
  progressTrack.replaceChildren();
  moments.forEach((m, idx) => {
    const step = document.createElement("button");
    step.type = "button";
    step.className = "scrub-step";
    step.setAttribute("aria-label", `Ir al momento ${idx + 1}`);
    step.title = `Momento ${idx + 1}`;
    step.addEventListener("click", () => setMoment(idx));
    progressTrack.appendChild(step);
  });
}

function updateScrubber() {
  const steps = progressTrack.querySelectorAll(".scrub-step");
  steps.forEach((step, idx) => {
    step.classList.toggle("is-active", idx === activeIndex);
    step.classList.toggle("is-passed", idx < activeIndex);
  });
}

function updateLanguageUi() {
  document.documentElement.lang = activeLanguage;
  for (const btn of langButtons) {
    const isActive = btn.dataset.language === activeLanguage;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  }

  const qrLabels = CONFIG.qr.labels?.[activeLanguage] || CONFIG.qr.labels?.[CONFIG.defaultLanguage] || {};
  if (qrMemoryLabel) qrMemoryLabel.textContent = qrLabels.memory || "Memorias";
  if (qrSocialLabel) qrSocialLabel.textContent = qrLabels.social || "@centrodeeventosupb";
}

function setMoment(index) {
  activeIndex = Math.max(0, Math.min(moments.length - 1, index));
  const moment = moments[activeIndex];
  const copy = copyFor(moment);

  window.clearTimeout(transitionTimer);
  copyLayer.classList.add("is-changing");

  // Toggle de la capa QR y estados de layout fotográfico
  qrDock.classList.toggle("is-visible", moment.state === "qr-code-formation");
  stage.classList.toggle("is-title-moment", activeIndex === 0);
  stage.classList.toggle("has-photo", !!moment.isPhoto);
  copyLayer.classList.toggle("is-photo-moment", !!moment.isPhoto);
  copyLayer.classList.toggle("is-qr-moment", moment.state === "qr-code-formation");

  transitionTimer = window.setTimeout(() => {
    kickerEl.textContent = copy.kicker || CONFIG.brandLine;
    renderTitle(moment, copy);
    subtitleEl.textContent = copy.subtitle || "";
    numberEl.textContent = pad(activeIndex + 1);
    updateScrubber();

    requestAnimationFrame(() => {
      copyLayer.classList.remove("is-changing");
    });
  }, 120);

  // Informar al motor generativo
  visualSystem.setMoment(moment);
}

function nextMoment() {
  setMoment(activeIndex + 1);
}

function previousMoment() {
  setMoment(activeIndex - 1);
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await stage.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (err) {
    console.warn("Fullscreen toggle:", err);
  }
}

function toggleHelp() {
  showHelp = !showHelp;
  helpHud.classList.toggle("is-hidden", !showHelp);
  helpBtn.setAttribute("aria-expanded", String(showHelp));
}

// Event Listeners de Botones
prevBtn.addEventListener("click", previousMoment);
nextBtn.addEventListener("click", nextMoment);
fullscreenBtn.addEventListener("click", toggleFullscreen);
helpBtn.addEventListener("click", toggleHelp);
helpCloseBtn.addEventListener("click", toggleHelp);
helpBackdrop.addEventListener("click", toggleHelp);
resetBtn.addEventListener("click", () => {
  toggleHelp();
  setMoment(0);
});
endBtn.addEventListener("click", () => {
  toggleHelp();
  setMoment(moments.length - 1);
});

// Selector de Idioma
for (const btn of langButtons) {
  btn.addEventListener("click", () => {
    activeLanguage = btn.dataset.language;
    localStorage.setItem("forum-language", activeLanguage);
    updateLanguageUi();
    setMoment(activeIndex);
  });
}

// Atajos de Teclado
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === "arrowright" || key === " ") {
    e.preventDefault();
    nextMoment();
  } else if (key === "arrowleft") {
    e.preventDefault();
    previousMoment();
  } else if (key === "f") {
    e.preventDefault();
    toggleFullscreen();
  } else if (key === "h") {
    e.preventDefault();
    toggleHelp();
  } else if (key === "r") {
    e.preventDefault();
    setMoment(0);
  } else if (key === "escape" && showHelp) {
    toggleHelp();
  }
});

// Soporte Gestual Táctil (Swipe)
let touchStartX = 0;
let touchStartY = 0;

stage.addEventListener(
  "touchstart",
  (e) => {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
  },
  { passive: true }
);

stage.addEventListener(
  "touchend",
  (e) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;

    // Solo reaccionar si el gesto es predominantemente horizontal y supera umbral
    if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        nextMoment();
      } else {
        previousMoment();
      }
    }
  },
  { passive: true }
);

// Links QR
qrMemoryLink.href = CONFIG.qr.memoryUrl;
qrSocialLink.href = CONFIG.qr.socialUrl;

// Inicialización de la presentación
totalEl.textContent = pad(moments.length);
initScrubber();
updateLanguageUi();
setMoment(0);

// Loop de renderizado
function tick() {
  visualSystem.render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
