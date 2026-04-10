// Configuration and Constants
const CONFIG = {
  CARD: {
    WIDTH: 450,
    HEIGHT: 750,
    PADDING: 30,
    CORNER_RADIUS: 15
  },
  COLORS: {
    BACKGROUND: '#000000',
    PAPER: '#fbebc1',
    BOX: '#15314a',
    STAR_COLORS: ["rgb(166,54,62)", "rgb(219,186,83)", "rgb(81,132,123)"],
    FIREWORK: {
      COOL: { hue: 180, sat: 60 },
      WARM: { hue: 15, sat: 100 },
      NEUTRAL: { hue: 0, sat: 0 }
    }
  },
  BACKGROUND_CACHE: {
    COUNT: 3,
    backgrounds: [],
    initialized: false
  },
  ANIMATION: {
    BLOOM_FRAMES: 5,           // sudden burst like real firework
    FIREWORK_DELAY_FRAMES: 30, // gap between upper and lower firework
    SAT_FADE_MIN: 30,          // ~0.5s — small gap, quick fade
    SAT_FADE_MAX: 300,         // ~5s — large gap, dramatic slow fade
    STAR_BLOOM_FRAMES: 30,     // ~0.5s at 60fps (star cards)
    CARD_DELAY_FRAMES: 10,     // pause between cards
    ROTATION_MAX: 0.3,         // max radians to rotate during sat fade (~17°)
    CENTER_START: 0.6,
    VIEWPORT_THRESHOLD: 0.15
  }
};

const DEFAULT_VALUES = {
  content: 0,
  lateReply: 0,
  senderName: "0",
  week: "0",
  lateReply_her: 0,
};

const State = {
  fireworkData: null,
  font: null,
  animators: [],
  queue: [],
  active: null,
  delayCounter: 0,        // frames to wait before starting next card
  observer: null
};

// ─── Asset Loader ─────────────────────────────────────
class AssetLoader {
  static async preload() {
    try {
      State.fireworkData = await loadTable('data/agg_week_sender.csv', 'csv', 'header');
      State.font = await loadFont('asset/OldNewspaperTypes.ttf');
      return true;
    } catch (error) {
      console.error('Error loading assets:', error);
      return false;
    }
  }
}

// ─── Background System ────────────────────────────────
class BackgroundSystem {
  static initialize() {
    if (CONFIG.BACKGROUND_CACHE.initialized) return;
    for (let i = 0; i < CONFIG.BACKGROUND_CACHE.COUNT; i++) {
      const bg = createGraphics(CONFIG.CARD.WIDTH, CONFIG.CARD.HEIGHT);
      bg.colorMode(HSL, 360, 100, 100, 100);
      bg.background(CONFIG.COLORS.BACKGROUND);
      this.renderIntegratedBackground(bg);
      CONFIG.BACKGROUND_CACHE.backgrounds.push(bg);
    }
    CONFIG.BACKGROUND_CACHE.initialized = true;
  }

  static renderIntegratedBackground(pg) {
    const centerX = pg.width / 2;
    const centerY = pg.height / 2;
    pg.push();
    pg.stroke(CONFIG.COLORS.PAPER);
    pg.strokeWeight(5);
    pg.noFill();
    pg.rectMode(CENTER);
    pg.rect(centerX, centerY,
      CONFIG.CARD.WIDTH - CONFIG.CARD.PADDING,
      CONFIG.CARD.HEIGHT - CONFIG.CARD.PADDING,
      CONFIG.CARD.CORNER_RADIUS);
    pg.pop();

    this.renderPaperTexture(pg);
  }

  static renderPaperTexture(pg) {
    const padfactor = 1e3;
    let iterations = 9e3;
    pg.push();
    for (let i = 0; i < iterations; i++) {
      pg.strokeWeight(0.15);
      pg.stroke(50, 50, random(55, 95), random(1, 15));
      pg.noFill();
      pg.bezier(
        random(-padfactor, pg.width + padfactor),
        random(-padfactor, pg.height + padfactor),
        random(-padfactor, pg.width + padfactor),
        random(-padfactor, pg.height + padfactor),
        random(-padfactor, pg.width + padfactor),
        random(-padfactor, pg.height + padfactor),
        random(-padfactor, pg.width + padfactor),
        random(-padfactor, pg.height + padfactor)
      );
    }
    pg.pop();
  }

  static getBackgroundWithText(week) {
    const bgIndex = Math.floor(random(CONFIG.BACKGROUND_CACHE.COUNT));
    const bg = CONFIG.BACKGROUND_CACHE.backgrounds[bgIndex];
    const cardBg = createGraphics(CONFIG.CARD.WIDTH, CONFIG.CARD.HEIGHT);
    cardBg.colorMode(HSL, 360, 100, 100, 100);
    cardBg.image(bg, 0, 0);
    cardBg.push();
    cardBg.textFont(State.font);
    cardBg.textSize(25);
    cardBg.fill(CONFIG.COLORS.PAPER);
    cardBg.textAlign(CENTER, CENTER);
    cardBg.text("week " + week, cardBg.width / 2, cardBg.height / 2);
    cardBg.pop();
    return cardBg;
  }
}

// ─── Firework Renderer ────────────────────────────────
class FireworkRenderer {

  // === STATIC methods (used by VisualizationGuide — unchanged) ===

  static drawFireworks(pg, centerX, centerY, data) {
    const upperSize = this.calculateFireworkSize(data.content_her);
    const lowerSize = this.calculateFireworkSize(data.content);
    this.drawUpperFirework(pg, centerX / 8, centerY / 12, upperSize, data.lateReply_her);
    this.drawLowerFirework(pg, centerX * 1.87, centerY * 1.92, lowerSize, data.lateReply);
  }

  static drawUpperFirework(pg, centerX, centerY, size, lateReply) {
    this._drawFireworkStatic(pg, centerX, centerY, size, lateReply);
  }

  static drawLowerFirework(pg, centerX, centerY, size, lateReply) {
    this._drawFireworkStatic(pg, centerX, centerY, size, lateReply);
  }

  static _drawFireworkStatic(pg, centerX, centerY, size, lateReply) {
    const scale = size / 100;
    const dashes_num = Math.floor(map(size, 32, 250, 200, 600));
    const centre_dashes_num = Math.floor(map(size, 32, 250, 50, 200));
    const golden_angle = 2.3999632297286535;
    const draw_radius = size * 0.85;
    const dash_gap_from_circles = size * 0.05;
    const centre_dashes_radius = size * 0.15;
    lateReply = lateReply * 100;
    const lateMap = constrain(map(lateReply, 1, 5, 10, 100), 10, 100);
    const percentChange = (100 - lateMap) / 100;

    pg.push();
    pg.stroke(15, 85 * percentChange, 60);
    pg.fill(15, 85 * percentChange, 60);
    this._drawOuterStatic(pg, centerX, centerY, dashes_num, golden_angle, draw_radius, dash_gap_from_circles, scale);
    this._drawCenterStatic(pg, centerX, centerY, centre_dashes_num, centre_dashes_radius, scale);
    pg.pop();
  }

  static _drawOuterStatic(pg, centerX, centerY, dashes_num, golden_angle, draw_radius, dash_gap_from_circles, scale) {
    for (let i = 0; i < dashes_num; i++) {
      const angle = i * golden_angle;
      const r = sqrt(i / dashes_num);
      const randomGap = random(dash_gap_from_circles);
      const x = centerX + (draw_radius - dash_gap_from_circles - randomGap) * cos(angle) * r;
      const y = centerY + (draw_radius - dash_gap_from_circles - randomGap) * sin(angle) * r;
      const dist_ratio = random(0.2);
      const x1 = (1 - dist_ratio) * x + dist_ratio * centerX;
      const y1 = (1 - dist_ratio) * y + dist_ratio * centerY;
      pg.strokeWeight(random(1, 1.5) * scale);
      pg.line(x, y, x1, y1);
    }
  }

  static _drawCenterStatic(pg, centerX, centerY, centre_dashes_num, centre_dashes_radius, scale) {
    for (let i = 0; i < centre_dashes_num; i++) {
      const angle = random(TWO_PI);
      const x = centerX + random(centre_dashes_radius) * cos(angle);
      const y = centerY + random(centre_dashes_radius) * sin(angle);
      pg.strokeWeight(random(1, 1.5) * scale);
      pg.line(x, y, centerX, centerY);
    }
  }

  static drawStar(pg, centerX, centerY, colour) {
    pg.push();
    pg.stroke(colour);
    for (let i = 0; i < 40; i++) {
      const angle = random(TWO_PI);
      const rayRadius = random(15, 22);
      const x = centerX + rayRadius * cos(angle);
      const y = centerY + rayRadius * sin(angle);
      pg.strokeWeight(random(2));
      pg.line(x, y, centerX, centerY);
      for (let j = 0; j <= 1; j++) {
        const sa = random(TWO_PI);
        const sr = random(8, 15);
        const x2 = centerX + sr * cos(sa);
        const y2 = centerY + sr * sin(sa);
        pg.strokeWeight(random(1, 1.5));
        pg.line(x2, y2, centerX, centerY);
      }
    }
    pg.pop();
  }

  static calculateFireworkSize(content) {
    return constrain(map(content, 100, 1500, 100, 270), 100, 270);
  }

  // === ANIMATED methods (used by CardAnimator) ===
  // Uses randomSeed for frame-consistent patterns.
  // `progress` (0→1) controls bloom radius; dashes beyond progress are skipped.

  static drawFireworksAnimated(pg, centerX, centerY, data, frame, seeds, satFade) {
    const upperSize = this.calculateFireworkSize(data.content_her);
    const lowerSize = this.calculateFireworkSize(data.content);
    const B = CONFIG.ANIMATION.BLOOM_FRAMES;
    const D = CONFIG.ANIMATION.FIREWORK_DELAY_FRAMES;

    // Upper fires immediately
    const upperP = constrain(frame / B, 0, 1);
    const rotation = satFade * CONFIG.ANIMATION.ROTATION_MAX;
    this._drawFireworkAnimated(pg, centerX / 8, centerY / 12, upperSize, data.lateReply_her, upperP, seeds.upper, satFade, rotation);

    // Lower fires after upper finishes + delay
    const lowerStart = B + D;
    if (frame >= lowerStart) {
      const lowerP = constrain((frame - lowerStart) / B, 0, 1);
      this._drawFireworkAnimated(pg, centerX * 1.87, centerY * 1.92, lowerSize, data.lateReply, lowerP, seeds.lower, satFade, rotation);
    }
  }

  static _drawFireworkAnimated(pg, centerX, centerY, size, lateReply, progress, seed, satFade, rotation) {
    const scale = size / 100;
    const dashes_num = Math.floor(map(size, 32, 250, 200, 600));
    const centre_dashes_num = Math.floor(map(size, 32, 250, 50, 200));
    const golden_angle = 2.3999632297286535;
    const draw_radius = size * 0.85;
    const dash_gap = size * 0.05;
    const centre_r = size * 0.15;
    lateReply = lateReply * 100;
    const lateMap = constrain(map(lateReply, 1, 5, 10, 100), 10, 100);
    const pctChange = (100 - lateMap) / 100;

    // Phase 1: full brightness (85). Phase 2: fade to data-driven saturation.
    const fullSat = 85;
    const targetSat = fullSat * pctChange;
    const sat = lerp(fullSat, targetSat, satFade);

    pg.push();
    pg.stroke(15, sat, 60);
    pg.fill(15, sat, 60);

    // Center pattern — pre-generated, always fully drawn (no rotation)
    randomSeed(seed + 50000);
    for (let i = 0; i < centre_dashes_num; i++) {
      const a = random(TWO_PI);
      const rx = random(centre_r);
      const ry = random(centre_r);
      const sw = random(1, 1.5) * scale;
      const x = centerX + rx * cos(a);
      const y = centerY + ry * sin(a);
      pg.strokeWeight(sw);
      pg.line(x, y, centerX, centerY);
    }

    // Outer pattern — blooms outward + slow rotation during sat fade
    randomSeed(seed);
    for (let i = 0; i < dashes_num; i++) {
      const angle = i * golden_angle + rotation; // rotation offset
      const r = sqrt(i / dashes_num);
      const rGap = random(dash_gap);
      const dr = random(0.2);
      const sw = random(1, 1.5) * scale;
      if (r > progress) continue;
      const x = centerX + (draw_radius - dash_gap - rGap) * cos(angle) * r;
      const y = centerY + (draw_radius - dash_gap - rGap) * sin(angle) * r;
      const x1 = (1 - dr) * x + dr * centerX;
      const y1 = (1 - dr) * y + dr * centerY;
      pg.strokeWeight(sw);
      pg.line(x, y, x1, y1);
    }
    pg.pop();
  }

  static drawStarAnimated(pg, cx, cy, colour, progress, seed) {
    const raysToShow = Math.ceil(40 * progress);
    randomSeed(seed);
    pg.push();
    pg.stroke(colour);
    for (let i = 0; i < 40; i++) {
      const angle = random(TWO_PI);
      const rayR = random(15, 22);
      const sw = random(2);
      const secs = [];
      for (let j = 0; j <= 1; j++) {
        secs.push({ a: random(TWO_PI), r: random(8, 15), sw: random(1, 1.5) });
      }
      if (i >= raysToShow) continue;
      const rScaled = rayR * progress;
      pg.strokeWeight(sw);
      pg.line(cx + rScaled * cos(angle), cy + rScaled * sin(angle), cx, cy);
      for (const s of secs) {
        const sr = s.r * progress;
        pg.strokeWeight(s.sw);
        pg.line(cx + sr * cos(s.a), cy + sr * sin(s.a), cx, cy);
      }
    }
    pg.pop();
  }
}

// ─── Card Animator ────────────────────────────────────
class CardAnimator {
  constructor(cardCanvas, bgBuffer, cardData, cardDiv) {
    this.pg = cardCanvas;
    this.bg = bgBuffer;
    this.data = cardData;
    this.el = cardDiv;
    this.started = false;
    this.complete = false;
    this.queued = false;
    this.frame = 0;
    this.isStarCard = (cardData.content < 100) && (cardData.content_her < 100);

    // Deterministic seeds for consistent patterns across frames
    this.seeds = {
      upper: Math.floor(random(100000)),
      lower: Math.floor(random(100000)),
      stars: []
    };

    if (this.isStarCard) {
      const n = Math.floor(constrain(map(cardData.content + cardData.content_her, 0, 200, 1, 10), 1, 10));
      for (let i = 0; i < n; i++) {
        this.seeds.stars.push({
          x: random(95, 325), y: random(120, 300),
          color: CONFIG.COLORS.STAR_COLORS[Math.floor(random(CONFIG.COLORS.STAR_COLORS.length))],
          seed: Math.floor(random(100000))
        });
      }
      this.satFadeFrames = 0;
    } else {
      // Compute max saturation gap across both fireworks → dynamic fade duration
      const computeGap = (lateReply) => {
        const lr = lateReply * 100;
        const lateMap = constrain(map(lr, 1, 5, 10, 100), 10, 100);
        const pctChange = (100 - lateMap) / 100;
        return 85 - 85 * pctChange; // gap from full brightness to target
      };
      const maxGap = max(computeGap(cardData.lateReply), computeGap(cardData.lateReply_her));
      // Map gap (0–85) to fade frames (min–max)
      this.satFadeFrames = Math.round(
        map(maxGap, 0, 85, CONFIG.ANIMATION.SAT_FADE_MIN, CONFIG.ANIMATION.SAT_FADE_MAX)
      );
    }

    // Show background only (no fireworks yet)
    this.pg.image(this.bg, 0, 0);
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.frame = 0;
  }

  update() {
    if (!this.started || this.complete) return false;
    this.frame++;

    if (this.isStarCard) {
      // Stars: single-phase, short animation
      const raw = min(this.frame / CONFIG.ANIMATION.STAR_BLOOM_FRAMES, 1);
      const p = 1 - Math.pow(1 - raw, 3);

      this.pg.clear();
      this.pg.image(this.bg, 0, 0);
      const stars = this.seeds.stars;
      for (let i = 0; i < stars.length; i++) {
        const start = (i / stars.length) * 0.5;
        const sp = constrain((p - start) / 0.5, 0, 1);
        if (sp <= 0) continue;
        const ep = 1 - Math.pow(1 - sp, 3);
        const s = stars[i];
        FireworkRenderer.drawStarAnimated(this.pg, s.x, s.y, s.color, ep, s.seed);
      }
      if (raw >= 1) {
        this.complete = true;
        if (this.bg) { this.bg.remove(); this.bg = null; }
      }
    } else {
      // Fireworks: bloom upper, delay, bloom lower, then saturation fade
      const B = CONFIG.ANIMATION.BLOOM_FRAMES;
      const D = CONFIG.ANIMATION.FIREWORK_DELAY_FRAMES;
      const bloomEnd = B + D + B;  // both fireworks done
      const totalFrames = bloomEnd + this.satFadeFrames;

      const satRaw = (this.frame > bloomEnd && this.satFadeFrames > 0)
        ? min((this.frame - bloomEnd) / this.satFadeFrames, 1)
        : 0;
      const satFade = 1 - Math.pow(1 - satRaw, 2);

      this.pg.clear();
      this.pg.image(this.bg, 0, 0);
      const cx = this.pg.width / 2;
      const cy = this.pg.height / 2;
      FireworkRenderer.drawFireworksAnimated(this.pg, cx, cy, this.data, this.frame, this.seeds, satFade);

      if (this.frame >= totalFrames) {
        this.complete = true;
        if (this.bg) { this.bg.remove(); this.bg = null; }
      }
    }
    return !this.complete;
  }
}

// ─── Data Processor ───────────────────────────────────
class DataProcessor {
  static extractCardData(row) {
    try {
      return {
        content_her: this.validateNumber(parseFloat(row.get('content_Her')), 'content her'),
        lateReply_her: this.validateNumber(parseFloat(row.get('percent_late_reply_Her')), 'late reply her'),
        content: this.validateNumber(parseFloat(row.get('content')), 'content'),
        lateReply: this.validateNumber(parseFloat(row.get('percent_late_reply')), 'late reply'),
        week: row.get('week')
      };
    } catch (error) {
      console.warn('Error extracting data:', error);
      return { ...DEFAULT_VALUES };
    }
  }

  static validateNumber(value, field) {
    if (isNaN(value) || !isFinite(value)) {
      console.warn(`Invalid ${field} value:`, value);
      return DEFAULT_VALUES[field.replace(/\s+/g, '')];
    }
    return value;
  }
}

// ─── Visualization Guide (static, no animation) ──────
class VisualizationGuide {
  static createGuide() {
    const guideWidth = CONFIG.CARD.WIDTH * 4;
    const guideHeight = (CONFIG.CARD.HEIGHT * 0.75) / 1.5;
    const pg = createGraphics(guideWidth, guideHeight);
    pg.colorMode(HSL, 360, 100, 100, 100);
    pg.background(CONFIG.COLORS.BACKGROUND);

    pg.push();
    pg.fill(CONFIG.COLORS.PAPER);
    pg.textFont(State.font);
    pg.textSize(24);
    pg.textAlign(CENTER);
    pg.text("How to Read the Visualization", guideWidth / 2, 40);
    pg.pop();

    this.drawSizeGuide(pg, 50, 100);
    this.drawSaturationGuide(pg, guideWidth / 4 + 100, 100);
    this.drawStarsGuide(pg, guideWidth / 2 + 100, 100);
    this.drawPositionGuide(pg, guideWidth / 4 + 450 * 3 - 450, 100);
    BackgroundSystem.renderPaperTexture(pg);

    pg.push();
    pg.stroke(CONFIG.COLORS.PAPER);
    pg.strokeWeight(3);
    pg.noFill();
    pg.rectMode(CENTER);
    pg.rect(guideWidth / 2, guideHeight / 2,
      guideWidth - CONFIG.CARD.PADDING / 1.5,
      guideHeight - CONFIG.CARD.PADDING / 1.5,
      CONFIG.CARD.CORNER_RADIUS);
    pg.pop();
    return pg;
  }

  static drawSizeGuide(pg, x, y) {
    const sizes = [100, 185, 270];
    const messages = ["100 messages", "800 messages", "1500 messages"];
    sizes.forEach((size, i) => {
      pg.push();
      FireworkRenderer.drawLowerFirework(pg, x + i * 150 + 30, y + 100, size / 2, 0.01);
      pg.fill(CONFIG.COLORS.PAPER);
      pg.textFont(State.font);
      pg.textSize(15);
      pg.textAlign(CENTER);
      pg.text(messages[i], x + i * 150 + 30, y + 210);
      pg.pop();
    });
  }

  static drawSaturationGuide(pg, x, y) {
    const lateReplies = [0.01, 0.03, 0.05];
    const labels = ["1% late", "3% late", "5% late"];
    lateReplies.forEach((late, i) => {
      pg.push();
      FireworkRenderer.drawLowerFirework(pg, x + i * 150 + 35, y + 100, 50, late);
      pg.fill(CONFIG.COLORS.PAPER);
      pg.textFont(State.font);
      pg.textSize(15);
      pg.textAlign(CENTER);
      pg.text(labels[i], x + i * 150 + 35, y + 210);
      pg.pop();
    });
  }

  static drawStarsGuide(pg, x, y) {
    pg.fill(CONFIG.COLORS.PAPER);
    pg.textFont(State.font);
    pg.textSize(15);
    pg.text("When we texted less than 200 messages ", x, y + 210);
    pg.text("20 messages = 1 star", x, y + 230);
    pg.push();
    const sc = CONFIG.COLORS.STAR_COLORS;
    FireworkRenderer.drawStar(pg, x + 100, y + 80, sc[0]);
    FireworkRenderer.drawStar(pg, x + 150, y + 100, sc[1]);
    FireworkRenderer.drawStar(pg, x + 200, y + 90, sc[2]);
    pg.pop();
  }

  static drawPositionGuide(pg, x, y) {
    pg.push();
    FireworkRenderer.drawUpperFirework(pg, x + 50, y + 70, 90, 0.01);
    FireworkRenderer.drawLowerFirework(pg, x + 250, y + 160, 90, 0.01);
    pg.fill(CONFIG.COLORS.PAPER);
    pg.textSize(15);
    pg.text("Upper firework:", x + 50, y + 50);
    pg.text("Her messages", x + 50, y + 70);
    pg.text("Lower firework:", x + 250, y + 180);
    pg.text("My messages", x + 250, y + 200);
    pg.pop();
  }
}

// ─── Main p5 lifecycle ───────────────────────────────
async function preload() {
  const ok = await AssetLoader.preload();
  if (!ok) console.error('Failed to load assets');
}

function setup() {
  noCanvas();
  if (!State.fireworkData) { showError('Failed to load data'); return; }

  BackgroundSystem.initialize();

  const pageContainer = createDiv('').addClass('page-container');

  // Guide
  const guideContainer = createDiv('').addClass('guide-container').parent(pageContainer);
  const guide = VisualizationGuide.createGuide();
  guide.canvas.style.display = 'block';
  const guideCard = createDiv('').addClass('guide-card').parent(guideContainer);
  guideCard.child(guide.canvas);

  // Cards
  const cardsContainer = createDiv('').addClass('firework-container').parent(pageContainer);

  State.fireworkData.rows.forEach((row, index) => {
    try {
      const cardData = DataProcessor.extractCardData(row);
      const bgBuffer = BackgroundSystem.getBackgroundWithText(cardData.week);
      const cardCanvas = createGraphics(CONFIG.CARD.WIDTH, CONFIG.CARD.HEIGHT);
      cardCanvas.colorMode(HSL, 360, 100, 100, 100);
      cardCanvas.canvas.style.display = 'block';

      const cardDiv = createDiv('').addClass('firework-card').parent(cardsContainer);
      cardDiv.child(cardCanvas.canvas);

      State.animators.push(new CardAnimator(cardCanvas, bgBuffer, cardData, cardDiv));
    } catch (error) {
      console.warn(`Skipping card ${index}:`, error);
    }
  });

  // IntersectionObserver enqueues cards — only one animates at a time
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const animator = State.animators.find(a => a.el.elt === entry.target);
      if (animator && !animator.started && !animator.queued) {
        animator.queued = true;
        State.queue.push(animator);
        if (!State.active) startNextInQueue();
      }
      observer.unobserve(entry.target);
    });
  }, { threshold: CONFIG.ANIMATION.VIEWPORT_THRESHOLD });

  State.animators.forEach(a => observer.observe(a.el.elt));
  State.observer = observer;
  noLoop();
}

function startNextInQueue() {
  if (State.queue.length === 0) {
    State.active = null;
    noLoop();
    return;
  }
  State.active = State.queue.shift();
  State.active.start();
  loop();
}

function draw() {
  // Delay between cards
  if (State.delayCounter > 0) {
    State.delayCounter--;
    return;
  }
  if (!State.active) { noLoop(); return; }
  const still = State.active.update();
  if (!still) {
    State.delayCounter = CONFIG.ANIMATION.CARD_DELAY_FRAMES;
    startNextInQueue();
  }
}

function showError(message) {
  const errorDiv = createDiv(message)
    .addClass('error-state')
    .style('color', '#ff6b6b')
    .style('text-align', 'center')
    .style('padding', '20px');
  select('body').child(errorDiv);
}