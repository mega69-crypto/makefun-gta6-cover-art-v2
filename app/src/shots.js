// Shot scenes for deterministic screenshots.
// Reads URL params (?shot=cover|editor, ?photo=, ?caption=, ?layout=,
// ?grade=, ?size=) and stages the app into that scene. The cover scene
// hides the editor chrome and fills the page with the cover canvas, drawn
// with the same drawCover function the Export buttons use.

import { defaultState, layoutById, gradeById, EXPORT_SIZES } from './cover.js';

export const SAMPLES = [
  { id: 'boulevard', name: 'Boulevard', src: 'samples/boulevard.jpg' },
  { id: 'pier', name: 'Pier', src: 'samples/pier.jpg' },
];

export function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || '',
    photo: q.get('photo') || '',
    caption: q.get('caption') || '',
    layout: q.get('layout') || '',
    grade: q.get('grade') || '',
    size: q.get('size') || '',
    title: q.get('title') || '',
  };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + src));
    img.src = src;
  });
}

export async function loadSamples() {
  const photos = [];
  for (const s of SAMPLES) {
    try {
      photos.push(await loadImage(s.src));
    } catch (err) {
      console.warn('sample failed:', s.src, err);
    }
  }
  return photos;
}

// Apply ?shot= params onto a fresh state. Returns { state, size, shot }.
export function applyShotParams(baseState) {
  const p = readShotParams();
  const state = { ...baseState, panels: baseState.panels.map((s) => ({ ...s })) };
  if (p.layout && layoutById(p.layout)) state.layout = p.layout;
  if (p.grade && gradeById(p.grade)) state.grade = p.grade;
  if (p.title) state.title = p.title;
  if (p.caption) state.subtitle = p.caption;
  let size = EXPORT_SIZES.find((s) => s.id === state.size) || EXPORT_SIZES[0];
  if (p.size) {
    const found = EXPORT_SIZES.find((s) => s.id === p.size);
    if (found) {
      size = found;
      state.size = found.id;
    }
  }
  // Default cover-shot size is landscape unless a size was given.
  if (p.shot === 'cover' && !p.size) {
    size = EXPORT_SIZES.find((s) => s.id === '1920x1080');
    state.size = size.id;
  }
  // Pick the requested sample as the first panel's photo and alternate the
  // other sample across the remaining panels, so a multi-panel cover shows
  // several photos (deterministic: panel i uses sample (idx + i) % count).
  if (p.photo) {
    const idx = SAMPLES.findIndex((s) => s.id === p.photo);
    if (idx >= 0) {
      state.panels = state.panels.map((slot, i) => ({
        ...slot,
        photo: (idx + i) % SAMPLES.length,
      }));
    }
  }
  return { state, size, shot: p.shot };
}

export function defaultShotState() {
  return defaultState();
}
