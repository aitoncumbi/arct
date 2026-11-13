// Turns project data (walls, openings, floors, items) into three.js objects.
import * as THREE from 'three';
import { buildFurniture, itemDef } from './furniture.js';

export const HIGHLIGHT = new THREE.Color('#1f6feb');

function highlight(obj) {
  obj.traverse((o) => {
    if (o.isMesh && o.material.emissive) {
      o.material.emissive.copy(HIGHLIGHT);
      o.material.emissiveIntensity = 0.55;
    }
  });
}

export const GROUNDS = {
  grass: { name: 'Grass', color: '#8fb573' },
  gravel: { name: 'Gravel', color: '#bdb6a8' },
  paving: { name: 'Paving', color: '#c9c7c1' },
  sand: { name: 'Sand', color: '#dccfa6' },
  soil: { name: 'Soil', color: '#9a7b5c' },
};

export const FLOOR_MATS = {
  wood: 'Timber boards',
  tile: 'Ceramic tile',
  carpet: 'Carpet',
  concrete: 'Polished concrete',
  marble: 'Marble',
};

const textures = {};
function floorTexture(mat) {
  if (textures[mat]) return textures[mat];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  if (mat === 'wood') {
    const tones = ['#c39a6b', '#b98f60', '#caa275', '#b28758', '#c09566'];
    for (let r = 0; r < 8; r++) {
      const off = rnd() * 180;
      for (let k = -1; k < 3; k++) {
        g.fillStyle = tones[Math.floor(rnd() * tones.length)];
        g.fillRect(off + k * 180, r * 32, 180, 32);
        g.fillStyle = 'rgba(70,45,20,.35)';
        g.fillRect(off + k * 180, r * 32, 1.5, 32);
      }
      g.fillStyle = 'rgba(70,45,20,.3)';
      g.fillRect(0, r * 32, 256, 1.5);
    }
  } else if (mat === 'tile') {
    g.fillStyle = '#e4e2dc'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#edebe6' : '#e7e5df';
      g.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
    }
    g.fillStyle = '#b9b6ad';
    for (let i = 0; i <= 2; i++) { g.fillRect(i * 128 - 2, 0, 4, 256); g.fillRect(0, i * 128 - 2, 256, 4); }
  } else {
    const base = { carpet: '#a9a39b', concrete: '#b9bbbd', marble: '#eceae6' }[mat] || '#cccccc';
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    const n = mat === 'marble' ? 0 : 5000;
    for (let i = 0; i < n; i++) {
      g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)';
      g.fillRect(rnd() * 256, rnd() * 256, 2, 2);
    }
    if (mat === 'marble') {
      g.strokeStyle = 'rgba(120,125,135,.35)';
      for (let i = 0; i < 9; i++) {
        g.lineWidth = 0.6 + rnd() * 1.6;
        g.beginPath();
        let x = rnd() * 256, y = 0;
        g.moveTo(x, y);
        while (y < 256) { x += (rnd() - 0.5) * 60; y += 20 + rnd() * 30; g.lineTo(x, y); }
        g.stroke();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  textures[mat] = t;
  return t;
}

export function buildFloor(floor, selected) {
  const map = floorTexture(floor.mat).clone();
  map.needsUpdate = true;
  // Textures are drawn at 1 m per repeat (2 m for the larger stone patterns).
  const scale = floor.mat === 'marble' || floor.mat === 'concrete' ? 0.5 : 1;
  map.repeat.set(floor.w * scale, floor.d * scale);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(floor.w, 0.04, floor.d),
    new THREE.MeshStandardMaterial({ map, roughness: floor.mat === 'carpet' ? 1 : 0.6 }),
  );
  mesh.position.set(floor.x, 0.02, floor.z);
  mesh.receiveShadow = true;
  mesh.userData.ref = { kind: 'floor', id: floor.id };
  mesh.userData.ownMap = true;
  if (selected) highlight(mesh);
  return mesh;
}

export function buildItem(item, selected) {
  const g = buildFurniture(item.type, item.color);
  g.position.set(item.x, 0, item.z);
  g.rotation.y = item.rot || 0;
  g.userData.ref = { kind: 'item', id: item.id };
  if (selected) highlight(g);
  return g;
}

const FRAME = '#fbfaf7';
const mat = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });

function box(g, m, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

function openingDetail(o, c, t) {
  const g = new THREE.Group();
  g.userData.ref = { kind: 'opening', id: o.id };
  const f = 0.05;
  const depth = t + 0.03;
  const frame = mat(FRAME);
  const y0 = o.sill, y1 = o.sill + o.h, cy = (y0 + y1) / 2;
  box(g, frame, f, o.h, depth, c - o.w / 2 + f / 2, cy, 0);
  box(g, frame, f, o.h, depth, c + o.w / 2 - f / 2, cy, 0);
  box(g, frame, o.w - 2 * f, f, depth, c, y1 - f / 2, 0);
  if (o.type === 'window') {
    box(g, frame, o.w - 2 * f, f, depth + 0.04, c, y0 + f / 2, 0);
    const glass = mat('#a9d6ea', { transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1 });
    const pane = box(g, glass, o.w - 2 * f, o.h - 2 * f, 0.02, c, cy, 0);
    pane.castShadow = false;
    const bars = Math.max(0, Math.round(o.w / 0.9) - 1);
    for (let i = 1; i <= bars; i++) {
      box(g, frame, 0.035, o.h - 2 * f, 0.04, c - o.w / 2 + (o.w * i) / (bars + 1), cy, 0);
    }
    if (o.h > 1.6) box(g, frame, o.w - 2 * f, 0.035, 0.04, c, y0 + o.h * 0.62, 0);
  } else if (o.style !== 'open') {
    const leaf = mat('#8d6844');
    const n = o.style === 'double' ? 2 : 1;
    const lw = (o.w - 2 * f) / n;
    for (let i = 0; i < n; i++) {
      const lx = c - o.w / 2 + f + lw * (i + 0.5);
      box(g, leaf, lw - 0.012, o.h - f - 0.01, 0.045, lx, y0 + (o.h - f) / 2, 0);
      const side = n === 2 ? (i ? -1 : 1) : 1;
      box(g, mat('#2b2d33', { metalness: 0.5 }), 0.03, 0.14, 0.11, lx + side * (lw / 2 - 0.09), y0 + 1.0, 0);
    }
  }
  return g;
}

/** Openings that actually fit on the wall, clamped and sorted along it. */
export function fitOpenings(wall, openings) {
  const L = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
  const out = [];
  let cursor = 0;
  for (const o of [...openings].sort((p, q) => p.pos - q.pos)) {
    if (o.w > L - 0.1) continue;
    const c = Math.min(Math.max(o.pos, o.w / 2 + 0.05), L - o.w / 2 - 0.05);
    if (c - o.w / 2 < cursor - 1e-6) continue;
    out.push({ o, c });
    cursor = c + o.w / 2;
  }
  return out;
}

export function buildWall(wall, openings, { maxH = Infinity, selected = false, selectedOpening = null } = {}) {
  const dx = wall.b.x - wall.a.x, dz = wall.b.z - wall.a.z;
  const L = Math.hypot(dx, dz);
  const g = new THREE.Group();
  g.position.set(wall.a.x, 0, wall.a.z);
  g.rotation.y = -Math.atan2(dz, dx);
  const ref = { kind: 'wall', id: wall.id };
  const H = Math.min(wall.h, maxH);
  const t = wall.t;
  const m = new THREE.MeshStandardMaterial({ color: wall.color, roughness: 0.92 });
  if (selected) { m.emissive.copy(HIGHLIGHT); m.emissiveIntensity = 0.45; }

  const piece = (x0, x1, y0, y1) => {
    if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4) return;
    box(g, m, x1 - x0, y1 - y0, t, (x0 + x1) / 2, (y0 + y1) / 2, 0).userData.ref = ref;
  };

  // Wall ends run half a thickness past each endpoint so corners close up.
  let cursor = -t / 2;
  for (const { o, c } of fitOpenings(wall, openings)) {
    const x0 = c - o.w / 2, x1 = c + o.w / 2;
    const top = Math.min(o.sill + o.h, wall.h);
    piece(cursor, x0, 0, H);
    piece(x0, x1, 0, Math.min(o.sill, H));
    piece(x0, x1, Math.min(top, H), H);
    if (top <= H + 1e-6) {
      const detail = openingDetail({ ...o, h: top - o.sill }, c, t);
      if (selectedOpening === o.id) highlight(detail);
      g.add(detail);
    }
    cursor = x1;
  }
  piece(cursor, L + t / 2, 0, H);
  return g;
}

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (!o.isMesh && !o.isLine) return;
    o.geometry.dispose();
    if (o.userData.ownMap) o.material.map?.dispose();
    o.material.dispose();
  });
}

export { itemDef };
