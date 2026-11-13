// Furniture catalogue. Every piece is built from primitives, sits on y = 0,
// is centred on its footprint and faces +z.
import * as THREE from 'three';

const M = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

function B(g, m, w, h, d, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z);
  g.add(mesh);
  return mesh;
}
function C(g, m, r, h, x = 0, y = 0, z = 0, rTop = r) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, 24), m);
  mesh.position.set(x, y + h / 2, z);
  g.add(mesh);
  return mesh;
}
function S(g, m, r, x, y, z, sy = 1) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m);
  mesh.position.set(x, y, z);
  mesh.scale.y = sy;
  g.add(mesh);
  return mesh;
}
function legs(g, m, w, d, h, s = 0.05, inset = 0.04) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B(g, m, s, h, s, sx * (w / 2 - inset - s / 2), 0, sz * (d / 2 - inset - s / 2));
  }
}
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const tint = (hex, k) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), k).getHexString();

const WOOD = '#a57848';
const DARK = '#2b2d33';
const WHITE = '#f4f4f1';
const STEEL = '#b9bec4';

function seat(g, c, w) {
  const f = M(c);
  const cushion = M(tint(c, 0.18));
  B(g, f, w, 0.3, 0.9, 0, 0.08, 0);
  B(g, f, w, 0.5, 0.2, 0, 0.38, -0.35);
  B(g, f, 0.18, 0.3, 0.9, -(w / 2 - 0.09), 0.38, 0);
  B(g, f, 0.18, 0.3, 0.9, w / 2 - 0.09, 0.38, 0);
  const inner = w - 0.4;
  const n = w > 1.2 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const cw = inner / n - 0.03;
    B(g, cushion, cw, 0.12, 0.62, -inner / 2 + (i + 0.5) * (inner / n), 0.38, 0.1);
  }
  legs(g, M(DARK), w, 0.9, 0.08, 0.06);
}

function bed(g, c, w) {
  const wood = M(WOOD);
  B(g, wood, w, 0.28, 2.0);
  B(g, wood, w, 0.95, 0.07, 0, 0, -0.985);
  B(g, M(WHITE), w - 0.06, 0.2, 1.9, 0, 0.28, 0.02);
  B(g, M(c), w - 0.02, 0.07, 1.25, 0, 0.47, 0.36);
  const n = w > 1.2 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    B(g, M('#ffffff'), 0.6, 0.1, 0.38, n === 2 ? (i ? 0.36 : -0.36) : 0, 0.48, -0.66);
  }
}

function counter(g, c, w) {
  B(g, M(c), w, 0.86, 0.58, 0, 0, -0.01);
  B(g, M('#3a3d44', { roughness: 0.4 }), w + 0.02, 0.04, 0.62, 0, 0.86, 0);
  B(g, M(shade(c, 0.6)), w, 0.08, 0.52, 0, 0, -0.04);
  const n = Math.max(1, Math.round(w / 0.6));
  for (let i = 0; i < n; i++) {
    B(g, M(STEEL), 0.14, 0.02, 0.02, -w / 2 + (i + 0.5) * (w / n), 0.74, 0.29);
  }
}

export const CATEGORIES = ['Living', 'Bedroom', 'Kitchen', 'Bathroom', 'Outdoor'];

export const CATALOG = [
  { id: 'sofa', name: 'Sofa', cat: 'Living', color: '#6f8196', build: (g, c) => seat(g, c, 2.1) },
  { id: 'armchair', name: 'Armchair', cat: 'Living', color: '#b8785a', build: (g, c) => seat(g, c, 0.95) },
  {
    id: 'coffee-table', name: 'Coffee table', cat: 'Living', color: WOOD,
    build: (g, c) => { B(g, M(c), 1.1, 0.05, 0.6, 0, 0.36, 0); legs(g, M(DARK), 1.1, 0.6, 0.36); },
  },
  {
    id: 'tv-unit', name: 'TV unit', cat: 'Living', color: '#8a6a48',
    build: (g, c) => {
      B(g, M(c), 1.7, 0.42, 0.4, 0, 0.06, 0);
      legs(g, M(DARK), 1.7, 0.4, 0.06);
      B(g, M(DARK), 0.4, 0.03, 0.2, 0, 0.48, 0);
      B(g, M('#111317', { roughness: 0.25 }), 1.25, 0.72, 0.04, 0, 0.54, 0);
    },
  },
  {
    id: 'bookshelf', name: 'Bookshelf', cat: 'Living', color: '#9b7651',
    build: (g, c) => {
      const m = M(c);
      B(g, m, 0.03, 2.0, 0.32, -0.485, 0, 0); B(g, m, 0.03, 2.0, 0.32, 0.485, 0, 0);
      B(g, m, 1.0, 2.0, 0.02, 0, 0, -0.15);
      const spines = ['#b5533c', '#3f6c8f', '#d9b44a', '#4f7d5c', '#7a5a8c', '#c9c4b8'];
      for (let s = 0; s < 6; s++) {
        const y = s * 0.394;
        B(g, m, 0.94, 0.03, 0.3, 0, y, 0);
        if (s === 5) break;
        let x = -0.44;
        for (let k = 0; x < 0.3; k++) {
          const bw = 0.04 + ((s * 7 + k * 3) % 4) * 0.012;
          const bh = 0.22 + ((s * 5 + k * 11) % 5) * 0.022;
          B(g, M(spines[(s * 2 + k) % spines.length]), bw, bh, 0.2, x + bw / 2, y + 0.03, 0.02);
          x += bw + 0.004;
        }
      }
    },
  },
  {
    id: 'rug', name: 'Rug', cat: 'Living', color: '#c9b89a', flat: true,
    build: (g, c) => { B(g, M(c), 2.6, 0.012, 1.7, 0, 0.03, 0); B(g, M(tint(c, 0.35)), 2.3, 0.014, 1.4, 0, 0.03, 0); },
  },
  {
    id: 'floor-lamp', name: 'Floor lamp', cat: 'Living', color: '#f3e3b8',
    build: (g, c) => {
      C(g, M(DARK), 0.15, 0.03); C(g, M(DARK), 0.015, 1.45, 0, 0.03, 0);
      C(g, M(c, { emissive: c, emissiveIntensity: 0.45 }), 0.2, 0.28, 0, 1.4, 0, 0.13);
    },
  },
  {
    id: 'plant', name: 'Potted plant', cat: 'Living', color: '#4f8a52',
    build: (g, c) => {
      C(g, M('#b96f4d'), 0.15, 0.3, 0, 0, 0, 0.2);
      S(g, M(c), 0.3, 0, 0.62, 0, 1.2); S(g, M(shade(c, 0.85)), 0.2, 0.14, 0.9, 0.05); S(g, M(tint(c, 0.12)), 0.18, -0.13, 0.86, -0.06);
    },
  },

  { id: 'bed-double', name: 'Double bed', cat: 'Bedroom', color: '#7d93a8', build: (g, c) => bed(g, c, 1.7) },
  { id: 'bed-single', name: 'Single bed', cat: 'Bedroom', color: '#a8b98f', build: (g, c) => bed(g, c, 0.95) },
  {
    id: 'nightstand', name: 'Nightstand', cat: 'Bedroom', color: WOOD,
    build: (g, c) => { B(g, M(c), 0.45, 0.48, 0.4); B(g, M(shade(c, 0.8)), 0.38, 0.16, 0.01, 0, 0.26, 0.2); B(g, M(DARK), 0.1, 0.02, 0.02, 0, 0.33, 0.21); },
  },
  {
    id: 'wardrobe', name: 'Wardrobe', cat: 'Bedroom', color: '#e6e0d4',
    build: (g, c) => {
      B(g, M(c), 1.8, 2.1, 0.6);
      for (const x of [-0.3, 0.3]) B(g, M(shade(c, 0.7)), 0.012, 2.0, 0.01, x, 0.05, 0.3);
      for (const x of [-0.36, -0.24, 0.36]) B(g, M(DARK), 0.02, 0.22, 0.03, x, 0.95, 0.31);
    },
  },
  {
    id: 'desk', name: 'Desk', cat: 'Bedroom', color: '#b08a5e',
    build: (g, c) => {
      B(g, M(c), 1.4, 0.04, 0.7, 0, 0.71, 0); legs(g, M(DARK), 1.4, 0.7, 0.71);
      B(g, M(DARK), 0.22, 0.02, 0.16, 0, 0.75, -0.18); B(g, M(DARK), 0.03, 0.14, 0.03, 0, 0.77, -0.18);
      B(g, M('#15171b', { roughness: 0.3 }), 0.62, 0.36, 0.025, 0, 0.88, -0.17);
    },
  },
  {
    id: 'chair', name: 'Chair', cat: 'Bedroom', color: '#c7a276',
    build: (g, c) => { B(g, M(c), 0.44, 0.05, 0.44, 0, 0.42, 0); legs(g, M(shade(c, 0.75)), 0.44, 0.44, 0.42, 0.04, 0.01); B(g, M(c), 0.44, 0.42, 0.04, 0, 0.5, -0.2); },
  },

  { id: 'counter', name: 'Base cabinet', cat: 'Kitchen', color: '#eeeae2', build: (g, c) => counter(g, c, 1.2) },
  {
    id: 'sink', name: 'Sink cabinet', cat: 'Kitchen', color: '#eeeae2',
    build: (g, c) => {
      counter(g, c, 1.2);
      B(g, M(STEEL, { roughness: 0.3, metalness: 0.6 }), 0.55, 0.012, 0.4, 0, 0.9, 0.02);
      B(g, M('#7d848c'), 0.47, 0.014, 0.32, 0, 0.9, 0.02);
      C(g, M(STEEL, { metalness: 0.7, roughness: 0.3 }), 0.015, 0.22, 0, 0.9, -0.22);
      B(g, M(STEEL, { metalness: 0.7, roughness: 0.3 }), 0.025, 0.02, 0.16, 0, 1.11, -0.15);
    },
  },
  {
    id: 'stove', name: 'Cooker', cat: 'Kitchen', color: '#c9cdd2',
    build: (g, c) => {
      B(g, M(c, { roughness: 0.4, metalness: 0.4 }), 0.6, 0.9, 0.6);
      B(g, M('#16181c', { roughness: 0.2 }), 0.58, 0.012, 0.56, 0, 0.9, 0);
      for (const x of [-0.14, 0.14]) for (const z of [-0.13, 0.14]) C(g, M('#3d4047'), 0.085, 0.01, x, 0.912, z);
      B(g, M('#16181c', { roughness: 0.2 }), 0.48, 0.42, 0.012, 0, 0.2, 0.3);
      B(g, M(STEEL), 0.44, 0.025, 0.03, 0, 0.7, 0.31);
    },
  },
  {
    id: 'fridge', name: 'Fridge', cat: 'Kitchen', color: '#d4d8dc',
    build: (g, c) => {
      B(g, M(c, { roughness: 0.35, metalness: 0.5 }), 0.7, 1.85, 0.68);
      B(g, M(shade(c, 0.6)), 0.7, 0.012, 0.01, 0, 0.72, 0.34);
      B(g, M(DARK), 0.025, 0.5, 0.03, -0.27, 0.95, 0.355); B(g, M(DARK), 0.025, 0.3, 0.03, -0.27, 0.3, 0.355);
    },
  },
  {
    id: 'dining-table', name: 'Dining table', cat: 'Kitchen', color: '#a9825a',
    build: (g, c) => { B(g, M(c), 1.8, 0.05, 0.9, 0, 0.7, 0); legs(g, M(shade(c, 0.8)), 1.8, 0.9, 0.7, 0.07); },
  },
  {
    id: 'round-table', name: 'Round table', cat: 'Kitchen', color: '#eeeae2',
    build: (g, c) => { C(g, M(c), 0.55, 0.04, 0, 0.71, 0); C(g, M(DARK), 0.04, 0.69, 0, 0.02, 0); C(g, M(DARK), 0.28, 0.02); },
  },
  {
    id: 'island', name: 'Kitchen island', cat: 'Kitchen', color: '#5d6b63',
    build: (g, c) => { B(g, M(c), 1.9, 0.86, 0.85); B(g, M('#e9e6df', { roughness: 0.35 }), 2.05, 0.05, 1.0, 0, 0.86, 0); },
  },

  {
    id: 'toilet', name: 'Toilet', cat: 'Bathroom', color: WHITE,
    build: (g, c) => {
      const m = M(c, { roughness: 0.3 });
      C(g, m, 0.15, 0.4, 0, 0, 0.08, 0.2); C(g, m, 0.21, 0.03, 0, 0.4, 0.08);
      B(g, m, 0.4, 0.38, 0.18, 0, 0.36, -0.24); B(g, m, 0.3, 0.36, 0.2, 0, 0, -0.2);
    },
  },
  {
    id: 'bathtub', name: 'Bathtub', cat: 'Bathroom', color: WHITE,
    build: (g, c) => {
      B(g, M(c, { roughness: 0.3 }), 1.7, 0.56, 0.75);
      B(g, M('#bfe0ee', { roughness: 0.15 }), 1.52, 0.012, 0.57, 0, 0.555, 0);
      C(g, M(STEEL, { metalness: 0.7, roughness: 0.3 }), 0.018, 0.18, -0.74, 0.56, 0);
    },
  },
  {
    id: 'washbasin', name: 'Vanity basin', cat: 'Bathroom', color: '#8c7458',
    build: (g, c) => {
      B(g, M(c), 0.7, 0.78, 0.45, 0, 0.04, 0);
      B(g, M(WHITE, { roughness: 0.3 }), 0.74, 0.08, 0.48, 0, 0.82, 0);
      B(g, M('#cfd6da'), 0.44, 0.012, 0.28, 0, 0.895, 0.03);
      C(g, M(STEEL, { metalness: 0.7, roughness: 0.3 }), 0.014, 0.16, 0, 0.9, -0.17);
    },
  },
  {
    id: 'shower', name: 'Shower', cat: 'Bathroom', color: WHITE,
    build: (g, c) => {
      B(g, M(c, { roughness: 0.3 }), 0.9, 0.07, 0.9);
      const glass = M('#bfe0ee', { transparent: true, opacity: 0.3, roughness: 0.1 });
      B(g, glass, 0.9, 1.9, 0.02, 0, 0.07, 0.44); B(g, glass, 0.02, 1.9, 0.9, 0.44, 0.07, 0);
      C(g, M(STEEL, { metalness: 0.7, roughness: 0.3 }), 0.012, 2.0, -0.38, 0.07, -0.38);
      C(g, M(STEEL, { metalness: 0.7, roughness: 0.3 }), 0.1, 0.02, -0.26, 2.0, -0.26);
    },
  },

  {
    id: 'tree', name: 'Tree', cat: 'Outdoor', color: '#4f8a52',
    build: (g, c) => {
      C(g, M('#75553a'), 0.16, 1.9, 0, 0, 0, 0.1);
      S(g, M(c), 1.15, 0, 2.7, 0); S(g, M(shade(c, 0.88)), 0.8, 0.65, 2.2, 0.3); S(g, M(tint(c, 0.1)), 0.75, -0.6, 2.35, -0.25); S(g, M(c), 0.7, 0.1, 3.5, -0.1);
    },
  },
  {
    id: 'bush', name: 'Shrub', cat: 'Outdoor', color: '#5c9357',
    build: (g, c) => { S(g, M(c), 0.55, 0, 0.36, 0, 0.75); S(g, M(shade(c, 0.88)), 0.4, 0.42, 0.28, 0.1, 0.75); S(g, M(tint(c, 0.1)), 0.36, -0.4, 0.26, -0.08, 0.75); },
  },
  {
    id: 'car', name: 'Car', cat: 'Outdoor', color: '#a9342f',
    build: (g, c) => {
      const body = M(c, { roughness: 0.35, metalness: 0.3 });
      B(g, body, 1.8, 0.55, 4.3, 0, 0.28, 0);
      B(g, M('#1c2026', { roughness: 0.2 }), 1.6, 0.5, 2.1, 0, 0.83, -0.25);
      B(g, body, 1.62, 0.04, 1.9, 0, 1.33, -0.25);
      const tyre = M('#17181b');
      for (const x of [-0.86, 0.86]) for (const z of [-1.35, 1.35]) {
        const w = C(g, tyre, 0.33, 0.22, x, 0, z);
        w.rotation.z = Math.PI / 2; w.position.y = 0.33;
      }
      B(g, M('#fff4c9', { emissive: '#fff4c9', emissiveIntensity: 0.4 }), 1.5, 0.1, 0.02, 0, 0.6, 2.15);
      B(g, M('#b3261e'), 1.5, 0.1, 0.02, 0, 0.6, -2.15);
    },
  },
  {
    id: 'bench', name: 'Garden bench', cat: 'Outdoor', color: '#8a6a48',
    build: (g, c) => {
      B(g, M(c), 1.5, 0.05, 0.45, 0, 0.42, 0); B(g, M(c), 1.5, 0.35, 0.04, 0, 0.55, -0.2);
      for (const x of [-0.65, 0.65]) B(g, M(DARK), 0.06, 0.42, 0.4, x, 0, 0);
    },
  },
  {
    id: 'pool', name: 'Pool', cat: 'Outdoor', color: '#3fa7cf', flat: true,
    build: (g, c) => {
      B(g, M('#d9d4c7'), 4.4, 0.1, 7.4, 0, 0.02, 0);
      B(g, M(c, { roughness: 0.1, transparent: true, opacity: 0.9 }), 3.8, 0.11, 6.8, 0, 0.02, 0);
    },
  },
  {
    id: 'parasol', name: 'Patio set', cat: 'Outdoor', color: '#d9a441',
    build: (g, c) => {
      C(g, M(WHITE), 0.5, 0.04, 0, 0.7, 0); C(g, M(DARK), 0.03, 2.3);
      C(g, M(c), 1.3, 0.35, 0, 2.05, 0, 0.03);
      for (const [x, z] of [[0.85, 0], [-0.85, 0], [0, 0.85], [0, -0.85]]) C(g, M(WHITE), 0.2, 0.45, x, 0, z);
    },
  },
];

const byId = new Map(CATALOG.map((d) => [d.id, d]));
export const itemDef = (id) => byId.get(id);

export function buildFurniture(type, color) {
  const def = byId.get(type) || CATALOG[0];
  const g = new THREE.Group();
  def.build(g, color || def.color);
  g.traverse((o) => {
    if (o.isMesh) { o.castShadow = !def.flat; o.receiveShadow = true; }
  });
  return g;
}

/** Renders every catalogue entry once to a small image for the picker. */
export function renderThumbnails(size = 144) {
  const out = {};
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return out;
  }
  renderer.setSize(size, size);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#8d9096', 2.2));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const box = new THREE.Box3();
  const sphere = new THREE.Sphere();
  for (const def of CATALOG) {
    const g = buildFurniture(def.id);
    scene.add(g);
    box.setFromObject(g).getBoundingSphere(sphere);
    const dist = sphere.radius / Math.sin((15 * Math.PI) / 180) * 1.02;
    cam.position.copy(sphere.center).add(new THREE.Vector3(0.62, 0.55, 0.78).normalize().multiplyScalar(dist));
    cam.lookAt(sphere.center);
    renderer.render(scene, cam);
    out[def.id] = renderer.domElement.toDataURL('image/png');
    scene.remove(g);
    g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
  renderer.dispose();
  renderer.forceContextLoss?.();
  return out;
}
