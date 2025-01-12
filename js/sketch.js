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
  }
};

// Default values for data validation
const DEFAULT_VALUES = {
  content: 0,
  lateReply: 0,
  senderName: "0",
  week: "0",
  lateReply_her: 0,

};

// State management
const State = {
  fireworkData: null,
  font: null,
  cards: []
};

// Asset loader
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

// Background system
class BackgroundSystem {
  static initialize() {
    if (CONFIG.BACKGROUND_CACHE.initialized) return;
    
    for (let i = 0; i < CONFIG.BACKGROUND_CACHE.COUNT; i++) {
      const bg = createGraphics(CONFIG.CARD.WIDTH, CONFIG.CARD.HEIGHT);
      bg.colorMode(HSL, 360, 100, 100, 100);
      bg.background(CONFIG.COLORS.BACKGROUND);
      
      // Create integrated background with box and pad
      this.renderIntegratedBackground(bg);
      CONFIG.BACKGROUND_CACHE.backgrounds.push(bg);
    }
    
    CONFIG.BACKGROUND_CACHE.initialized = true;
  }

  static renderIntegratedBackground(pg) {
    const centerX = pg.width / 2;
    const centerY = pg.height / 2;
    
    // First render the inner pad
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

    // Then render the box
    pg.push();
    pg.noStroke();
    pg.fill(CONFIG.COLORS.BOX);
    const boxWidth = CONFIG.CARD.HEIGHT / 3;
    const boxHeight = CONFIG.CARD.WIDTH / 5;
    pg.rectMode(CENTER);
    pg.rect(centerX, centerY, boxWidth, boxHeight, 25);
    pg.pop();

    // Finally render the paper texture over everything
    this.renderPaperTexture(pg);
  }

  static renderPaperTexture(pg) {
    //paper texture idea from https://editor.p5js.org/pinky-pig/sketches/3Omb1YMQq
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
    cardBg.text("week "+week, cardBg.width/2, cardBg.height/2);
    cardBg.pop();
    
    return cardBg;
  }
}

// Firework renderer
class FireworkRenderer {
  //firework code idea is from https://observablehq.com/@oliviafvane/animated-firework-p5
  static drawFireworks(pg, centerX, centerY, data) {
    // Calculate sizes for both fireworks
    const upperSize = this.calculateFireworkSize(data.content_her);
    const lowerSize = this.calculateFireworkSize(data.content);

    // Draw upper firework (her data)
    this.drawUpperFirework(pg, centerX/8, centerY/12, upperSize, data.lateReply_her);
    
    // Draw lower firework (his data)
    this.drawLowerFirework(pg, centerX*1.87, centerY*1.92, lowerSize, data.lateReply);
  }

  static drawUpperFirework(pg, centerX, centerY, size, lateReply) {
    const scale = size / 100;
    const dashes_num = Math.floor(map(size, 32, 250, 200, 600));
    const centre_dashes_num = Math.floor(map(size, 32, 250, 50, 200));
    
    const golden_angle = 2.3999632297286535;
    const draw_radius = size * 0.85;
    const dash_gap_from_circles = size * 0.05;
    const centre_dashes_radius = size * 0.15;
    lateReply = lateReply*100;
    const lateMap = constrain(map(lateReply, 1, 5, 10, 100), 10, 100);
    const percentChange = (100-lateMap)/100;
    
    pg.push();
    pg.stroke(15, 85 * percentChange, 60);
    pg.fill(15, 85 * percentChange, 60);

    // Draw outer pattern
    this.drawOuterPattern(pg, centerX, centerY, dashes_num, golden_angle, draw_radius, 
      dash_gap_from_circles, scale);

    // Draw center pattern
    this.drawCenterPattern(pg, centerX, centerY, centre_dashes_num, 
      centre_dashes_radius, scale);
    pg.pop();
  }

  static drawLowerFirework(pg, centerX, centerY, size, lateReply) {
    const scale = size / 100;
    const dashes_num = Math.floor(map(size, 32, 250, 200, 600));
    const centre_dashes_num = Math.floor(map(size, 32, 250, 50, 200));
    
    const golden_angle = 2.3999632297286535;
    const draw_radius = size * 0.85;
    const dash_gap_from_circles = size * 0.05;
    const centre_dashes_radius = size * 0.15;
    lateReply = lateReply*100;
    const lateMap = constrain(map(lateReply, 1, 5, 10, 100), 10, 100);
    const percentChange = (100-lateMap)/100;
    
    pg.push();
    pg.stroke(15, 85 * percentChange, 60);
    pg.fill(15, 85 * percentChange, 60);

    // Draw outer pattern
    this.drawOuterPattern(pg, centerX, centerY, dashes_num, golden_angle, draw_radius, 
      dash_gap_from_circles, scale);

    // Draw center pattern
    this.drawCenterPattern(pg, centerX, centerY, centre_dashes_num, 
      centre_dashes_radius, scale);
    pg.pop();
  }

  static drawOuterPattern(pg, centerX, centerY, dashes_num, golden_angle, draw_radius, 
    dash_gap_from_circles, scale) {
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

  static drawCenterPattern(pg, centerX, centerY, centre_dashes_num, 
    centre_dashes_radius, scale) {
    for (let i = 0; i < centre_dashes_num; i++) {
      const angle = random(TWO_PI);
      const x = centerX + random(centre_dashes_radius) * cos(angle);
      const y = centerY + random(centre_dashes_radius) * sin(angle);
      
      pg.strokeWeight(random(1, 1.5) * scale);
      pg.line(x, y, centerX, centerY);
    }
  }

  static calculateFireworkSize(content) {
    return constrain(map(content, 100, 1500, 100, 270), 100, 270);
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
        const secondaryAngle = random(TWO_PI);
        const secondaryRadius = random(8, 15);
        
        const x2 = centerX + secondaryRadius * cos(secondaryAngle);
        const y2 = centerY + secondaryRadius * sin(secondaryAngle);
        
        pg.strokeWeight(random(1, 1.5));
        pg.line(x2, y2, centerX, centerY);
      }
    }
    pg.pop();
  }
}

// Card renderer
class CardRenderer {
  static createCard(data) {
    const pg = createGraphics(CONFIG.CARD.WIDTH, CONFIG.CARD.HEIGHT);
    pg.colorMode(HSL, 360, 100, 100, 100);
    
    // Get background with integrated elements and text
    const background = BackgroundSystem.getBackgroundWithText(data.week);
    pg.image(background, 0, 0);
    
    // Draw fireworks or stars based on content
    if (data.content+data.content_her < 200) {
      this.drawStars(pg, data);
    } else {
      this.drawFireworks(pg, data);
    }
    
    return pg;
  }

  static drawStars(pg, data) {
    const numStars = constrain(map(data.content + data.content_her, 0, 200, 1, 10),1,10);
    
    for (let i = 0; i < numStars; i++) {
      const color = CONFIG.COLORS.STAR_COLORS[Math.floor(random(CONFIG.COLORS.STAR_COLORS.length))];
      FireworkRenderer.drawStar(pg, random(95, 325), random(120, 300), color);
    }
  }

  static drawFireworks(pg, data) {
    const centerX = pg.width / 2;
    const centerY = pg.height / 2;
    
    FireworkRenderer.drawFireworks(pg, centerX, centerY, data);
  }

  static calculateFireworkSize(content) {
    return constrain(map(content, 100, 1500, 100, 270), 100, 270);
  }
}

// Data processor
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

class VisualizationGuide {
  static createGuide() {
    const guideWidth = CONFIG.CARD.WIDTH * 4;
    const guideHeight = (CONFIG.CARD.HEIGHT * 0.75)/1.5;
    const pg = createGraphics(guideWidth, guideHeight);
    pg.colorMode(HSL, 360, 100, 100, 100);
    
    // Set background
    pg.background(CONFIG.COLORS.BACKGROUND);
    
    // Add title
    pg.push();
    pg.fill(CONFIG.COLORS.PAPER);
    pg.textFont(State.font);
    pg.textSize(24);
    pg.textAlign(CENTER);
    pg.text("How to Read the Visualization", guideWidth/2, 40);
    pg.pop();

    // Section 1: Message Size to Firework Size
    this.drawSizeGuide(pg, 50, 100);

    // Section 2: Late Reply to Saturation
    this.drawSaturationGuide(pg, guideWidth/4 + 100, 100);

    // Section 3: Small Messages to Stars
    this.drawStarsGuide(pg, guideWidth/2+100, 100);

    // Section 4: Her vs His Position
    this.drawPositionGuide(pg, guideWidth/4 + 450*3-450, 100);
    BackgroundSystem.renderPaperTexture(pg)
    const centerX = pg.width / 2;
    const centerY = pg.height / 2;
    // inner pad
    pg.push();
    pg.stroke(CONFIG.COLORS.PAPER);
    pg.strokeWeight(3);
    pg.noFill();
    pg.rectMode(CENTER);
    pg.rect(guideWidth/2, guideHeight/2, 
      guideWidth - CONFIG.CARD.PADDING/1.5, 
      guideHeight - CONFIG.CARD.PADDING/1.5, 
      CONFIG.CARD.CORNER_RADIUS);
    pg.pop();
    return pg;
  }

  static drawSizeGuide(pg, x, y) {


    // Draw three different sized fireworks
    const sizes = [100, 185, 270];
    const messages = ["100 messages", "800 messages", "1500 messages"];
    
    sizes.forEach((size, i) => {
      const data = {
        content: size,
        content_her: 0,
        lateReply: 0.01,
        lateReply_her: 0
      };
      
      pg.push();
      FireworkRenderer.drawLowerFirework(pg, x + i * 150 + 30, y + 100, size/2, 0.01);
      pg.fill(CONFIG.COLORS.PAPER);
      pg.textFont(State.font);
      pg.textSize(15);
      pg.textAlign(CENTER);
      pg.text(messages[i], x + i * 150 + 30, y + 210);
      pg.pop();
    });
  }

  static drawSaturationGuide(pg, x, y) {


    // Draw three fireworks with different saturations
    const lateReplies = [0.01, 0.03, 0.05];
    const labels = ["1% late", "3% late", "5% late"];
    
    lateReplies.forEach((late, i) => {
      const data = {
        content: 10,
        content_her: 0,
        lateReply: late,
        lateReply_her: 0
      };
      
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
    const title = "When we texted less than 200 messages ";
    pg.fill(CONFIG.COLORS.PAPER);
    pg.textFont(State.font);
    pg.textSize(15);
    pg.text(title, x, y+ 210);
    pg.text("20 messages = 1 star", x, y+ 230);

    // Draw example with stars
    pg.push();
    const starColors = CONFIG.COLORS.STAR_COLORS;
    FireworkRenderer.drawStar(pg, x + 100, y + 80, starColors[0]);
    FireworkRenderer.drawStar(pg, x + 150, y + 100, starColors[1]);
    FireworkRenderer.drawStar(pg, x + 200, y + 90, starColors[2]);
    
    pg.fill(CONFIG.COLORS.PAPER);
    pg.textSize(12);
    pg.textAlign(CENTER);
    pg.pop();
  }

  static drawPositionGuide(pg, x, y) {
    pg.push();

    // Draw example fireworks
    const data = {
      content: 150,
      content_her: 150,
      lateReply: 0.01,
      lateReply_her: 0.01
    };
    
    FireworkRenderer.drawUpperFirework(pg, x + 50, y + 70, 90, 0.01);
    FireworkRenderer.drawLowerFirework(pg, x + 250, y + 160, 90, 0.01);
    // Add labels
    pg.fill(CONFIG.COLORS.PAPER);
    pg.textSize(15);
    pg.text("Upper firework:", x + 50, y + 50);
    pg.text("Her messages", x + 50, y + 70);
    pg.text("Lower firework:", x + 250, y + 180);
    pg.text("My messages", x + 250, y + 200);
    
    pg.pop();
  }
}

// Main application functions
async function preload() {
  const assetsLoaded = await AssetLoader.preload();
  if (!assetsLoaded) {
    console.error('Failed to load assets');
  }
}

function setup() {
  noCanvas();
  if (!State.fireworkData) {
    showError('Failed to load data');
    return;
  }

  BackgroundSystem.initialize();
  
  // Create main container
  const pageContainer = createDiv('').addClass('page-container');
  
  // Add guide container
  const guideContainer = createDiv('').addClass('guide-container').parent(pageContainer);
  const guide = VisualizationGuide.createGuide();
  guide.canvas.style.display='block';
  const guideCard = createDiv('')
    .addClass('guide-card')
    .parent(guideContainer);
  guideCard.child(guide.canvas);
  
  // Add cards container
  const cardsContainer = createDiv('').addClass('firework-container').parent(pageContainer);
  
  // Create cards
  State.fireworkData.rows.forEach((row, index) => {
    try {
      const cardData = DataProcessor.extractCardData(row);
      const cardCanvas = CardRenderer.createCard(cardData);
      cardCanvas.canvas.style.display = 'block';

      State.cards.push(cardCanvas);
      
      const cardDiv = createDiv('')
        .addClass('firework-card')
        .parent(cardsContainer);
      cardDiv.child(cardCanvas.canvas);
      
    } catch (error) {
      console.warn(`Skipping card ${index} due to invalid data:`, error);
    }
  });
}

function showError(message) {
  const errorDiv = createDiv(message)
    .addClass('error-state')
    .style('color', '#ff6b6b')
    .style('text-align', 'center')
    .style('padding', '20px');
  
  select('body').child(errorDiv);
}