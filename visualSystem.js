/**
 * visualSystem.js - Motor generativo de partículas y morphing de alta definición para Fórum UPB
 * 
 * Mejoras aplicadas:
 * 1. 11.664 partículas (cuadrícula 144x81) con cobertura total y soporte visual fotográfico
 *    para nitidez y reconocimiento instantáneo de las fotos en Slides 2, 4, 5, 8, 12 y 13 (QRs).
 * 2. Slide 6: Red de proximidad con circulación armónica continua y fuerzas orbitales;
 *    nunca se queda quieta ni se congela, manteniendo vida propia sin necesidad de mouse.
 * 3. Slide 7: Contagio de confianza progresivo y visible (semilla inicial -> onda expansiva 
 *    por colisiones 3s–7s -> descargas eléctricas 7s–10s -> cristalización 10s+).
 * 4. Slide 11: La red geométrica se TEJE y CONSTRUYE activamente en tiempo real por el paso
 *    de los trazadores jóvenes, en vez de simplemente aparecer estática.
 */

const TAU = Math.PI * 2;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
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

    // 11.664 partículas (144 columnas x 81 filas en ratio 16:9)
    this.particleCount = CONFIG.particleCount || 11664;
    this.gridCols = 144;
    this.gridRows = 81;

    this.particles = [];
    this.pulses = [];
    this.microParticles = [];

    // Caché de imágenes muestreadas y fotos nativas
    this.rawImages = {};
    this.sampledTargets = {};
    this.imagesLoaded = false;

    // Estado del momento activo
    this.currentMoment = null;
    this.momentState = "latent-orbits";
    this.momentTime = 0;
    this.lastTimestamp = performance.now();

    // Mouse / Touch
    this.mouse = {
      x: -9999,
      y: -9999,
      active: false,
      radius: CONFIG.mouseRepulsionRadius || 130,
      power: CONFIG.mouseRepulsionPower || 9,
    };

    // Slide 11: Red en construcción dinámica
    this.constructedNodes = [];
    this.constructedEdges = [];
    this.targetLatticeNodes = [];

    // Slide 7: Estado de contagio progresivo
    this.contagionSeeds = [];

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

  initParticles() {
    this.particles = [];
    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");
    const white = hexToRgb("#f7f7f4");

    for (let i = 0; i < this.particleCount; i++) {
      const isTypeA = i < this.particleCount * 0.5;
      const group = isTypeA ? 0 : 1;
      const baseRgb = isTypeA ? cyan : magenta;

      this.particles.push({
        id: i,
        group: group, // 0: Experiencia, 1: Nuevas Generaciones
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        tx: this.width * 0.5,
        ty: this.height * 0.5,
        ox: this.width * 0.5,
        oy: this.height * 0.5,
        size: isTypeA ? 2.8 : 2.0,
        tsize: 2.5,
        r: baseRgb.r,
        g: baseRgb.g,
        b: baseRgb.b,
        a: 0.9,
        tr: baseRgb.r,
        tg: baseRgb.g,
        tb: baseRgb.b,
        ta: 0.9,
        orbitRadius: 40 + Math.random() * 200,
        orbitAngle: Math.random() * TAU,
        orbitSpeed: (isTypeA ? 0.0035 : 0.016) * (Math.random() * 0.5 + 0.75),
        cluster: i % 3,
        // Slide 7 variables
        infected: false,
        infectionProgress: 0,
        // Flow offsets
        flowOffset: Math.random() * 100,
      });
    }
  }

  // Pre-carga asíncrona de imágenes
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
    const keys = ["auditorio-grados", "academia-industria-ciudad", "impacto", "nuevas-rutas", "futuro-construido"];
    keys.forEach((k) => {
      if (this.rawImages[k]) {
        this.sampledTargets[k] = this.sampleImageDense(this.rawImages[k]);
      }
    });

    if (this.rawImages["qr-memory"] && this.rawImages["qr-social"]) {
      this.sampledTargets["qr-cierre"] = this.sampleQrDense(
        this.rawImages["qr-memory"],
        this.rawImages["qr-social"]
      );
    }
  }

  // Muestreo refinado con espacio negativo en zonas oscuras y paleta cromática armónica
  sampleImageDense(img) {
    const cols = 126;
    const rows = 72;

    const off = document.createElement("canvas");
    off.width = cols;
    off.height = rows;
    const offCtx = off.getContext("2d", { willReadFrequently: true });
    offCtx.drawImage(img, 0, 0, cols, rows);
    const data = offCtx.getImageData(0, 0, cols, rows).data;

    // Posición en centro-derecha dejando la columna izquierda libre para el texto
    const padY = this.height * 0.12;
    const availH = this.height - padY * 2;
    const availW = this.width * 0.54;
    const startLeft = this.width * 0.42;

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

    const points = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 4;
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        const lum = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;

        // ESPACIO NEGATIVO: En zonas oscuras (fondos, sombras profundas) no ponemos partículas
        if (lum < 0.16) continue;

        // Mapeo armónico a la paleta de Future Leaders Forum y Fórum UPB
        let tr, tg, tb;
        const isWarm = (red + green * 0.45) > (blue * 1.25);

        if (lum > 0.74) {
          // Altas luces: Blanco marfil nítido (#f7f7f4)
          tr = 247; tg = 247; tb = 244;
        } else if (lum > 0.40) {
          if (isWarm) {
            if (red > 155 && green > 125) {
              tr = 214; tg = 169; tb = 79; // Dorado Fórum UPB #d6a94f
            } else {
              tr = 233; tg = 109; tb = 170; // Magenta vibrante #e96daa
            }
          } else {
            tr = 8; tg = 169; tb = 221; // Cyan eléctrico #08a9dd
          }
        } else {
          // Medios-bajos y contornos: tonos profundos elegantes
          if (isWarm) {
            tr = 184; tg = 45; tb = 128; // Magenta profundo
          } else {
            tr = 6; tg = 110; tb = 158; // Cyan profundo
          }
        }

        // Círculos pequeños y sutiles (de 1.6px a 3.2px)
        const dotSize = 1.6 + lum * 1.8;

        points.push({
          x: startX + c * stepX,
          y: startY + r * stepY,
          r: tr,
          g: tg,
          b: tb,
          a: 0.92,
          size: dotSize,
        });
      }
    }

    // Partículas restantes del pool: halo ambiental de polvo estelar sutil en la periferia
    const remaining = this.particleCount - points.length;
    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");

    for (let i = 0; i < remaining; i++) {
      const ang = Math.random() * TAU;
      const radX = (drawW * 0.5) * (1.05 + Math.random() * 0.35);
      const radY = (drawH * 0.5) * (1.05 + Math.random() * 0.35);
      const rgb = i % 2 === 0 ? cyan : magenta;

      points.push({
        x: startX + drawW * 0.5 + Math.cos(ang) * radX,
        y: startY + drawH * 0.5 + Math.sin(ang) * radY,
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        a: 0.15 + Math.random() * 0.15, // Muy tenue y etéreo
        size: 1.2,
      });
    }

    return {
      points: points,
      bounds: { startX, startY, drawW, drawH },
    };
  }

  // Muestreo nítido de códigos QR con espacio negativo y círculos definidos
  sampleQrDense(imgMem, imgSoc) {
    const points = [];
    const total = this.particleCount;
    const half = Math.floor(total * 0.42);

    // Dimensiones y posición de los QRs a la derecha del texto
    const qrSize = Math.min(this.width * 0.23, this.height * 0.50);
    const yPos = this.height * 0.50 - qrSize * 0.5;
    const leftX = this.width * 0.46 - qrSize * 0.5;
    const rightX = this.width * 0.78 - qrSize * 0.5;

    // QR 1: Memorias
    const pts1 = this.sampleSingleQrDense(imgMem, leftX, yPos, qrSize, half);
    points.push(...pts1);

    // QR 2: Social
    const pts2 = this.sampleSingleQrDense(imgSoc, rightX, yPos, qrSize, half);
    points.push(...pts2);

    // Partículas restantes en halo ambiental cálido
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
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        a: 0.22,
        size: 1.4,
      });
    }

    return {
      points: points,
      isQr: true,
    };
  }

  sampleSingleQrDense(qrImg, posX, posY, size, maxPoints) {
    const off = document.createElement("canvas");
    const dim = 46; // Módulos QR
    off.width = dim;
    off.height = dim;
    const ctx = off.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(qrImg, 0, 0, dim, dim);
    const data = ctx.getImageData(0, 0, dim, dim).data;

    const pts = [];
    const cell = size / dim;

    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        const i = (y * dim + x) * 4;
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;

        // Módulos negros del QR -> Puntos circulares nítidos en blanco marfil puro
        if (brightness < 125 && data[i + 3] > 80) {
          pts.push({
            x: posX + x * cell + cell * 0.5,
            y: posY + y * cell + cell * 0.5,
            r: 247,
            g: 247,
            b: 244,
            a: 1.0,
            size: cell * 0.88, // Puntos circulares nítidos con separación limpia
          });
        }
      }
    }

    return pts;
  }

  setMoment(moment, force = false) {
    this.currentMoment = moment;
    this.momentState = moment.state;
    this.momentTime = 0;

    this.microParticles = [];
    this.pulses = [];
    this.hasBlasted = false;

    // Resetear estructuras específicas
    if (moment.state === "trust-crystallize") {
      this.initTrustContagion();
    } else if (moment.state === "latent-reveal") {
      this.initLatentConstruction();
    }

    this.applyMomentTargets(moment, force);
  }

  initTrustContagion() {
    const colors = [
      hexToRgb("#08a9dd"), // Cyan
      hexToRgb("#e96daa"), // Magenta
      hexToRgb("#f7353f"), // Rojo
      hexToRgb("#d6a94f"), // Amarillo/Dorado
      hexToRgb("#f7f7f4"), // Blanco
    ];

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const col = colors[i % colors.length];
      p.r = col.r;
      p.g = col.g;
      p.b = col.b;
      p.tr = col.r;
      p.tg = col.g;
      p.tb = col.b;
      p.infected = false;
      p.infectionProgress = 0;
      p.tsize = 2.4;
      p.vx = (Math.random() - 0.5) * 2.2;
      p.vy = (Math.random() - 0.5) * 2.2;
    }

    // Semillas iniciales (solo 3 partículas infectadas al principio)
    for (let s = 0; s < 4; s++) {
      const idx = Math.floor(Math.random() * this.particles.length);
      this.particles[idx].infected = true;
      this.particles[idx].tr = 8;
      this.particles[idx].tg = 169;
      this.particles[idx].tb = 221;
    }
  }

  initLatentConstruction() {
    this.constructedNodes = [];
    this.constructedEdges = [];
    this.targetLatticeNodes = [];

    const cols = 12;
    const rows = 7;
    const cellW = (this.width * 0.84) / cols;
    const cellH = (this.height * 0.74) / rows;
    const startX = this.width * 0.08;
    const startY = this.height * 0.13;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const jx = (Math.sin(r * 4 + c * 8) * cellW) * 0.2;
        const jy = (Math.cos(r * 6 + c * 4) * cellH) * 0.2;
        this.targetLatticeNodes.push({
          x: startX + c * cellW + cellW * 0.5 + jx,
          y: startY + r * cellH + cellH * 0.5 + jy,
          constructed: false,
          alpha: 0,
          scale: 0,
        });
      }
    }
  }

  applyMomentTargets(moment, force = false) {
    const state = moment.state;
    const isPhoto = moment.isPhoto;
    const assetKey = moment.assetKey;

    // Si es slide de foto directo (Slide 2, 12, 13)
    if (isPhoto && this.sampledTargets[assetKey] && !["triad-fuse", "stage-collapse", "path-discovery"].includes(state)) {
      const targetObj = this.sampledTargets[assetKey];
      const targets = targetObj.points;
      const count = targets.length;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const t = targets[i % count];

        p.tx = t.x;
        p.ty = t.y;
        p.tr = t.r;
        p.tg = t.g;
        p.tb = t.b;
        p.ta = t.a;
        p.tsize = t.size;

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
          if (p.group === 0) {
            p.orbitRadius = 60 + (i % 220) * 1.2;
            p.orbitSpeed = 0.003 + (i % 6) * 0.0008;
            p.tsize = 2.4 + (i % 3) * 0.6;
            p.tr = (i % 6 === 0) ? gold.r : cyan.r;
            p.tg = (i % 6 === 0) ? gold.g : cyan.g;
            p.tb = (i % 6 === 0) ? gold.b : cyan.b;
          } else {
            p.orbitRadius = 35 + (i % 160) * 1.0;
            p.orbitSpeed = 0.016 + (i % 8) * 0.002;
            p.tsize = 1.6 + (i % 3) * 0.4;
            p.tr = (i % 5 === 0) ? white.r : magenta.r;
            p.tg = (i % 5 === 0) ? white.g : magenta.g;
            p.tb = (i % 5 === 0) ? white.b : magenta.b;
          }
        }
        break;
      }

      case "boundary-blast": {
        const cx = this.width * 0.5;
        const cy = this.height * 0.5;
        const boxW = Math.min(this.width * 0.30, 320);
        const boxH = Math.min(this.height * 0.34, 190);

        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.ox = cx + (Math.random() - 0.5) * boxW;
          p.oy = cy + (Math.random() - 0.5) * boxH;
          p.tx = p.ox;
          p.ty = p.oy;
          p.tr = (i % 2 === 0) ? cyan.r : white.r;
          p.tg = (i % 2 === 0) ? cyan.g : white.g;
          p.tb = (i % 2 === 0) ? cyan.b : white.b;
          p.tsize = 2.2;
        }
        break;
      }

      case "proximity-graph": {
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.tx = Math.random() * this.width;
          p.ty = Math.random() * this.height;
          p.vx = (Math.random() - 0.5) * 2.0;
          p.vy = (Math.random() - 0.5) * 2.0;
          p.tr = (p.group === 0) ? cyan.r : magenta.r;
          p.tg = (p.group === 0) ? cyan.g : magenta.g;
          p.tb = (p.group === 0) ? cyan.b : magenta.b;
          p.tsize = 2.2;
        }
        break;
      }

      case "dual-streams": {
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          if (p.group === 0) {
            p.x = Math.random() * (this.width * 0.45);
            p.y = this.height * 0.5 + (Math.random() - 0.5) * (this.height * 0.6);
            p.tr = cyan.r;
            p.tg = cyan.g;
            p.tb = cyan.b;
            p.tsize = 2.6;
          } else {
            p.x = this.width * 0.55 + Math.random() * (this.width * 0.45);
            p.y = this.height * 0.5 + (Math.random() - 0.5) * (this.height * 0.6);
            p.tr = magenta.r;
            p.tg = magenta.g;
            p.tb = magenta.b;
            p.tsize = 1.8;
          }
        }
        break;
      }

      case "latent-reveal": {
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.tr = (p.group === 1) ? magenta.r : cyan.r;
          p.tg = (p.group === 1) ? magenta.g : cyan.g;
          p.tb = (p.group === 1) ? magenta.b : cyan.b;
          p.tsize = (p.group === 1) ? 3.4 : 1.5; // Trazadores jóvenes grandes y brillantes
          p.ta = (p.group === 1) ? 1.0 : 0.25;
        }
        break;
      }

      default: {
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.tr = (p.group === 0) ? cyan.r : magenta.r;
          p.tg = (p.group === 0) ? cyan.g : magenta.g;
          p.tb = (p.group === 0) ? cyan.b : magenta.b;
          p.tsize = 2.2;
        }
        break;
      }
    }
  }

  render() {
    const now = performance.now();
    const dt = Math.min((now - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = now;
    this.momentTime += dt;

    this.clearBackground();

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
      default:
        this.updateSpringPhysics(dt);
        break;
    }

    this.drawParticles();
    this.drawPulsesAndMicroParticles(dt);
  }

  clearBackground() {
    const isKinetic = ["boundary-blast", "dual-streams", "trust-crystallize", "synergy-multiplication"].includes(this.momentState);
    if (isKinetic) {
      this.ctx.fillStyle = "rgba(6, 7, 9, 0.35)";
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else {
      this.ctx.fillStyle = "#060709";
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  // Física elástica general (interactive-particles)
  updateSpringPhysics(dt) {
    const spring = CONFIG.springStrength || 0.058;
    const friction = CONFIG.friction || 0.86;
    const mouse = this.mouse;

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

      p.r += (p.tr - p.r) * 0.08;
      p.g += (p.tg - p.g) * 0.08;
      p.b += (p.tb - p.b) * 0.08;
      p.a += (p.ta - p.a) * 0.08;
      p.size += (p.tsize - p.size) * 0.08;
    }
  }

  // Slide 1: Latent Orbits
  updateLatentOrbits(dt) {
    const cx1 = this.width * 0.28;
    const cy1 = this.height * 0.38;
    const cx2 = this.width * 0.74;
    const cy2 = this.height * 0.65;
    const mouse = this.mouse;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.orbitAngle += p.orbitSpeed;

      const cx = p.group === 0 ? cx1 : cx2;
      const cy = p.group === 0 ? cy1 : cy2;
      const ex = p.group === 0 ? 1.25 : 0.85;
      const ey = p.group === 0 ? 0.85 : 1.2;

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

      p.r += (p.tr - p.r) * 0.05;
      p.g += (p.tg - p.g) * 0.05;
      p.b += (p.tb - p.b) * 0.05;
      p.size += (p.tsize - p.size) * 0.05;
    }
  }

  // Slide 3: Boundary Blast
  updateBoundaryBlast(dt) {
    const t = this.momentTime;
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;

    if (t < 0.75) {
      const boxW = Math.min(this.width * 0.30, 320);
      const boxH = Math.min(this.height * 0.34, 190);

      this.ctx.save();
      this.ctx.strokeStyle = "rgba(8, 169, 221, 0.45)";
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(cx - boxW * 0.5, cy - boxH * 0.5, boxW, boxH);
      this.ctx.restore();

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const dx = p.ox - p.x;
        const dy = p.oy - p.y;
        p.vx = (p.vx + dx * 0.08) * 0.82;
        p.vy = (p.vy + dy * 0.08) * 0.82;
        p.x += p.vx;
        p.y += p.vy;
      }
    } else {
      if (!this.hasBlasted) {
        this.hasBlasted = true;
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          const ang = Math.atan2(p.y - cy, p.x - cx) + (Math.random() - 0.5) * 0.5;
          const spd = 7 + Math.random() * 15;
          p.vx = Math.cos(ang) * spd;
          p.vy = Math.sin(ang) * spd;
        }
      }

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > this.width) p.vx *= -0.8;
        if (p.y < 0 || p.y > this.height) p.vy *= -0.8;
      }
    }
  }

  // Slide 4: Triad Fuse
  updateTriadFuse(dt) {
    const t = this.momentTime;
    const targetObj = this.sampledTargets["academia-industria-ciudad"];
    const targets = targetObj ? targetObj.points : null;

    if (t < 1.7) {
      const c1 = { x: this.width * 0.28, y: this.height * 0.38 };
      const c2 = { x: this.width * 0.72, y: this.height * 0.38 };
      const c3 = { x: this.width * 0.50, y: this.height * 0.76 };

      const cyan = hexToRgb("#08a9dd");
      const magenta = hexToRgb("#e96daa");
      const gold = hexToRgb("#d6a94f");

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const center = p.cluster === 0 ? c1 : p.cluster === 1 ? c2 : c3;
        const color = p.cluster === 0 ? cyan : p.cluster === 1 ? magenta : gold;

        const ang = p.orbitAngle + t * 2.2;
        const rad = 30 + (i % 120) * 1.1;

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
      if (targets) {
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          const tgt = targets[i % targets.length];
          p.tx = tgt.x;
          p.ty = tgt.y;
          p.tr = tgt.r;
          p.tg = tgt.g;
          p.tb = tgt.b;
          p.tsize = tgt.size;
        }
      }
      this.updateSpringPhysics(dt);
    }
  }

  // Slide 5: Stage Collapse
  updateStageCollapse(dt) {
    const t = this.momentTime;
    const targetObj = this.sampledTargets["impacto"];
    const targets = targetObj ? targetObj.points : null;

    if (t < 1.4) {
      const cx = this.width * 0.5;
      const cy = this.height * 0.65;
      const stageW = Math.min(this.width * 0.70, 850);

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (i % 3 === 0) {
          const progress = (i % 1200) / 1200;
          p.tx = cx - stageW * 0.5 + progress * stageW;
          p.ty = cy + Math.sin(progress * Math.PI) * -18;
        } else {
          const rayIdx = i % 7;
          const rayAngle = -Math.PI * 0.5 + (rayIdx - 3) * 0.28;
          const dist = 50 + (i % 400) * 1.5;
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
      }
    } else {
      if (targets) {
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          const tgt = targets[i % targets.length];
          p.tx = tgt.x;
          p.ty = tgt.y;
          p.tr = tgt.r;
          p.tg = tgt.g;
          p.tb = tgt.b;
          p.tsize = tgt.size;
        }
      }
      this.updateSpringPhysics(dt);
    }
  }

  // Slide 6: Proximity Graph Network (VIVA, ORBITAL Y NUNCA ESTÁTICA)
  updateProximityGraph(dt) {
    const t = this.momentTime;
    const mouse = this.mouse;
    const lines = [];

    // Subconjunto de partículas nodo para conexiones estructurales
    const nodeStep = 18;
    const connectDist = 95;
    const connectDistSq = connectDist * connectDist;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Fuerza de flujo armónico continua: GARANTIZA QUE NUNCA SE QUEDEN QUIETAS
      const flowAng =
        Math.sin(p.y * 0.004 + t * 0.9 + p.flowOffset) * Math.PI +
        Math.cos(p.x * 0.004 + t * 0.9) * Math.PI * 0.5;
      p.vx += Math.cos(flowAng) * 0.32;
      p.vy += Math.sin(flowAng) * 0.32;

      // Atracción y órbita entre nodos de la red
      if (i % nodeStep === 0) {
        for (let j = i + nodeStep; j < this.particles.length; j += nodeStep) {
          const q = this.particles[j];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const dSq = dx * dx + dy * dy;

          if (dSq < connectDistSq && dSq > 4) {
            const d = Math.sqrt(dSq);
            // Fuerza atractiva
            const pull = (1 - d / connectDist) * 0.08;
            p.vx += (dx / d) * pull;
            p.vy += (dy / d) * pull;
            q.vx -= (dx / d) * pull;
            q.vy -= (dy / d) * pull;

            // FUERZA ORBITAL TANGENCIAL: hace que giren unas alrededor de otras en lugar de frenar
            const orbitForce = (1 - d / connectDist) * 0.45;
            p.vx += (-dy / d) * orbitForce;
            p.vy += (dx / d) * orbitForce;
            q.vx -= (-dy / d) * orbitForce;
            q.vy -= (dx / d) * orbitForce;

            if (lines.length < 350) {
              const alpha = (1 - d / connectDist) * (0.45 + Math.sin(t * 3.0 + i) * 0.25);
              lines.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y, alpha });
            }
          }
        }
      }

      // Fricción suave
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.x += p.vx;
      p.y += p.vy;

      // Rebote suave en límites para circulación continua
      if (p.x < 30) { p.x = 30; p.vx *= -0.7; }
      if (p.x > this.width - 30) { p.x = this.width - 30; p.vx *= -0.7; }
      if (p.y < 30) { p.y = 30; p.vy *= -0.7; }
      if (p.y > this.height - 30) { p.y = this.height - 30; p.vy *= -0.7; }

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
    }

    // Dibujar conectores de red
    if (lines.length > 0) {
      this.ctx.save();
      this.ctx.lineWidth = 1.2;
      for (const l of lines) {
        this.ctx.strokeStyle = `rgba(8, 169, 221, ${l.alpha})`;
        this.ctx.beginPath();
        this.ctx.moveTo(l.x1, l.y1);
        this.ctx.lineTo(l.x2, l.y2);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }
  }

  // Slide 7: Contagio de Confianza Progresivo y Visible
  updateTrustCrystallize(dt) {
    const t = this.momentTime;
    const cyan = hexToRgb("#08a9dd");

    if (t < 3.0) {
      // Fase 1 (0–3s): Diversidad inicial multicolor flotando a velocidad moderada
      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > this.width) p.vx *= -1;
        if (p.y < 0 || p.y > this.height) p.vy *= -1;
      }
    } else if (t < 7.0) {
      // Fase 2 (3–7s): Contagio progresivo por contacto y repulsión explosiva
      const contactRadiusSq = 36 * 36;

      // Revisamos contacto entre partículas infectadas y no infectadas
      for (let i = 0; i < this.particles.length; i += 4) {
        const p = this.particles[i];
        if (!p.infected) continue;

        for (let j = i + 1; j < this.particles.length; j += 4) {
          const q = this.particles[j];
          if (q.infected) continue;

          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const dSq = dx * dx + dy * dy;

          if (dSq < contactRadiusSq && dSq > 1) {
            // Contagio orgánico
            q.infected = true;
            q.tr = cyan.r;
            q.tg = cyan.g;
            q.tb = cyan.b;

            // Repulsión instantánea que las dispara en direcciones opuestas
            const d = Math.sqrt(dSq);
            const blast = 5.2;
            p.vx -= (dx / d) * blast;
            p.vy -= (dy / d) * blast;
            q.vx += (dx / d) * blast;
            q.vy += (dy / d) * blast;

            // Destello de confianza en el punto de encuentro
            if (this.pulses.length < 20) {
              this.pulses.push({
                x: (p.x + q.x) * 0.5,
                y: (p.y + q.y) * 0.5,
                radius: 3,
                maxRadius: 24,
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
      }
    } else if (t < 10.0) {
      // Fase 3 (7–10s): Descargas eléctricas en zig-zag entre partículas que ya comparten color
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
      this.ctx.strokeStyle = "rgba(233, 109, 170, 0.85)";
      this.ctx.lineWidth = 1.6;
      this.ctx.shadowColor = "#08a9dd";
      this.ctx.shadowBlur = 9;

      const boltCount = 16;
      for (let b = 0; b < boltCount; b++) {
        const i1 = Math.floor(Math.random() * this.particles.length);
        const i2 = Math.floor(Math.random() * this.particles.length);
        const p1 = this.particles[i1];
        const p2 = this.particles[i2];
        const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        if (d < 240 && d > 25) {
          this.drawZigZagBolt(p1.x, p1.y, p2.x, p2.y);
        }
      }
      this.ctx.restore();
    } else {
      // Fase 4 (10s+): Cristalización total: velocidad a 0, color 100% unificado, constelación fija
      this.ctx.save();
      this.ctx.strokeStyle = "rgba(8, 169, 221, 0.42)";
      this.ctx.lineWidth = 1.0;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        p.vx *= 0.84;
        p.vy *= 0.84;
        p.x += p.vx;
        p.y += p.vy;
        p.r = cyan.r;
        p.g = cyan.g;
        p.b = cyan.b;

        if (i % 24 === 0) {
          for (let j = i + 1; j < i + 32 && j < this.particles.length; j += 2) {
            const q = this.particles[j];
            const d = Math.hypot(q.x - p.x, q.y - p.y);
            if (d < 95) {
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
    const steps = 6;
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

  // Slide 8: Path Discovery
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
          p.tx = progress * this.width;
          p.ty = cy + Math.sin(progress * TAU * 1.5) * 95;
        } else {
          const ang = p.orbitAngle + t * 3.2;
          const rad = 40 + (i % 180) * 1.2;
          p.tx = (p.x + Math.cos(ang) * rad) % this.width;
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
      if (targets) {
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          const tgt = targets[i % targets.length];
          p.tx = tgt.x;
          p.ty = tgt.y;
          p.tr = tgt.r;
          p.tg = tgt.g;
          p.tb = tgt.b;
          p.tsize = tgt.size;
        }
      }
      this.updateSpringPhysics(dt);
    }
  }

  // Slide 9: Dual Streams & Harmonic Vortex
  updateDualStreams(dt) {
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (p.group === 0) {
        p.vx = 2.4;
        p.vy = Math.sin(p.x * 0.015 + this.momentTime * 2.0) * 1.4;

        if (p.x > cx - 190 && p.x < cx + 190) {
          const angle = Math.atan2(p.y - cy, p.x - cx) + 0.04;
          const radius = Math.hypot(p.x - cx, p.y - cy);
          p.x = cx + Math.cos(angle) * radius;
          p.y = cy + Math.sin(angle) * radius;
        } else {
          p.x += p.vx;
          p.y += p.vy;
        }
        if (p.x > this.width + 40) p.x = -40;
      } else {
        p.vx = -4.2;
        p.vy = Math.cos(p.x * 0.025 + this.momentTime * 3.5) * 2.6;

        if (p.x > cx - 190 && p.x < cx + 190) {
          const angle = Math.atan2(p.y - cy, p.x - cx) - 0.06;
          const radius = Math.hypot(p.x - cx, p.y - cy);
          p.x = cx + Math.cos(angle) * radius;
          p.y = cy + Math.sin(angle) * radius;
        } else {
          p.x += p.vx;
          p.y += p.vy;
        }
        if (p.x < -40) p.x = this.width + 40;
      }
    }
  }

  // Slide 10: Synergy Multiplication
  updateSynergyMultiplication(dt) {
    const collisionDistSq = 22 * 22;

    for (let i = 0; i < this.particles.length; i += 8) {
      const p = this.particles[i];
      if (p.group !== 0) continue;

      for (let j = i + 1; j < this.particles.length; j += 8) {
        const q = this.particles[j];
        if (q.group !== 1) continue;

        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const dSq = dx * dx + dy * dy;

        if (dSq < collisionDistSq && this.microParticles.length < 500) {
          if (this.pulses.length < 25) {
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
            const spd = 2.5 + Math.random() * 4.5;
            this.microParticles.push({
              x: (p.x + q.x) * 0.5,
              y: (p.y + q.y) * 0.5,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              life: 1.0,
              r: 247,
              g: Math.random() > 0.5 ? 247 : 109,
              b: 244,
              size: 1.8,
            });
          }
        }
      }
    }

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > this.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.height) p.vy *= -1;
    }
  }

  // Slide 11: TEJIDO Y CONSTRUCCIÓN ACTIVA DE LA RED EN TIEMPO REAL
  updateLatentReveal(dt) {
    const t = this.momentTime;
    const tracerRadiusSq = 90 * 90;

    // Actualizar partículas jóvenes (Trazadores constructores)
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > this.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.height) p.vy *= -1;

      // Los jóvenes actúan como trazadores que siembran y tejen la red
      if (p.group === 1 && i % 4 === 0) {
        // Comprobar si pasa cerca de un nodo aún no construido
        for (let n = 0; n < this.targetLatticeNodes.length; n++) {
          const node = this.targetLatticeNodes[n];
          if (!node.constructed) {
            const dx = node.x - p.x;
            const dy = node.y - p.y;
            if (dx * dx + dy * dy < tracerRadiusSq) {
              node.constructed = true;
              this.constructedNodes.push(node);

              // Conectar inmediatamente con nodos vecinos ya construidos
              for (const prev of this.constructedNodes) {
                if (prev === node) continue;
                const dist = Math.hypot(prev.x - node.x, prev.y - node.y);
                if (dist < 140) {
                  this.constructedEdges.push({
                    a: node,
                    b: prev,
                    progress: 0, // Crece de 0 a 1 en tiempo real
                  });
                }
              }

              // Pulso de nacimiento del nodo
              if (this.pulses.length < 25) {
                this.pulses.push({
                  x: node.x,
                  y: node.y,
                  radius: 3,
                  maxRadius: 28,
                  alpha: 0.9,
                });
              }
            }
          }
        }
      }
    }

    // Dibujar aristas en construcción que crecen progresivamente
    const pulseGlow = (Math.sin(t * 3.5) + 1) * 0.5;

    this.ctx.save();
    for (let e = 0; e < this.constructedEdges.length; e++) {
      const edge = this.constructedEdges[e];
      if (edge.progress < 1.0) {
        edge.progress = Math.min(1.0, edge.progress + dt * 3.5);
      }

      const currX = edge.a.x + (edge.b.x - edge.a.x) * edge.progress;
      const currY = edge.a.y + (edge.b.y - edge.a.y) * edge.progress;

      this.ctx.strokeStyle = `rgba(8, 169, 221, ${0.45 + pulseGlow * 0.45})`;
      this.ctx.lineWidth = 1.6;
      this.ctx.beginPath();
      this.ctx.moveTo(edge.a.x, edge.a.y);
      this.ctx.lineTo(currX, currY);
      this.ctx.stroke();
    }

    // Dibujar nodos construidos
    for (let n = 0; n < this.constructedNodes.length; n++) {
      const node = this.constructedNodes[n];
      node.alpha = Math.min(1.0, node.alpha + dt * 2.0);
      node.scale = Math.min(1.0, node.scale + dt * 3.0);

      this.ctx.fillStyle = `rgba(233, 109, 170, ${node.alpha * (0.6 + pulseGlow * 0.4)})`;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, (3.2 + pulseGlow * 1.8) * node.scale, 0, TAU);
      this.ctx.fill();
    }
    this.ctx.restore();
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
      this.ctx.fillRect(mp.x - mp.size * 0.5, mp.y - mp.size * 0.5, mp.size, mp.size);
    }
  }
}

window.VisualSystem = VisualSystem;
