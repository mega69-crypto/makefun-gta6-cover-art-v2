// Neon Coast Cover Studio — cover render engine.
// Draws GTA-style multi-panel cover art onto any 2D canvas context:
// layouts, gradient-map colour grades, bold lettering, halftone title
// block, badge ribbon, heat meter, film grain and vignette.
// Pure canvas code, no network, no dependencies.

export const LAYOUTS = [
  { id: 'four-panel', name: 'Four Panel', panels: 4 },
  { id: 'hero-three', name: 'Hero + Three', panels: 4 },
  { id: 'full-bleed', name: 'Full Bleed', panels: 1 },
  { id: 'nine-panel', name: 'Nine Panel', panels: 9 },
  { id: 'tilted', name: 'Tilted Snapshots', panels: 5 },
];

export const GRADES = [
  {
    id: 'sunset', name: 'Vice Sunset',
    stops: [[24, 8, 44], [214, 74, 60], [255, 196, 110]],
  },
  {
    id: 'neon', name: 'Neon Night',
    stops: [[10, 6, 40], [190, 32, 150], [80, 240, 255]],
  },
  {
    id: 'dusk', name: 'Palm Dusk',
    stops: [[18, 10, 52], [128, 52, 150], [255, 190, 90]],
  },
  {
    id: 'teal', name: 'Teal Heat',
    stops: [[6, 30, 34], [16, 140, 140], [255, 150, 60]],
  },
  {
    id: 'noir', name: 'Mono Noir',
    stops: [[0, 0, 0], [110, 110, 110], [255, 255, 255]],
  },
];

export const EXPORT_SIZES = [
  { id: '1080x1080', label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  { id: '1080x1350', label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  { id: '1920x1080', label: 'Landscape 1920 x 1080', w: 1920, h: 1080 },
  { id: '1080x1920', label: 'Story 1080 x 1920', w: 1080, h: 1920 },
];

export const PRESETS = [
  { id: 'sunset-heist', name: 'Sunset Heist', layout: 'hero-three', grade: 'sunset' },
  { id: 'neon-nights', name: 'Neon Nights', layout: 'four-panel', grade: 'neon' },
  { id: 'palm-gold', name: 'Palm Gold', layout: 'nine-panel', grade: 'dusk' },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

export function defaultState() {
  return {
    layout: 'four-panel',
    grade: 'sunset',
    size: '1080x1080',
    title: 'SUNSET HEIST',
    subtitle: 'Vice City nights',
    grain: true,
    vignette: true,
    badge: true,
    heat: 4,
    // One slot per panel (max 9). photo: index into state.photos, -1 = empty.
    // dx/dy: photo centre offset as a fraction of panel width/height. zoom: 1..3.
    panels: Array.from({ length: 9 }, (_, i) => ({
      photo: i < 2 ? i % 2 : 0,
      dx: 0,
      dy: 0,
      zoom: 1,
    })),
  };
}

// ---------------------------------------------------------------------------
// Colour grades: a 3-stop gradient map over luminance.
// ---------------------------------------------------------------------------

const lutCache = new Map();

export function gradeLut(gradeId) {
  if (lutCache.has(gradeId)) return lutCache.get(gradeId);
  const grade = gradeById(gradeId);
  const [a, b, c] = grade.stops;
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r, g, bl;
    if (t < 0.5) {
      const k = t / 0.5;
      r = a[0] + (b[0] - a[0]) * k;
      g = a[1] + (b[1] - a[1]) * k;
      bl = a[2] + (b[2] - a[2]) * k;
    } else {
      const k = (t - 0.5) / 0.5;
      r = b[0] + (c[0] - b[0]) * k;
      g = b[1] + (c[1] - b[1]) * k;
      bl = b[2] + (c[2] - b[2]) * k;
    }
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = bl;
  }
  lutCache.set(gradeId, lut);
  return lut;
}

// Draw an image cover-fitting a rect, apply the grade, return a canvas.
export function gradedPhotoCanvas(img, w, h, gradeId, zoom, dx, dy) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w));
  c.height = Math.max(2, Math.round(h));
  const ctx = c.getContext('2d');
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih) * (zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, (w - dw) / 2 + (dx || 0) * w, (h - dh) / 2 + (dy || 0) * h, dw, dh);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  const lut = gradeLut(gradeId);
  for (let i = 0; i < px.length; i += 4) {
    const lum = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    const o = lum * 3;
    px[i] = lut[o];
    px[i + 1] = lut[o + 1];
    px[i + 2] = lut[o + 2];
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// Layout geometry. All rects are in cover pixels. Title band sits at the
// bottom; panels live in the region above it (full-bleed uses the whole cover).
// ---------------------------------------------------------------------------

export function coverGeometry(layoutId, W, H) {
  const titleH = Math.round(H * 0.22);
  const m = Math.round(W * 0.022); // outer margin
  const gap = Math.round(W * 0.014);
  const region = { x: m, y: m, w: W - m * 2, h: H - titleH - m * 2 };
  const title = { x: 0, y: H - titleH, w: W, h: titleH };
  const panels = [];

  if (layoutId === 'full-bleed') {
    return { panels: [{ x: 0, y: 0, w: W, h: H, rot: 0 }], title, region, fullBleed: true };
  }
  if (layoutId === 'four-panel') {
    const pw = (region.w - gap) / 2;
    const ph = (region.h - gap) / 2;
    for (let r = 0; r < 2; r++) {
      for (let col = 0; col < 2; col++) {
        panels.push({ x: region.x + col * (pw + gap), y: region.y + r * (ph + gap), w: pw, h: ph, rot: 0 });
      }
    }
    return { panels, title, region, fullBleed: false };
  }
  if (layoutId === 'hero-three') {
    const heroH = region.h * 0.6;
    const smallH = region.h - heroH - gap;
    const sw = (region.w - gap * 2) / 3;
    panels.push({ x: region.x, y: region.y, w: region.w, h: heroH, rot: 0 });
    for (let i = 0; i < 3; i++) {
      panels.push({ x: region.x + i * (sw + gap), y: region.y + heroH + gap, w: sw, h: smallH, rot: 0 });
    }
    return { panels, title, region, fullBleed: false };
  }
  if (layoutId === 'nine-panel') {
    const pw = (region.w - gap * 2) / 3;
    const ph = (region.h - gap * 2) / 3;
    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 3; col++) {
        panels.push({ x: region.x + col * (pw + gap), y: region.y + r * (ph + gap), w: pw, h: ph, rot: 0 });
      }
    }
    return { panels, title, region, fullBleed: false };
  }
  // tilted: five overlapping snapshots at slight angles.
  const u = (fx, fy, fw, fh, rot) => ({
    x: region.x + fx * region.w,
    y: region.y + fy * region.h,
    w: fw * region.w,
    h: fh * region.h,
    rot,
  });
  panels.push(u(0.00, 0.00, 0.47, 0.52, -5));
  panels.push(u(0.53, 0.00, 0.47, 0.48, 4));
  panels.push(u(0.03, 0.52, 0.42, 0.44, 3));
  panels.push(u(0.50, 0.50, 0.47, 0.46, -3));
  panels.push(u(0.29, 0.27, 0.42, 0.42, -1));
  return { panels, title, region, fullBleed: false };
}

// ---------------------------------------------------------------------------
// Small drawing helpers.
// ---------------------------------------------------------------------------

function starPath(ctx, cx, cy, rOuter, rInner, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawHalftone(ctx, rect, color, maxR) {
  ctx.save();
  ctx.fillStyle = color;
  const step = maxR * 3.4;
  let row = 0;
  for (let y = rect.y + step / 2; y < rect.y + rect.h; y += step, row++) {
    const offset = row % 2 === 0 ? 0 : step / 2;
    for (let x = rect.x + step / 2 + offset; x < rect.x + rect.w; x += step) {
      const depth = 1 - (y - rect.y) / rect.h; // bigger dots at the top
      const r = Math.max(0.6, maxR * (0.35 + 0.65 * depth));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

let noiseTile = null;
function getNoiseTile() {
  if (noiseTile) return noiseTile;
  const c = document.createElement('canvas');
  c.width = 140;
  c.height = 140;
  const ctx = c.getContext('2d');
  const data = ctx.createImageData(140, 140);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  noiseTile = c;
  return c;
}

function drawPanelPhoto(ctx, rect, img, slot, gradeId, borderW) {
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.rotate(((rect.rot || 0) * Math.PI) / 180);
  ctx.translate(-rect.w / 2, -rect.h / 2);
  // Drop shadow for tilted panels, flat ink for the rest.
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = rect.rot ? borderW * 2.2 : 0;
  ctx.shadowOffsetY = rect.rot ? borderW * 1.2 : 0;
  if (img) {
    const photo = gradedPhotoCanvas(img, rect.w, rect.h, gradeId, slot.zoom, slot.dx, slot.dy);
    ctx.drawImage(photo, 0, 0, rect.w, rect.h);
  } else {
    ctx.fillStyle = '#241a3a';
    ctx.fillRect(0, 0, rect.w, rect.h);
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // Inked poster border: thick black frame + thin hot inner line.
  ctx.lineWidth = borderW;
  ctx.strokeStyle = '#0a0a12';
  ctx.strokeRect(borderW / 2, borderW / 2, rect.w - borderW, rect.h - borderW);
  ctx.lineWidth = Math.max(1.5, borderW * 0.22);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeRect(borderW * 1.6, borderW * 1.6, rect.w - borderW * 3.2, rect.h - borderW * 3.2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Title block: halftone panel, banded border, Anton title, Pacifico subtitle,
// badge ribbon and heat-meter stars.
// ---------------------------------------------------------------------------

function drawTitleBlock(ctx, rect, state, W, H) {
  const s = H / 1080; // scale factor so lettering tracks cover height
  ctx.save();
  // Base panel.
  ctx.fillStyle = '#120a24';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  drawHalftone(ctx, { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, 'rgba(255,120,80,0.28)', 5 * s + 2);
  // Banded border: outer ink line, hot pink band, inner ink line.
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(rect.x, rect.y, rect.w, 5 * s + 2);
  ctx.fillStyle = '#ff2e88';
  ctx.fillRect(rect.x, rect.y + 5 * s + 2, rect.w, 4 * s + 1);
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(rect.x, rect.y + 9 * s + 3, rect.w, 3 * s + 1);

  const padX = rect.w * 0.035;
  const cy = rect.y + rect.h / 2;
  const titleText = (state.title || 'UNTITLED').toUpperCase();
  const subText = state.subtitle || '';

  // Subtitle first (Pacifico, sunset gradient) so we can stack the title above it.
  let subH = 0;
  if (subText) {
    const subSize = Math.max(18, rect.h * 0.22);
    ctx.font = `${subSize}px Pacifico, cursive`;
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y);
    grad.addColorStop(0, '#ffd166');
    grad.addColorStop(0.5, '#ff7b54');
    grad.addColorStop(1, '#ff2e88');
    ctx.fillStyle = grad;
    subH = subSize;
  }
  // Title (Anton, white with heavy black outline).
  let titleSize = Math.max(28, rect.h * 0.46);
  ctx.font = `${titleSize}px Anton, 'Arial Narrow', sans-serif`;
  const maxW = rect.w - padX * 2 - rect.w * 0.2; // leave room for the badge side
  const tw = ctx.measureText(titleText).width;
  if (tw > maxW) titleSize = Math.max(20, titleSize * (maxW / tw));
  ctx.font = `${titleSize}px Anton, 'Arial Narrow', sans-serif`;

  const totalH = titleSize * 0.95 + (subText ? subH * 1.15 : 0);
  let y = cy - totalH / 2 + titleSize * 0.72;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, titleSize * 0.13);
  ctx.strokeStyle = '#0a0a12';
  ctx.strokeText(titleText, rect.x + padX, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(titleText, rect.x + padX, y);
  if (subText) {
    const subSize = Math.max(18, rect.h * 0.22);
    ctx.font = `${subSize}px Pacifico, cursive`;
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.5, rect.y);
    grad.addColorStop(0, '#ffd166');
    grad.addColorStop(0.5, '#ff7b54');
    grad.addColorStop(1, '#ff2e88');
    ctx.fillStyle = grad;
    ctx.fillText(subText, rect.x + padX, y + subH * 1.05);
  }

  // Heat meter: five stars, bottom-right of the title band.
  const starR = Math.max(9, rect.h * 0.11);
  const starGap = starR * 2.5;
  const starsW = starGap * 4 + starR * 2;
  let sx = rect.x + rect.w - padX - starsW + starR;
  const sy = rect.y + rect.h - starR * 1.7;
  for (let i = 0; i < 5; i++) {
    starPath(ctx, sx + i * starGap, sy, starR, starR * 0.45);
    ctx.fillStyle = i < state.heat ? '#ffd166' : 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, starR * 0.14);
    ctx.strokeStyle = '#0a0a12';
    ctx.stroke();
  }
  // "HEAT" label to the left of the stars (kept clear of the badge ribbon).
  ctx.font = `${Math.max(11, rect.h * 0.09)}px Anton, 'Arial Narrow', sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('HEAT', sx - starR * 1.4, sy);

  // Badge ribbon: gold star badge top-right, with a NEON COAST banner.
  if (state.badge) {
    const bx = rect.x + rect.w - padX - rect.w * 0.055;
    const by = rect.y + rect.h * 0.30;
    const br = Math.max(16, rect.h * 0.24);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-0.12);
    starPath(ctx, 0, 0, br * 1.25, br * 0.55);
    ctx.fillStyle = '#ffd166';
    ctx.fill();
    ctx.lineWidth = Math.max(2, br * 0.1);
    ctx.strokeStyle = '#0a0a12';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, br * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = '#ff2e88';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, br * 0.07);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.max(10, br * 0.42)}px Anton, 'Arial Narrow', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NC', 0, 1);
    // Ribbon banner under the badge.
    const bw = br * 3.4;
    const bh = br * 0.72;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(-bw / 2, br * 0.95, bw, bh);
    ctx.fillStyle = '#ffd166';
    ctx.font = `${Math.max(9, br * 0.34)}px Anton, 'Arial Narrow', sans-serif`;
    ctx.fillText('NEON COAST', 0, br * 0.95 + bh / 2 + 1);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main entry: draw the whole cover into ctx at W x H.
// state.photos: array of HTMLImageElement (or null). state.panels: slots.
// ---------------------------------------------------------------------------

export function drawCover(ctx, W, H, state) {
  const geo = coverGeometry(state.layout, W, H);
  const borderW = Math.max(4, Math.round(W * 0.008));

  // Backdrop.
  ctx.save();
  ctx.fillStyle = '#0d0718';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  if (geo.fullBleed) {
    const slot = state.panels[0];
    const img = state.photos && slot.photo >= 0 ? state.photos[slot.photo] : null;
    drawPanelPhoto(ctx, geo.panels[0], img, slot, state.grade, borderW);
    // Title band overlays the bottom of the photo.
    ctx.save();
    ctx.globalAlpha = 0.88;
    drawTitleBlock(ctx, geo.title, state, W, H);
    ctx.restore();
  } else {
    for (let i = 0; i < geo.panels.length; i++) {
      const slot = state.panels[i];
      const img = state.photos && slot.photo >= 0 ? state.photos[slot.photo] : null;
      drawPanelPhoto(ctx, geo.panels[i], img, slot, state.grade, borderW);
    }
    drawTitleBlock(ctx, geo.title, state, W, H);
  }

  // Vignette.
  if (state.vignette) {
    const vg = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.42,
      W / 2, H / 2, Math.max(W, H) * 0.75,
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(5,2,12,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // Film grain.
  if (state.grain) {
    const tile = getNoiseTile();
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// Render the cover at an exact size and return the canvas (used by Export).
export function renderCoverCanvas(W, H, state) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  drawCover(c.getContext('2d'), W, H, state);
  return c;
}

// Panels the current layout actually uses (for hit-testing / selection).
export function activePanels(state, W, H) {
  const geo = coverGeometry(state.layout, W, H);
  return geo.panels.map((rect, i) => ({ rect, slot: i }));
}
