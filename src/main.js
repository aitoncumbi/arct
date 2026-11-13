import './style.css';
import * as THREE from 'three';
import { Store, lastProject, sampleProject, wallLength } from './state.js';
import { Viewport } from './scene.js';
import { buildWall, buildFloor, buildItem } from './build.js';
import { Tools } from './tools.js';
import { UI } from './ui.js';

const store = new Store();
const view = new Viewport(document.querySelector('#stage'));
const LOW_WALL = 1.0;

const app = {
  store,
  view,
  wallMode: 'full',
  onToolChange: () => ui.refreshTool(),
  setView(mode) {
    view.setMode(mode);
    rebuild();
    ui.refreshView();
  },
  setWallMode(mode) {
    app.wallMode = mode;
    rebuild();
    ui.refreshView();
  },
};
app.tools = new Tools(app);
const ui = new UI(app);
app.ui = ui;

let plotSig = '';

function rebuild() {
  const p = store.project;
  if (!p) return;
  const sel = store.selection;
  const maxH = app.wallMode === 'low' ? LOW_WALL : Infinity;
  view.clearContent();

  for (const f of p.floors) view.content.add(buildFloor(f, sel?.kind === 'floor' && sel.id === f.id));

  const byWall = new Map();
  for (const o of p.openings) {
    if (!byWall.has(o.wall)) byWall.set(o.wall, []);
    byWall.get(o.wall).push(o);
  }
  const labels = [
    { x: 0, z: p.plot.d / 2 + 0.9, text: `${p.plot.w} m`, kind: 'plot' },
    { x: -p.plot.w / 2 - 0.9, z: 0, text: `${p.plot.d} m`, kind: 'plot' },
  ];
  for (const w of p.walls) {
    const selected = sel?.kind === 'wall' && sel.id === w.id;
    view.content.add(buildWall(w, byWall.get(w.id) || [], {
      maxH, selected, selectedOpening: sel?.kind === 'opening' ? sel.id : null,
    }));
    const top = Math.min(w.h, maxH);
    if (selected || view.mode === '2d') {
      labels.push({ x: (w.a.x + w.b.x) / 2, y: top + (selected && view.mode === '3d' ? 0.35 : 0), z: (w.a.z + w.b.z) / 2, text: `${wallLength(w).toFixed(2)}`, kind: selected ? 'live' : 'wall' });
    }
    if (selected) {
      for (const end of ['a', 'b']) {
        const handle = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 20, 14),
          new THREE.MeshBasicMaterial({ color: '#1f6feb', depthTest: false, transparent: true }),
        );
        handle.position.set(w[end].x, top, w[end].z);
        handle.renderOrder = 20;
        handle.userData.ref = { kind: 'handle', wall: w.id, end };
        view.content.add(handle);
      }
    }
  }
  for (const it of p.items) view.content.add(buildItem(it, sel?.kind === 'item' && sel.id === it.id));
  view.setLabels('scene', labels);
}

store.on((kind) => {
  const p = store.project;
  const sig = `${p.plot.w}x${p.plot.d}:${p.plot.ground}`;
  if (sig !== plotSig || kind === 'load') {
    plotSig = sig;
    view.setPlot(p.plot, kind === 'load');
  }
  if (kind === 'load') app.tools.set('select');
  rebuild();
  ui.refresh(kind);
});

window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, dialog')) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === 'z') { e.preventDefault(); store.step(e.shiftKey ? 1 : -1); }
  else if (mod && key === 'y') { e.preventDefault(); store.step(1); }
  else if (mod && key === 'd') { e.preventDefault(); ui.duplicate(); }
  else if (mod) return;
  else if (key === 'escape' || (key === 'enter' && app.tools.busy())) app.tools.cancel();
  else if (key === 'delete' || key === 'backspace') store.removeSelected();
  else if (key === 'r') app.tools.rotate(e.shiftKey ? -Math.PI / 4 : Math.PI / 4);
  else if (key >= '1' && key <= '7') ui.pickTool(['select', 'wall', 'room', 'floor', 'door', 'window', 'furniture'][+key - 1]);
});

const last = lastProject();
if (last) {
  store.load(last);
} else {
  // First visit: show the example behind the new-project dialog.
  store.load(sampleProject());
  ui.showStart();
}
ui.refreshView();

// Handy for poking at the app from the browser console.
window.arct = app;
