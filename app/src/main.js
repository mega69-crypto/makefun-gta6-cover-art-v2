// Neon Coast Cover Studio — UI wiring.
// File inputs, layout/grade pickers, caption editing, panel selection
// (click to select, drag to position, zoom slider, photo picker per panel),
// presets, undo/redo, export buttons, ?shot= scenes, sample preload.

import {
  LAYOUTS, GRADES, EXPORT_SIZES, PRESETS,
  layoutById, gradeById, defaultState,
  drawCover, renderCoverCanvas, activePanels,
} from './cover.js';
import { SAMPLES, loadImage, loadSamples, applyShotParams } from './shots.js';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#preview');
const ctx = canvas.getContext('2d');

let state = defaultState();
let photos = []; // HTMLImageElement list; index matches state.panels[].photo
let photoNames = [];
let selectedPanel = 0;
let undoStack = [];
let redoStack = [];
let drag = null; // { panel, startX, startY, startDx, startDy, moved }
let renderQueued = false;

function snapshot() {
  return JSON.stringify({
    layout: state.layout, grade: state.grade, size: state.size,
    title: state.title, subtitle: state.subtitle,
    grain: state.grain, vignette: state.vignette, badge: state.badge,
    heat: state.heat, panels: state.panels,
  });
}

function restore(json) {
  const s = JSON.parse(json);
  state = { ...state, ...s, panels: s.panels.map((p) => ({ ...p })) };
  syncControls();
  queueRender();
}

function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  syncUndoButtons();
}

function doUndo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  syncUndoButtons();
}

function doRedo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  syncUndoButtons();
}

function syncUndoButtons() {
  $('#undoBtn').disabled = undoStack.length === 0;
  $('#redoBtn').disabled = redoStack.length === 0;
}

// ---------------------------------------------------------------------------
// Rendering.
// ---------------------------------------------------------------------------

function currentSize() {
  return EXPORT_SIZES.find((s) => s.id === state.size) || EXPORT_SIZES[0];
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderPreview();
  });
}

function renderPreview() {
  const size = currentSize();
  canvas.width = size.w;
  canvas.height = size.h;
  const drawState = { ...state, photos };
  drawCover(ctx, size.w, size.h, drawState);
  if (!document.body.classList.contains('shot-cover')) highlightSelectedPanel();
}

function highlightSelectedPanel() {
  const size = currentSize();
  const list = activePanels({ ...state, photos }, size.w, size.h);
  const hit = list[selectedPanel];
  if (!hit) return;
  const r = hit.rect;
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.rotate(((r.rot || 0) * Math.PI) / 180);
  ctx.translate(-r.w / 2, -r.h / 2);
  ctx.lineWidth = Math.max(3, size.w * 0.004);
  ctx.strokeStyle = '#ffd166';
  ctx.setLineDash([14, 8]);
  ctx.strokeRect(4, 4, r.w - 8, r.h - 8);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Controls.
// ---------------------------------------------------------------------------

function buildPickers() {
  const layoutBox = $('#layoutPicker');
  LAYOUTS.forEach((l) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.value = l.id;
    b.textContent = l.name;
    b.addEventListener('click', () => {
      if (state.layout === l.id) return;
      pushUndo();
      state.layout = l.id;
      selectedPanel = 0;
      syncControls();
      queueRender();
    });
    layoutBox.appendChild(b);
  });

  const gradeBox = $('#gradePicker');
  GRADES.forEach((g) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick grade';
    b.dataset.value = g.id;
    b.innerHTML = `<span class="swatch" style="background:linear-gradient(135deg, rgb(${g.stops[0].join(',')}), rgb(${g.stops[2].join(',')}))"></span>${g.name}`;
    b.addEventListener('click', () => {
      if (state.grade === g.id) return;
      pushUndo();
      state.grade = g.id;
      syncControls();
      queueRender();
    });
    gradeBox.appendChild(b);
  });

  const presetBox = $('#presetPicker');
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick preset';
    b.textContent = p.name;
    b.addEventListener('click', () => {
      pushUndo();
      state.layout = p.layout;
      state.grade = p.grade;
      selectedPanel = 0;
      syncControls();
      queueRender();
    });
    presetBox.appendChild(b);
  });

  const sizeSel = $('#sizeSelect');
  EXPORT_SIZES.forEach((s) => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.label;
    sizeSel.appendChild(o);
  });
  sizeSel.addEventListener('change', () => {
    pushUndo();
    state.size = sizeSel.value;
    queueRender();
  });
}

function syncControls() {
  document.querySelectorAll('#layoutPicker .pick').forEach((b) => {
    b.classList.toggle('active', b.dataset.value === state.layout);
  });
  document.querySelectorAll('#gradePicker .pick').forEach((b) => {
    b.classList.toggle('active', b.dataset.value === state.grade);
  });
  $('#titleInput').value = state.title;
  $('#subtitleInput').value = state.subtitle;
  $('#sizeSelect').value = state.size;
  $('#grainToggle').checked = state.grain;
  $('#vignetteToggle').checked = state.vignette;
  $('#badgeToggle').checked = state.badge;
  $('#heatRange').value = state.heat;
  $('#heatValue').textContent = state.heat + ' / 5';
  syncPanelControls();
}

function syncPanelControls() {
  const size = currentSize();
  const list = activePanels({ ...state, photos }, size.w, size.h);
  const count = list.length;
  $('#panelLabel').textContent = `Panel ${selectedPanel + 1} of ${count}`;
  const slot = state.panels[selectedPanel];
  const zoom = $('#zoomRange');
  zoom.value = slot ? slot.zoom : 1;
  $('#zoomValue').textContent = (slot ? slot.zoom : 1).toFixed(1) + 'x';
  const sel = $('#photoSelect');
  sel.innerHTML = '';
  photoNames.forEach((name, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = name;
    sel.appendChild(o);
  });
  const none = document.createElement('option');
  none.value = -1;
  none.textContent = '(empty panel)';
  sel.appendChild(none);
  sel.value = slot ? String(slot.photo) : '-1';
  $('#panelHint').textContent = count > 1
    ? 'Click a panel on the cover to select it, then drag inside it to move the photo.'
    : 'Drag inside the photo to move it.';
}

function bindControls() {
  $('#titleInput').addEventListener('input', (e) => {
    state.title = e.target.value;
    queueRender();
  });
  $('#titleInput').addEventListener('change', () => { pushUndo(); });
  $('#subtitleInput').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    queueRender();
  });
  $('#subtitleInput').addEventListener('change', () => { pushUndo(); });
  $('#grainToggle').addEventListener('change', (e) => { pushUndo(); state.grain = e.target.checked; queueRender(); });
  $('#vignetteToggle').addEventListener('change', (e) => { pushUndo(); state.vignette = e.target.checked; queueRender(); });
  $('#badgeToggle').addEventListener('change', (e) => { pushUndo(); state.badge = e.target.checked; queueRender(); });
  $('#heatRange').addEventListener('input', (e) => {
    state.heat = Number(e.target.value);
    $('#heatValue').textContent = state.heat + ' / 5';
    queueRender();
  });
  $('#heatRange').addEventListener('change', () => { pushUndo(); });
  $('#zoomRange').addEventListener('input', (e) => {
    const slot = state.panels[selectedPanel];
    if (!slot) return;
    slot.zoom = Number(e.target.value);
    $('#zoomValue').textContent = slot.zoom.toFixed(1) + 'x';
    queueRender();
  });
  $('#zoomRange').addEventListener('change', () => { pushUndo(); });
  $('#photoSelect').addEventListener('change', (e) => {
    pushUndo();
    state.panels[selectedPanel].photo = Number(e.target.value);
    queueRender();
  });
  $('#undoBtn').addEventListener('click', doUndo);
  $('#redoBtn').addEventListener('click', doRedo);
  $('#uploadInput').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      try {
        const url = URL.createObjectURL(f);
        const img = await loadImage(url);
        photos.push(img);
        photoNames.push(f.name);
      } catch (err) {
        console.warn('upload failed:', f.name, err);
      }
    }
    e.target.value = '';
    syncPanelControls();
    queueRender();
  });
}

// ---------------------------------------------------------------------------
// Panel selection + drag on the preview canvas.
// ---------------------------------------------------------------------------

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (canvas.width / r.width);
  const y = (e.clientY - r.top) * (canvas.height / r.height);
  return { x, y };
}

function hitPanel(x, y) {
  const size = currentSize();
  const list = activePanels({ ...state, photos }, size.w, size.h);
  // Topmost panel wins: test in reverse draw order.
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i].rect;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const a = -((r.rot || 0) * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2) return i;
  }
  return -1;
}

function bindCanvas() {
  canvas.addEventListener('pointerdown', (e) => {
    const p = canvasPoint(e);
    const hit = hitPanel(p.x, p.y);
    if (hit < 0) return;
    selectedPanel = hit;
    syncPanelControls();
    const slot = state.panels[hit];
    drag = { panel: hit, startX: p.x, startY: p.y, startDx: slot.dx, startDy: slot.dy, moved: false };
    pushUndo();
    canvas.setPointerCapture(e.pointerId);
    queueRender();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = canvasPoint(e);
    const size = currentSize();
    const list = activePanels({ ...state, photos }, size.w, size.h);
    const r = list[drag.panel].rect;
    const slot = state.panels[drag.panel];
    slot.dx = drag.startDx + (p.x - drag.startX) / r.w;
    slot.dy = drag.startDy + (p.y - drag.startY) / r.h;
    slot.dx = Math.max(-0.6, Math.min(0.6, slot.dx));
    slot.dy = Math.max(-0.6, Math.min(0.6, slot.dy));
    drag.moved = true;
    queueRender();
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
}

// ---------------------------------------------------------------------------
// Export.
// ---------------------------------------------------------------------------

function downloadPng(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function exportSize(size) {
  const c = renderCoverCanvas(size.w, size.h, { ...state, photos });
  c.toBlob((blob) => {
    if (blob) downloadPng(blob, `neon-coast-${size.id}.png`);
  }, 'image/png');
}

function bindExport() {
  const box = $('#exportButtons');
  EXPORT_SIZES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'export-btn';
    b.textContent = s.id;
    b.addEventListener('click', () => exportSize(s));
    box.appendChild(b);
  });
  $('#exportAllBtn').addEventListener('click', () => {
    EXPORT_SIZES.forEach((s, i) => setTimeout(() => exportSize(s), i * 250));
  });
  $('#exportBigBtn').addEventListener('click', () => exportSize(currentSize()));
}

// ---------------------------------------------------------------------------
// Startup: fonts, samples, ?shot= scenes.
// ---------------------------------------------------------------------------

async function waitForFonts() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('40px Anton'),
        document.fonts.load('20px Pacifico'),
      ]),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch (err) {
    console.warn('font load timed out', err);
  }
}

async function boot() {
  buildPickers();
  bindControls();
  bindCanvas();
  bindExport();

  const params = new URLSearchParams(window.location.search);
  const isCoverShot = params.get('shot') === 'cover';
  const isEditorShot = params.get('shot') === 'editor';

  // Preload the two built-in samples first so the cover is visible at once.
  const samples = await loadSamples();
  samples.forEach((img, i) => {
    photos.push(img);
    photoNames.push(SAMPLES[i].name + ' (sample)');
  });

  await waitForFonts();

  if (isCoverShot || isEditorShot) {
    const { state: shotState, size } = applyShotParams(state);
    state = shotState;
    // Cover shot: hide the editor chrome, show only the cover canvas.
    if (isCoverShot) {
      document.body.classList.add('shot-cover');
      canvas.width = size.w;
      canvas.height = size.h;
      // Fit the canvas into the viewport while keeping its aspect ratio.
      const fit = () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scale = Math.min(vw / size.w, vh / size.h);
        canvas.style.width = Math.floor(size.w * scale) + 'px';
        canvas.style.height = Math.floor(size.h * scale) + 'px';
      };
      fit();
      window.addEventListener('resize', fit);
    }
  }

  syncControls();
  syncUndoButtons();
  renderPreview();
  // Signal to screenshot tooling that the cover is fully drawn.
  document.documentElement.dataset.ready = '1';
}

boot();
