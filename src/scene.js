// Renderer, cameras, ground and the HTML dimension labels drawn over the canvas.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GROUNDS, disposeTree } from './build.js';

const SKY = '#d5e6f2';

export class Viewport {
  constructor(stage) {
    this.stage = stage;
    this.canvas = stage.querySelector('canvas');
    this.labelLayer = stage.querySelector('.labels');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 220, 620);

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#9aa48f', 1.5));
    this.sun = new THREE.DirectionalLight('#fff3e0', 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.ground = new THREE.Group();
    this.content = new THREE.Group();
    this.overlay = new THREE.Group();
    this.scene.add(this.ground, this.content, this.overlay);

    this.persp = new THREE.PerspectiveCamera(45, 1, 0.1, 1500);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 600);
    this.ortho.position.set(0, 200, 0);
    this.ortho.up.set(0, 0, -1);
    this.ortho.lookAt(0, 0, 0);

    this.ctl3 = new OrbitControls(this.persp, this.canvas);
    this.ctl3.maxPolarAngle = Math.PI / 2 - 0.03;
    this.ctl3.minDistance = 1.5;
    this.ctl3.maxDistance = 400;
    this.ctl3.zoomToCursor = true;

    this.ctl2 = new OrbitControls(this.ortho, this.canvas);
    this.ctl2.enableRotate = false;
    this.ctl2.zoomToCursor = true;
    this.ctl2.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.ctl2.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    this.ctl2.minZoom = 0.3;
    this.ctl2.maxZoom = 30;

    this.mode = '3d';
    this.ctl2.enabled = false;
    this.halfH = 10;
    this.plot = { w: 20, d: 20 };
    this.labelSets = {};
    this.labelPool = [];
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.ndc = new THREE.Vector2();
    this.tmp = new THREE.Vector3();

    new ResizeObserver(() => this.resize()).observe(stage);
    this.resize();
    const loop = () => {
      requestAnimationFrame(loop);
      this.render();
    };
    loop();
  }

  get camera() { return this.mode === '3d' ? this.persp : this.ortho; }
  get controls() { return this.mode === '3d' ? this.ctl3 : this.ctl2; }

  setMode(mode) {
    this.mode = mode;
    this.ctl3.enabled = mode === '3d';
    this.ctl2.enabled = mode === '2d';
  }

  resize() {
    const w = Math.max(1, this.stage.clientWidth), h = Math.max(1, this.stage.clientHeight);
    this.renderer.setSize(w, h, false);
    this.persp.aspect = w / h;
    this.persp.updateProjectionMatrix();
    this.fitOrtho();
  }

  fitOrtho() {
    const aspect = this.stage.clientWidth / Math.max(1, this.stage.clientHeight);
    this.halfH = (Math.max(this.plot.d, this.plot.w / aspect) / 2) * 1.2;
    Object.assign(this.ortho, { left: -this.halfH * aspect, right: this.halfH * aspect, top: this.halfH, bottom: -this.halfH });
    this.ortho.updateProjectionMatrix();
  }

  /** Rebuilds the ground for a plot and points lights and cameras at it. */
  setPlot(plot, recenter) {
    this.plot = { w: plot.w, d: plot.d };
    disposeTree(this.ground);
    this.ground.clear();
    const { w, d } = plot;

    const around = new THREE.Mesh(new THREE.CircleGeometry(900, 48), new THREE.MeshStandardMaterial({ color: '#c3ccb8', roughness: 1 }));
    around.rotation.x = -Math.PI / 2;
    around.position.y = -0.03;
    this.ground.add(around);

    const lot = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ color: (GROUNDS[plot.ground] || GROUNDS.grass).color, roughness: 1 }),
    );
    lot.rotation.x = -Math.PI / 2;
    lot.receiveShadow = true;
    this.ground.add(lot);

    const pts = [];
    for (let x = Math.ceil(-w / 2); x <= w / 2; x++) pts.push(x, 0, -d / 2, x, 0, d / 2);
    for (let z = Math.ceil(-d / 2); z <= d / 2; z++) pts.push(-w / 2, 0, z, w / 2, 0, z);
    const grid = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)),
      new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22 }),
    );
    grid.position.y = 0.006;
    this.ground.add(grid);

    const b = [-w / 2, -d / 2, w / 2, -d / 2, w / 2, d / 2, -w / 2, d / 2, -w / 2, -d / 2];
    const edge = [];
    for (let i = 0; i < b.length; i += 2) edge.push(b[i], 0.012, b[i + 1]);
    this.ground.add(new THREE.Line(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(edge, 3)),
      new THREE.LineBasicMaterial({ color: '#ffffff' }),
    ));

    const r = Math.hypot(w, d) / 2 + 4;
    this.sun.position.set(r * 0.55, r * 1.25, r * 0.75);
    Object.assign(this.sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: r * 4 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.fitOrtho();
    if (recenter) this.recenter();
  }

  recenter() {
    const { w, d } = this.plot;
    const span = Math.max(w, d);
    this.ctl3.target.set(0, 0, 0);
    this.persp.position.set(span * 0.42, span * 0.6, span * 0.72 + d * 0.12);
    this.ctl3.update();
    this.ctl2.target.set(0, 0, 0);
    this.ortho.position.set(0, 200, 0);
    this.ortho.zoom = 1;
    this.ortho.updateProjectionMatrix();
    this.ctl2.update();
  }

  clearContent() {
    disposeTree(this.content);
    this.content.clear();
  }

  setRay(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.ray;
  }

  /** Point under the pointer on the horizontal plane at the given height. */
  groundPoint(clientX, clientY, height = 0) {
    this.groundPlane.constant = -height;
    const hit = this.setRay(clientX, clientY).intersectPlane(this.groundPlane, new THREE.Vector3());
    return hit && hit.length() < 2000 ? hit : null;
  }

  raycast(clientX, clientY, objects) {
    this.setRay(clientX, clientY);
    return this.raycaster.intersectObjects(objects, true);
  }

  /** labels: [{x, y, z, text, kind?}] in world metres. */
  setLabels(key, labels) {
    this.labelSets[key] = labels;
  }

  drawLabels() {
    const all = Object.values(this.labelSets).flat();
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    while (this.labelPool.length < all.length) {
      const el = document.createElement('div');
      el.className = 'dim';
      this.labelLayer.appendChild(el);
      this.labelPool.push(el);
    }
    this.labelPool.forEach((el, i) => {
      const l = all[i];
      if (!l) { el.hidden = true; return; }
      this.tmp.set(l.x, l.y || 0, l.z).project(this.camera);
      if (this.tmp.z > 1 || Math.abs(this.tmp.x) > 1.1 || Math.abs(this.tmp.y) > 1.1) { el.hidden = true; return; }
      el.hidden = false;
      if (el.textContent !== l.text) el.textContent = l.text;
      el.dataset.kind = l.kind || '';
      el.style.transform = `translate(-50%,-50%) translate(${((this.tmp.x + 1) / 2) * w}px,${((1 - this.tmp.y) / 2) * h}px)`;
    });
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.drawLabels();
  }

  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.canvas.toDataURL('image/png');
  }
}
