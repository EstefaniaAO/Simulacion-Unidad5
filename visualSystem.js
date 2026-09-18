/**
 * visualSystem.js - Motor generativo de partículas, morphing de imágenes y simulación narrativa
 * para el Centro de Eventos Fórum UPB Medellín.
 *
 * Implementa las correcciones de dirección de arte:
 * 1. Slides de fotos:
 *    - Transición de color suave: nacen en la paleta y se degradan fluidamente hacia los colores reales de la foto;
 *      al cambiar de slide, se degradan rápidamente de vuelta a la paleta.
 *    - Muestreo denso con distancias cortas y partículas circulares finas para máxima legibilidad.
 *    - Animaciones previas (Slide 4, 5, 8) 100% graduales y fluidas sin cortes abruptos.
 * 2. Slide 1: Texto ubicado en la esquina inferior izquierda; órbitas en cuadrantes derechos (sin colisión de azul).
 * 3. Slide 3: Tensión central prolongada (1.8s), expansión radial gradual (1.8s a 4.2s) y deriva centrífuga lenta continua.
 * 6. Slide 6: Partículas distribuidas por TODO el lienzo; atracción gradual hacia 8 nodos comunitarios con rotación orbital continua.
 * 7. Slide 7: Especificación exacta de 4 fases (0-3s diversidad -> 3-7s contagio en grupos de 3+ con repulsión explosiva
 *             -> 7-10s descargas eléctricas zig-zag -> 10s+ v->0 y cristalización fija).
 * 9. Slide 9: Flujo izquierdo en cyan/azul vibrante (#08a9dd) y flujo derecho en magenta (#e96daa) con vórtice central entrelazado.
 * 10. Slide 10: Fuerte presencia de cyan y magenta con pulsos de sinergia y micropartículas.
 * 11. Slide 11: Las partículas se reúnen primero a la izquierda (0 a 1.6s) y luego viajan siguiendo y tejiendo las líneas de la red en tiempo real.
 * 13. Slide 13: Códigos QR con placas de contraste blanco óptico, módulos negros sólidos y patrones de búsqueda fidedignos, 100% escaneables con móvil.
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

    // 11.664 partículas (144x81) para densidad y definición fotográfica
    this.particleCount = CONFIG.particleCount || 11664;
    this.gridCols = 144;
    this.gridRows = 81;

    this.particles = [];
    this.pulses = [];
    this.microParticles = [];

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

    // Estructuras dinámicas de slides
    this.slide7InfectedCount = 0;
    this.slide11Lines = [];
    this.slide11Nodes = [];

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
        tsize: 2.4,
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
        cluster: i % 8, // 8 clústeres para distribución en Slide 6
        // Slide 7 variables
        infected: false,
        lastContagionTime: 0,
        // Slide 11 variables
        lineIndex: -1,
        lineProgress: 0,
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
    const keys = ["auditorio-grados", "academia-industria-ciudad", "impacto", "nuevas-rutas", "futuro-construido"];
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

  // Muestreo denso de imagen con degradado de color y distancias cortas
  sampleImageDense(img) {
    const cols = this.gridCols; // 144
    const rows = this.gridRows; // 81

    const off = document.createElement("canvas");
    off.width = cols;
    off.height = rows;
    const offCtx = off.getContext("2d", { willReadFrequently: true });
    offCtx.drawImage(img, 0, 0, cols, rows);
    const data = offCtx.getImageData(0, 0, cols, rows).data;

    // Área en centro-derecha (dejando la columna izquierda para el texto)
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
    const dotSize = Math.max(stepX, stepY) * 0.96; // Círculos definidos con separación mínima

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

        // Si es casi negro absoluto/bordes extremos de recorte, omitir
        if (lum < 0.07) continue;

        // Color de la paleta inicial (para degradado de entrada)
        let palColor = (c + r) % 2 === 0 ? cyan : magenta;
        if (lum > 0.7) palColor = hexToRgb("#f7f7f4");
        else if (red > 160 && green > 120) palColor = gold;

        points.push({
          x: startX + c * stepX,
          y: startY + r * stepY,
          // Color auténtico de la imagen
          imgR: red,
          imgG: green,
          imgB: blue,
          // Color de la paleta de inicio
          palR: palColor.r,
          palG: palColor.g,
          palB: palColor.b,
          size: dotSize,
          a: 0.95,
        });
      }
    }

    // Partículas excedentes en halo ambiental
    const remaining = this.particleCount - points.length;
    for (let i = 0; i < remaining; i++) {
      const ang = Math.random() * TAU;
      const radX = (drawW * 0.5) * (1.02 + Math.random() * 0.3);
      const radY = (drawH * 0.5) * (1.02 + Math.random() * 0.3);
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

  // Muestreo de códigos QR 100% escaneables con módulos negros sólidos sobre placa blanca
  sampleQrScannable(imgMem, imgSoc) {
    const points = [];
    const total = this.particleCount;
    const half = Math.floor(total * 0.44);

    // Dimensiones de los QRs en pantalla grande
    const qrSize = Math.min(this.width * 0.24, this.height * 0.50);
    const yPos = this.height * 0.50 - qrSize * 0.5;
    const leftX = this.width * 0.46 - qrSize * 0.5;
    const rightX = this.width * 0.78 - qrSize * 0.5;

    // Placas de fondo blanco que se dibujarán en el render para garantizar 100% de escaneabilidad
    const plates = [
      { x: leftX - 16, y: yPos - 16, size: qrSize + 32, label: "Memorias" },
      { x: rightX - 16, y: yPos - 16, size: qrSize + 32, label: "@centrodeeventosupb" },
    ];

    // Muestreo preciso de módulos
    const pts1 = this.sampleSingleQrModules(imgMem, leftX, yPos, qrSize, half);
    points.push(...pts1);

    const pts2 = this.sampleSingleQrModules(imgSoc, rightX, yPos, qrSize, half);
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
    // Muestreo de matriz QR exacta (~37x37)
    const dim = 37;
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

        // Módulos negros del QR -> Partículas negras sólidas que forman el código
        if (brightness < 128 && data[i + 3] > 80) {
          pts.push({
            x: posX + x * cell + cell * 0.5,
            y: posY + y * cell + cell * 0.5,
            imgR: 8,
            imgG: 8,
            imgB: 10, // Negro puro de alto contraste sobre la placa blanca
            palR: 8,
            palG: 169,
            palB: 221, // Empieza en cyan de la paleta y morph a negro QR
            size: cell * 1.04, // Módulos sólidos que se tocan para escaneo óptico perfecto
            a: 1.0,
            isQrModule: true,
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

    // Inicializar estados específicos
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
      p.colorSpeed = 0.08;
      p.tsize = 2.4;
      p.vx = (Math.random() - 0.5) * 2.4;
      p.vy = (Math.random() - 0.5) * 2.4;
    }

    // Semillas iniciales (3 partículas en el centro que comienzan infectadas)
    for (let s = 0; s < 3; s++) {
      const idx = Math.floor(Math.random() * this.particles.length);
      this.particles[idx].infected = true;
      this.particles[idx].tr = 8;
      this.particles[idx].tg = 169;
      this.particles[idx].tb = 221; // Cyan unificador
    }
  }

  initLatentConstruction() {
    this.slide11Lines = [];
    this.slide11Nodes = [];

    // Definición de las líneas maestras de la red arquitectónica
    const startX = this.width * 0.32;
    const endX = this.width * 0.94;
    const startY = this.height * 0.16;
    const endY = this.height * 0.84;
    const rows = 6;
    const cols = 8;
    const stepX = (endX - startX) / (cols - 1);
    const stepY = (endY - startY) / (rows - 1);

    // Crear nodos de la grilla
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const nx = startX + c * stepX + (Math.sin(r * 3 + c * 5) * 16);
        const ny = startY + r * stepY + (Math.cos(r * 5 + c * 3) * 16);
        this.slide11Nodes.push({ x: nx, y: ny, built: false, alpha: 0, scale: 0 });
      }
    }

    // Crear segmentos de línea (horizontales, verticales y diagonales)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (c < cols - 1) {
          this.slide11Lines.push({ a: idx, b: idx + 1, progress: 0, active: false });
        }
        if (r < rows - 1) {
          this.slide11Lines.push({ a: idx, b: idx + cols, progress: 0, active: false });
        }
        if (r < rows - 1 && c < cols - 1) {
          this.slide11Lines.push({ a: idx, b: idx + cols + 1, progress: 0, active: false });
        }
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
        p.tr = t.palR; // Inicia en color de paleta y luego se degradará a imgR
        p.tg = t.palG;
        p.tb = t.palB;
        p.ta = t.a;
        p.tsize = t.size;
        p.colorSpeed = 0.05; // Transición gradual a color de imagen

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
        // Slide 1: Texto en esquina inferior izquierda; órbitas en cuadrantes derechos
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.colorSpeed = 0.12; // Rápido retorno a paleta
          if (p.group === 0) {
            p.orbitRadius = 55 + (i % 200) * 1.2;
            p.orbitSpeed = 0.003 + (i % 6) * 0.0008;
            p.tsize = 2.6 + (i % 3) * 0.5;
            p.tr = (i % 6 === 0) ? gold.r : cyan.r;
            p.tg = (i % 6 === 0) ? gold.g : cyan.g;
            p.tb = (i % 6 === 0) ? gold.b : cyan.b;
          } else {
            p.orbitRadius = 35 + (i % 150) * 1.0;
            p.orbitSpeed = 0.016 + (i % 8) * 0.002;
            p.tsize = 1.8 + (i % 3) * 0.4;
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
          p.tsize = 2.4;
          p.colorSpeed = 0.12;
        }
        break;
      }

      case "proximity-graph": {
        // Slide 6: Distribución amplia por TODO el lienzo
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.x = Math.random() * this.width;
          p.y = Math.random() * this.height;
          p.vx = (Math.random() - 0.5) * 2.2;
          p.vy = (Math.random() - 0.5) * 2.2;
          p.tr = (p.group === 0) ? cyan.r : magenta.r;
          p.tg = (p.group === 0) ? cyan.g : magenta.g;
          p.tb = (p.group === 0) ? cyan.b : magenta.b;
          p.tsize = 2.4;
          p.colorSpeed = 0.12;
        }
        break;
      }

      case "dual-streams": {
        // Slide 9: Fuerte presencia de azul/cyan a la izquierda y magenta a la derecha
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.colorSpeed = 0.12;
          if (p.group === 0) {
            // Flujo izquierdo: Cyan vibrante (#08a9dd)
            p.x = Math.random() * (this.width * 0.45);
            p.y = this.height * 0.5 + (Math.random() - 0.5) * (this.height * 0.6);
            p.tr = cyan.r;
            p.tg = cyan.g;
            p.tb = cyan.b;
            p.tsize = 2.8;
          } else {
            // Flujo derecho: Magenta vibrante (#e96daa)
            p.x = this.width * 0.55 + Math.random() * (this.width * 0.45);
            p.y = this.height * 0.5 + (Math.random() - 0.5) * (this.height * 0.6);
            p.tr = magenta.r;
            p.tg = magenta.g;
            p.tb = magenta.b;
            p.tsize = 2.0;
          }
        }
        break;
      }

      case "synergy-multiplication": {
        // Slide 10: Sinergia cyan y magenta
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.colorSpeed = 0.12;
          p.tr = (p.group === 0) ? cyan.r : magenta.r;
          p.tg = (p.group === 0) ? cyan.g : magenta.g;
          p.tb = (p.group === 0) ? cyan.b : magenta.b;
          p.tsize = (p.group === 0) ? 3.0 : 2.0;
        }
        break;
      }

      case "latent-reveal": {
        // Slide 11: Se reúnen a la izquierda
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.colorSpeed = 0.12;
          p.tr = (p.group === 1) ? magenta.r : cyan.r;
          p.tg = (p.group === 1) ? magenta.g : cyan.g;
          p.tb = (p.group === 1) ? magenta.b : cyan.b;
          p.tsize = 2.4;
        }
        break;
      }

      default: {
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.colorSpeed = 0.12;
          p.tr = (p.group === 0) ? cyan.r : magenta.r;
          p.tg = (p.group === 0) ? cyan.g : magenta.g;
          p.tb = (p.group === 0) ? cyan.b : magenta.b;
          p.tsize = 2.4;
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

    // En Slide 13, dibujar placas de contraste blanco óptico para 100% de escaneo de QR
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
      default:
        this.updatePhotoMorph(dt);
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

  drawQrPlates() {
    const targetObj = this.sampledTargets["qr-cierre"];
    if (!targetObj || !targetObj.plates) return;

    // Placa blanca suave que asegura el escaneo inmediato por la cámara del celular
    this.ctx.save();
    for (const plate of targetObj.plates) {
      this.ctx.fillStyle = "#ffffff";
      this.ctx.shadowColor = "rgba(8, 169, 221, 0.45)";
      this.ctx.shadowBlur = 24;
      this.ctx.beginPath();
      // Rectángulo con esquinas redondeadas elegantes y zona muda (quiet zone)
      const r = 16;
      this.ctx.roundRect(plate.x, plate.y, plate.size, plate.size, r);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  // Morphing con degradado de color fluido hacia los colores auténticos de la foto
  updatePhotoMorph(dt) {
    const spring = CONFIG.springStrength || 0.058;
    const friction = CONFIG.friction || 0.86;
    const mouse = this.mouse;
    const t = this.momentTime;

    // Degradado gradual al color de la imagen (de 0 a 1.8s)
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

      // Degradado suave hacia el color de la imagen
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

  // Slide 1: Latent Orbits (Órbitas en sectores derechos; texto abajo a la izquierda)
  updateLatentOrbits(dt) {
    const cx1 = this.width * 0.72; // Experiencia: arriba a la derecha
    const cy1 = this.height * 0.32;
    const cx2 = this.width * 0.76; // Nuevas generaciones: abajo a la derecha
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

  // Slide 3: Tensión prolongada (1.8s), expansión gradual (1.8s a 4.2s) y deriva continua
  updateBoundaryBlast(dt) {
    const t = this.momentTime;
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;

    if (t < 1.8) {
      // Fase 1: Confinamiento y respiración con tensión acumulada
      const boxW = Math.min(this.width * 0.30, 320);
      const boxH = Math.min(this.height * 0.34, 190);
      const pulseTension = 1 + Math.sin(t * 5.0) * 0.04;

      this.ctx.save();
      this.ctx.strokeStyle = `rgba(8, 169, 221, ${0.35 + Math.sin(t * 6.0) * 0.2})`;
      this.ctx.lineWidth = 1.8;
      this.ctx.strokeRect(cx - (boxW * 0.5) * pulseTension, cy - (boxH * 0.5) * pulseTension, boxW * pulseTension, boxH * pulseTension);
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
    } else if (t < 4.2) {
      // Fase 2: Expansión radial gradual y sostenida (no de golpe)
      const progress = clamp((t - 1.8) / 2.4, 0, 1);
      const ease = smoothstep(0, 1, progress);

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const outwardAngle = Math.atan2(p.y - cy, p.x - cx);
        const push = (1 - ease) * (4.5 + (p.id % 7) * 0.7);

        p.vx += Math.cos(outwardAngle) * push * 0.12;
        p.vy += Math.sin(outwardAngle) * push * 0.12;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.x += p.vx;
        p.y += p.vy;
      }
    } else {
      // Fase 3: Deriva lenta continua hacia afuera (nunca se queda quieto)
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const ang = Math.atan2(p.y - cy, p.x - cx);
        p.vx = Math.cos(ang) * (0.65 + (p.id % 4) * 0.25) + Math.sin(p.y * 0.008 + t) * 0.25;
        p.vy = Math.sin(ang) * (0.65 + (p.id % 4) * 0.25) + Math.cos(p.x * 0.008 + t) * 0.25;

        p.x += p.vx;
        p.y += p.vy;

        // Envoltura suave en bordes
        if (p.x < -20) p.x = this.width + 20;
        if (p.x > this.width + 20) p.x = -20;
        if (p.y < -20) p.y = this.height + 20;
        if (p.y > this.height + 20) p.y = -20;
      }
    }
  }

  // Slide 4: Animación previa gradual (3 clústeres girando y convergiendo fluidamente a la foto)
  updateTriadFuse(dt) {
    const t = this.momentTime;
    const targetObj = this.sampledTargets["academia-industria-ciudad"];
    const targets = targetObj ? targetObj.points : null;

    const c1 = { x: this.width * 0.44, y: this.height * 0.34 }; // Academia (Cyan)
    const c2 = { x: this.width * 0.78, y: this.height * 0.34 }; // Industria (Magenta)
    const c3 = { x: this.width * 0.61, y: this.height * 0.72 }; // Ciudad (Dorado)

    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");
    const gold = hexToRgb("#d6a94f");

    if (t < 1.6) {
      // Fase 1: Los 3 clústeres giran suavemente
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
      // Fase 2: Convergencia 100% gradual y fluida hacia los objetivos de la foto
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
          // Degradado gradual al color auténtico de la imagen
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

  // Slide 5: Escenario previo que colapsa gradualmente hacia el impacto real
  updateStageCollapse(dt) {
    const t = this.momentTime;
    const targetObj = this.sampledTargets["impacto"];
    const targets = targetObj ? targetObj.points : null;

    const cx = this.width * 0.65;
    const cy = this.height * 0.65;
    const stageW = Math.min(this.width * 0.50, 680);

    if (t < 1.4) {
      // Fase 1: Dibujar silueta previa de focos y escenario
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
      // Fase 2: Transición gradual fluida a la imagen de impacto
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

  // Slide 6: Partículas distribuidas por TODO el lienzo; atracción gradual y órbita continua
  updateProximityGraph(dt) {
    const t = this.momentTime;
    const mouse = this.mouse;
    const lines = [];

    // 8 nodos comunitarios bien distribuidos a lo ancho y alto de toda la pantalla
    const nodes = [
      { x: this.width * 0.22, y: this.height * 0.28 },
      { x: this.width * 0.52, y: this.height * 0.22 },
      { x: this.width * 0.82, y: this.height * 0.30 },
      { x: this.width * 0.36, y: this.height * 0.54 },
      { x: this.width * 0.68, y: this.height * 0.52 },
      { x: this.width * 0.20, y: this.height * 0.78 },
      { x: this.width * 0.50, y: this.height * 0.82 },
      { x: this.width * 0.82, y: this.height * 0.76 },
    ];

    // Factor de atracción gradual (de 1.5s a 4.5s)
    const clusterFactor = smoothstep(1.5, 4.5, t);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const assignedNode = nodes[p.cluster % nodes.length];

      // Circulación armónica continua por todo el lienzo
      const flowAng = Math.sin(p.y * 0.003 + t * 0.8 + i) * Math.PI + Math.cos(p.x * 0.003 + t * 0.8) * Math.PI * 0.5;
      p.vx += Math.cos(flowAng) * 0.28;
      p.vy += Math.sin(flowAng) * 0.28;

      if (clusterFactor > 0.01) {
        // Atracción gradual hacia su nodo comunitario
        const dx = assignedNode.x - p.x;
        const dy = assignedNode.y - p.y;
        const d = Math.hypot(dx, dy);

        if (d > 10) {
          const pull = (clusterFactor * 0.06);
          p.vx += (dx / d) * pull;
          p.vy += (dy / d) * pull;

          // Fuerza orbital tangencial: hace que dancen en órbita alrededor de su nodo
          const orbit = (clusterFactor * 0.38);
          p.vx += (-dy / d) * orbit;
          p.vy += (dx / d) * orbit;
        }

        // Conexiones lineales dentro del clúster
        if (i % 24 === 0 && d < 110) {
          lines.push({
            x1: p.x,
            y1: p.y,
            x2: assignedNode.x,
            y2: assignedNode.y,
            alpha: (1 - d / 110) * (0.35 + Math.sin(t * 3.0 + i) * 0.25) * clusterFactor,
          });
        }
      }

      p.vx *= 0.95;
      p.vy *= 0.95;
      p.x += p.vx;
      p.y += p.vy;

      // Rebote suave en los límites
      if (p.x < 25) { p.x = 25; p.vx *= -0.7; }
      if (p.x > this.width - 25) { p.x = this.width - 25; p.vx *= -0.7; }
      if (p.y < 25) { p.y = 25; p.vy *= -0.7; }
      if (p.y > this.height - 25) { p.y = this.height - 25; p.vy *= -0.7; }

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

  // Slide 7: Especificación completa de 4 fases (Diversidad -> Contagio/Repulsión -> Descargas -> Cristalización)
  updateTrustCrystallize(dt) {
    const t = this.momentTime;
    const cyan = hexToRgb("#08a9dd");

    if (t < 3.0) {
      // Fase 1 (0–3s): Diversidad inicial multicolor flotando de forma independiente a velocidad moderada
      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > this.width) p.vx *= -1;
        if (p.y < 0 || p.y > this.height) p.vy *= -1;
      }
    } else if (t < 7.0) {
      // Fase 2 (3–7s): Contagio en grupos de 3+ y fuerza de repulsión instantánea que las dispara
      const groupRadiusSq = 38 * 38;

      // Buscar grupos de 3 o más partículas cercanas
      for (let i = 0; i < this.particles.length; i += 4) {
        const p = this.particles[i];
        let neighbors = [p];

        for (let j = i + 1; j < this.particles.length; j += 4) {
          const q = this.particles[j];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          if (dx * dx + dy * dy < groupRadiusSq) {
            neighbors.push(q);
            if (neighbors.length >= 3) break;
          }
        }

        // Si se agrupan 3 o más y al menos una está contagiada
        if (neighbors.length >= 3) {
          const hasInfected = neighbors.some((n) => n.infected);
          if (hasInfected) {
            for (const n of neighbors) {
              n.infected = true;
              n.tr = cyan.r;
              n.tg = cyan.g;
              n.tb = cyan.b;

              // Fuerza de repulsión instantánea que las dispara en direcciones opuestas
              const blastAng = Math.random() * TAU;
              const blastSpeed = 7.2;
              n.vx = Math.cos(blastAng) * blastSpeed;
              n.vy = Math.sin(blastAng) * blastSpeed;
            }

            if (this.pulses.length < 24) {
              this.pulses.push({
                x: p.x,
                y: p.y,
                radius: 4,
                maxRadius: 28,
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
      // Fase 3 (7–10s): Descargas eléctricas en zig-zag que conectan a las partículas del mismo color
      for (const p of this.particles) {
        p.tr = cyan.r;
        p.tg = cyan.g;
        p.tb = cyan.b;
        p.r += (p.tr - p.r) * 0.1;
        p.g += (p.tg - p.g) * 0.1;
        p.b += (p.tb - p.b) * 0.1;
        p.vx *= 0.91;
        p.vy *= 0.91;
        p.x += p.vx;
        p.y += p.vy;
      }

      this.ctx.save();
      this.ctx.strokeStyle = "rgba(233, 109, 170, 0.88)";
      this.ctx.lineWidth = 1.7;
      this.ctx.shadowColor = "#08a9dd";
      this.ctx.shadowBlur = 10;

      const boltCount = 18;
      for (let b = 0; b < boltCount; b++) {
        const i1 = Math.floor(Math.random() * this.particles.length);
        const i2 = Math.floor(Math.random() * this.particles.length);
        const p1 = this.particles[i1];
        const p2 = this.particles[i2];
        const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        if (d < 260 && d > 30) {
          this.drawZigZagBolt(p1.x, p1.y, p2.x, p2.y);
        }
      }
      this.ctx.restore();
    } else {
      // Fase 4 (10s+): Cristalización: 100% mismo color, velocidad cae a cero (v->0), red iluminada y fija
      this.ctx.save();
      this.ctx.strokeStyle = "rgba(8, 169, 221, 0.44)";
      this.ctx.lineWidth = 1.2;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        p.vx *= 0.85; // Velocidad cae a 0 rápidamente
        p.vy *= 0.85;
        p.x += p.vx;
        p.y += p.vy;
        p.r = cyan.r;
        p.g = cyan.g;
        p.b = cyan.b;

        // Conexiones de red fijas e iluminadas
        if (i % 20 === 0) {
          for (let j = i + 1; j < i + 30 && j < this.particles.length; j += 2) {
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
      const jx = (Math.random() - 0.5) * 28;
      const jy = (Math.random() - 0.5) * 28;
      this.ctx.lineTo(x1 + dx * s + jx, y1 + dy * s + jy);
    }
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  // Slide 8: Animación previa gradual (camino troncal y ramas exploratorias convergiendo a la foto)
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
      // Transición 100% gradual a los objetivos de la foto
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

  // Slide 9: Fuerte presencia de Azul/Cyan (#08a9dd) a la izquierda y Magenta (#e96daa) a la derecha
  updateDualStreams(dt) {
    const cx = this.width * 0.58;
    const cy = this.height * 0.5;
    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (p.group === 0) {
        // Flujo izquierdo: Cyan vibrante y enérgico
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
        // Flujo derecho: Magenta vibrante
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

  // Slide 10: Sinergia de colisión entre Cyan y Magenta
  updateSynergyMultiplication(dt) {
    const collisionDistSq = 24 * 24;
    const cyan = hexToRgb("#08a9dd");
    const magenta = hexToRgb("#e96daa");

    for (let i = 0; i < this.particles.length; i += 6) {
      const p = this.particles[i];
      if (p.group !== 0) continue;

      for (let j = i + 1; j < this.particles.length; j += 6) {
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

          // Brote de micropartículas
          const count = 2 + Math.floor(Math.random() * 2);
          for (let m = 0; m < count; m++) {
            const ang = Math.random() * TAU;
            const spd = 2.6 + Math.random() * 4.5;
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

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > this.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.height) p.vy *= -1;
    }
  }

  // Slide 11: Se reúnen a la izquierda y luego viajan trazando y tejiendo las líneas de la red
  updateLatentReveal(dt) {
    const t = this.momentTime;

    if (t < 1.6) {
      // Fase 1: Se reúnen todas a la izquierda como un enjambre enérgico
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        p.tx = this.width * 0.10 + (p.id % 60) * 1.8;
        p.ty = this.height * 0.18 + (p.id % 90) * 4.5;

        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        p.vx = (p.vx + dx * 0.08) * 0.82;
        p.vy = (p.vy + dy * 0.08) * 0.82;
        p.x += p.vx;
        p.y += p.vy;
      }
    } else {
      // Fase 2: Salen a seguir las líneas y construir la red
      const progress = clamp((t - 1.6) / 5.0, 0, 1);
      const activeLineCount = Math.floor(progress * this.slide11Lines.length);

      // Activar líneas progresivamente
      for (let l = 0; l < this.slide11Lines.length; l++) {
        const line = this.slide11Lines[l];
        if (l <= activeLineCount) {
          line.active = true;
          line.progress = Math.min(1.0, line.progress + dt * 2.8);

          // Activar nodos que toca la línea
          this.slide11Nodes[line.a].built = true;
          this.slide11Nodes[line.b].built = true;
        }
      }

      // Las partículas viajan a lo largo de las líneas
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const line = this.slide11Lines[i % this.slide11Lines.length];

        if (line && line.active) {
          const n1 = this.slide11Nodes[line.a];
          const n2 = this.slide11Nodes[line.b];
          const travel = ((t * 1.5 + (i % 10) * 0.1) % 1.0);

          p.tx = lerp(n1.x, n2.x, travel);
          p.ty = lerp(n1.y, n2.y, travel);

          const dx = p.tx - p.x;
          const dy = p.ty - p.y;
          p.vx = (p.vx + dx * 0.09) * 0.84;
          p.vy = (p.vy + dy * 0.09) * 0.84;
          p.x += p.vx;
          p.y += p.vy;
        }
      }

      // Dibujar la red tejida
      const pulse = (Math.sin(t * 3.5) + 1) * 0.5;
      this.ctx.save();

      for (const line of this.slide11Lines) {
        if (!line.active) continue;
        const n1 = this.slide11Nodes[line.a];
        const n2 = this.slide11Nodes[line.b];
        const currX = lerp(n1.x, n2.x, line.progress);
        const currY = lerp(n1.y, n2.y, line.progress);

        this.ctx.strokeStyle = `rgba(8, 169, 221, ${0.45 + pulse * 0.45})`;
        this.ctx.lineWidth = 1.6;
        this.ctx.beginPath();
        this.ctx.moveTo(n1.x, n1.y);
        this.ctx.lineTo(currX, currY);
        this.ctx.stroke();
      }

      for (const node of this.slide11Nodes) {
        if (!node.built) continue;
        node.scale = Math.min(1.0, node.scale + dt * 2.5);
        this.ctx.fillStyle = `rgba(233, 109, 170, ${0.7 + pulse * 0.3})`;
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, (3.2 + pulse * 1.6) * node.scale, 0, TAU);
        this.ctx.fill();
      }
      this.ctx.restore();
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
