// DOM side of the app: tool rail, option and property panels, dialogs.
import { createProject, sampleProject, listSaved, deleteSaved, uid, wallLength } from './state.js';
import { CATALOG, CATEGORIES, itemDef, renderThumbnails } from './furniture.js';
import { GROUNDS, FLOOR_MATS } from './build.js';
import { HINTS, OPENING_PRESETS } from './tools.js';

const SANDBOX = import.meta.env.VITE_SANDBOX === '1';
const $ = (sel) => document.querySelector(sel);

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

const icon = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const TOOLS = [
  { id: 'select', name: 'Select', key: '1', icon: icon('<path d="M5 3l14 7-6 2-2 6z"/>') },
  { id: 'wall', name: 'Wall', key: '2', icon: icon('<path d="M3 6h18v12H3zM3 12h18M9 6v6M15 12v6"/>') },
  { id: 'room', name: 'Room', key: '3', icon: icon('<path d="M4 4h16v16H4z"/><path d="M4 14h6v6" opacity=".55"/>') },
  { id: 'floor', name: 'Floor', key: '4', icon: icon('<path d="M3 16l9-6 9 6-9 5z"/><path d="M7.5 13.5l9 5M12 10.5v0" opacity=".55"/>') },
  { id: 'door', name: 'Door', key: '5', icon: icon('<path d="M6 21V3h12v18M4 21h16"/><circle cx="14.5" cy="12" r=".8" fill="currentColor"/>') },
  { id: 'window', name: 'Window', key: '6', icon: icon('<path d="M4 4h16v16H4zM12 4v16M4 12h16"/>') },
  { id: 'furniture', name: 'Furnish', key: '7', icon: icon('<path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3"/><path d="M3 12a2 2 0 0 1 4 0v3h10v-3a2 2 0 0 1 4 0v5H3zM6 17v2M18 17v2"/>') },
];

const KIND_NAMES = { wall: 'Wall', floor: 'Floor', item: 'Furniture', opening: 'Opening' };
const deg = (r) => Math.round(((r || 0) * 180) / Math.PI);

export class UI {
  constructor(app) {
    this.app = app;
    this.thumbs = null;
    this.cat = CATEGORIES[0];
    this.panel = $('#panel');

    const rail = $('#tools');
    for (const t of TOOLS) {
      rail.append(h('button', {
        class: 'tool', 'data-tool': t.id, title: `${t.name} (${t.key})`, html: `${t.icon}<span>${t.name}</span>`,
        onclick: () => this.pickTool(t.id),
      }));
    }

    $('#projName').addEventListener('change', (e) => {
      app.store.project.name = e.target.value.trim() || 'Untitled project';
      app.store.commit();
    });
    $('#undoBtn').onclick = () => app.store.step(-1);
    $('#redoBtn').onclick = () => app.store.step(1);
    $('#viewSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) app.setView(b.dataset.view);
    });
    $('#wallsBtn').onclick = () => app.setWallMode(app.wallMode === 'full' ? 'low' : 'full');
    $('#fitBtn').onclick = () => app.view.recenter();
    $('#panelToggle').onclick = () => this.setPanelOpen(!this.panel.hasAttribute('data-open'));

    const menu = $('#fileMenu');
    menu.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      menu.open = false;
      if (act === 'new') this.showStart();
      if (act === 'export') this.showExport();
      if (act === 'import') this.showImport();
      if (act === 'shot') this.showShot();
    });
    document.addEventListener('pointerdown', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });

    $('#fileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (file) this.importText(await file.text());
    });
  }

  get store() { return this.app.store; }

  setPanelOpen(open) {
    this.panel.toggleAttribute('data-open', open);
    $('#panelToggle').setAttribute('aria-expanded', String(open));
  }

  pickTool(id) {
    const tools = this.app.tools;
    if (id === 'door' || id === 'window') tools.set(id, { preset: OPENING_PRESETS[id][0] });
    else if (id === 'floor' || id === 'room') tools.set(id, { mat: 'wood' });
    else tools.set(id);
    if (['door', 'window', 'floor', 'furniture'].includes(id)) this.setPanelOpen(true);
  }

  // ---------- refresh ----------

  refresh(kind) {
    if (kind === 'touch') return;
    const p = this.store.project;
    const name = $('#projName');
    if (document.activeElement !== name) name.value = p.name;
    $('#undoBtn').disabled = !this.store.canUndo();
    $('#redoBtn').disabled = !this.store.canRedo();
    this.renderProps();
    this.renderHint();
  }

  refreshTool() {
    const tool = this.app.tools.tool;
    for (const b of document.querySelectorAll('.tool')) b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
    this.renderToolOptions();
    this.renderProps();
    this.renderHint();
  }

  refreshView() {
    for (const b of document.querySelectorAll('#viewSeg button')) b.setAttribute('aria-pressed', String(b.dataset.view === this.app.view.mode));
    $('#wallsBtn').setAttribute('aria-pressed', String(this.app.wallMode === 'low'));
  }

  renderHint() {
    const el = $('#hint');
    const tools = this.app.tools;
    const sel = this.store.selection;
    el.replaceChildren();
    if (tools.tool === 'select' && sel && this.store.selected()) {
      const obj = this.store.selected();
      const label = sel.kind === 'item' ? itemDef(obj.type)?.name : sel.kind === 'opening' ? (obj.type === 'door' ? 'Door' : 'Window') : KIND_NAMES[sel.kind];
      el.append(h('strong', {}, label));
      if (sel.kind === 'item') {
        el.append(
          h('button', { class: 'btn small', onclick: () => tools.rotate() }, 'Rotate 45°'),
          h('button', { class: 'btn small', onclick: () => this.duplicate() }, 'Duplicate'),
        );
      }
      el.append(h('button', { class: 'btn small danger', onclick: () => this.store.removeSelected() }, 'Delete'));
      return;
    }
    el.append(h('span', {}, HINTS[tools.tool]));
    if (tools.tool === 'furniture' && tools.opt.type) el.append(h('button', { class: 'btn small', onclick: () => tools.rotate() }, 'Rotate'));
    if (tools.busy()) el.append(h('button', { class: 'btn small', onclick: () => tools.cancel() }, 'Finish'));
    else if (tools.tool !== 'select') el.append(h('button', { class: 'btn small', onclick: () => tools.set('select') }, 'Done'));
  }

  duplicate() {
    const item = this.store.selected();
    if (!item || this.store.selection.kind !== 'item') return;
    const copy = { ...item, id: uid(), x: item.x + 0.5, z: item.z + 0.5 };
    this.store.project.items.push(copy);
    this.store.selection = { kind: 'item', id: copy.id };
    this.store.commit();
  }

  // ---------- form helpers ----------

  field(label, control) {
    return h('label', { class: 'field' }, h('span', {}, label), control);
  }

  num(id, value, { min = 0, max = 999, step = 0.05, unit = 'm' } = {}, apply) {
    const input = h('input', {
      type: 'number', id, min, max, step, value: String(+(+value).toFixed(2)), inputMode: 'decimal',
      onchange: () => {
        let v = parseFloat(input.value);
        if (!Number.isFinite(v)) { this.renderProps(); return; }
        v = Math.min(max, Math.max(min, v));
        apply(v);
        this.store.commit();
      },
    });
    return h('span', { class: 'num' }, input, h('i', {}, unit));
  }

  select(id, value, options, apply) {
    const el = h('select', { id, onchange: () => { apply(el.value); this.store.commit(); } },
      Object.entries(options).map(([v, name]) => h('option', { value: v, selected: v === value }, name)));
    return el;
  }

  color(id, value, apply) {
    return h('input', {
      type: 'color', id, value,
      oninput: (e) => { apply(e.target.value); this.store.touch(); },
      onchange: (e) => { apply(e.target.value); this.store.commit(); },
    });
  }

  // ---------- tool options ----------

  renderToolOptions() {
    const box = $('#toolOptions');
    const tools = this.app.tools;
    const t = tools.tool;
    const s = this.store.project.settings;
    box.replaceChildren();
    if (t === 'wall' || t === 'room') {
      box.append(
        h('h2', {}, 'New walls'),
        this.field('Height', this.num('optWallH', s.wallH, { min: 0.5, max: 8 }, (v) => { s.wallH = v; })),
        this.field('Thickness', this.num('optWallT', s.wallT, { min: 0.05, max: 0.6, step: 0.01 }, (v) => { s.wallT = v; })),
        this.field('Colour', this.color('optWallC', s.wallColor, (v) => { s.wallColor = v; })),
      );
    }
    if (t === 'floor' || t === 'room') {
      box.append(
        h('h2', {}, 'Floor finish'),
        h('div', { class: 'chips' }, Object.entries(FLOOR_MATS).map(([id, name]) => h('button', {
          class: 'chip-btn', 'aria-pressed': String((tools.opt.mat || 'wood') === id),
          onclick: () => { tools.opt.mat = id; this.renderToolOptions(); },
        }, name))),
      );
    }
    if (t === 'door' || t === 'window') {
      box.append(
        h('h2', {}, t === 'door' ? 'Door type' : 'Window type'),
        h('div', { class: 'presets' }, OPENING_PRESETS[t].map((p) => h('button', {
          class: 'preset', 'aria-pressed': String(tools.opt.preset === p),
          onclick: () => { tools.opt.preset = p; this.renderToolOptions(); },
        }, h('b', {}, p.name), h('small', {}, `${p.w.toFixed(1)} × ${p.h.toFixed(1)} m${p.sill ? ` · sill ${p.sill.toFixed(1)} m` : ''}`)))),
      );
    }
    if (t === 'furniture') {
      if (!this.thumbs) this.thumbs = renderThumbnails();
      box.append(
        h('h2', {}, 'Furniture'),
        h('div', { class: 'tabs', role: 'tablist' }, CATEGORIES.map((c) => h('button', {
          role: 'tab', 'aria-selected': String(c === this.cat),
          onclick: () => { this.cat = c; this.renderToolOptions(); },
        }, c))),
        h('div', { class: 'catalog' }, CATALOG.filter((d) => d.cat === this.cat).map((d) => h('button', {
          class: 'cat-item', 'aria-pressed': String(tools.opt.type === d.id),
          onclick: () => { tools.set('furniture', { type: d.id }); },
        }, this.thumbs[d.id] ? h('img', { src: this.thumbs[d.id], alt: '' }) : null, h('span', {}, d.name)))),
      );
    }
  }

  // ---------- properties ----------

  renderProps() {
    const box = $('#props');
    const p = this.store.project;
    const sel = this.store.selection;
    const obj = this.store.selected();
    box.replaceChildren();
    const del = () => h('button', { class: 'btn danger wide', onclick: () => this.store.removeSelected() }, 'Delete');

    if (!obj) {
      $('#panelTitle').textContent = this.app.tools.tool === 'select' ? 'Project' : TOOLS.find((t) => t.id === this.app.tools.tool).name;
      const area = p.floors.reduce((a, f) => a + f.w * f.d, 0);
      const run = p.walls.reduce((a, w) => a + wallLength(w), 0);
      box.append(
        h('h2', {}, 'Plot'),
        this.field('Width', this.num('plotW', p.plot.w, { min: 4, max: 200, step: 1 }, (v) => { p.plot.w = v; })),
        this.field('Depth', this.num('plotD', p.plot.d, { min: 4, max: 200, step: 1 }, (v) => { p.plot.d = v; })),
        this.field('Ground', this.select('plotG', p.plot.ground, Object.fromEntries(Object.entries(GROUNDS).map(([k, g]) => [k, g.name])), (v) => { p.plot.ground = v; })),
        h('h2', {}, 'Schedule'),
        h('dl', { class: 'stats' },
          h('dt', {}, 'Plot area'), h('dd', {}, `${(p.plot.w * p.plot.d).toFixed(0)} m²`),
          h('dt', {}, 'Floor area'), h('dd', {}, `${area.toFixed(1)} m²`),
          h('dt', {}, 'Plot coverage'), h('dd', {}, `${((area / (p.plot.w * p.plot.d)) * 100).toFixed(0)} %`),
          h('dt', {}, 'Wall run'), h('dd', {}, `${run.toFixed(1)} m`),
          h('dt', {}, 'Doors'), h('dd', {}, String(p.openings.filter((o) => o.type === 'door').length)),
          h('dt', {}, 'Windows'), h('dd', {}, String(p.openings.filter((o) => o.type === 'window').length)),
          h('dt', {}, 'Furniture'), h('dd', {}, String(p.items.length))),
      );
      return;
    }

    if (sel.kind === 'wall') {
      $('#panelTitle').textContent = 'Wall';
      const L = wallLength(obj);
      box.append(
        h('h2', {}, 'Wall'),
        this.field('Length', this.num('wallL', L, { min: 0.25, max: 300 }, (v) => {
          const k = v / (L || 1);
          obj.b = { x: obj.a.x + (obj.b.x - obj.a.x) * k, z: obj.a.z + (obj.b.z - obj.a.z) * k };
        })),
        this.field('Height', this.num('wallH', obj.h, { min: 0.5, max: 8 }, (v) => { obj.h = v; })),
        this.field('Thickness', this.num('wallT', obj.t, { min: 0.05, max: 0.6, step: 0.01 }, (v) => { obj.t = v; })),
        this.field('Colour', this.color('wallC', obj.color, (v) => { obj.color = v; })),
        h('button', {
          class: 'btn wide',
          onclick: () => { for (const w of p.walls) { w.h = obj.h; w.t = obj.t; w.color = obj.color; } this.store.commit(); },
        }, 'Apply to all walls'),
        del(),
      );
    } else if (sel.kind === 'opening') {
      const wall = p.walls.find((w) => w.id === obj.wall);
      const L = wall ? wallLength(wall) : 10;
      const isDoor = obj.type === 'door';
      $('#panelTitle').textContent = isDoor ? 'Door' : 'Window';
      box.append(
        h('h2', {}, isDoor ? 'Door' : 'Window'),
        isDoor && this.field('Type', this.select('opStyle', obj.style, { single: 'Single leaf', double: 'Double leaf', open: 'Open passage' }, (v) => { obj.style = v; })),
        this.field('Width', this.num('opW', obj.w, { min: 0.4, max: Math.max(0.4, L - 0.2) }, (v) => { obj.w = v; })),
        this.field('Height', this.num('opH', obj.h, { min: 0.3, max: (wall?.h || 3) - obj.sill }, (v) => { obj.h = v; })),
        !isDoor && this.field('Sill height', this.num('opS', obj.sill, { min: 0, max: (wall?.h || 3) - obj.h }, (v) => { obj.sill = v; })),
        this.field('Along wall', this.num('opP', obj.pos, { min: obj.w / 2 + 0.05, max: Math.max(obj.w / 2 + 0.05, L - obj.w / 2 - 0.05) }, (v) => { obj.pos = v; })),
        del(),
      );
    } else if (sel.kind === 'floor') {
      $('#panelTitle').textContent = 'Floor';
      box.append(
        h('h2', {}, 'Floor'),
        this.field('Width', this.num('flW', obj.w, { min: 0.25, max: 200 }, (v) => { obj.w = v; })),
        this.field('Depth', this.num('flD', obj.d, { min: 0.25, max: 200 }, (v) => { obj.d = v; })),
        this.field('Finish', this.select('flM', obj.mat, FLOOR_MATS, (v) => { obj.mat = v; })),
        h('p', { class: 'note' }, `${(obj.w * obj.d).toFixed(1)} m²`),
        del(),
      );
    } else if (sel.kind === 'item') {
      const def = itemDef(obj.type);
      $('#panelTitle').textContent = def.name;
      box.append(
        h('h2', {}, def.name),
        this.field('Rotation', this.num('itR', deg(obj.rot), { min: -360, max: 360, step: 15, unit: '°' }, (v) => { obj.rot = (v * Math.PI) / 180; })),
        this.field('Colour', this.color('itC', obj.color || def.color, (v) => { obj.color = v; })),
        h('button', { class: 'btn wide', onclick: () => this.duplicate() }, 'Duplicate'),
        del(),
      );
    }
  }

  // ---------- dialogs ----------

  showStart() {
    const dlg = $('#startDlg');
    const state = { w: 20, d: 30 };
    const canClose = !!this.store.project;
    const preview = h('div', { class: 'plot-preview' });
    const drawPreview = () => {
      const k = 150 / Math.max(state.w, state.d);
      const w = state.w * k, d = state.d * k;
      const step = Math.max(1, Math.ceil(Math.max(state.w, state.d) / 20)) * k;
      preview.innerHTML = `<svg viewBox="-40 -30 230 210" role="img" aria-label="Plot ${state.w} by ${state.d} metres">
        <defs><pattern id="pg" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><path d="M${step} 0H0V${step}" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width=".6"/></pattern></defs>
        <g transform="translate(${(150 - w) / 2} ${(150 - d) / 2})">
          <rect width="${w}" height="${d}" fill="url(#pg)" stroke="currentColor" stroke-width="1.5"/>
          <path d="M0 ${d + 12}h${w}M0 ${d + 8}v8M${w} ${d + 8}v8M-12 0v${d}M-16 0h8M-16 ${d}h8" stroke="currentColor" stroke-width="1" fill="none"/>
          <text x="${w / 2}" y="${d + 26}" text-anchor="middle">${state.w} m</text>
          <text x="-20" y="${d / 2}" text-anchor="middle" transform="rotate(-90 -20 ${d / 2})">${state.d} m</text>
        </g></svg><p>${(state.w * state.d).toLocaleString()} m² plot</p>`;
    };
    const wIn = h('input', { type: 'number', id: 'newW', min: 4, max: 200, step: 1, value: state.w });
    const dIn = h('input', { type: 'number', id: 'newD', min: 4, max: 200, step: 1, value: state.d });
    const sync = () => {
      state.w = Math.min(200, Math.max(4, parseFloat(wIn.value) || 4));
      state.d = Math.min(200, Math.max(4, parseFloat(dIn.value) || 4));
      drawPreview();
    };
    wIn.oninput = dIn.oninput = sync;
    const nameIn = h('input', { type: 'text', id: 'newName', value: 'My house', maxLength: 60 });
    const presets = [[10, 15], [15, 20], [20, 30], [30, 40]];
    const open = (project) => { dlg.close(); this.store.load(project); };
    const saved = listSaved();

    dlg.replaceChildren(
      h('form', { method: 'dialog', class: 'start', onsubmit: (e) => { e.preventDefault(); sync(); open(createProject(nameIn.value.trim(), state.w, state.d)); } },
        h('header', {}, h('h1', {}, 'New project'), canClose && h('button', { type: 'button', class: 'btn icon', 'aria-label': 'Close', onclick: () => dlg.close() }, '✕')),
        h('div', { class: 'start-grid' },
          h('div', { class: 'start-form' },
            this.field('Project name', nameIn),
            h('div', { class: 'field' }, h('span', {}, 'Plot size'),
              h('div', { class: 'chips' }, presets.map(([w, d]) => h('button', {
                type: 'button', class: 'chip-btn', onclick: () => { wIn.value = w; dIn.value = d; sync(); },
              }, `${w} × ${d} m`)))),
            h('div', { class: 'pair' },
              this.field('Width', h('span', { class: 'num' }, wIn, h('i', {}, 'm'))),
              this.field('Depth', h('span', { class: 'num' }, dIn, h('i', {}, 'm')))),
            h('button', { type: 'submit', class: 'btn primary wide' }, 'Create empty plot'),
            h('button', { type: 'button', class: 'btn wide', onclick: () => open(sampleProject()) }, 'Open the example house'),
          ),
          preview,
        ),
        saved.length ? h('div', { class: 'saved' },
          h('h2', {}, 'Saved in this browser'),
          h('ul', {}, saved.map((s) => h('li', {},
            h('button', { type: 'button', class: 'saved-open', onclick: () => open(s) },
              h('b', {}, s.name), h('small', {}, `${s.plot.w} × ${s.plot.d} m · ${s.walls.length} walls · ${s.items.length} items`)),
            h('button', {
              type: 'button', class: 'btn small danger', 'aria-label': `Delete ${s.name}`,
              onclick: (e) => { deleteSaved(s.id); e.target.closest('li').remove(); },
            }, 'Delete'))))) : null,
      ),
    );
    drawPreview();
    dlg.oncancel = (e) => { if (!canClose) e.preventDefault(); };
    if (!dlg.open) dlg.showModal();
  }

  share(title, body) {
    const dlg = $('#shareDlg');
    dlg.replaceChildren(h('div', { class: 'share' },
      h('header', {}, h('h1', {}, title), h('button', { class: 'btn icon', 'aria-label': 'Close', onclick: () => dlg.close() }, '✕')),
      body));
    if (!dlg.open) dlg.showModal();
  }

  download(href, name) {
    return SANDBOX ? null : h('a', { class: 'btn primary', href, download: name }, 'Download');
  }

  showExport() {
    const p = this.store.project;
    const json = JSON.stringify(p, null, 1);
    const area = h('textarea', { id: 'exportText', readOnly: true, value: json, rows: 10 });
    const copy = h('button', {
      class: 'btn',
      onclick: async () => {
        try { await navigator.clipboard.writeText(json); copy.textContent = 'Copied'; }
        catch { area.select(); copy.textContent = 'Selected — press Ctrl+C'; }
      },
    }, 'Copy');
    this.share('Export project', [
      h('p', { class: 'note' }, 'This text is the whole project. Keep it in a .json file and bring it back with Import.'),
      area,
      h('div', { class: 'row' }, copy, this.download(URL.createObjectURL(new Blob([json], { type: 'application/json' })), `${p.name.replace(/[^\w-]+/g, '-') || 'project'}.json`)),
    ]);
  }

  showImport() {
    const area = h('textarea', { id: 'importText', rows: 8, placeholder: 'Paste exported project text here' });
    const err = h('p', { class: 'note error', hidden: true });
    this.importError = err;
    this.share('Import project', [
      area, err,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => $('#fileInput').click() }, 'Choose a file…'),
        h('button', { class: 'btn primary', onclick: () => this.importText(area.value) }, 'Import')),
    ]);
  }

  importText(text) {
    try {
      const p = JSON.parse(text);
      if (!p.plot || !Array.isArray(p.walls)) throw new Error('missing plot or walls');
      const clean = { ...createProject(p.name, +p.plot.w || 20, +p.plot.d || 20), ...p, id: uid() };
      for (const key of ['walls', 'openings', 'floors', 'items']) if (!Array.isArray(clean[key])) clean[key] = [];
      clean.items = clean.items.filter((i) => itemDef(i.type));
      $('#shareDlg').close();
      this.store.load(clean);
    } catch (e) {
      if (this.importError) {
        this.importError.hidden = false;
        this.importError.textContent = `That is not a project file (${e.message}). Paste the text from Export project.`;
      }
    }
  }

  showShot() {
    const url = this.app.view.snapshot();
    this.share('Image of this view', [
      h('img', { class: 'shot', src: url, alt: 'Rendered view of the project' }),
      h('div', { class: 'row' },
        h('span', { class: 'note' }, SANDBOX ? 'Press and hold, or right-click, the image to save it.' : ''),
        this.download(url, `${this.store.project.name.replace(/[^\w-]+/g, '-') || 'view'}.png`)),
    ]);
  }
}
