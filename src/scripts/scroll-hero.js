/*
  Scroll-synced hero scene with the strand-extraction handoff.

  Phase 1, the ride (first ~82% of the hero track): the light-stream journey.
  Two streams (buyer azure, supplier copper) merge, pass the bright waist,
  and widen into one gold river while the camera rides alongside and copy
  beats fade in. Native scrolling is never hijacked.

  Phase 2, the extraction (the rest of the track): no colour crossfade, no
  blur. As the visitor keeps scrolling, ONE golden strand is pulled out of
  the river's right side; it grows leftward across the frame, turns, and
  dives straight down, while the camera pans with it exactly as the ride
  does. The final camera pose is solved so the strand's vertical run lands
  on the page's left-gutter x at any viewport size. Flow particles ride the
  strand as it grows.

  Phase 3, the page: when the hero unpins, the canvas goes transparent and
  keeps rendering just the strand and its particles from the frozen final
  camera. The dark stage scrolls away as ordinary DOM, and the strand,
  fixed at the gutter, visibly crosses the dark-to-paper boundary and
  continues to the very bottom beside the sections. The strand and its
  particles use normal blending in warm copper-gold, so they read on both
  the navy and the paper without any material swap.

  Mobile-first: narrow screens get fewer particles and a lower pixel-ratio
  cap; the gutter alignment recomputes from the real viewport. Reduced
  motion: static composed frame, no extraction, page fully readable.
*/

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ============================================================================
   CFG: every knob you should need. Retune here, not in the code below.
   ========================================================================= */
const CFG = {
  loopSeconds: 6.5,
  threadCount: 24,
  particlesPerThread: 480, // desktop; narrow screens drop to 300 (see init)
  filamentOpacity: 0.16,
  flowSpeed: 0.5,
  particleSize: 0.04,
  colorBuyer: 0x5aa6f7,
  colorSupplier: 0xf58f35,
  colorMerged: 0xffd076,
  waistGlow: 1.0,
  trails: 0.92,
  bloom: true,
  bloomStrength: 0.65,
  bloomRadius: 0.6,
  bloomThreshold: 0.7,
  cameraDistance: 5.4,
  cameraElevationDeg: 6,
  cameraAzimuthDeg: 10,
  cameraRollDeg: -6,
  cameraDriftDeg: 0.8,
  // Kept close together and ending exactly on the first section's navy, so
  // that when the canvas turns transparent over that section there is no
  // visible tone step
  bgTop: '#0c1729',
  bgMid: '#0f1c33',
  bgBottom: '#12203a',
  // NOTE: the ride/extraction split is not a constant. The ride occupies
  // exactly the sticky range, and the extraction plays through the stage's
  // scroll-away, so page content rises in step with the strand instead of
  // waiting for an empty frame. See rideEnd, computed in frameCamera().
  strandColor: 0xe0a85c,   // warm copper-gold; reads on navy AND on paper
  strandFlowCount: 420,    // particles riding the strand (280 narrow)
  maxPixelRatio: 1.75,
};

// Spine: one grand rising stroke, lower left corner through the waist and
// off the upper right; the supplier arm joins like a river confluence.
const IN_A = [
  [-6.6, -2.4, -1.8], [-4.8, -1.75, -1.5], [-3.2, -1.0, -1.2], [-2.1, -0.5, -0.95],
];
const IN_B = [
  [-5.6, 2.4, -2.1], [-4.0, 1.5, -1.7], [-2.9, 0.7, -1.3], [-2.0, 0.12, -0.95],
];
const OUT = [
  [-1.35, -0.18, -0.72],
  [0, 0, 0],
  [1.5, 0.55, 0.55], [3.1, 1.15, 0.95], [4.9, 1.65, 1.1], [6.6, 2.0, 1.05],
];
const MERGE = new THREE.Vector3(-1.35, -0.18, -0.72);

// The extracted strand: pulled from the river's right side, swept left,
// then straight down, far past the frame bottom
const STRAND_PTS = [
  [5.2, 1.7, 1.0], [3.2, 2.1, 0.8], [0.8, 1.5, 0.55],
  [-1.4, 0.8, 0.35], [-2.0, -0.2, 0.18],
  [-2.1, -1.6, 0.12], [-2.1, -3.5, 0.1], [-2.1, -6.2, 0.1],
];
const STRAND_X = -2.1;        // world x of the vertical run
const STRAND_Z = 0.1;         // world z of the vertical run
const STRAND_STRAIGHT_Y = -1.6; // where the curve has finished turning down
const STRAND_SAMPLES = 260;

const SAMPLES = 240;
const Z_UNIT = new THREE.Vector3(0, 0, 1);
const FIT_HALF_WIDTH = 2.6;
const FIT_HALF_PORTRAIT = 1.5;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/* Fade window: ramp up over a..b, hold, ramp down over c..d.
   A zero-width edge (a===b or c===d) would divide by zero inside smooth() and
   silently blank the element for the whole range, so guard both edges. To hold
   an element on with no fade-out at all, use smooth(a, b, u) directly rather
   than a degenerate window. */
const fadeWin = (u, a, b, c, d) =>
  (a === b ? (u < a ? 0 : 1) : smooth(a, b, u)) *
  (c === d ? (u < c ? 1 : 0) : smooth(d, c, u));

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function radialTexture(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function initScrollHero(root) {
  if (!root || root.dataset.shInit) return;
  root.dataset.shInit = '1';

  const stage = root.querySelector('[data-sh="stage"]');
  const canvas = root.querySelector('[data-sh="canvas"]');
  const ui = {
    copy: root.querySelector('[data-sh="copy"]'),
    beat1: root.querySelector('[data-sh="beat1"]'),
    beat2: root.querySelector('[data-sh="beat2"]'),
    beat3: root.querySelector('[data-sh="beat3"]'),
    flare: root.querySelector('[data-sh="flare"]'),
    hint: root.querySelector('[data-sh="hint"]'),
    poster: root.querySelector('[data-sh="poster"]'),
  };

  const narrow = window.matchMedia('(max-width: 520px)').matches;
  const particlesPerThread = narrow ? 300 : CFG.particlesPerThread;
  const strandFlowCount = narrow ? 280 : CFG.strandFlowCount;
  const pixelCap = narrow ? 1.5 : CFG.maxPixelRatio;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: true, powerPreference: 'high-performance',
    });
  } catch (e) {
    console.warn('ScrollHero: WebGL unavailable, static fallback.', e);
    root.classList.add('sh-fallback');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap));
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0c1830, 6.5, 14);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);

  // The canvas is ALWAYS transparent: the navy comes from the DOM
  // (.sh-root, viewport-anchored so it matches what the scene used to
  // paint). That is what lets the next section scroll up into view behind
  // the live scene instead of being unveiled all at once when the canvas
  // stopped painting. Kept here in case an opaque backdrop is ever wanted.
  // eslint-disable-next-line no-unused-vars
  const bgTex = (() => {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 512;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, CFG.bgTop);
    grad.addColorStop(0.55, CFG.bgMid);
    grad.addColorStop(1, CFG.bgBottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  const rand = mulberry32(1624);

  /* Threads: offset helices around the joined spine. Per-thread randomness
     is deliberate; the structure lives in the spine. */
  function buildThread(inPoints, theta0, baseR, twist) {
    const spine = new THREE.CatmullRomCurve3(
      [...inPoints, ...OUT].map((p) => new THREE.Vector3(...p)));
    const pts = new Float32Array((SAMPLES + 1) * 3);
    const p = new THREE.Vector3(), T = new THREE.Vector3();
    const side = new THREE.Vector3(), up = new THREE.Vector3();
    let waistT = 0, waistD = Infinity;
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      spine.getPointAt(t, p);
      spine.getTangentAt(t, T);
      side.crossVectors(T, Z_UNIT);
      if (side.lengthSq() < 1e-6) side.set(0, 1, 0); else side.normalize();
      up.crossVectors(side, T).normalize();
      const dWaist = p.length();
      const dMerge = p.distanceTo(MERGE);
      if (dWaist < waistD) { waistD = dWaist; waistT = t; }
      const waistScale = 0.04 + 0.96 * smooth(0.05, 1.5, dWaist);
      const mergeScale = 0.32 + 0.68 * smooth(0.1, 1.0, dMerge);
      const r = baseR * Math.min(waistScale, mergeScale);
      const ang = theta0 + twist * t * Math.PI * 2;
      p.addScaledVector(side, Math.cos(ang) * r)
       .addScaledVector(up, Math.sin(ang) * r);
      pts[i * 3] = p.x; pts[i * 3 + 1] = p.y; pts[i * 3 + 2] = p.z;
    }
    return { pts, waistT };
  }

  const heroGroup = new THREE.Group();
  scene.add(heroGroup);

  const threads = [];
  const perStream = CFG.threadCount / 2;
  for (let s = 0; s < 2; s++) {
    const inPts = s === 0 ? IN_A : IN_B;
    for (let i = 0; i < perStream; i++) {
      const theta0 = (i / perStream) * Math.PI * 2 + rand() * 0.5;
      const baseR = 0.18 + rand() * 0.26;
      const twist = 0.22 + rand() * 0.33;
      const th = buildThread(inPts, theta0, baseR, twist);
      th.stream = s;
      threads.push(th);
    }
  }

  const buyerC = new THREE.Color(CFG.colorBuyer);
  const supplierC = new THREE.Color(CFG.colorSupplier);
  const mergedC = new THREE.Color(CFG.colorMerged);
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: CFG.filamentOpacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  {
    const cTmp = new THREE.Color();
    for (const th of threads) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(th.pts, 3));
      const cols = new Float32Array(th.pts.length);
      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES;
        cTmp.copy(th.stream === 0 ? buyerC : supplierC)
          .lerp(mergedC, smooth(th.waistT, th.waistT + 0.22, t));
        const endFade = smooth(0, 0.07, t) * smooth(1, 0.93, t);
        cols[i * 3] = cTmp.r * endFade;
        cols[i * 3 + 1] = cTmp.g * endFade;
        cols[i * 3 + 2] = cTmp.b * endFade;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      heroGroup.add(new THREE.Line(geo, lineMat));
    }
  }

  const COUNT = CFG.threadCount * particlesPerThread;
  const particles = new Array(COUNT);
  {
    let n = 0;
    for (let th = 0; th < threads.length; th++) {
      for (let i = 0; i < particlesPerThread; i++) {
        particles[n++] = {
          thread: th, t0: rand(),
          speed: 0.85 + rand() * 0.3,
          bright: 0.3 + rand() * 0.35,
        };
      }
    }
  }
  const posAttr = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3);
  const colAttr = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', posAttr);
  pGeo.setAttribute('color', colAttr);
  pGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
  const dotTex = radialTexture(64, [
    [0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)'],
  ]);
  const pMat = new THREE.PointsMaterial({
    map: dotTex, size: CFG.particleSize, sizeAttenuation: true,
    vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  heroGroup.add(new THREE.Points(pGeo, pMat));

  const glowTex = radialTexture(256, [
    [0, 'rgba(255,255,255,0.9)'], [0.35, 'rgba(255,255,255,0.28)'], [1, 'rgba(255,255,255,0)'],
  ]);
  const waistGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xf2e7d8, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  waistGlow.position.set(0, 0, 0.1);
  waistGlow.renderOrder = 5;
  heroGroup.add(waistGlow);
  const backGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0x1c355e, transparent: true, opacity: 0.32,
    depthWrite: false,
  }));
  backGlow.position.set(0, -0.3, -3);
  backGlow.scale.set(16, 10, 1);
  heroGroup.add(backGlow);

  const tmpColor = new THREE.Color();
  let glowBoost = 1;

  function updateParticles(timeSec) {
    const loopPhase = (timeSec / CFG.loopSeconds) % 1;
    const pos = posAttr.array, col = colAttr.array;
    for (let n = 0; n < COUNT; n++) {
      const pt = particles[n];
      const th = threads[pt.thread];
      const t = (pt.t0 + timeSec * 0.09 * CFG.flowSpeed * pt.speed) % 1;
      const f = t * SAMPLES;
      const i0 = Math.floor(f), fr = f - i0;
      const a = i0 * 3, b = Math.min(i0 + 1, SAMPLES) * 3;
      const px = th.pts[a] + (th.pts[b] - th.pts[a]) * fr;
      const py = th.pts[a + 1] + (th.pts[b + 1] - th.pts[a + 1]) * fr;
      const pz = th.pts[a + 2] + (th.pts[b + 2] - th.pts[a + 2]) * fr;
      pos[n * 3] = px; pos[n * 3 + 1] = py; pos[n * 3 + 2] = pz;
      tmpColor.copy(th.stream === 0 ? buyerC : supplierC)
        .lerp(mergedC, smooth(th.waistT, th.waistT + 0.22, t));
      const packet = 0.7 + 0.3 * Math.sin((loopPhase - t * 1.5) * Math.PI * 2);
      const nearWaist = 1 + 1.3 * CFG.waistGlow *
        smooth(0.28, 0.02, Math.hypot(px, py, pz));
      const endFade = smooth(0, 0.08, t) * smooth(1, 0.92, t);
      const bright = pt.bright * packet * nearWaist * endFade;
      col[n * 3] = tmpColor.r * bright;
      col[n * 3 + 1] = tmpColor.g * bright;
      col[n * 3 + 2] = tmpColor.b * bright;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    const surge = 0.7 + 0.3 * Math.sin((loopPhase - 0.75) * Math.PI * 2);
    const g = CFG.waistGlow * surge * glowBoost;
    waistGlow.material.opacity = 0.05 + 0.09 * g;
    waistGlow.scale.setScalar(0.5 + 0.3 * g);
  }

  /* -------------------------------------------------------------------------
     The extracted strand: a polyline that grows along its curve with the
     extraction progress, plus flow particles that ride the drawn portion,
     and a glowing tip while it grows. Warm copper-gold, normal blending,
     so it reads on the navy AND later on the paper.
  ------------------------------------------------------------------------- */
  const strandCurve = new THREE.CatmullRomCurve3(
    STRAND_PTS.map((p) => new THREE.Vector3(...p)));
  const strandPos = new Float32Array((STRAND_SAMPLES + 1) * 3);
  {
    const p = new THREE.Vector3();
    for (let i = 0; i <= STRAND_SAMPLES; i++) {
      strandCurve.getPointAt(i / STRAND_SAMPLES, p);
      strandPos[i * 3] = p.x; strandPos[i * 3 + 1] = p.y; strandPos[i * 3 + 2] = p.z;
    }
  }
  const strandGeo = new THREE.BufferGeometry();
  strandGeo.setAttribute('position', new THREE.BufferAttribute(strandPos, 3));
  strandGeo.setDrawRange(0, 0);
  const strandMat = new THREE.LineBasicMaterial({
    color: CFG.strandColor, transparent: true, opacity: 0.9, depthWrite: false,
  });
  const strandLine = new THREE.Line(strandGeo, strandMat);
  strandLine.renderOrder = 6;
  scene.add(strandLine);

  // (No tip sprite: a bright point riding the growth read as a stray dot
  // sitting on the line. The line's own leading edge is enough.)

  /* Light travelling down the strand. Deliberately FINE and dense: the
     earlier version used few large soft sprites, which read as blobs and
     as stray dots whenever the strand was short. These are small, always
     spread over real drawn length, and never rendered before the strand
     has one. */
  const GLINTS = narrow ? 220 : 340;
  const glintParts = new Array(GLINTS);
  const gPosAttr = new THREE.BufferAttribute(new Float32Array(GLINTS * 3), 3);
  gPosAttr.setUsage(THREE.DynamicDrawUsage);
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', gPosAttr);
  gGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
  const glintMat = new THREE.PointsMaterial({
    map: dotTex, color: 0xffd9a0, size: 0.022, sizeAttenuation: true,
    transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glints = new THREE.Points(gGeo, glintMat);
  glints.renderOrder = 7;
  scene.add(glints);
  for (let i = 0; i < GLINTS; i++) {
    glintParts[i] = { t0: rand(), speed: 0.055 + rand() * 0.05 };
  }
  function updateGlints(timeSec, grow) {
    const pos = gPosAttr.array;
    const range = Math.max(0.25, grow);
    for (let i = 0; i < GLINTS; i++) {
      const p = glintParts[i];
      const t = ((p.t0 + timeSec * p.speed) % 1) * range;
      const f = t * STRAND_SAMPLES;
      const i0 = Math.floor(f), fr = f - i0;
      const a = i0 * 3, b = Math.min(i0 + 1, STRAND_SAMPLES) * 3;
      pos[i * 3] = strandPos[a] + (strandPos[b] - strandPos[a]) * fr;
      pos[i * 3 + 1] = strandPos[a + 1] + (strandPos[b + 1] - strandPos[a + 1]) * fr;
      pos[i * 3 + 2] = strandPos[a + 2] + (strandPos[b + 2] - strandPos[a + 2]) * fr;
    }
    gPosAttr.needsUpdate = true;
  }

  /* -------------------------------------------------------------------------
     The page line: a screen-space continuation of the strand. Once the
     extraction ends, a 3D strand cannot keep being a page-length line (it
     has finite world length and a frozen camera runs out of it, which is
     what made the line vanish and then reappear as its own curve). So the
     page phase draws the line in normalised device space with an
     orthographic camera: always exactly on the gutter, always spanning the
     full viewport, at any width, with the same particles flowing down it.
  ------------------------------------------------------------------------- */
  const pageScene = new THREE.Scene();
  const pageCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  pageCam.position.z = 5;

  const pageLineMat = new THREE.MeshBasicMaterial({
    color: CFG.strandColor, transparent: true, opacity: 0, depthWrite: false,
  });
  const pageLine = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), pageLineMat);
  pageScene.add(pageLine);

  // The same fine glints, continuing down the page-phase line
  const PAGE_GLINTS = narrow ? 70 : 110;
  const pgParts = new Array(PAGE_GLINTS);
  const pgPosAttr = new THREE.BufferAttribute(new Float32Array(PAGE_GLINTS * 3), 3);
  pgPosAttr.setUsage(THREE.DynamicDrawUsage);
  const pgGeo = new THREE.BufferGeometry();
  pgGeo.setAttribute('position', pgPosAttr);
  pgGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
  const pgMat = new THREE.PointsMaterial({
    map: dotTex, color: 0xffd9a0, size: 4, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  pageScene.add(new THREE.Points(pgGeo, pgMat));
  for (let i = 0; i < PAGE_GLINTS; i++) {
    pgParts[i] = { y0: rand(), speed: 0.16 + rand() * 0.14 };
  }
  function updatePageGlints(timeSec) {
    const pos = pgPosAttr.array;
    for (let i = 0; i < PAGE_GLINTS; i++) {
      const p = pgParts[i];
      const t = (p.y0 + timeSec * p.speed) % 1;
      pos[i * 3] = gutterNDC;
      pos[i * 3 + 1] = 1.1 - t * 2.2;
      pos[i * 3 + 2] = 0.01;
    }
    pgPosAttr.needsUpdate = true;
  }

  let gutterNDC = -0.9;
  function layoutPageLine() {
    // Same gutter the page rail measures: max(12px, 50% - 622px). On a phone
    // that lands 8px clear of the 20px text inset, which is a rail, not
    // crowding; the line stays at every width.
    const gutterPx = Math.max(12, stageW / 2 - 622) + 1;
    gutterNDC = (gutterPx / stageW) * 2 - 1;
    pageLine.position.set(gutterNDC, 0, 0);
    // Match the 3D strand's on-screen weight (a 1px GL line) closely enough
    // that the handover has nothing to give away
    pageLine.scale.set((2 / stageW) * 1.5, 2.2, 1);
  }

  /* -------------------------------------------------------------------------
     Sizing, postprocessing, cameras
  ------------------------------------------------------------------------- */
  let stageW = 1, stageH = 1, isPortrait = false, baseDistance = CFG.cameraDistance;
  let composer = null, bloomPass = null, afterPass = null;
  // Progress is measured over the WHOLE hero element, so it keeps advancing
  // while the stage scrolls away; rideEnd is the point where the sticky
  // range ends, i.e. where that scroll-away begins.
  let rideEnd = 0.8, scrollSpan = 1;

  function frameCamera() {
    stageW = Math.max(1, stage.clientWidth);
    stageH = Math.max(1, stage.clientHeight);
    camera.aspect = stageW / stageH;
    camera.updateProjectionMatrix();
    renderer.setSize(stageW, stageH);
    if (composer) composer.setSize(stageW, stageH);
    isPortrait = camera.aspect < 1;
    const fitHalf = isPortrait ? FIT_HALF_PORTRAIT : FIT_HALF_WIDTH;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const needed = fitHalf / (halfTan * camera.aspect);
    baseDistance = Math.max(CFG.cameraDistance,
      Math.min(needed, CFG.cameraDistance * 2.2));
    layoutPageLine();
    // The extraction gets the stage's scroll-away PLUS a stretch of the
    // page below it, so the shot has room to breathe instead of racing
    const total = Math.max(1, root.offsetHeight);
    scrollSpan = total + stageH * 0.9;
    rideEnd = Math.min(0.95, Math.max(0.4, (total - stageH) / scrollSpan));
  }
  frameCamera();

  try {
    const target = new THREE.WebGLRenderTarget(stageW, stageH, {
      type: THREE.HalfFloatType,
    });
    composer = new EffectComposer(renderer, target);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap));
    composer.addPass(new RenderPass(scene, camera));
    if (CFG.trails > 0 && !reducedMotion) {
      afterPass = new AfterimagePass(CFG.trails);
      composer.addPass(afterPass);
    }
    if (CFG.bloom) {
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(stageW, stageH),
        CFG.bloomStrength, CFG.bloomRadius, CFG.bloomThreshold);
      composer.addPass(bloomPass);
    }
    composer.addPass(new OutputPass());
    composer.setSize(stageW, stageH);
  } catch (e) {
    console.warn('ScrollHero: postprocessing unavailable, direct render.', e);
    composer = null;
  }

  function placeCamera(driftPhase) {
    const az = THREE.MathUtils.degToRad(
      CFG.cameraAzimuthDeg + Math.sin(driftPhase * Math.PI * 2) * CFG.cameraDriftDeg);
    const el = THREE.MathUtils.degToRad(CFG.cameraElevationDeg);
    camera.position.set(
      baseDistance * Math.cos(el) * Math.sin(az),
      baseDistance * Math.sin(el),
      baseDistance * Math.cos(el) * Math.cos(az));
    camera.lookAt(isPortrait ? 0.1 : 0.4, 0.08, 0);
    camera.rotateZ(THREE.MathUtils.degToRad(
      CFG.cameraRollDeg * (isPortrait ? 2.4 : 1)));
  }

  const DEBUG_P = new URLSearchParams(location.search).get('shp');
  let scrollTarget = 0, scrollP = 0;
  function readScroll() {
    const rect = root.getBoundingClientRect();
    scrollTarget = scrollSpan > 0
      ? Math.min(1, Math.max(0, -rect.top / scrollSpan)) : 0;
  }
  addEventListener('scroll', readScroll, { passive: true });

  let posCurve = null, tgtCurve = null;
  // Extraction camera solve, recomputed on resize
  const desc = {
    fromPos: new THREE.Vector3(), fromTgt: new THREE.Vector3(),
    camX: 0, camY: 0, dist: 6.0, halfH: 2,
  };
  const RIDE_ROLLS = [0, -4, -3, -2, -5];
  const tmpTarget = new THREE.Vector3();

  function buildRide() {
    placeCamera(0);
    RIDE_ROLLS[0] = CFG.cameraRollDeg * (isPortrait ? 2.4 : 1);
    const side = isPortrait ? 0.7 : 1;
    posCurve = new THREE.CatmullRomCurve3([
      camera.position.clone(),
      new THREE.Vector3(-3.9 * side, -0.6, 1.1),
      new THREE.Vector3(-1.6 * side, 0.45, 1.0),
      new THREE.Vector3(0.05, 0.0, 0.7),
      new THREE.Vector3(2.3 * side, 1.3, 6.3),
    ]);
    tgtCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(isPortrait ? 0.1 : 0.4, 0.08, 0),
      new THREE.Vector3(-2.9 * side, -0.85, -1.15),
      new THREE.Vector3(-1.0 * side, -0.15, -0.6),
      new THREE.Vector3(1.1, 0.4, 0.55),
      new THREE.Vector3(1.6 * side, 0.5, 0.5),
    ]);
    buildDescent();
  }

  // The extraction camera: pans left and travels DOWN with the strand. The
  // end pose is solved twice over so the last frame of the shot and the
  // first frame of the page line are the same pixels:
  //   x, so the straight run projects exactly onto the page gutter, and
  //   y, so the straight run fills the whole frame height (the curve is
  //      above the top edge by then).
  // Without the y solve, the strand only covered the lower half and the
  // top half read as empty navy.
  function buildDescent() {
    const depth = desc.dist - STRAND_Z;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    desc.halfH = halfTan * depth;
    const halfW = desc.halfH * camera.aspect;
    const gutterPx = Math.max(12, stageW / 2 - 622) + 1;
    const gNDC = (gutterPx / stageW) * 2 - 1;
    desc.camX = STRAND_X - gNDC * halfW;
    desc.camY = STRAND_STRAIGHT_Y - desc.halfH + 0.12;
    posCurve.getPoint(1, desc.fromPos);
    tgtCurve.getPoint(1, desc.fromTgt);
  }

  function rollAt(u) {
    const f = Math.min(3.999, Math.max(0, u * 4));
    const i = Math.floor(f);
    return THREE.MathUtils.lerp(RIDE_ROLLS[i], RIDE_ROLLS[i + 1], f - i);
  }
  function placeRide(u) {
    posCurve.getPoint(u, camera.position);
    tgtCurve.getPoint(u, tmpTarget);
    camera.lookAt(tmpTarget);
    camera.rotateZ(THREE.MathUtils.degToRad(rollAt(u)));
  }
  // The extraction camera moves on separated axes, which is what keeps the
  // finished line still:
  //   x and z settle EARLY (by d 0.45, while the strand is still drawing its
  //     curve). Horizontal motion is the only thing that can slide a vertical
  //     line sideways, so it is over before the vertical run exists.
  //   y KEEPS FOLLOWING the growing tip down, and a pure vertical move
  //     cannot change the line's screen x. This is what stops the frame from
  //     emptying out while the strand is still somewhere off-screen.
  function placeDescent(d, tipY) {
    const settleXZ = smooth(0, 0.45, d);
    const blendY = smooth(0, 0.22, d);
    const followY = Math.max(desc.camY, tipY + desc.halfH * 0.5);
    const x = THREE.MathUtils.lerp(desc.fromPos.x, desc.camX, settleXZ);
    const z = THREE.MathUtils.lerp(desc.fromPos.z, desc.dist, settleXZ);
    const y = THREE.MathUtils.lerp(desc.fromPos.y, followY, blendY);
    camera.position.set(x, y, z);
    tmpTarget.set(
      THREE.MathUtils.lerp(desc.fromTgt.x, x, blendY),
      THREE.MathUtils.lerp(desc.fromTgt.y, y, blendY),
      THREE.MathUtils.lerp(desc.fromTgt.z, STRAND_Z, blendY));
    camera.lookAt(tmpTarget);
    // Roll levels out to zero for the frontal page pose
    camera.rotateZ(THREE.MathUtils.degToRad(
      RIDE_ROLLS[4] * (1 - smooth(0, 0.35, d))));
  }

  const setFade = (el, v, interactive) => {
    if (!el) return;
    el.style.opacity = v;
    if (interactive) el.style.pointerEvents = v > 0.4 ? 'auto' : 'none';
  };
  function updateScrollUI(u, shot = 0) {
    // Windows overlap so the ride is never text-less, and everything is
    // clear of the screen before the shot hands over to the page
    setFade(ui.copy, 1 - smooth(0.16, 0.3, u), true);
    setFade(ui.beat1, fadeWin(u, 0.2, 0.3, 0.46, 0.56));
    setFade(ui.beat2, fadeWin(u, 0.5, 0.6, 0.74, 0.84));
    // beat3 has no fade-out of its own: it ramps in and HOLDS at full until the
    // extraction shot takes it off screen via the `shot` factor below. Expressing
    // that as a fadeWin ending 1.0..1.0 divided by zero and blanked it entirely.
    setFade(ui.beat3,
      smooth(0.8, 0.9, u) * (1 - smooth(0, 0.12, shot)), true);
    if (ui.flare) ui.flare.style.opacity = reducedMotion ? 0
      : 0.85 * fadeWin(u, 0.7, 0.75, 0.77, 0.84);
    if (ui.hint) ui.hint.style.opacity = smooth(0.05, 0.01, u);
  }

  let posterHidden = false;
  function hidePoster() {
    if (posterHidden || !ui.poster) return;
    posterHidden = true;
    ui.poster.classList.add('sh-hidden');
    setTimeout(() => ui.poster.remove(), 1100);
  }

  buildRide();
  readScroll();

  if (reducedMotion) {
    const renderStill = () => {
      placeCamera(0);
      updateParticles(2.6);
      if (composer) { composer.render(); }
      else { renderer.clear(); renderer.render(scene, camera); }
      hidePoster();
    };
    renderStill();
    updateScrollUI(0);
    addEventListener('scroll', () => { readScroll(); updateScrollUI(scrollTarget); },
      { passive: true });
    new ResizeObserver(() => { frameCamera(); buildRide(); renderStill(); }).observe(stage);
    return;
  }

  /* -------------------------------------------------------------------------
     Main loop: ride, extraction, then the transparent page phase
  ------------------------------------------------------------------------- */
  const start = performance.now();
  let warmed = 0, lastT = 0;

  const tick = () => {
    const elapsed = (performance.now() - start) / 1000;
    const dt = Math.min(0.1, (elapsed - lastT) || 0.016);
    lastT = elapsed;
    if (DEBUG_P !== null) {
      scrollP = Math.min(1, Math.max(0, parseFloat(DEBUG_P) || 0));
    } else {
      scrollP += (scrollTarget - scrollP) * Math.min(1, dt * 5);
    }

    /* TIMELINE. The whole point of this split is that the hero's river and
       the page's content must never share the screen: the extraction runs
       inside the pinned stage, the river is gone before the stage releases,
       and only the line remains while the page scrolls up.
         scrollP  0        -> shotStart : the ride (river + copy beats)
         shotStart-> ~+0.12: strand pulled, river fades out, still pinned
         rideEnd            : stage releases, page content starts rising
         .. shotEnd         : line completes, hands to the page line      */
    const shotStart = Math.max(0.3, rideEnd - 0.14);
    const shotEnd = Math.min(0.99, rideEnd + 0.22);
    const shot = smooth(shotStart, shotEnd, scrollP);
    const uRide = Math.min(1, scrollP / shotStart);

    // The river clears early in the shot, well before the stage releases,
    // so it can never be drawn over section text
    const riverOut = smooth(0.04, 0.3, shot);
    lineMat.opacity = CFG.filamentOpacity * (1 - riverOut);
    pMat.opacity = 1 - riverOut;
    backGlow.material.opacity = 0.32 * (1 - riverOut);
    waistGlow.visible = riverOut < 0.98;
    heroGroup.visible = riverOut < 0.999;

    // The screen-space line takes over only in the final sliver of the
    // shot, by which point the camera solve has the strand vertical, on the
    // gutter, and filling the frame: the two are the same pixels, so the
    // handover cannot read as two lines swapping.
    /* The rail continues onto the page at EVERY width: the whole point of the
       extraction is that the strand carries on down the page, so dropping it
       on phones breaks the idea. Narrow screens get a slimmer inset instead
       (see layoutPageLine), not a missing line. */
    const pageIn = smooth(0.94, 1, shot);
    const pageMode = shot >= 0.997;
    // CRITICAL: the postprocess chain (bloom + afterimage) writes OPAQUE
    // BLACK where the scene is empty, so a composited frame can never be
    // see-through. It covered the whole page and made the handoff look like
    // an instant jump. So: composer while the river is on screen (it needs
    // the glow and an opaque backdrop anyway), then a plain transparent
    // render once the river is gone, with the navy coming from the DOM.
    const seeThrough = riverOut >= 0.995;
    scene.background = seeThrough ? null : bgTex;
    pageLineMat.opacity = pageIn * 0.85;
    pgMat.opacity = pageIn * 0.9;

    // Growth completes just before the crossfade so the swap happens
    // between two full-height lines.
    const grow = Math.min(1, shot / 0.93);
    // Nothing of the strand exists until it has real length on screen
    const strandIn = smooth(0.06, 0.2, grow);
    strandGeo.setDrawRange(0,
      Math.max(0, Math.floor(grow * (STRAND_SAMPLES + 1))));
    const gi = Math.min(STRAND_SAMPLES, Math.floor(grow * STRAND_SAMPLES)) * 3;
    const tipY = strandPos[gi + 1];
    // The 3D strand hands off to the screen-space line, then stops drawing.
    // It stays fully lit until the very end so the shot is one continuous
    // object rather than a fade between two of them.
    const strandFade = 1 - smooth(0.96, 1, shot);
    strandMat.opacity = 0.9 * strandFade * strandIn;
    strandLine.visible = strandMat.opacity > 0.01;
    glintMat.opacity = 0.85 * strandFade * strandIn;
    glints.visible = glintMat.opacity > 0.01;

    // The camera finishes its whole move while the strand is still drawing
    // its CURVE, and is locked by the time the vertical run begins. A camera
    // still moving after that is what made the finished line drift sideways
    // and smear across to its final x.
    if (shot > 0) placeDescent(shot, tipY);
    else placeRide(uRide);
    // Wind down with the river, so that when the composer is dropped for the
    // transparent render there is nothing left to lose and no visible switch
    const preFade = riverOut;
    if (afterPass) {
      afterPass.uniforms.damp.value = CFG.trails * (1 - preFade);
    }
    if (bloomPass) {
      bloomPass.strength = CFG.bloomStrength * (1 - preFade);
    }
    glowBoost = 1 + 1.6 * fadeWin(uRide, 0.7, 0.75, 0.77, 0.84);
    updateScrollUI(uRide, shot);
    if (heroGroup.visible) updateParticles(elapsed);
    if (glints.visible) updateGlints(elapsed, grow);
    if (pgMat.opacity > 0.01) updatePageGlints(elapsed);

    if (pageMode) {
      // Transparent canvas: only the screen-space gutter line over the page
      renderer.clear();
      renderer.render(pageScene, pageCam);
    } else {
      if (composer && !seeThrough) {
        composer.render();
      } else {
        renderer.clear();
        renderer.render(scene, camera);
      }
      if (pageIn > 0) {
        renderer.clearDepth();
        renderer.render(pageScene, pageCam);
      }
    }
    if (++warmed > 12) hidePoster();
  };

  renderer.setAnimationLoop(tick);
  document.addEventListener('visibilitychange', () => {
    renderer.setAnimationLoop(document.hidden ? null : tick);
  });

  new ResizeObserver(() => { frameCamera(); buildRide(); }).observe(stage);
}
