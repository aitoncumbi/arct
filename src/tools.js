// Pointer tools: select/move, wall, room, floor, door, window and furniture placement.
import * as THREE from 'three';
import { uid, wallLength } from './state.js';
import { buildItem, disposeTree, fitOpenings } from './build.js';

const GRID = 0.25;
const snapTo = (v, step) => Math.round(v / step) * step;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const fmt = (m) => `${m.toFixed(2)} m`;

export const OPENING_PRESETS = {
  door: [
    { id: 'single', name: 'Single door', style: 'single', w: 0.9, h: 2.1, sill: 0 },
    { id: 'double', name: 'Double door', style: 'double', w: 1.6, h: 2.1, sill: 0 },
    { id: 'open', name: 'Open passage', style: 'open', w: 1.2, h: 2.2, sill: 0 },
  ],
  window: [
    { id: 'standard', name: 'Standard', style: 'window', w: 1.2, h: 1.2, sill: 0.9 },
    { id: 'wide', name: 'Wide', style: 'window', w: 2.0, h: 1.3, sill: 0.9 },
    { id: 'tall', name: 'Floor to ceiling', style: 'window', w: 1.8, h: 2.2, sill: 0.1 },
    { id: 'small', name: 'High slot', style: 'window', w: 0.6, h: 0.6, sill: 1.5 },
  ],
};

export const HINTS = {
  select: 'Click to select. Drag furniture, doors and windows to move them; drag a wall’s end handles to reshape it.',
  wall: 'Click to start a wall, click again to place each corner. Double-click or press Esc to finish.',
  room: 'Click one corner of the room, then the opposite corner. Walls and a floor are added together.',
  floor: 'Click one corner of the floor, then the opposite corner.',
  door: 'Hover a wall and click to cut a door into it.',
  window: 'Hover a wall and click to cut a window into it.',
  furniture: 'Pick a piece, then click the plot to place it. R rotates it.',
};

export class Tools {
  constructor(app) {
    this.app = app;
    this.tool = 'select';
    this.opt = {};
    this.chain = null;
    this.rect = null;
    this.rot = 0;
    this.ghost = null;
    this.pointers = new Set();
    this.press = null;
    this.drag = null;
    this.last = null;

    const c = app.view.canvas;
    c.addEventListener('pointerdown', (e) => this.down(e), true);
    c.addEventListener('pointermove', (e) => this.move(e), true);
    c.addEventListener('pointerup', (e) => this.up(e), true);
    c.addEventListener('pointercancel', (e) => this.up(e, true), true);
    c.addEventListener('pointerleave', () => { if (!this.drag && !this.chain && !this.rect) this.clearPreview(); });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get store() { return this.app.store; }
  get view() { return this.app.view; }
  get project() { return this.store.project; }

  set(tool, opt = {}) {
    this.reset();
    this.tool = tool;
    this.opt = opt;
    if (tool !== 'select') this.store.select(null);
    this.view.canvas.dataset.tool = tool;
    this.app.onToolChange();
  }

  reset() {
    this.chain = null;
    this.rect = null;
    this.clearPreview();
    if (this.ghost) { this.view.overlay.remove(this.ghost); disposeTree(this.ghost); this.ghost = null; }
  }

  /** Esc: back out one level at a time. */
  cancel() {
    if (this.chain || this.rect) { this.reset(); this.app.onToolChange(); }
    else if (this.tool !== 'select') this.set('select');
    else this.store.select(null);
  }

  busy() { return !!(this.chain || this.rect); }

  // ---------- geometry helpers ----------

  snap(p, { grid = GRID, ends = true, skip = null } = {}) {
    const { w, d } = this.project.plot;
    let x = snapTo(p.x, grid), z = snapTo(p.z, grid);
    if (ends) {
      let best = 0.3;
      for (const wall of this.project.walls) {
        for (const key of ['a', 'b']) {
          if (skip && skip.some((s) => s.wall === wall && s.end === key)) continue;
          const dist = Math.hypot(wall[key].x - p.x, wall[key].z - p.z);
          if (dist < best) { best = dist; x = wall[key].x; z = wall[key].z; }
        }
      }
    }
    return { x: clamp(x, -w / 2, w / 2), z: clamp(z, -d / 2, d / 2) };
  }

  refOf(obj) {
    for (let o = obj; o; o = o.parent) if (o.userData.ref) return o.userData.ref;
    return null;
  }

  pick(e) {
    const handles = this.view.content.children.filter((o) => o.userData.ref?.kind === 'handle');
    const h = this.view.raycast(e.clientX, e.clientY, handles)[0];
    if (h) return { ref: h.object.userData.ref, point: h.point, object: h.object };
    for (const hit of this.view.raycast(e.clientX, e.clientY, this.view.content.children)) {
      const ref = this.refOf(hit.object);
      if (ref && ref.kind !== 'handle') return { ref, point: hit.point };
    }
    return null;
  }

  wallFrame(wall) {
    const L = wallLength(wall) || 1;
    return { L, dir: { x: (wall.b.x - wall.a.x) / L, z: (wall.b.z - wall.a.z) / L } };
  }

  openingFits(wall, o, pos, ignoreId) {
    const { L } = this.wallFrame(wall);
    if (o.w > L - 0.1 || o.sill + o.h > wall.h + 1e-6) return false;
    return !this.project.openings.some((q) => q.wall === wall.id && q.id !== ignoreId
      && Math.abs(q.pos - pos) < (q.w + o.w) / 2 + 0.05);
  }

  clampPos(wall, w, pos) {
    const { L } = this.wallFrame(wall);
    return clamp(snapTo(pos, 0.05), w / 2 + 0.05, Math.max(w / 2 + 0.05, L - w / 2 - 0.05));
  }

  // ---------- preview drawing ----------

  clearPreview() {
    const keep = this.ghost;
    for (const o of [...this.view.overlay.children]) {
      if (o === keep) continue;
      disposeTree(o);
      this.view.overlay.remove(o);
    }
    if (keep) keep.visible = false;
    this.view.setLabels('tool', []);
  }

  previewBox(w, h, d, color, opacity = 0.45) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    );
    this.view.overlay.add(m);
    return m;
  }

  previewWall(a, b, color = '#1f6feb') {
    const s = this.project.settings;
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L < 0.01) return;
    const m = this.previewBox(L + s.wallT, s.wallH, s.wallT, color);
    m.position.set((a.x + b.x) / 2, s.wallH / 2, (a.z + b.z) / 2);
    m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
  }

  marker(p) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.17, 24),
      new THREE.MeshBasicMaterial({ color: '#1f6feb', depthTest: false, transparent: true }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, 0.03, p.z);
    m.renderOrder = 10;
    this.view.overlay.add(m);
  }

  // ---------- pointer events ----------

  down(e) {
    this.pointers.add(e.pointerId);
    if (this.pointers.size > 1 || (e.pointerType === 'mouse' && e.button !== 0)) {
      this.press = null;
      return;
    }
    this.press = { x: e.clientX, y: e.clientY, moved: false };
    if (this.tool !== 'select') return;
    const hit = this.pick(e);
    if (!hit || !['item', 'opening', 'handle'].includes(hit.ref.kind)) return;
    if (hit.ref.kind !== 'handle') this.store.select(hit.ref);
    this.beginDrag(hit, e);
  }

  beginDrag(hit, e) {
    const p = this.project;
    const ref = hit.ref;
    const drag = { ref, changed: false, controls: this.view.controls };
    if (ref.kind === 'item') {
      const item = p.items.find((i) => i.id === ref.id);
      const g = this.view.groundPoint(e.clientX, e.clientY);
      if (!item || !g) return;
      drag.offset = { x: item.x - g.x, z: item.z - g.z };
    } else if (ref.kind === 'handle') {
      const wall = p.walls.find((w) => w.id === ref.wall);
      if (!wall) return;
      const pt = wall[ref.end];
      drag.height = hit.object.position.y;
      // Corners move together: grab every wall end sitting on this point.
      drag.ends = [];
      for (const w of p.walls) for (const end of ['a', 'b']) {
        if (Math.hypot(w[end].x - pt.x, w[end].z - pt.z) < 0.01) drag.ends.push({ wall: w, end });
      }
    }
    drag.controls.enabled = false;
    this.view.canvas.setPointerCapture?.(e.pointerId);
    this.drag = drag;
  }

  move(e) {
    this.last = e;
    if (this.press && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 6) this.press.moved = true;
    if (this.drag) {
      if (this.press?.moved) this.dragMove(e);
      return;
    }
    if (this.pointers.size > 1) return;
    this.hover(e);
  }

  up(e, cancelled) {
    this.pointers.delete(e.pointerId);
    const press = this.press;
    this.press = null;
    if (this.drag) {
      const drag = this.drag;
      this.drag = null;
      drag.controls.enabled = true;
      if (drag.changed) this.store.commit();
      return;
    }
    if (!press || press.moved || cancelled) return;
    this.click(e);
  }

  dragMove(e) {
    const { drag } = this;
    const p = this.project;
    const ref = drag.ref;
    if (ref.kind === 'item') {
      const g = this.view.groundPoint(e.clientX, e.clientY);
      const item = p.items.find((i) => i.id === ref.id);
      if (!g || !item) return;
      const s = this.snap({ x: g.x + drag.offset.x, z: g.z + drag.offset.z }, { grid: 0.05, ends: false });
      item.x = s.x; item.z = s.z;
    } else if (ref.kind === 'handle') {
      const g = this.view.groundPoint(e.clientX, e.clientY, drag.height);
      if (!g) return;
      const s = this.snap(g, { skip: drag.ends });
      // Refuse a move that would collapse a wall to nothing.
      const collapses = drag.ends.some(({ wall, end }) => {
        const other = wall[end === 'a' ? 'b' : 'a'];
        const fixed = !drag.ends.some((d) => d.wall === wall && d.end !== end);
        return fixed && Math.hypot(other.x - s.x, other.z - s.z) < 0.2;
      });
      if (collapses) return;
      for (const { wall, end } of drag.ends) wall[end] = { x: s.x, z: s.z };
    } else if (ref.kind === 'opening') {
      const o = p.openings.find((q) => q.id === ref.id);
      const wall = o && p.walls.find((w) => w.id === o.wall);
      if (!wall) return;
      const pos = this.posOnWall(wall, e);
      if (pos === null) return;
      const c = this.clampPos(wall, o.w, pos);
      if (!this.openingFits(wall, o, c, o.id)) return;
      o.pos = c;
    }
    drag.changed = true;
    this.store.touch();
  }

  /** Distance along a wall under the pointer, using the wall's own vertical plane. */
  posOnWall(wall, e) {
    const { dir } = this.wallFrame(wall);
    const ray = this.view.setRay(e.clientX, e.clientY);
    const normal = new THREE.Vector3(-dir.z, 0, dir.x);
    let pt = null;
    if (Math.abs(ray.direction.dot(normal)) > 0.12) {
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(wall.a.x, 0, wall.a.z));
      pt = ray.intersectPlane(plane, new THREE.Vector3());
    }
    pt = pt || this.view.groundPoint(e.clientX, e.clientY);
    return pt ? (pt.x - wall.a.x) * dir.x + (pt.z - wall.a.z) * dir.z : null;
  }

  openingTarget(e) {
    for (const hit of this.view.raycast(e.clientX, e.clientY, this.view.content.children)) {
      const ref = this.refOf(hit.object);
      if (!ref) continue;
      let wallId = null;
      if (ref.kind === 'wall') wallId = ref.id;
      else if (ref.kind === 'opening') wallId = this.project.openings.find((o) => o.id === ref.id)?.wall;
      else continue;
      const wall = this.project.walls.find((w) => w.id === wallId);
      if (!wall) return null;
      const { dir } = this.wallFrame(wall);
      const spec = this.opt.preset;
      const pos = this.clampPos(wall, spec.w, (hit.point.x - wall.a.x) * dir.x + (hit.point.z - wall.a.z) * dir.z);
      return { wall, pos, ok: this.openingFits(wall, spec, pos) };
    }
    return null;
  }

  hover(e) {
    const t = this.tool;
    if (t === 'select') return;
    this.clearPreview();
    if (t === 'door' || t === 'window') {
      const target = this.openingTarget(e);
      if (!target) return;
      const { wall, pos, ok } = target;
      const spec = this.opt.preset;
      const { dir } = this.wallFrame(wall);
      const m = this.previewBox(spec.w, spec.h, wall.t + 0.12, ok ? '#1f9d55' : '#d1242f', 0.6);
      m.position.set(wall.a.x + dir.x * pos, spec.sill + spec.h / 2, wall.a.z + dir.z * pos);
      m.rotation.y = -Math.atan2(dir.z, dir.x);
      this.view.setLabels('tool', [{
        x: m.position.x, y: spec.sill + spec.h + 0.3, z: m.position.z, kind: 'live',
        text: ok ? `${spec.w.toFixed(2)} × ${spec.h.toFixed(2)} m` : 'Does not fit here',
      }]);
      return;
    }
    const g = this.view.groundPoint(e.clientX, e.clientY);
    if (!g) return;
    if (t === 'furniture') {
      if (!this.opt.type) return;
      const s = this.snap(g, { grid: 0.05, ends: false });
      if (!this.ghost) {
        this.ghost = buildItem({ id: 'ghost', type: this.opt.type, x: 0, z: 0, rot: 0 });
        this.ghost.traverse((o) => {
          if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0.6; o.castShadow = false; }
        });
        this.view.overlay.add(this.ghost);
      }
      this.ghost.visible = true;
      this.ghost.position.set(s.x, 0, s.z);
      this.ghost.rotation.y = this.rot;
      return;
    }
    const s = this.snap(g, { ends: t === 'wall' });
    this.marker(s);
    if (t === 'wall' && this.chain) {
      this.previewWall(this.chain, s);
      const L = Math.hypot(s.x - this.chain.x, s.z - this.chain.z);
      if (L > 0.01) {
        this.view.setLabels('tool', [{ x: (s.x + this.chain.x) / 2, y: this.project.settings.wallH + 0.35, z: (s.z + this.chain.z) / 2, text: fmt(L), kind: 'live' }]);
      }
    } else if ((t === 'room' || t === 'floor') && this.rect) {
      const a = this.rect;
      const w = Math.abs(s.x - a.x), d = Math.abs(s.z - a.z);
      if (w < 0.01 || d < 0.01) return;
      const slab = this.previewBox(w, 0.05, d, '#1f6feb', 0.3);
      slab.position.set((a.x + s.x) / 2, 0.05, (a.z + s.z) / 2);
      if (t === 'room') {
        this.previewWall(a, { x: s.x, z: a.z }); this.previewWall({ x: s.x, z: a.z }, s);
        this.previewWall(s, { x: a.x, z: s.z }); this.previewWall({ x: a.x, z: s.z }, a);
      }
      this.view.setLabels('tool', [{
        x: (a.x + s.x) / 2, y: t === 'room' ? this.project.settings.wallH + 0.35 : 0.3, z: (a.z + s.z) / 2, kind: 'live',
        text: `${w.toFixed(2)} × ${d.toFixed(2)} m · ${(w * d).toFixed(1)} m²`,
      }]);
    }
  }

  click(e) {
    const t = this.tool;
    const p = this.project;
    if (t === 'select') {
      const hit = this.pick(e);
      this.store.select(hit && hit.ref.kind !== 'handle' ? hit.ref : null);
      return;
    }
    if (t === 'door' || t === 'window') {
      const target = this.openingTarget(e);
      if (!target || !target.ok) return;
      const spec = this.opt.preset;
      p.openings.push({ id: uid(), wall: target.wall.id, type: t, style: spec.style, pos: target.pos, w: spec.w, h: spec.h, sill: spec.sill });
      this.clearPreview();
      this.store.commit();
      return;
    }
    const g = this.view.groundPoint(e.clientX, e.clientY);
    if (!g) return;
    if (t === 'furniture') {
      if (!this.opt.type) return;
      const s = this.snap(g, { grid: 0.05, ends: false });
      p.items.push({ id: uid(), type: this.opt.type, x: s.x, z: s.z, rot: this.rot });
      this.store.commit();
      return;
    }
    const s = this.snap(g, { ends: t === 'wall' });
    if (t === 'wall') {
      if (!this.chain) {
        this.chain = s;
      } else if (Math.hypot(s.x - this.chain.x, s.z - this.chain.z) < 0.1) {
        this.chain = null;
      } else {
        p.walls.push(this.newWall(this.chain, s));
        this.chain = s;
        this.store.commit();
      }
    } else {
      if (!this.rect) {
        this.rect = s;
      } else {
        const a = this.rect;
        const w = Math.abs(s.x - a.x), d = Math.abs(s.z - a.z);
        if (w < GRID || d < GRID) return;
        if (t === 'room') {
          const c = [a, { x: s.x, z: a.z }, s, { x: a.x, z: s.z }];
          for (let i = 0; i < 4; i++) p.walls.push(this.newWall(c[i], c[(i + 1) % 4]));
        }
        p.floors.push({ id: uid(), x: (a.x + s.x) / 2, z: (a.z + s.z) / 2, w, d, mat: this.opt.mat || 'wood' });
        this.rect = null;
        this.store.commit();
      }
    }
    this.clearPreview();
    if (e.pointerType === 'mouse') this.hover(e);
    else if (this.chain || this.rect) this.marker(this.chain || this.rect);
    this.app.onToolChange();
  }

  newWall(a, b) {
    const s = this.project.settings;
    return { id: uid(), a: { x: a.x, z: a.z }, b: { x: b.x, z: b.z }, h: s.wallH, t: s.wallT, color: s.wallColor };
  }

  rotate(step = Math.PI / 4) {
    if (this.tool === 'furniture') {
      this.rot = (this.rot + step) % (Math.PI * 2);
      if (this.ghost) this.ghost.rotation.y = this.rot;
      return;
    }
    const item = this.store.selection?.kind === 'item' && this.store.selected();
    if (item) {
      item.rot = ((item.rot || 0) + step) % (Math.PI * 2);
      this.store.commit();
    }
  }
}

export { fitOpenings };
