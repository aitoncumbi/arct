// Project data model, undo history and browser persistence.

const KEY = 'arct:projects';
const LAST = 'arct:last';

export const uid = () => Math.random().toString(36).slice(2, 10);

export function createProject(name, w, d) {
  return {
    id: uid(),
    name: name || 'Untitled project',
    plot: { w, d, ground: 'grass' },
    settings: { wallH: 2.7, wallT: 0.15, wallColor: '#f1eee8' },
    walls: [], // {id, a:{x,z}, b:{x,z}, h, t, color}
    openings: [], // {id, wall, type:'door'|'window', style, pos, w, h, sill}
    floors: [], // {id, x, z, w, d, mat}
    items: [], // {id, type, x, z, rot, color?}
    updated: Date.now(),
  };
}

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function listSaved() {
  return Object.values(readAll()).sort((a, b) => (b.updated || 0) - (a.updated || 0));
}

export function deleteSaved(id) {
  try {
    const all = readAll();
    delete all[id];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* storage unavailable */ }
}

export function lastProject() {
  try {
    const id = localStorage.getItem(LAST);
    return id ? readAll()[id] || null : null;
  } catch {
    return null;
  }
}

function persist(project) {
  try {
    const all = readAll();
    all[project.id] = project;
    localStorage.setItem(KEY, JSON.stringify(all));
    localStorage.setItem(LAST, project.id);
  } catch { /* storage unavailable */ }
}

export class Store {
  constructor() {
    this.project = null;
    this.selection = null; // {kind:'wall'|'opening'|'floor'|'item', id}
    this.history = [];
    this.index = -1;
    this.listeners = [];
  }

  on(fn) { this.listeners.push(fn); }
  emit(kind) { this.listeners.forEach((fn) => fn(kind)); }

  load(project) {
    this.project = project;
    this.selection = null;
    this.history = [JSON.stringify(project)];
    this.index = 0;
    persist(project);
    this.emit('load');
  }

  /** Scene-only refresh while a drag or live edit is in flight. */
  touch() { this.emit('touch'); }

  /** Record the current state as an undo step and save it. */
  commit() {
    this.project.updated = Date.now();
    this.history.length = this.index + 1;
    this.history.push(JSON.stringify(this.project));
    if (this.history.length > 200) this.history.shift();
    this.index = this.history.length - 1;
    persist(this.project);
    this.emit('commit');
  }

  canUndo() { return this.index > 0; }
  canRedo() { return this.index < this.history.length - 1; }

  step(dir) {
    const next = this.index + dir;
    if (next < 0 || next >= this.history.length) return;
    this.index = next;
    this.project = JSON.parse(this.history[next]);
    if (!this.selected()) this.selection = null;
    persist(this.project);
    this.emit('commit');
  }

  select(ref) {
    const same = (ref && this.selection && ref.kind === this.selection.kind && ref.id === this.selection.id)
      || (!ref && !this.selection);
    if (same) return;
    this.selection = ref ? { kind: ref.kind, id: ref.id } : null;
    this.emit('select');
  }

  collection(kind) {
    return { wall: 'walls', opening: 'openings', floor: 'floors', item: 'items' }[kind];
  }

  selected() {
    const s = this.selection;
    if (!s || !this.project) return null;
    return this.project[this.collection(s.kind)].find((o) => o.id === s.id) || null;
  }

  removeSelected() {
    const s = this.selection;
    if (!s || !this.selected()) return;
    const p = this.project;
    const key = this.collection(s.kind);
    p[key] = p[key].filter((o) => o.id !== s.id);
    if (s.kind === 'wall') p.openings = p.openings.filter((o) => o.wall !== s.id);
    this.selection = null;
    this.commit();
  }
}

export const wallLength = (w) => Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z);

/** A furnished single-storey house used as the starting example. */
export function sampleProject() {
  const p = createProject('Example house', 24, 18);
  const { wallH: h, wallT: t, wallColor: color } = p.settings;
  const wall = (ax, az, bx, bz) => {
    const w = { id: uid(), a: { x: ax, z: az }, b: { x: bx, z: bz }, h, t, color };
    p.walls.push(w);
    return w.id;
  };
  const open = (wallId, type, pos, w, hh, sill, style) =>
    p.openings.push({ id: uid(), wall: wallId, type, style: style || (type === 'door' ? 'single' : 'window'), pos, w, h: hh, sill });
  const item = (type, x, z, deg = 0, c) =>
    p.items.push({ id: uid(), type, x, z, rot: (deg * Math.PI) / 180, ...(c ? { color: c } : {}) });
  const floor = (x, z, w, d, mat) => p.floors.push({ id: uid(), x, z, w, d, mat });

  const north = wall(-6, -4.5, 6, -4.5);
  const east = wall(6, -4.5, 6, 4.5);
  const south = wall(6, 4.5, -6, 4.5);
  const west = wall(-6, 4.5, -6, -4.5);
  const spine = wall(1, -4.5, 1, 4.5);
  const cross = wall(1, 0, 6, 0);
  wall(3.5, 0, 3.5, 4.5);

  open(south, 'door', 8.5, 0.9, 2.1, 0);
  open(south, 'window', 6.2, 1.8, 1.3, 0.9);
  open(south, 'window', 3.75, 0.6, 0.6, 1.5);
  open(south, 'window', 1.25, 1.2, 1.2, 0.9);
  open(north, 'window', 2.4, 1.2, 1.0, 1.1);
  open(north, 'window', 9.5, 1.6, 1.2, 0.9);
  open(east, 'window', 2.25, 1.6, 1.2, 0.9);
  open(west, 'window', 2.6, 2.4, 2.1, 0.1);
  open(west, 'window', 6.6, 1.2, 1.2, 0.9);
  open(spine, 'door', 3.4, 0.9, 2.1, 0);
  open(spine, 'door', 5.4, 0.8, 2.1, 0);
  open(cross, 'door', 3.75, 0.8, 2.1, 0);

  floor(-2.5, 0, 7, 9, 'wood');
  floor(3.5, -2.25, 5, 4.5, 'carpet');
  floor(2.25, 2.25, 2.5, 4.5, 'tile');
  floor(4.75, 2.25, 2.5, 4.5, 'wood');

  // Living area
  item('rug', -3.4, 2.1);
  item('sofa', -3.4, 3.6, 180);
  item('coffee-table', -3.4, 2.1);
  item('armchair', -5.2, 2.0, 90);
  item('tv-unit', -3.4, 0.35, 0);
  item('floor-lamp', -1.6, 3.9);
  item('plant', 0.5, 4.0);
  // Kitchen and dining
  item('fridge', -5.55, -4.05);
  item('counter', -4.6, -4.1);
  item('sink', -3.4, -4.1);
  item('stove', -2.5, -4.1);
  item('counter', -1.6, -4.1);
  item('dining-table', -2.6, -1.9);
  item('chair', -3.2, -2.7);
  item('chair', -2.0, -2.7);
  item('chair', -3.2, -1.1, 180);
  item('chair', -2.0, -1.1, 180);
  // Bedroom
  item('bed-double', 3.6, -3.35);
  item('nightstand', 2.45, -4.15);
  item('nightstand', 4.75, -4.15);
  item('wardrobe', 5.6, -1.4, -90);
  // Bathroom
  item('bathtub', 2.25, 4.0, 180);
  item('toilet', 3.1, 1.9, -90);
  item('washbasin', 1.35, 2.3, 90);
  // Study
  item('desk', 5.5, 2.4, -90);
  item('chair', 4.85, 2.4, 90);
  item('bookshelf', 4.75, 0.3);
  // Garden
  item('tree', -9.5, -6);
  item('tree', 9.5, -6.5);
  item('tree', -10, 5.5);
  item('bush', -7.2, 5.6);
  item('bush', 7.4, -3);
  item('car', 9, 4.5);
  item('bench', -8.5, 0, 90);
  return p;
}
