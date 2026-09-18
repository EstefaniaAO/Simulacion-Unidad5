/**
 * visualSystem.js - Motor generativo de partículas, morphing de imágenes y simulación narrativa
 * para el Centro de Eventos Fórum UPB Medellín.
 *
 * Implementa con máxima fidelidad:
 * 1. Transiciones 100% fluidas entre TODAS las diapositivas (adelante y atrás):
 *    - NUNCA se teletransportan las coordenadas de las partículas al cambiar de slide.
 *    - Cada partícula conserva su posición en pantalla y se desliza/guía suavemente mediante
 *      campos vectoriales o resortes hacia su nueva dinámica o posición.
 * 2. Slide 10: Evolución cinemática hacia olas entrelazadas:
 *    - Inicia con corrientes que cruzan de lado a lado (azul en ondas, rosa más errática).
 *    - Conforme avanza el tiempo, las rosadas se organizan en una gran ola conjunta y las azules
 *      hacen lo mismo, entrelazándose en una hermosa trenza sinusoidal doble (doble hélice)
 *      que danza sincronizada a lo largo de toda la pantalla con destellos en sus cruces.
 * 3. Slide 11: Inicia en la oscuridad/negro y una ola lumínica barre lentamente de izquierda
 *    a derecha revelando los colores vibrantes y la estructura arquitectónica.
 * 4. Slide 3: Paleta institucional limpia (sin residuos de fotos anteriores), ondas concéntricas
 *    periódicas y núcleo central permanente.
 * 6. Slide 6: Movimiento continuo y autónomo en todo momento, trazando conexiones dinámicas al cruzarse.
 * 13. Slide 13: Códigos QR con módulos nítidos sobre placa blanca y partículas finas, 100% escaneables.
 */

const TAU = Math.PI * 2;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex) {
  let c = hex.replace("#", "");
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("");
  }
  const n = parseInt(c, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

class VisualSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.particleCount = CONFIG.particleCount || 11664;
    this.gridCols = 144;
    this.gridRows = 81;

    this.particles = [];
    this.pulses = [];
    this.microParticles = [];
    this.shockwaves = [];

    this.rawImages = {};
    this.sampledTargets = {};
    this.imagesLoaded = false;

    this.currentMoment = null;
    this.momentState = "latent-orbits";
    this.momentTime = 0;
    this.lastTimestamp = performance.now();

    this.mouse = {
      x: -9999,
      y: -9999,
      active: false,
      radius: CONFIG.mouseRepulsionRadius || 130,
      power: CONFIG.mouseRepulsionPower || 9,
    };

    this.slide11Network = { nodes: [], edges: [] };
    this.slide3LastWaveTime = 0;

    this.initEvents();
    this.resize();
    this.initParticles();
    this.preloadSampleImages();
  }

  initEvents() {
    window.addEventListener("resize", () => this.resize());

    const updatePointer = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (clientX - rect.left) * (this.width / rect.width);
      this.mouse.y = (clientY - rect.top) * (this.height / rect.height);
      this.mouse.active = true;
    };

    window.addEventListener("mousemove", (e) => {
      updatePointer(e.clientX, e.clientY);
    });

    window.addEventListener("mouseleave", () => {
      this.mouse.active = false;
      this.mouse.x = -9999;
      this.mouse.y = -9999;
    });

    window.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length > 0) {
          updatePointer(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: true }
    );

    window.addEventListener("touchend", () => {
      this.mouse.active = false;
      this.mouse.x = -9999;
      this.mouse.y = -9999;
    });
  }

  resize() {
    const rect = this.canvas.parentElement
      ? this.canvas.parentElement.getBoundingClientRect()
      : this.canvas.getBoundingClientRect();
    this.width = Math.max(320, rect.width || window.innerWidth);
    this.height = Math.max(180, rect.height || window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (this.imagesLoaded) {
      this.resampleAllImages();
      if (this.currentMoment) {
        this.setMoment(this.currentMoment, true);
      }
    }
  }

  // Inicialización única al cargar la página
  initParticles() {
    this.particles = [];
    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");

    for (let i = 0; i < this.particleCount; i++) {
      const isTypeA = i < this.particleCount * 0.5;
      const group = isTypeA ? 0 : 1;
      const baseRgb = isTypeA ? cyan : magenta;

      this.particles.push({
        id: i,
        group: group, // 0: Experiencia (Cyan), 1: Juventud (Magenta)
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        tx: this.width * 0.5,
        ty: this.height * 0.5,
        ox: this.width * 0.5,
        oy: this.height * 0.5,
        size: isTypeA ? 2.4 : 1.8,
        tsize: 2.2,
        r: baseRgb.r,
        g: baseRgb.g,
        b: baseRgb.b,
        a: 0.9,
        tr: baseRgb.r,
        tg: baseRgb.g,
        tb: baseRgb.b,
        ta: 0.9,
        colorSpeed: 0.08,
        orbitRadius: 40 + Math.random() * 200,
        orbitAngle: Math.random() * TAU,
        orbitSpeed: (isTypeA ? 0.0035 : 0.016) * (Math.random() * 0.5 + 0.75),
        cluster: i % 8,
        cohort: i % 6,
        infected: false,
        colorCode: 0,
        flowAngle: Math.random() * TAU,
        flowSpeed: 1.0 + Math.random() * 1.2,
        edgeIdx: -1,
        edgeT: Math.random(),
      });
    }
  }

  preloadSampleImages() {
    const photoMap = CONFIG.assets.photoMoments;
    const keys = Object.keys(photoMap);
    let loaded = 0;
    const total = keys.length + 2;

    const checkDone = () => {
      loaded++;
      if (loaded >= total) {
        this.imagesLoaded = true;
        this.resampleAllImages();
        if (this.currentMoment) {
          this.setMoment(this.currentMoment, true);
        }
      }
    };

    keys.forEach((key) => {
      const val = photoMap[key];
      if (typeof val === "string") {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          this.rawImages[key] = img;
          checkDone();
        };
        img.onerror = () => checkDone();
        img.src = val;
      }
    });

    const qrObj = photoMap["qr-cierre"];
    if (qrObj) {
      const imgMem = new Image();
      imgMem.crossOrigin = "anonymous";
      imgMem.onload = () => {
        this.rawImages["qr-memory"] = imgMem;
        checkDone();
      };
      imgMem.src = qrObj.memory;

      const imgSoc = new Image();
      imgSoc.crossOrigin = "anonymous";
      imgSoc.onload = () => {
        this.rawImages["qr-social"] = imgSoc;
        checkDone();
      };
      imgSoc.src = qrObj.social;

      const imgBg = new Image();
      imgBg.crossOrigin = "anonymous";
      imgBg.onload = () => {
        this.rawImages["qr-bg"] = imgBg;
        checkDone();
      };
      imgBg.src = qrObj.background;
    }
  }

  resampleAllImages() {
    const keys = [
      "auditorio-grados",
      "academia-industria-ciudad",
      "impacto",
      "nuevas-rutas",
      "futuro-construido",
    ];
    keys.forEach((k) => {
      if (this.rawImages[k]) {
        this.sampledTargets[k] = this.sampleImageDense(this.rawImages[k]);
      }
    });

    if (this.rawImages["qr-memory"] && this.rawImages["qr-social"]) {
      this.sampledTargets["qr-cierre"] = this.sampleQrScannable(
        this.rawImages["qr-memory"],
        this.rawImages["qr-social"]
      );
    }
  }

  sampleImageDense(img) {
    const cols = this.gridCols; // 144
    const rows = this.gridRows; // 81

    const off = document.createElement("canvas");
    off.width = cols;
    off.height = rows;
    const offCtx = off.getContext("2d", { willReadFrequently: true });
    offCtx.drawImage(img, 0, 0, cols, rows);
    const data = offCtx.getImageData(0, 0, cols, rows).data;

    const padY = this.height * 0.10;
    const availH = this.height - padY * 2;
    const availW = this.width * 0.58;
    const startLeft = this.width * 0.38;

    const imgAspect = img.naturalWidth / img.naturalHeight || 16 / 9;
    let drawW = availW;
    let drawH = drawW / imgAspect;

    if (drawH > availH) {
      drawH = availH;
      drawW = drawH * imgAspect;
    }

    const startX = startLeft + (availW - drawW) * 0.5;
    const startY = padY + (availH - drawH) * 0.5;

    const stepX = drawW / (cols - 1);
    const stepY = drawH / (rows - 1);
    const dotSize = Math.max(1.8, Math.min(stepX, stepY) * 0.52);

    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");
    const gold = hexToRgb("#d6a94f");

    const points = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 4;
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        const lum = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;

        if (lum < 0.07) continue;

        let palColor = (c + r) % 2 === 0 ? cyan : magenta;
        if (lum > 0.7) palColor = hexToRgb("#f7f7f4");
        else if (red > 160 && green > 120) palColor = gold;

        points.push({
          x: startX + c * stepX,
          y: startY + r * stepY,
          imgR: red,
          imgG: green,
          imgB: blue,
          palR: palColor.r,
          palG: palColor.g,
          palB: palColor.b,
          size: dotSize,
          a: 0.95,
        });
      }
    }

    const remaining = this.particleCount - points.length;
    for (let i = 0; i < remaining; i++) {
      const ang = Math.random() * TAU;
      const radX = (drawW * 0.5) * (1.02 + Math.random() * 0.35);
      const radY = (drawH * 0.5) * (1.02 + Math.random() * 0.35);
      const rgb = i % 2 === 0 ? cyan : magenta;

      points.push({
        x: startX + drawW * 0.5 + Math.cos(ang) * radX,
        y: startY + drawH * 0.5 + Math.sin(ang) * radY,
        imgR: rgb.r,
        imgG: rgb.g,
        imgB: rgb.b,
        palR: rgb.r,
        palG: rgb.g,
        palB: rgb.b,
        size: 1.4,
        a: 0.25,
      });
    }

    return {
      points: points,
      bounds: { startX, startY, drawW, drawH },
    };
  }

  sampleQrScannable(imgMem, imgSoc) {
    const points = [];
    const total = this.particleCount;
    const half = Math.floor(total * 0.45);

    const qrSize = Math.min(this.width * 0.24, this.height * 0.50);
    const yPos = this.height * 0.50 - qrSize * 0.5;
    const leftX = this.width * 0.46 - qrSize * 0.5;
    const rightX = this.width * 0.78 - qrSize * 0.5;

    const plates = [
      { x: leftX - 16, y: yPos - 16, size: qrSize + 32, qrX: leftX, qrY: yPos, qrS: qrSize, img: imgMem },
      { x: rightX - 16, y: yPos - 16, size: qrSize + 32, qrX: rightX, qrY: yPos, qrS: qrSize, img: imgSoc },
    ];

    const pts1 = this.sampleSingleQrModules(imgMem, leftX, yPos, qrSize, half);
    points.push(...pts1);

    const pts2 = this.sampleSingleQrModules(imgSoc, rightX, yPos, qrSize, half);
    points.push(...pts2);

    const remaining = total - points.length;
    const gold = hexToRgb("#d6a94f");
    const cyan = hexToRgb("#08a9dd");

    for (let i = 0; i < remaining; i++) {
      const ang = Math.random() * TAU;
      const rad = Math.random() * (this.width * 0.45);
      const rgb = Math.random() > 0.4 ? gold : cyan;
      points.push({
        x: this.width * 0.62 + Math.cos(ang) * rad,
        y: this.height * 0.5 + Math.sin(ang) * (rad * 0.55),
        imgR: rgb.r,
        imgG: rgb.g,
        imgB: rgb.b,
        palR: rgb.r,
        palG: rgb.g,
        palB: rgb.b,
        size: 1.4,
        a: 0.25,
        isQrModule: false,
      });
    }

    return {
      points: points,
      plates: plates,
      isQr: true,
    };
  }

  sampleSingleQrModules(qrImg, posX, posY, size, maxPoints) {
    const off = document.createElement("canvas");
    const dim = 45;
    off.width = dim;
    off.height = dim;
    const ctx = off.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(qrImg, 0, 0, dim, dim);
    const data = ctx.getImageData(0, 0, dim, dim).data;

    const pts = [];
    const cell = size / dim;
    const cyan = hexToRgb("#08a9dd");

    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        const i = (y * dim + x) * 4;
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;

        if (brightness < 130 && data[i + 3] > 80) {
          pts.push({
            x: posX + x * cell + cell * 0.5,
            y: posY + y * cell + cell * 0.5,
            imgR: 12,
            imgG: 14,
            imgB: 18,
            palR: cyan.r,
            palG: cyan.g,
            palB: cyan.b,
            size: 2.2,
            a: 1.0,
            isQrModule: true,
          });
        }
      }
    }

    return pts;
  }

  // Cambio de momento con transición fluida garantizada (sin teletransportar x, y)
  setMoment(moment, force = false) {
    this.currentMoment = moment;
    this.momentState = moment.state;
    this.momentTime = 0;

    this.microParticles = [];
    this.pulses = [];
    this.shockwaves = [];
    this.slide3LastWaveTime = 0;

    if (moment.state === "boundary-blast") {
      this.initBoundaryBlast();
    } else if (moment.state === "proximity-graph") {
      this.initProximityGraph();
    } else if (moment.state === "trust-crystallize") {
      this.initTrustContagion();
    } else if (moment.state === "synergy-multiplication") {
      this.initSynergy();
    } else if (moment.state === "latent-reveal") {
      this.initLatentConstruction();
    } else if (moment.state === "highest-order") {
      this.initHighestOrder();
    }

    this.applyMomentTargets(moment, force);
  }

  // Slide 3: Sin teletransportación; partículas convergen elásticamente al centro desde donde estén
  initBoundaryBlast() {
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const boxW = Math.min(this.width * 0.28, 300);
    const boxH = Math.min(this.height * 0.32, 180);

    const cyan = hexToRgb("#08a9dd");
    const white = hexToRgb("#f7f7f4");
    const magenta = hexToRgb("#e96daa");
    const gold = hexToRgb("#d6a94f");

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.ox = cx + (Math.random() - 0.5) * boxW;
      p.oy = cy + (Math.random() - 0.5) * boxH;
      p.tx = p.ox;
      p.ty = p.oy;
      p.cohort = i % 6;

      const col = i % 4 === 0 ? cyan : i % 4 === 1 ? white : i % 4 === 2 ? magenta : gold;
      p.tr = col.r;
      p.tg = col.g;
      p.tb = col.b;
      p.ta = 0.95;
      p.tsize = 2.2;
    }
  }

  // Slide 6: Conserva posiciones actuales; inicia flujo autónomo sin teletransportar
  initProximityGraph() {
    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.flowAngle = Math.random() * TAU;
      p.flowSpeed = 1.1 + Math.random() * 0.9;
      p.vx = Math.cos(p.flowAngle) * p.flowSpeed;
      p.vy = Math.sin(p.flowAngle) * p.flowSpeed;

      const col = p.group === 0 ? cyan : magenta;
      p.tr = col.r;
      p.tg = col.g;
      p.tb = col.b;
      p.ta = 0.9;
      p.tsize = 2.2;
    }
  }

  // Slide 7: Caos inicial multicolor sin alterar posiciones
  initTrustContagion() {
    const colors = [
      hexToRgb("#08a9dd"),
      hexToRgb("#d6a94f"),
      hexToRgb("#f7353f"),
      hexToRgb("#f7f7f4"),
      hexToRgb("#e96daa"),
    ];

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const colIdx = i % colors.length;
      const col = colors[colIdx];

      p.colorCode = colIdx;
      p.tr = col.r;
      p.tg = col.g;
      p.tb = col.b;
      p.infected = false;
      p.colorSpeed = 0.08;
      p.tsize = 2.2;
      p.vx = (Math.random() - 0.5) * 2.2;
      p.vy = (Math.random() - 0.5) * 2.2;
    }

    for (let s = 0; s < 4; s++) {
      const idx = Math.floor(Math.random() * this.particles.length);
      this.particles[idx].infected = true;
      this.particles[idx].colorCode = 0;
      this.particles[idx].tr = 8;
      this.particles[idx].tg = 169;
      this.particles[idx].tb = 221;
    }
  }

  // Slide 10: Azul (experiencia) en ondas vs Rosa (juventud) errática
  initSynergy() {
    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (p.group === 0) {
        p.tr = cyan.r;
        p.tg = cyan.g;
        p.tb = cyan.b;
        p.tsize = 2.6;
        p.vx = 2.4;
        p.vy = 0;
      } else {
        p.tr = magenta.r;
        p.tg = magenta.g;
        p.tb = magenta.b;
        p.tsize = 1.9;
        p.vx = -4.2;
        p.vy = 0;
      }
    }
  }

  // Slide 11: Malla tridimensional que se revelará desde el negro de izquierda a derecha
  initLatentConstruction() {
    const nodes = [];
    const edges = [];

    const startX = this.width * 0.36;
    const endX = this.width * 0.94;
    const startY = this.height * 0.18;
    const endY = this.height * 0.82;
    const rows = 5;
    const cols = 7;
    const stepX = (endX - startX) / (cols - 1);
    const stepY = (endY - startY) / (rows - 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const jitterX = Math.sin(r * 4.2 + c * 2.8) * 18;
        const jitterY = Math.cos(r * 2.8 + c * 4.2) * 18;
        nodes.push({
          x: startX + c * stepX + jitterX,
          y: startY + r * stepY + jitterY,
          pulse: 0,
        });
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (c < cols - 1) edges.push({ a: idx, b: idx + 1, minX: nodes[idx].x });
        if (r < rows - 1) edges.push({ a: idx, b: idx + cols, minX: Math.min(nodes[idx].x, nodes[idx + cols].x) });
        if (r < rows - 1 && c < cols - 1) {
          edges.push({ a: idx, b: idx + cols + 1, minX: nodes[idx].x });
        }
      }
    }

    edges.sort((e1, e2) => e1.minX - e2.minX);
    this.slide11Network = { nodes, edges };

    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.edgeIdx = i % edges.length;
      p.edgeT = Math.random();
      p.tr = p.group === 0 ? cyan.r : magenta.r;
      p.tg = p.group === 0 ? cyan.g : magenta.g;
      p.tb = p.group === 0 ? cyan.b : magenta.b;
      p.tsize = 2.0;
    }
  }

  // Slide 12: Flujo alrededor que converge a la foto sin saltos
  initHighestOrder() {
    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");
    const gold = hexToRgb("#d6a94f");

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.flowAngle = Math.random() * TAU;
      p.flowSpeed = 1.4 + Math.random() * 2.2;
      p.vx = Math.cos(p.flowAngle + Math.PI * 0.5) * p.flowSpeed;
      p.vy = Math.sin(p.flowAngle + Math.PI * 0.5) * p.flowSpeed;

      const pal = i % 3 === 0 ? cyan : i % 3 === 1 ? magenta : gold;
      p.tr = pal.r;
      p.tg = pal.g;
      p.tb = pal.b;
      p.tsize = 2.2;
    }
  }

  applyMomentTargets(moment, force = false) {
    const state = moment.state;
    const isPhoto = moment.isPhoto;
    const assetKey = moment.assetKey;

    if (
      isPhoto &&
      this.sampledTargets[assetKey] &&
      !["triad-fuse", "stage-collapse", "path-discovery", "highest-order"].includes(state)
    ) {
      const targetObj = this.sampledTargets[assetKey];
      const targets = targetObj.points;
      const count = targets.length;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const t = targets[i % count];

        p.tx = t.x;
        p.ty = t.y;
        p.tr = t.palR;
        p.tg = t.palG;
        p.tb = t.palB;
        p.ta = t.a;
        p.tsize = t.size;
        p.colorSpeed = 0.05;

        if (force) {
          p.x = p.tx;
          p.y = p.ty;
          p.r = p.tr;
          p.g = p.tg;
          p.b = p.tb;
          p.size = p.tsize;
        }
      }
      return;
    }

    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");
    const gold = hexToRgb("#d6a94f");
    const white = hexToRgb("#f7f7f4");

    switch (state) {
      case "latent-orbits": {
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.colorSpeed = 0.12;
          if (p.group === 0) {
            p.orbitRadius = 55 + (i % 200) * 1.2;
            p.orbitSpeed = 0.003 + (i % 6) * 0.0008;
            p.tsize = 2.4;
            p.tr = i % 6 === 0 ? gold.r : cyan.r;
            p.tg = i % 6 === 0 ? gold.g : cyan.g;
            p.tb = i % 6 === 0 ? gold.b : cyan.b;
          } else {
            p.orbitRadius = 35 + (i % 150) * 1.0;
            p.orbitSpeed = 0.016 + (i % 8) * 0.002;
            p.tsize = 1.8;
            p.tr = i % 5 === 0 ? white.r : magenta.r;
            p.tg = i % 5 === 0 ? white.g : magenta.g;
            p.tb = i % 5 === 0 ? white.b : magenta.b;
          }
        }
        break;
      }

      case "boundary-blast": {
        const cx = this.width * 0.5;
        const cy = this.height * 0.5;
        const boxW = Math.min(this.width * 0.28, 300);
        const boxH = Math.min(this.height * 0.32, 180);

        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.ox = cx + (Math.random() - 0.5) * boxW;
          p.oy = cy + (Math.random() - 0.5) * boxH;
          p.tx = p.ox;
          p.ty = p.oy;
          const col = i % 4 === 0 ? cyan : i % 4 === 1 ? white : i % 4 === 2 ? magenta : gold;
          p.tr = col.r;
          p.tg = col.g;
          p.tb = col.b;
          p.ta = 0.95;
          p.tsize = 2.2;
          p.colorSpeed = 0.15;
        }
        break;
      }

      case "dual-streams": {
        // Asignación de color y dinámica sin teletransportar coordenadas
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.colorSpeed = 0.12;
          if (p.group === 0) {
            p.tr = cyan.r;
            p.tg = cyan.g;
            p.tb = cyan.b;
            p.tsize = 2.6;
          } else {
            p.tr = magenta.r;
            p.tg = magenta.g;
            p.tb = magenta.b;
            p.tsize = 2.0;
          }
        }
        break;
      }

      default:
        break;
    }
  }

  render() {
    const now = performance.now();
    const dt = Math.min((now - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = now;
    this.momentTime += dt;

    this.clearBackground();

    if (this.momentState === "qr-code-formation") {
      this.drawQrPlates();
    }

    switch (this.momentState) {
      case "latent-orbits":
        this.updateLatentOrbits(dt);
        break;
      case "boundary-blast":
        this.updateBoundaryBlast(dt);
        break;
      case "triad-fuse":
        this.updateTriadFuse(dt);
        break;
      case "stage-collapse":
        this.updateStageCollapse(dt);
        break;
      case "proximity-graph":
        this.updateProximityGraph(dt);
        break;
      case "trust-crystallize":
        this.updateTrustCrystallize(dt);
        break;
      case "path-discovery":
        this.updatePathDiscovery(dt);
        break;
      case "dual-streams":
        this.updateDualStreams(dt);
        break;
      case "synergy-multiplication":
        this.updateSynergyMultiplication(dt);
        break;
      case "latent-reveal":
        this.updateLatentReveal(dt);
        break;
      case "highest-order":
        this.updateHighestOrder(dt);
        break;
      default:
        this.updatePhotoMorph(dt);
        break;
    }

    this.drawParticles();
    this.drawPulsesAndMicroParticles(dt);
  }

  clearBackground() {
    const isKinetic = [
      "boundary-blast",
      "dual-streams",
      "trust-crystallize",
      "synergy-multiplication",
      "proximity-graph",
    ].includes(this.momentState);

    if (isKinetic) {
      this.ctx.fillStyle = "rgba(6, 7, 9, 0.38)";
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else {
      this.ctx.fillStyle = "#060709";
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  drawQrPlates() {
    const targetObj = this.sampledTargets["qr-cierre"];
    if (!targetObj || !targetObj.plates) return;

    this.ctx.save();
    for (const plate of targetObj.plates) {
      this.ctx.fillStyle = "#ffffff";
      this.ctx.shadowColor = "rgba(8, 169, 221, 0.45)";
      this.ctx.shadowBlur = 24;
      this.ctx.beginPath();
      this.ctx.roundRect(plate.x, plate.y, plate.size, plate.size, 16);
      this.ctx.fill();

      if (plate.img && plate.img.complete) {
        this.ctx.shadowBlur = 0;
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(plate.img, plate.qrX, plate.qrY, plate.qrS, plate.qrS);
      }
    }
    this.ctx.restore();
  }

  updatePhotoMorph(dt) {
    const spring = CONFIG.springStrength || 0.058;
    const friction = CONFIG.friction || 0.86;
    const mouse = this.mouse;
    const t = this.momentTime;

    const colorProgress = clamp(t / 1.8, 0, 1);
    const targetObj = this.sampledTargets[this.currentMoment?.assetKey];
    const targets = targetObj ? targetObj.points : null;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      p.vx += dx * spring;
      p.vy += dy * spring;

      if (mouse.active) {
        const mdx = p.x - mouse.x;
        const mdy = p.y - mouse.y;
        const dist = Math.hypot(mdx, mdy);
        if (dist < mouse.radius && dist > 0.1) {
          const force = (1 - dist / mouse.radius) * mouse.power;
          p.vx += (mdx / dist) * force;
          p.vy += (mdy / dist) * force;
        }
      }

      p.vx *= friction;
      p.vy *= friction;
      p.x += p.vx;
      p.y += p.vy;

      if (targets && targets[i % targets.length]) {
        const tgt = targets[i % targets.length];
        p.tr = lerp(tgt.palR, tgt.imgR, colorProgress);
        p.tg = lerp(tgt.palG, tgt.imgG, colorProgress);
        p.tb = lerp(tgt.palB, tgt.imgB, colorProgress);
      }

      p.r += (p.tr - p.r) * 0.08;
      p.g += (p.tg - p.g) * 0.08;
      p.b += (p.tb - p.b) * 0.08;
      p.size += (p.tsize - p.size) * 0.08;
    }
  }

  updateLatentOrbits(dt) {
    const cx1 = this.width * 0.72;
    const cy1 = this.height * 0.32;
    const cx2 = this.width * 0.76;
    const cy2 = this.height * 0.74;
    const mouse = this.mouse;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.orbitAngle += p.orbitSpeed;

      const cx = p.group === 0 ? cx1 : cx2;
      const cy = p.group === 0 ? cy1 : cy2;
      const ex = p.group === 0 ? 1.25 : 0.9;
      const ey = p.group === 0 ? 0.85 : 1.15;

      p.tx = cx + Math.cos(p.orbitAngle) * p.orbitRadius * ex;
      p.ty = cy + Math.sin(p.orbitAngle) * p.orbitRadius * ey;

      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      p.vx = (p.vx + dx * 0.04) * 0.88;
      p.vy = (p.vy + dy * 0.04) * 0.88;

      if (mouse.active) {
        const mdx = p.x - mouse.x;
        const mdy = p.y - mouse.y;
        const dist = Math.hypot(mdx, mdy);
        if (dist < mouse.radius && dist > 0.1) {
          const force = (1 - dist / mouse.radius) * mouse.power;
          p.vx += (mdx / dist) * force;
          p.vy += (mdy / dist) * force;
        }
      }

      p.x += p.vx;
      p.y += p.vy;

      p.r += (p.tr - p.r) * p.colorSpeed;
      p.g += (p.tg - p.g) * p.colorSpeed;
      p.b += (p.tb - p.b) * p.colorSpeed;
      p.size += (p.tsize - p.size) * 0.05;
    }
  }

  // Slide 3: Desplazamiento fluido hacia el centro y expansión en ondas
  updateBoundaryBlast(dt) {
    const t = this.momentTime;
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const boxW = Math.min(this.width * 0.28, 300);
    const boxH = Math.min(this.height * 0.32, 180);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.r += (p.tr - p.r) * 0.12;
      p.g += (p.tg - p.g) * 0.12;
      p.b += (p.tb - p.b) * 0.12;
    }

    if (t < 1.8) {
      // Convergencia fluida al centro (desde cualquier posición previa)
      const pulseTension = 1 + Math.sin(t * 4.5) * 0.04;
      this.ctx.save();
      this.ctx.strokeStyle = `rgba(8, 169, 221, ${0.35 + Math.sin(t * 5.0) * 0.2})`;
      this.ctx.lineWidth = 1.8;
      this.ctx.strokeRect(
        cx - (boxW * 0.5) * pulseTension,
        cy - (boxH * 0.5) * pulseTension,
        boxW * pulseTension,
        boxH * pulseTension
      );
      this.ctx.restore();

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const dx = p.ox - p.x;
        const dy = p.oy - p.y;
        p.vx = (p.vx + dx * 0.07) * 0.85;
        p.vy = (p.vy + dy * 0.07) * 0.85;
        p.x += p.vx;
        p.y += p.vy;
      }
    } else {
      const waveInterval = 1.35;
      if (t - this.slide3LastWaveTime > waveInterval) {
        this.slide3LastWaveTime = t;
        this.shockwaves.push({
          x: cx,
          y: cy,
          radius: 10,
          maxRadius: Math.max(this.width, this.height) * 0.75,
          speed: 380,
          alpha: 0.85,
        });
      }

      this.ctx.save();
      for (let w = this.shockwaves.length - 1; w >= 0; w--) {
        const wave = this.shockwaves[w];
        wave.radius += wave.speed * dt;
        wave.alpha -= dt * 0.42;

        if (wave.alpha <= 0 || wave.radius >= wave.maxRadius) {
          this.shockwaves.splice(w, 1);
          continue;
        }

        this.ctx.strokeStyle = `rgba(8, 169, 221, ${wave.alpha * 0.7})`;
        this.ctx.lineWidth = 2.2;
        this.ctx.beginPath();
        this.ctx.arc(wave.x, wave.y, wave.radius, 0, TAU);
        this.ctx.stroke();
      }
      this.ctx.restore();

      const wavesElapsed = Math.floor((t - 1.8) / waveInterval);

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const isPermanentCore = p.cohort >= 4;
        const isCohortReleased = p.cohort <= wavesElapsed;

        if (isPermanentCore) {
          const ang = Math.atan2(p.y - cy, p.x - cx) + 0.02;
          const targetDist = 45 + (p.id % 90) * 1.1;
          const currentDist = Math.hypot(p.x - cx, p.y - cy);
          const distDiff = targetDist - currentDist;

          p.vx = (p.vx + Math.cos(ang) * distDiff * 0.03 - Math.sin(ang) * 0.8) * 0.90;
          p.vy = (p.vy + Math.sin(ang) * distDiff * 0.03 + Math.cos(ang) * 0.8) * 0.90;
          p.x += p.vx;
          p.y += p.vy;
        } else if (isCohortReleased) {
          const outwardAng = Math.atan2(p.y - cy, p.x - cx);
          const push = 1.6 + (p.id % 5) * 0.4;
          p.vx += Math.cos(outwardAng) * push * 0.05 + Math.sin(p.y * 0.008 + t) * 0.15;
          p.vy += Math.sin(outwardAng) * push * 0.05 + Math.cos(p.x * 0.008 + t) * 0.15;
          p.vx *= 0.96;
          p.vy *= 0.96;
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < -20) p.x = this.width + 20;
          if (p.x > this.width + 20) p.x = -20;
          if (p.y < -20) p.y = this.height + 20;
          if (p.y > this.height + 20) p.y = -20;
        } else {
          const dx = p.ox - p.x;
          const dy = p.oy - p.y;
          p.vx = (p.vx + dx * 0.04) * 0.86;
          p.vy = (p.vy + dy * 0.04) * 0.86;
          p.x += p.vx;
          p.y += p.vy;
        }
      }
    }
  }

  updateTriadFuse(dt) {
    const t = this.momentTime;
    const targetObj = this.sampledTargets["academia-industria-ciudad"];
    const targets = targetObj ? targetObj.points : null;

    const c1 = { x: this.width * 0.44, y: this.height * 0.34 };
    const c2 = { x: this.width * 0.78, y: this.height * 0.34 };
    const c3 = { x: this.width * 0.61, y: this.height * 0.72 };

    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");
    const gold = hexToRgb("#d6a94f");

    if (t < 1.6) {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const center = p.cluster === 0 ? c1 : p.cluster === 1 ? c2 : c3;
        const color = p.cluster === 0 ? cyan : p.cluster === 1 ? magenta : gold;
        const ang = p.orbitAngle + t * 2.2;
        const rad = 25 + (i % 120) * 1.1;

        p.tx = center.x + Math.cos(ang) * rad;
        p.ty = center.y + Math.sin(ang) * rad;
        p.tr = color.r;
        p.tg = color.g;
        p.tb = color.b;

        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        p.vx = (p.vx + dx * 0.06) * 0.86;
        p.vy = (p.vy + dy * 0.06) * 0.86;
        p.x += p.vx;
        p.y += p.vy;

        p.r += (p.tr - p.r) * 0.08;
        p.g += (p.tg - p.g) * 0.08;
        p.b += (p.tb - p.b) * 0.08;
      }
    } else {
      const progress = clamp((t - 1.6) / 2.2, 0, 1);
      const ease = smoothstep(0, 1, progress);

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const center = p.cluster === 0 ? c1 : p.cluster === 1 ? c2 : c3;
        const color = p.cluster === 0 ? cyan : p.cluster === 1 ? magenta : gold;
        const ang = p.orbitAngle + t * 2.2;
        const rad = 25 + (i % 120) * 1.1;

        const clusterX = center.x + Math.cos(ang) * rad;
        const clusterY = center.y + Math.sin(ang) * rad;

        if (targets && targets[i % targets.length]) {
          const tgt = targets[i % targets.length];
          p.tx = lerp(clusterX, tgt.x, ease);
          p.ty = lerp(clusterY, tgt.y, ease);
          p.tr = lerp(color.r, tgt.imgR, ease);
          p.tg = lerp(color.g, tgt.imgG, ease);
          p.tb = lerp(color.b, tgt.imgB, ease);
          p.tsize = lerp(2.2, tgt.size, ease);
        }

        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        p.vx = (p.vx + dx * 0.06) * 0.86;
        p.vy = (p.vy + dy * 0.06) * 0.86;
        p.x += p.vx;
        p.y += p.vy;

        p.r += (p.tr - p.r) * 0.08;
        p.g += (p.tg - p.g) * 0.08;
        p.b += (p.tb - p.b) * 0.08;
        p.size += (p.tsize - p.size) * 0.08;
      }
    }
  }

  updateStageCollapse(dt) {
    const t = this.momentTime;
    const targetObj = this.sampledTargets["impacto"];
    const targets = targetObj ? targetObj.points : null;

    const cx = this.width * 0.65;
    const cy = this.height * 0.65;
    const stageW = Math.min(this.width * 0.50, 680);

    if (t < 1.4) {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (i % 3 === 0) {
          const pr = (i % 1200) / 1200;
          p.tx = cx - stageW * 0.5 + pr * stageW;
          p.ty = cy + Math.sin(pr * Math.PI) * -16;
        } else {
          const rayIdx = i % 7;
          const rayAngle = -Math.PI * 0.5 + (rayIdx - 3) * 0.28;
          const dist = 40 + (i % 380) * 1.4;
          p.tx = cx + Math.cos(rayAngle) * dist;
          p.ty = cy + Math.sin(rayAngle) * dist;
        }
        p.tr = 247;
        p.tg = 110 + (i % 80);
        p.tb = 170;

        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        p.vx = (p.vx + dx * 0.07) * 0.85;
        p.vy = (p.vy + dy * 0.07) * 0.85;
        p.x += p.vx;
        p.y += p.vy;
        p.r += (p.tr - p.r) * 0.08;
        p.g += (p.tg - p.g) * 0.08;
        p.b += (p.tb - p.b) * 0.08;
      }
    } else {
      const progress = clamp((t - 1.4) / 2.0, 0, 1);
      const ease = smoothstep(0, 1, progress);

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (targets && targets[i % targets.length]) {
          const tgt = targets[i % targets.length];
          p.tx = lerp(p.tx, tgt.x, ease);
          p.ty = lerp(p.ty, tgt.y, ease);
          p.tr = lerp(p.tr, tgt.imgR, ease);
          p.tg = lerp(p.tg, tgt.imgG, ease);
          p.tb = lerp(p.tb, tgt.imgB, ease);
          p.tsize = lerp(2.2, tgt.size, ease);
        }

        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        p.vx = (p.vx + dx * 0.065) * 0.86;
        p.vy = (p.vy + dy * 0.065) * 0.86;
        p.x += p.vx;
        p.y += p.vy;
        p.r += (p.tr - p.r) * 0.08;
        p.g += (p.tg - p.g) * 0.08;
        p.b += (p.tb - p.b) * 0.08;
        p.size += (p.tsize - p.size) * 0.08;
      }
    }
  }

  updateProximityGraph(dt) {
    const t = this.momentTime;
    const mouse = this.mouse;
    const lines = [];

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      p.flowAngle += (Math.sin(p.y * 0.005 + t + i) + Math.cos(p.x * 0.005 + t)) * 0.015;
      p.vx = Math.cos(p.flowAngle) * p.flowSpeed;
      p.vy = Math.sin(p.flowAngle) * p.flowSpeed;

      if (mouse.active) {
        const mdx = p.x - mouse.x;
        const mdy = p.y - mouse.y;
        const dist = Math.hypot(mdx, mdy);
        if (dist < mouse.radius && dist > 0.1) {
          const force = (1 - dist / mouse.radius) * mouse.power;
          p.vx += (mdx / dist) * force;
          p.vy += (mdy / dist) * force;
        }
      }

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;
    }

    const sampleStep = 16;
    const connectorIndices = [];
    for (let i = 0; i < this.particles.length; i += sampleStep) {
      connectorIndices.push(i);
    }

    const maxDist = 80;
    const maxDistSq = maxDist * maxDist;

    for (let m = 0; m < connectorIndices.length; m++) {
      const i = connectorIndices[m];
      const p = this.particles[i];

      for (let n = m + 1; n < connectorIndices.length; n++) {
        const j = connectorIndices[n];
        const q = this.particles[j];

        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < maxDistSq && distSq > 4) {
          const dist = Math.sqrt(distSq);
          lines.push({
            x1: p.x,
            y1: p.y,
            x2: q.x,
            y2: q.y,
            alpha: (1 - dist / maxDist) * 0.52,
            isCrossGroup: p.group !== q.group,
          });
        }
      }
    }

    if (lines.length > 0) {
      this.ctx.save();
      this.ctx.lineWidth = 1.1;
      for (const l of lines) {
        this.ctx.strokeStyle = l.isCrossGroup
          ? `rgba(233, 109, 170, ${l.alpha})`
          : `rgba(8, 169, 221, ${l.alpha})`;
        this.ctx.beginPath();
        this.ctx.moveTo(l.x1, l.y1);
        this.ctx.lineTo(l.x2, l.y2);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }
  }

  updateTrustCrystallize(dt) {
    const t = this.momentTime;
    const cyan = hexToRgb("#08a9dd");

    if (t < 3.0) {
      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > this.width) p.vx *= -1;
        if (p.y < 0 || p.y > this.height) p.vy *= -1;
      }
    } else if (t < 7.0) {
      const groupRadiusSq = 42 * 42;
      const step = 6;

      for (let i = 0; i < this.particles.length; i += step) {
        const p = this.particles[i];
        let neighbors = [p];

        for (let j = i + 1; j < this.particles.length; j += step) {
          const q = this.particles[j];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          if (dx * dx + dy * dy < groupRadiusSq) {
            neighbors.push(q);
            if (neighbors.length >= 3) break;
          }
        }

        if (neighbors.length >= 3) {
          const hasInfected = neighbors.some((n) => n.infected);
          if (hasInfected) {
            for (const n of neighbors) {
              n.infected = true;
              n.colorCode = 0;
              n.tr = cyan.r;
              n.tg = cyan.g;
              n.tb = cyan.b;

              const blastAng = Math.random() * TAU;
              const fuerzaRepulsion = 7.6;
              n.vx = Math.cos(blastAng) * fuerzaRepulsion;
              n.vy = Math.sin(blastAng) * fuerzaRepulsion;
            }

            if (this.pulses.length < 24) {
              this.pulses.push({
                x: p.x,
                y: p.y,
                radius: 4,
                maxRadius: 32,
                alpha: 0.9,
              });
            }
          }
        }
      }

      for (const p of this.particles) {
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.x += p.vx;
        p.y += p.vy;
        p.r += (p.tr - p.r) * 0.08;
        p.g += (p.tg - p.g) * 0.08;
        p.b += (p.tb - p.b) * 0.08;

        if (p.x < 0 || p.x > this.width) p.vx *= -1;
        if (p.y < 0 || p.y > this.height) p.vy *= -1;
      }
    } else if (t < 10.0) {
      for (const p of this.particles) {
        p.tr = cyan.r;
        p.tg = cyan.g;
        p.tb = cyan.b;
        p.r += (p.tr - p.r) * 0.1;
        p.g += (p.tg - p.g) * 0.1;
        p.b += (p.tb - p.b) * 0.1;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.x += p.vx;
        p.y += p.vy;
      }

      this.ctx.save();
      this.ctx.strokeStyle = "rgba(233, 109, 170, 0.92)";
      this.ctx.lineWidth = 1.6;
      this.ctx.shadowColor = "#08a9dd";
      this.ctx.shadowBlur = 12;

      const boltCount = 20;
      for (let b = 0; b < boltCount; b++) {
        const i1 = Math.floor(Math.random() * this.particles.length);
        const i2 = Math.floor(Math.random() * this.particles.length);
        const p1 = this.particles[i1];
        const p2 = this.particles[i2];
        const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        if (d < 320 && d > 40) {
          this.drawZigZagBolt(p1.x, p1.y, p2.x, p2.y);
        }
      }
      this.ctx.restore();
    } else {
      this.ctx.save();
      this.ctx.strokeStyle = "rgba(8, 169, 221, 0.55)";
      this.ctx.lineWidth = 1.2;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.x += p.vx;
        p.y += p.vy;
        p.r = cyan.r;
        p.g = cyan.g;
        p.b = cyan.b;

        if (i % 22 === 0) {
          for (let j = i + 1; j < i + 36 && j < this.particles.length; j += 3) {
            const q = this.particles[j];
            const d = Math.hypot(q.x - p.x, q.y - p.y);
            if (d < 105) {
              this.ctx.beginPath();
              this.ctx.moveTo(p.x, p.y);
              this.ctx.lineTo(q.x, q.y);
              this.ctx.stroke();
            }
          }
        }
      }
      this.ctx.restore();
    }
  }

  drawZigZagBolt(x1, y1, x2, y2) {
    const steps = 7;
    const dx = (x2 - x1) / steps;
    const dy = (y2 - y1) / steps;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);

    for (let s = 1; s < steps; s++) {
      const jx = (Math.random() - 0.5) * 26;
      const jy = (Math.random() - 0.5) * 26;
      this.ctx.lineTo(x1 + dx * s + jx, y1 + dy * s + jy);
    }
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  updatePathDiscovery(dt) {
    const t = this.momentTime;
    const targetObj = this.sampledTargets["nuevas-rutas"];
    const targets = targetObj ? targetObj.points : null;

    if (t < 1.6) {
      const cy = this.height * 0.5;
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (p.group === 0) {
          const progress = (i % 1600) / 1600;
          p.tx = this.width * 0.38 + progress * (this.width * 0.58);
          p.ty = cy + Math.sin(progress * TAU * 1.5) * 85;
        } else {
          const ang = p.orbitAngle + t * 3.2;
          const rad = 35 + (i % 180) * 1.1;
          p.tx = this.width * 0.38 + (p.x + Math.cos(ang) * rad) % (this.width * 0.58);
          p.ty = cy + Math.sin(ang) * (rad * 1.3);
        }

        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        p.vx = (p.vx + dx * 0.05) * 0.86;
        p.vy = (p.vy + dy * 0.05) * 0.86;
        p.x += p.vx;
        p.y += p.vy;
      }
    } else {
      const progress = clamp((t - 1.6) / 2.0, 0, 1);
      const ease = smoothstep(0, 1, progress);

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (targets && targets[i % targets.length]) {
          const tgt = targets[i % targets.length];
          p.tx = lerp(p.tx, tgt.x, ease);
          p.ty = lerp(p.ty, tgt.y, ease);
          p.tr = lerp(p.tr, tgt.imgR, ease);
          p.tg = lerp(p.tg, tgt.imgG, ease);
          p.tb = lerp(p.tb, tgt.imgB, ease);
          p.tsize = lerp(2.2, tgt.size, ease);
        }

        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        p.vx = (p.vx + dx * 0.065) * 0.86;
        p.vy = (p.vy + dy * 0.065) * 0.86;
        p.x += p.vx;
        p.y += p.vy;
        p.r += (p.tr - p.r) * 0.08;
        p.g += (p.tg - p.g) * 0.08;
        p.b += (p.tb - p.b) * 0.08;
        p.size += (p.tsize - p.size) * 0.08;
      }
    }
  }

  // Slide 9: Dos corrientes generacionales cruzando la pantalla sin saltos
  updateDualStreams(dt) {
    const cx = this.width * 0.58;
    const cy = this.height * 0.5;
    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (p.group === 0) {
        p.vx = 2.6;
        p.vy = Math.sin(p.x * 0.015 + this.momentTime * 2.0) * 1.5;
        p.tr = cyan.r;
        p.tg = cyan.g;
        p.tb = cyan.b;

        if (p.x > cx - 210 && p.x < cx + 210) {
          const angle = Math.atan2(p.y - cy, p.x - cx) + 0.045;
          const radius = Math.hypot(p.x - cx, p.y - cy);
          p.x = cx + Math.cos(angle) * radius;
          p.y = cy + Math.sin(angle) * radius;
        } else {
          p.x += p.vx;
          p.y += p.vy;
        }
        if (p.x > this.width + 40) p.x = -40;
      } else {
        p.vx = -4.4;
        p.vy = Math.cos(p.x * 0.025 + this.momentTime * 3.5) * 2.8;
        p.tr = magenta.r;
        p.tg = magenta.g;
        p.tb = magenta.b;

        if (p.x > cx - 210 && p.x < cx + 210) {
          const angle = Math.atan2(p.y - cy, p.x - cx) - 0.065;
          const radius = Math.hypot(p.x - cx, p.y - cy);
          p.x = cx + Math.cos(angle) * radius;
          p.y = cy + Math.sin(angle) * radius;
        } else {
          p.x += p.vx;
          p.y += p.vy;
        }
        if (p.x < -40) p.x = this.width + 40;
      }

      p.r += (p.tr - p.r) * 0.1;
      p.g += (p.tg - p.g) * 0.1;
      p.b += (p.tb - p.b) * 0.1;
    }
  }

  // Slide 10: Olas entrelazadas que se van sincronizando conforme pasa el tiempo
  // Las rosadas forman olas y las azules hacen lo mismo, entrelazándose armónicamente
  updateSynergyMultiplication(dt) {
    const t = this.momentTime;
    const cy = this.height * 0.5;
    const amp = Math.min(this.height * 0.25, 150);
    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");

    // Factor de entrelazamiento progresivo (de corrientes sueltas a olas trenzadas conjuntas)
    const braidFactor = smoothstep(1.8, 5.2, t);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const offset = ((p.id % 40) - 20) * 1.6;

      if (p.group === 0) {
        // Experiencia (Azul): Ola armónica continua
        const waveY = cy + Math.sin(p.x * 0.0072 - t * 2.2) * amp + offset;
        const initialVy = Math.sin(p.x * 0.015 + t * 2.2) * 2.2;

        p.vx = 2.4;
        p.vy = lerp(initialVy, (waveY - p.y) * 0.12, braidFactor);
        p.x += p.vx;
        p.y += p.vy;

        if (p.x > this.width + 40) p.x = -40;
      } else {
        // Juventud (Rosada): Pasa de movimiento errático a ola simétrica entrelazada
        const waveY = cy + Math.sin(p.x * 0.0072 - t * 2.2 + Math.PI) * amp + offset;
        const initialVy = Math.cos(p.x * 0.026 + t * 3.8) * 3.4 + Math.sin(p.y * 0.018 + t * 2.0) * 1.6;

        p.vx = lerp(-4.2, -3.2, braidFactor);
        p.vy = lerp(initialVy, (waveY - p.y) * 0.14, braidFactor);
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -40) p.x = this.width + 40;
      }

      if (p.y < -30) p.y = this.height + 30;
      if (p.y > this.height + 30) p.y = -30;
    }

    // Colisiones y cruces entre ambas corrientes generando destellos luminosos
    const collisionDistSq = 28 * 28;
    for (let i = 0; i < this.particles.length; i += 6) {
      const p = this.particles[i];
      if (p.group !== 0) continue;

      for (let j = i + 1; j < this.particles.length; j += 6) {
        const q = this.particles[j];
        if (q.group !== 1) continue;

        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const dSq = dx * dx + dy * dy;

        if (dSq < collisionDistSq && this.microParticles.length < 450) {
          if (this.pulses.length < 24) {
            this.pulses.push({
              x: (p.x + q.x) * 0.5,
              y: (p.y + q.y) * 0.5,
              radius: 4,
              maxRadius: 36,
              alpha: 0.9,
            });
          }

          const count = 2 + Math.floor(Math.random() * 2);
          for (let m = 0; m < count; m++) {
            const ang = Math.random() * TAU;
            const spd = 2.4 + Math.random() * 4.0;
            this.microParticles.push({
              x: (p.x + q.x) * 0.5,
              y: (p.y + q.y) * 0.5,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              life: 1.0,
              r: m % 2 === 0 ? cyan.r : magenta.r,
              g: m % 2 === 0 ? cyan.g : magenta.g,
              b: m % 2 === 0 ? cyan.b : magenta.b,
              size: 1.8,
            });
          }
        }
      }
    }
  }

  // Slide 11: Inicia oculta en negro y barre de izquierda a derecha revelando colores
  updateLatentReveal(dt) {
    const t = this.momentTime;
    const { nodes, edges } = this.slide11Network;
    if (!edges || edges.length === 0) return;

    const revealProgress = clamp(t / 6.5, 0, 1);
    const revealX = lerp(-120, this.width + 120, revealProgress);

    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");
    const pulse = (Math.sin(t * 3.2) + 1) * 0.5;

    this.ctx.save();

    // 1. Aristas: ocultas en negro a la derecha, reveladas con brillo a la izquierda
    for (const edge of edges) {
      const n1 = nodes[edge.a];
      const n2 = nodes[edge.b];
      const edgeMinX = Math.min(n1.x, n2.x);
      const edgeMaxX = Math.max(n1.x, n2.x);

      if (revealX > edgeMinX) {
        const segmentReveal = clamp((revealX - edgeMinX) / Math.max(15, edgeMaxX - edgeMinX), 0, 1);
        const currX = lerp(n1.x, n2.x, segmentReveal);
        const currY = lerp(n1.y, n2.y, segmentReveal);

        const edgeAlpha = clamp((revealX - edgeMinX) / 80, 0, 1) * (0.42 + pulse * 0.35);
        this.ctx.strokeStyle = `rgba(8, 169, 221, ${edgeAlpha})`;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(n1.x, n1.y);
        this.ctx.lineTo(currX, currY);
        this.ctx.stroke();
      }
    }

    // 2. Nodos: ocultos en negro a la derecha, revelados en magenta a la izquierda
    for (const node of nodes) {
      if (revealX > node.x) {
        const nodeAlpha = clamp((revealX - node.x) / 70, 0, 1);
        this.ctx.fillStyle = `rgba(233, 109, 170, ${nodeAlpha * (0.75 + pulse * 0.25)})`;
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, (2.8 + pulse * 1.4) * nodeAlpha, 0, TAU);
        this.ctx.fill();
      }
    }

    // 3. Haz de luz suave barriendo en el frente de revelación
    if (revealProgress < 0.98 && revealX > 0 && revealX < this.width) {
      const grad = this.ctx.createLinearGradient(revealX - 35, 0, revealX + 35, 0);
      grad.addColorStop(0, "rgba(8, 169, 221, 0)");
      grad.addColorStop(0.5, "rgba(247, 247, 244, 0.45)");
      grad.addColorStop(1, "rgba(8, 169, 221, 0)");
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(revealX - 35, 0, 70, this.height);
    }

    this.ctx.restore();

    // 4. Partículas en la red: ocultas en negro a la derecha, fluidas y visibles a la izquierda
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const edge = edges[p.edgeIdx % edges.length];
      const n1 = nodes[edge.a];
      const n2 = nodes[edge.b];

      p.edgeT = (p.edgeT + dt * (0.35 + (i % 5) * 0.08)) % 1.0;
      const targetX = lerp(n1.x, n2.x, p.edgeT);
      const targetY = lerp(n1.y, n2.y, p.edgeT);

      p.vx = (p.vx + (targetX - p.x) * 0.12) * 0.82;
      p.vy = (p.vy + (targetY - p.y) * 0.12) * 0.82;
      p.x += p.vx;
      p.y += p.vy;

      if (p.x > revealX) {
        p.a = 0;
      } else {
        p.a = clamp((revealX - p.x) / 70, 0, 0.95);
        p.tr = p.group === 0 ? cyan.r : magenta.r;
        p.tg = p.group === 0 ? cyan.g : magenta.g;
        p.tb = p.group === 0 ? cyan.b : magenta.b;
      }
    }
  }

  updateHighestOrder(dt) {
    const t = this.momentTime;
    const targetObj = this.sampledTargets["futuro-construido"];
    const targets = targetObj ? targetObj.points : null;
    const mouse = this.mouse;

    const assemblyProgress = smoothstep(2.5, 6.0, t);
    const colorReveal = smoothstep(6.0, 8.2, t);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (assemblyProgress < 0.99 && targets && targets[i % targets.length]) {
        p.flowAngle += dt * p.flowSpeed * (1 - assemblyProgress);
        const flowX = this.width * 0.65 + Math.cos(p.flowAngle) * (this.width * 0.28);
        const flowY = this.height * 0.5 + Math.sin(p.flowAngle) * (this.height * 0.35);

        const tgt = targets[i % targets.length];
        p.tx = lerp(flowX, tgt.x, assemblyProgress);
        p.ty = lerp(flowY, tgt.y, assemblyProgress);
        p.tsize = lerp(2.2, tgt.size, assemblyProgress);

        p.tr = lerp(tgt.palR, tgt.imgR, colorReveal);
        p.tg = lerp(tgt.palG, tgt.imgG, colorReveal);
        p.tb = lerp(tgt.palB, tgt.imgB, colorReveal);
      } else if (targets && targets[i % targets.length]) {
        const tgt = targets[i % targets.length];
        p.tx = tgt.x;
        p.ty = tgt.y;
        p.tsize = tgt.size;
        p.tr = lerp(tgt.palR, tgt.imgR, colorReveal);
        p.tg = lerp(tgt.palG, tgt.imgG, colorReveal);
        p.tb = lerp(tgt.palB, tgt.imgB, colorReveal);
      }

      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      p.vx = (p.vx + dx * 0.055) * 0.86;
      p.vy = (p.vy + dy * 0.055) * 0.86;

      if (mouse.active) {
        const mdx = p.x - mouse.x;
        const mdy = p.y - mouse.y;
        const dist = Math.hypot(mdx, mdy);
        if (dist < mouse.radius && dist > 0.1) {
          const force = (1 - dist / mouse.radius) * mouse.power;
          p.vx += (mdx / dist) * force;
          p.vy += (mdy / dist) * force;
        }
      }

      p.x += p.vx;
      p.y += p.vy;

      p.r += (p.tr - p.r) * 0.08;
      p.g += (p.tg - p.g) * 0.08;
      p.b += (p.tb - p.b) * 0.08;
      p.size += (p.tsize - p.size) * 0.08;
    }
  }

  drawParticles() {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.a <= 0.02) continue;

      this.ctx.fillStyle = `rgba(${p.r | 0}, ${p.g | 0}, ${p.b | 0}, ${p.a})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, Math.max(0.75, p.size * 0.5), 0, TAU);
      this.ctx.fill();
    }
  }

  drawPulsesAndMicroParticles(dt) {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pulse = this.pulses[i];
      pulse.radius += 2.2;
      pulse.alpha -= 0.035;

      if (pulse.alpha <= 0 || pulse.radius >= pulse.maxRadius) {
        this.pulses.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.strokeStyle = `rgba(247, 247, 244, ${pulse.alpha})`;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(pulse.x, pulse.y, pulse.radius, 0, TAU);
      this.ctx.stroke();
      this.ctx.restore();
    }

    for (let i = this.microParticles.length - 1; i >= 0; i--) {
      const mp = this.microParticles[i];
      mp.x += mp.vx;
      mp.y += mp.vy;
      mp.vx *= 0.94;
      mp.vy *= 0.94;
      mp.life -= 0.02;

      if (mp.life <= 0) {
        this.microParticles.splice(i, 1);
        continue;
      }

      this.ctx.fillStyle = `rgba(${mp.r}, ${mp.g}, ${mp.b}, ${mp.life * 0.9})`;
      this.ctx.beginPath();
      this.ctx.arc(mp.x, mp.y, mp.size * 0.5, 0, TAU);
      this.ctx.fill();
    }
  }
}

window.VisualSystem = VisualSystem;
