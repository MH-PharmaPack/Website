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
  // Total pixel budget for the canvas. Fill cost is passes x pixels, and the
  // postprocess chain is ~12 fullscreen passes: a 1440p or 4K desktop left to
  // render at its native ratio pushed 4-8 MP through that chain every frame,
  // which is what dropped frames on otherwise capable PCs. The budget scales
  // the pixel ratio down so the chain costs roughly the same at any screen
  // size; the content is soft glow, so the downscale is very hard to see.
  maxRenderPixels: 2.6e6,
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
/* Tall-screen staging. Portrait framing shows only a narrow horizontal
   slice of the composition (about x -1.5..1.6), but the tributaries only
   separate further left than that, so on a phone both streams entered the
   frame as one blob at the left edge while the tall frame's vertical range
   went unused. Rather than a second hand-authored composition, the SAME
   approved stroke is rotated toward the tall diagonal (buyer enters from
   the bottom, supplier from the left, merged river exits top right) and
   compressed in x, so every approved relationship (confluence angle,
   braid, taper) survives. tall runs 0 (aspect >= 1, identity) to 1
   (aspect <= 0.5, full re-stage); see setStaging(). */
const TALL_ROT_DEG = 44;
const TALL_SX = 0.68;
const TALL_SY = 1.06;

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
    creds: root.querySelector('[data-sh="creds"]'),
    beat1: root.querySelector('[data-sh="beat1"]'),
    beat2: root.querySelector('[data-sh="beat2"]'),
    beat3: root.querySelector('[data-sh="beat3"]'),
    flare: root.querySelector('[data-sh="flare"]'),
    hint: root.querySelector('[data-sh="hint"]'),
    poster: root.querySelector('[data-sh="poster"]'),
  };

  // Phones are budgeted, not just scaled: fill cost rises with the SQUARE of
  // pixel ratio, so that cap is the single biggest lever, and the particle
  // loop is main-thread work that competes with scrolling.
  // Mutable: the tier is re-evaluated on resize (see frameCamera). Read once,
  // it stuck at whatever the window happened to be at load, so testing a
  // phone width in devtools and switching back left the desktop running the
  // phone's resolution until a reload.
  let narrow = window.matchMedia('(max-width: 820px)').matches;
  const particlesPerThread = narrow ? 110 : CFG.particlesPerThread;
  const strandFlowCount = narrow ? 280 : CFG.strandFlowCount;
  const pixelCap = narrow ? 1.15 : CFG.maxPixelRatio;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      // antialias applies to the DEFAULT framebuffer only, which the
      // composer path never draws the scene into (its passes render to
      // offscreen targets; the composer supplies its own MSAA there). It
      // exists for degrade level 4's direct render, where it is the only
      // thing keeping the filament hairlines from aliasing.
      canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    });
  } catch (e) {
    console.warn('ScrollHero: WebGL unavailable, static fallback.', e);
    root.classList.add('sh-fallback');
    return;
  }

  /* Software rendering: no GPU at all (remote desktops, virtual machines,
     blocklisted drivers, and the lab machines PageSpeed Insights tests
     on). WebGL still "works" there, but every frame is rasterised on the
     CPU: PageSpeed measured 32.7 s of CPU from this script in one mobile
     load (2026-09-24), i.e. a page frozen for as long as it is open, and
     even degrade level 4 cannot fix that. Such a machine gets the same
     static hero as a browser without WebGL, decided here, before the
     warm-up frames and the calibration render a single pixel. Nothing
     changes on any real GPU. ?shfb forces this path for review. */
  const softwareGL = (() => {
    try {
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
      return /swiftshader|llvmpipe|softpipe|software|basic render driver/i.test(name);
    } catch (e) {
      return false;
    }
  })();
  if (softwareGL || new URLSearchParams(location.search).has('shfb')) {
    console.info('ScrollHero: software rendering, static hero.');
    renderer.dispose();
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

  /* Staging state: identity on wide screens, rotate + scale on tall ones.
     built=false forces the first frameCamera() call to do the initial
     geometry build whatever the aspect is. */
  const STAGE = { tall: 0, cos: 1, sin: 0, sx: 1, sy: 1, built: false };
  const MERGE_S = MERGE.clone();
  const stageXY = (x, y) => [
    (x * STAGE.cos - y * STAGE.sin) * STAGE.sx,
    (x * STAGE.sin + y * STAGE.cos) * STAGE.sy,
  ];
  const stagePts = (list) => list.map(([x, y, z]) => {
    const [nx, ny] = stageXY(x, y);
    return [nx, ny, z];
  });
  let lineBoost = 1;

  /* Threads: offset helices around the joined spine. Per-thread randomness
     is deliberate; the structure lives in the spine. */
  function buildThread(inPoints, outPoints, theta0, baseR, twist) {
    const spine = new THREE.CatmullRomCurve3(
      [...inPoints, ...outPoints].map((p) => new THREE.Vector3(...p)));
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
      const dMerge = p.distanceTo(MERGE_S);
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

  /* Per-thread randomness is drawn ONCE (stable across staging rebuilds, so
     an orientation change re-poses the same fibres rather than rerolling
     them); geometry is (re)built from it in buildAllThreads(). */
  const threads = [];
  const perStream = CFG.threadCount / 2;
  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < perStream; i++) {
      threads.push({
        stream: s,
        theta0: (i / perStream) * Math.PI * 2 + rand() * 0.5,
        baseR: 0.18 + rand() * 0.26,
        twist: 0.22 + rand() * 0.33,
        pts: null, waistT: 0,
      });
    }
  }
  function buildAllThreads() {
    const inA = stagePts(IN_A), inB = stagePts(IN_B), out = stagePts(OUT);
    for (const th of threads) {
      const built = buildThread(th.stream === 0 ? inA : inB, out,
        th.theta0, th.baseR, th.twist);
      th.pts = built.pts;
      th.waistT = built.waistT;
    }
  }

  const buyerC = new THREE.Color(CFG.colorBuyer);
  const supplierC = new THREE.Color(CFG.colorSupplier);
  const mergedC = new THREE.Color(CFG.colorMerged);
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: CFG.filamentOpacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  // All filaments in ONE LineSegments rather than a Line per thread: 24
  // draw calls per frame collapse to 1. Segments (not a strip) because a
  // strip would join the end of one thread to the start of the next.
  const segCount = threads.length * SAMPLES * 2;
  const segPosAttr = new THREE.BufferAttribute(new Float32Array(segCount * 3), 3);
  const segColAttr = new THREE.BufferAttribute(new Float32Array(segCount * 3), 3);
  function fillSegments() {
    const cTmp = new THREE.Color();
    const sPos = segPosAttr.array, sCol = segColAttr.array;
    let w = 0;
    for (const th of threads) {
      const base = th.stream === 0 ? buyerC : supplierC;
      for (let i = 0; i < SAMPLES; i++) {
        for (const k of [i, i + 1]) {
          const t = k / SAMPLES;
          cTmp.copy(base).lerp(mergedC, smooth(th.waistT, th.waistT + 0.22, t));
          const endFade = smooth(0, 0.07, t) * smooth(1, 0.93, t);
          sPos[w] = th.pts[k * 3];
          sPos[w + 1] = th.pts[k * 3 + 1];
          sPos[w + 2] = th.pts[k * 3 + 2];
          sCol[w] = cTmp.r * endFade;
          sCol[w + 1] = cTmp.g * endFade;
          sCol[w + 2] = cTmp.b * endFade;
          w += 3;
        }
      }
    }
    segPosAttr.needsUpdate = true;
    segColAttr.needsUpdate = true;
  }
  {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', segPosAttr);
    geo.setAttribute('color', segColAttr);
    // Explicit: the auto-computed sphere would go stale on staging rebuilds
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 14);
    heroGroup.add(new THREE.LineSegments(geo, lineMat));
  }

  const COUNT = CFG.threadCount * particlesPerThread;
  const particles = new Array(COUNT);
  {
    // Interleaved thread-last, NOT thread-first: the degrade ladder trims
    // the particle count by drawing a contiguous prefix of this array, and
    // a prefix of a thread-first ordering would strip entire threads (the
    // whole buyer stream keeps its glints, the supplier stream goes bare).
    // Ordered this way, any prefix covers every thread evenly.
    let n = 0;
    for (let i = 0; i < particlesPerThread; i++) {
      for (let th = 0; th < threads.length; th++) {
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

  // Colour changes far more slowly than position, so it is recomputed and
  // re-uploaded on alternate frames only. That halves both the per-particle
  // maths and the CPU-to-GPU traffic (this buffer is the single largest
  // per-frame upload in the scene) with nothing visible lost.
  let colTick = 0;
  function updateParticles(timeSec) {
    const loopPhase = (timeSec / CFG.loopSeconds) % 1;
    const pos = posAttr.array, col = colAttr.array;
    const doCol = (colTick++ & 1) === 0;
    // particleActive, not COUNT: the degrade ladder halves the live prefix
    for (let n = 0; n < particleActive; n++) {
      const pt = particles[n];
      const th = threads[pt.thread];
      const t = (pt.t0 + timeSec * 0.09 * CFG.flowSpeed * pt.speed) % 1;
      const f = t * SAMPLES;
      const i0 = f | 0, fr = f - i0;
      const a = i0 * 3, b = (i0 < SAMPLES ? i0 + 1 : SAMPLES) * 3;
      const px = th.pts[a] + (th.pts[b] - th.pts[a]) * fr;
      const py = th.pts[a + 1] + (th.pts[b + 1] - th.pts[a + 1]) * fr;
      const pz = th.pts[a + 2] + (th.pts[b + 2] - th.pts[a + 2]) * fr;
      const i3 = n * 3;
      pos[i3] = px; pos[i3 + 1] = py; pos[i3 + 2] = pz;
      if (!doCol) continue;
      tmpColor.copy(th.stream === 0 ? buyerC : supplierC)
        .lerp(mergedC, smooth(th.waistT, th.waistT + 0.22, t));
      const packet = 0.7 + 0.3 * Math.sin((loopPhase - t * 1.5) * Math.PI * 2);
      // sqrt of the squared length, not Math.hypot: hypot does overflow-safe
      // scaling we do not need and costs several times more per call
      const nearWaist = 1 + 1.3 * CFG.waistGlow *
        smooth(0.28, 0.02, Math.sqrt(px * px + py * py + pz * pz));
      const endFade = smooth(0, 0.08, t) * smooth(1, 0.92, t);
      const bright = pt.bright * packet * nearWaist * endFade * brightBoost;
      col[i3] = tmpColor.r * bright;
      col[i3 + 1] = tmpColor.g * bright;
      col[i3 + 2] = tmpColor.b * bright;
    }
    posAttr.needsUpdate = true;
    if (doCol) colAttr.needsUpdate = true;
    const surge = 0.7 + 0.3 * Math.sin((loopPhase - 0.75) * Math.PI * 2);
    const g = CFG.waistGlow * surge * glowBoost;
    waistGlow.material.opacity = (0.05 + 0.09 * g) * levelGlowBoost;
    waistGlow.scale.setScalar(0.5 + 0.3 * g);
  }

  /* -------------------------------------------------------------------------
     The extracted strand: a polyline that grows along its curve with the
     extraction progress, plus flow particles that ride the drawn portion,
     and a glowing tip while it grows. Warm copper-gold, normal blending,
     so it reads on the navy AND later on the paper.
  ------------------------------------------------------------------------- */
  const strandPos = new Float32Array((STRAND_SAMPLES + 1) * 3);
  const strandPosAttr = new THREE.BufferAttribute(strandPos, 3);
  function buildStrand() {
    // The head follows the staged river exit; the tail (the vertical dive
    // the gutter camera solve depends on) is never staged. The bridge point
    // eases the staged head into the fixed dive.
    const pts = STRAND_PTS.map((p) => [...p]);
    for (let i = 0; i < 4; i++) {
      const [x, y] = stageXY(pts[i][0], pts[i][1]);
      pts[i][0] = x; pts[i][1] = y;
    }
    pts[4][1] = THREE.MathUtils.lerp(pts[4][1], -0.9, STAGE.tall);
    const curve = new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(...p)));
    const p = new THREE.Vector3();
    for (let i = 0; i <= STRAND_SAMPLES; i++) {
      curve.getPointAt(i / STRAND_SAMPLES, p);
      strandPos[i * 3] = p.x; strandPos[i * 3 + 1] = p.y; strandPos[i * 3 + 2] = p.z;
    }
    strandPosAttr.needsUpdate = true;
  }
  const strandGeo = new THREE.BufferGeometry();
  strandGeo.setAttribute('position', strandPosAttr);
  strandGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
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
      pos[i * 3] = lineNDC;
      pos[i * 3 + 1] = 1.1 - t * 2.2;
      pos[i * 3 + 2] = 0.01;
    }
    pgPosAttr.needsUpdate = true;
  }

  let lineNDC = -0.9;
  const STRIP_W = 72; // px of canvas kept once only the rail is drawn
  let stripMode = false;
  function layoutPageLine() {
    // Same gutter the page rail measures: max(12px, 50% - 622px). On a phone
    // that lands 8px clear of the 20px text inset, which is a rail, not
    // crowding; the line stays at every width.
    const gutterPx = Math.max(12, stageW / 2 - 622) + 1;
    if (stripMode) {
      // Once the hero is done the only thing left to draw is a hairline in
      // the gutter, so the canvas shrinks to a strip around it. A
      // viewport-filling fixed canvas has to be composited on every scroll
      // frame; this is ~95% less of it, and it is what makes scrolling the
      // page below the hero cheap on a phone.
      canvas.style.left = `${gutterPx - STRIP_W / 2}px`;
      canvas.style.width = `${STRIP_W}px`;
      canvas.style.height = '100%';
      renderer.setSize(STRIP_W, stageH, false);
      lineNDC = 0;
      pageLine.scale.set((2 / STRIP_W) * 1.5, 2.2, 1);
    } else {
      canvas.style.left = '0px';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      lineNDC = (gutterPx / stageW) * 2 - 1;
      // Match the 3D strand's on-screen weight (a 1px GL line) closely enough
      // that the handover has nothing to give away
      pageLine.scale.set((2 / stageW) * 1.5, 2.2, 1);
    }
    pageLine.position.set(lineNDC, 0, 0);
  }
  function setStrip(on) {
    if (on === stripMode) return;
    stripMode = on;
    if (on) layoutPageLine();
    else frameCamera(); // restores full canvas, composer and camera aspect
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

  // Resolution follows the CURRENT viewport, not whatever it was at load.
  // Three caps on the scene ratio: device ratio, tier cap, and the pixel
  // budget (see CFG.maxRenderPixels). The composer additionally carries the
  // adaptive degrade scale, stepped down at runtime if frames drop.
  let degradeScale = 1;
  function applyQuality() {
    const cap = narrow ? 1.15 : CFG.maxPixelRatio;
    const budget = Math.sqrt(CFG.maxRenderPixels / Math.max(1, stageW * stageH));
    const pr = Math.max(0.65, Math.min(window.devicePixelRatio || 1, cap, budget));
    renderer.setPixelRatio(pr);
    if (composer) composer.setPixelRatio((narrow ? pr * 0.7 : pr) * degradeScale);
  }

  /* Look compensation. A degrade level that only REMOVES things (bloom,
     trails, particles, atmosphere) reads as a stripped scene, which is the
     confirmed failure mode of the first floor implementation. What the
     deep levels shed is postprocess RESOLUTION, which is the expensive
     axis; presence is cheap, so each level buys some back: bigger and
     brighter particles, denser filament opacity, a stronger waist sprite.
     Both this and the tall staging scale the same materials, so the two
     factors compose in one place. */
  let levelSizeBoost = 1, levelLineBoost = 1, levelGlowBoost = 1, brightBoost = 1;
  function applyLook() {
    pMat.size = CFG.particleSize * (1 + 0.9 * STAGE.tall) * levelSizeBoost;
    glintMat.size = 0.022 * (1 + 0.8 * STAGE.tall);
  }

  /* Re-stage the composition for the current aspect. Rebuilds are cheap
     (once per orientation change, never per frame) and keyed on a real
     threshold so resize jitter does not thrash them. */
  function setStaging(tall) {
    if (STAGE.built && Math.abs(tall - STAGE.tall) < 0.015) return;
    STAGE.tall = tall;
    STAGE.built = true;
    const rot = THREE.MathUtils.degToRad(TALL_ROT_DEG * tall);
    STAGE.cos = Math.cos(rot);
    STAGE.sin = Math.sin(rot);
    STAGE.sx = 1 + (TALL_SX - 1) * tall;
    STAGE.sy = 1 + (TALL_SY - 1) * tall;
    const [mx, my] = stageXY(MERGE.x, MERGE.y);
    MERGE_S.set(mx, my, MERGE.z);
    buildAllThreads();
    fillSegments();
    buildStrand();
    // The tall framing pulls the camera much further back, which halves the
    // apparent size of everything; give the primitives their presence back.
    // (Sizes are set in applyLook so the level boost composes with this.)
    lineBoost = 1 + 0.5 * tall;
    backGlow.scale.set(16 - 5 * tall, 10 + 4 * tall, 1);
    applyLook();
  }

  function frameCamera() {
    stageW = Math.max(1, stage.clientWidth);
    stageH = Math.max(1, stage.clientHeight);
    narrow = stageW <= 820;
    applyQuality();
    camera.aspect = stageW / stageH;
    camera.updateProjectionMatrix();
    // In strip mode layoutPageLine() owns the renderer size; sizing to the
    // full stage here would undo the strip on every resize tick
    if (!stripMode) renderer.setSize(stageW, stageH);
    if (composer) composer.setSize(stageW, stageH);
    isPortrait = camera.aspect < 1;
    setStaging(smooth(1.0, 0.5, camera.aspect));
    const fitHalf = isPortrait ? FIT_HALF_PORTRAIT : FIT_HALF_WIDTH;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const needed = fitHalf / (halfTan * camera.aspect);
    baseDistance = Math.max(CFG.cameraDistance,
      Math.min(needed, CFG.cameraDistance * 2.2));
    // Depth cueing tracks the framing distance. The bounds used to be fixed
    // at the DESKTOP framing distance, so the portrait camera (pulled back
    // to ~11 to fit the slice) left the entire scene in the fog's dim end:
    // a large part of why the hero read as washed out on phones.
    scene.fog.near = baseDistance + 1.1;
    scene.fog.far = baseDistance + 8.6;
    layoutPageLine();
    // The extraction gets the stage's scroll-away PLUS a stretch of the
    // page below it, so the shot has room to breathe instead of racing
    const total = Math.max(1, root.offsetHeight);
    scrollSpan = total + stageH * 0.9;
    rideEnd = Math.min(0.95, Math.max(0.4, (total - stageH) / scrollSpan));
  }
  frameCamera();

  try {
    // MSAA on the composer target. Without it every filament is a hard
    // aliased hairline (the renderer's own antialias flag does nothing once
    // rendering goes through a composer target), which reads as a
    // low-resolution image no matter what the pixel ratio is. Phones skip
    // it: they cannot spare the bandwidth and their pixel density hides the
    // stair-stepping anyway.
    const target = new THREE.WebGLRenderTarget(stageW, stageH, {
      type: THREE.HalfFloatType,
      samples: narrow ? 0 : 4,
    });
    composer = new EffectComposer(renderer, target);
    // The postprocess chain is the heaviest thing on a phone: bloom alone is
    // ~10 fullscreen passes. Running the chain at 70% linear resolution is
    // half the pixels, and on content made entirely of soft glow it is very
    // hard to see. The scene itself still renders at the full cap.
    composer.addPass(new RenderPass(scene, camera));
    // Trails cost a fullscreen pass plus a full texture copy every frame.
    // Worth it on desktop, not on a phone where bloom already carries the look.
    if (CFG.trails > 0 && !reducedMotion && !narrow) {
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
    applyQuality(); // composer exists now; give it the budgeted ratio
  } catch (e) {
    console.warn('ScrollHero: postprocessing unavailable, direct render.', e);
    composer = null;
  }

  /* Adaptive degrade: whatever the device claims, the ride must hold frame
     rate. Sustained long frames shed composer resolution first, then the
     afterimage pass (a fullscreen copy per frame). Steps are one-way:
     flipping back up re-janks at the exact moment the headroom returns. */
  let slowFrames = 0, degradeLevel = 0;
  let loopStartAt = -1; // elapsed-seconds when the visible loop first engaged
  /* Five levels now. The old floor (level 3) still ran the full composer:
     4x MSAA on a HalfFloat target plus the ~10-pass bloom chain, just at
     0.55 scale. A UHD-620-class laptop iGPU cannot hold that at ANY scale,
     which is why low-end machines stayed janky however far the ladder
     went. Level 4 is a genuinely different floor: no composer at all, one
     plain render pass. The additive materials still self-glow against the
     navy, so it reads as a lighter cousin of the look, not a broken one. */
  const DEGRADE_SCALES = [1, 0.85, 0.7, 0.55, 0.5];
  let particleActive = COUNT;
  function applyDegrade(level) {
    degradeLevel = level;
    slowFrames = 0;
    degradeScale = DEGRADE_SCALES[level];
    if (level >= 2 && afterPass) afterPass.enabled = false;
    // Weak GPUs usually ship with weak CPUs: trim the per-frame particle
    // loop and its buffer upload along with the pixel work, but never by
    // half at level 3 - the density loss read as a stripped scene. Each
    // cut is paid back in size and brightness (see applyLook).
    particleActive = level >= 4 ? COUNT >> 1
      : level >= 3 ? Math.floor(COUNT * 0.75) : COUNT;
    pGeo.setDrawRange(0, particleActive);
    levelSizeBoost = level >= 4 ? 1.5 : level >= 3 ? 1.18 : 1;
    brightBoost = level >= 4 ? 1.35 : level >= 3 ? 1.12 : 1;
    // Without bloom (level 4) the filaments and waist carry the glow alone
    levelLineBoost = level >= 4 ? 1.9 : 1;
    levelGlowBoost = level >= 4 ? 1.8 : 1;
    // Full-viewport mix-blend-mode layers (grain) and the near dust sheet
    // force an extra composite over the changing canvas every frame. Shed
    // only at level 3+: losing them at 2 flattened a look that machines at
    // that tier can actually afford.
    root.classList.toggle('sh-lite', level >= 3);
    applyLook();
    applyQuality();
  }
  function stepDown() {
    if (degradeLevel >= DEGRADE_SCALES.length - 1) return;
    applyDegrade(degradeLevel + 1);
  }

  /* Startup calibration, run behind the intro sheet after shader warmup:
     time a few real composer frames with a forced GPU sync and START at
     the quality level whose estimated cost fits the frame budget, instead
     of opening at full quality and shedding reactively while the visitor
     watches the jank. Measured on the client's own Iris Xe: full quality
     costs ~30 ms/frame (33 fps); the reactive ladder took ~4 s to react.
     Cost scales with composer pixel count, so each level's factor is
     roughly scale^2 (level 2+ also drops the afterimage copy). 12 ms fits
     a 60 Hz frame and a 144 Hz half-rate beat alike. */
  // Level 4's factor is measured, not scale^2: dropping the composer
  // removes MSAA resolve, HalfFloat bandwidth, the bloom chain and the
  // output pass, leaving one plain pass; that is roughly a tenth of the
  // full pipeline, not half.
  const LEVEL_COST_FACTOR = [1, 0.72, 0.42, 0.26, 0.12];
  let calibratedCost = -1, levelPicked = false;
  // ?shl=N pins the starting level (diagnosis on real devices in the
  // field, same spirit as ?shd and ?shp). The watchdog can still step
  // further down from a pinned level; it never steps up.
  const FORCED_LEVEL = (() => {
    const v = parseInt(new URLSearchParams(location.search).get('shl'), 10);
    return Number.isInteger(v) && v >= 0 && v < DEGRADE_SCALES.length ? v : -1;
  })();
  /* The GPU measurement is the expensive half (~100 ms of forced sync), so
     it runs SYNCHRONOUSLY in the init task, before the intro's first
     visual frame can possibly paint. Deferring it to the display-rate
     sample put its stall ~200 ms into the visible intro, right on the
     wordmark's landing beat, which read as the logo animation dropping
     frames. Picking the level from the measurement is pure arithmetic and
     happens later, once the display rate is known. */
  function measureCost() {
    if (!composer) return;
    try {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      // gl.finish() on ANGLE/D3D11 returns without waiting for the GPU
      // (measured 0 ms for a pipeline that takes ~30 ms), so force a real
      // sync by reading a pixel back: readPixels cannot return until every
      // queued command has executed.
      const syncRead = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      composer.render(); syncRead(); // settle, untimed
      // Min of the samples, not the mean: a transient main-thread hitch
      // during one sample must not over-degrade the whole session.
      let best = Infinity;
      for (let i = 0; i < 2; i++) {
        const t0 = performance.now();
        composer.render(); syncRead();
        best = Math.min(best, performance.now() - t0);
      }
      calibratedCost = best;
    } catch (e) { /* measurement is best-effort; the watchdog still runs */ }
  }
  function pickLevel() {
    // Cheap: called at display-sample completion, the 700 ms fallback, or
    // at latest in begin() before the first visible frame.
    if (levelPicked) return;
    levelPicked = true;
    let level = 0;
    if (FORCED_LEVEL >= 0) {
      level = FORCED_LEVEL;
    } else {
      if (calibratedCost < 2) return; // no valid measurement; watchdog takes over
      // Budget = the interval of one rendered beat (two vsyncs when paced)
      // minus ~4 ms headroom for everything else the page does per frame.
      const beat = paceHalf ? displayInterval * 2 : displayInterval;
      const budget = Math.min(14, Math.max(7, beat - 4));
      level = DEGRADE_SCALES.length - 1;
      for (let l = 0; l < DEGRADE_SCALES.length; l++) {
        if (calibratedCost * LEVEL_COST_FACTOR[l] <= budget) { level = l; break; }
      }
    }
    console.info(`ScrollHero: calibrated ${calibratedCost.toFixed(1)}ms/frame -> level ${level}${FORCED_LEVEL >= 0 ? ' (forced)' : ''}`);
    if (level > 0) {
      applyDegrade(level);
      // Changing the composer's pixel ratio only takes effect at the next
      // render, so without this the resized bloom targets were ALLOCATED at
      // the first visible frame, i.e. exactly at the dock: a 20-80 ms GPU
      // stall right as the logo starts flying. Absorb it here, while the
      // intro sheet still covers everything.
      if (!loopOn) tick();
    }
  }

  /* Display cadence, sampled while the intro owns the screen. On fast
     panels (>105 Hz) the hero renders every SECOND vsync: a rock-steady
     72 fps on a 144 Hz display reads as smooth, while chasing 144 and
     landing on an oscillating 30-50 reads as broken. Unmeasured (hidden
     tab) leaves the default 60 Hz assumption and full-rate rendering. */
  let displayInterval = 16.7, paceHalf = false, paceFlip = 0;
  {
    const samples = [];
    let sLast = 0, sCount = 0;
    const sampleTick = (now) => {
      if (sLast > 0) {
        const d = now - sLast;
        if (d > 2 && d < 50) samples.push(d);
      }
      sLast = now;
      if (++sCount < 30) requestAnimationFrame(sampleTick);
      else {
        if (samples.length >= 10) {
          samples.sort((a, b) => a - b);
          displayInterval = samples[Math.floor(samples.length / 2)];
          paceHalf = displayInterval < 9.5;
        }
        pickLevel(); // display rate known; pick the starting level now
      }
    };
    requestAnimationFrame(sampleTick);
    // Occluded tabs never finish the sample; pick on wall clock so the
    // level is still chosen before any plausible first visible frame.
    setTimeout(pickLevel, 700);
  }

  // Portrait used to multiply the roll 2.4x to tip the (then horizontal)
  // composition toward the diagonal; the staging now rotates the geometry
  // itself, so the roll only breathes a little with tallness.
  const rollMul = () => 1 + 0.3 * STAGE.tall;
  function placeCamera(driftPhase) {
    const az = THREE.MathUtils.degToRad(
      CFG.cameraAzimuthDeg + Math.sin(driftPhase * Math.PI * 2) * CFG.cameraDriftDeg);
    const el = THREE.MathUtils.degToRad(CFG.cameraElevationDeg);
    camera.position.set(
      baseDistance * Math.cos(el) * Math.sin(az),
      baseDistance * Math.sin(el),
      baseDistance * Math.cos(el) * Math.cos(az));
    camera.lookAt(isPortrait ? 0.1 : 0.4, 0.08, 0);
    camera.rotateZ(THREE.MathUtils.degToRad(CFG.cameraRollDeg * rollMul()));
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
    RIDE_ROLLS[0] = CFG.cameraRollDeg * rollMul();
    // Keyframes ride THROUGH the staged geometry, so they take the same
    // staging transform as the spine (this replaces the old blanket 0.7 x
    // squeeze for portrait). The opening pose and its target stay unstaged:
    // they come from placeCamera(0), which frames whatever the staging is.
    const rp = stagePts([
      [-3.9, -0.6, 1.1], [-1.6, 0.45, 1.0], [0.05, 0.0, 0.7], [2.3, 1.3, 6.3],
    ]);
    const rt = stagePts([
      [-2.9, -0.85, -1.15], [-1.0, -0.15, -0.6], [1.1, 0.4, 0.55], [1.6, 0.5, 0.5],
    ]);
    posCurve = new THREE.CatmullRomCurve3([
      camera.position.clone(), ...rp.map((p) => new THREE.Vector3(...p)),
    ]);
    tgtCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(isPortrait ? 0.1 : 0.4, 0.08, 0),
      ...rt.map((p) => new THREE.Vector3(...p)),
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
    const copyOut = 1 - smooth(0.16, 0.3, u);
    setFade(ui.copy, copyOut, true);
    // The credential row belongs to the opening frame, so it leaves on the
    // same curve as the copy rather than lingering into the ride.
    setFade(ui.creds, copyOut);
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
    // Pacing: on fast displays render every SECOND vsync (see paceHalf).
    // During the dock window (first 1.2 s after the loop engages) halve
    // again: the flying logo is the most-watched pixels on the page, and
    // hero GPU work contending with the compositor there made the fly
    // judder. The river is behind the lifting sheet for most of it anyway.
    // dt derives from elapsed, so rendered frames integrate skipped beats.
    const docking = loopStartAt >= 0 && elapsed - loopStartAt < 1.2;
    // The dock multiplier adapts to the measured frame cost: on a GPU whose
    // hero frame costs more than ~half a 60 Hz budget, even a quarter-rate
    // beat drops the compositor frame it lands on, so weak machines render
    // only a handful of frames across the whole flight.
    const estCost = calibratedCost > 0
      ? calibratedCost * LEVEL_COST_FACTOR[degradeLevel] : 8;
    const paceDiv = (paceHalf ? 2 : 1) * (docking ? (estCost > 9 ? 4 : 2) : 1);
    if (paceDiv > 1) {
      paceFlip = (paceFlip + 1) % paceDiv;
      if (paceFlip !== 0) return;
    }
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
    // so it can never be drawn over section text. Tall screens hold it a
    // little longer (the release comes at shot ~0.36 there and the frame
    // between river-out and strand-in was reading empty); it is still fully
    // gone before any section text can arrive.
    const riverOut = smooth(0.04, 0.3 + 0.12 * STAGE.tall, shot);
    lineMat.opacity = CFG.filamentOpacity * lineBoost * levelLineBoost * (1 - riverOut);
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

    // Shrink the canvas to the gutter strip for the page phase, restore it
    // when scrolling back up into the hero
    setStrip(pageMode);

    // Frame-rate watchdog. Grace period counts from when the VISIBLE loop
    // engaged (warmup frames and the intro idle don't count); after that,
    // ~0.7s of sustained >26 ms frames sheds quality.
    if (!pageMode && composer && degradeLevel < DEGRADE_SCALES.length - 1 &&
        loopStartAt >= 0 && elapsed - loopStartAt > 1.5) {
      if (dt > 0.022) slowFrames += 1;
      else if (slowFrames > 0) slowFrames -= 0.5;
      if (slowFrames >= 15) stepDown();
    }

    if (pageMode) {
      // Transparent canvas: only the screen-space gutter line over the page
      renderer.clear();
      renderer.render(pageScene, pageCam);
    } else {
      // Level 4 skips the composer entirely (see the ladder note): one
      // plain pass, scene.background still supplies the opaque navy while
      // the river is on screen, exactly like the post-river direct path.
      if (composer && !seeThrough && degradeLevel < 4) {
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
    // Two warmup frames already proved the pipeline renders real content, so
    // the poster can go after a couple of live frames. It used to wait 12,
    // which pushed its 900 ms fade past the intro's dock and made the river
    // read as arriving late.
    if (++warmed > 3) hidePoster();
  };

  /* Startup sequencing. WebGL's real cost is the FIRST frame: every material
     compiles its shaders and every render target allocates on first use,
     which blocks the main thread for hundreds of ms. Deferring init until
     the intro docked put that stall at the exact moment the page became
     visible: the river appeared late and its first seconds dropped frames.
     So the scene builds and WARMS UP here, immediately - two full composer
     frames behind the intro sheet, before the intro's first visual beat
     (this module evaluates at DOMContentLoaded; the intro waits on a font
     race) - then the loop idles while the intro owns the screen and resumes
     the moment the dock begins. The first visible frame runs pre-compiled
     shaders only, so the river is flowing as the sheet lifts. */
  let loopOn = false;
  function setLoop(on) {
    loopOn = on;
    if (on && !document.hidden) {
      // Stamp the watchdog's grace clock only when the loop genuinely
      // engages on a VISIBLE page: a dock that happens in a hidden tab
      // (autoDock is a plain timer and keeps running there) enables the
      // loop without rendering a single frame, and stamping then would
      // hand the first real frames after refocus straight to the watchdog
      // with the grace already spent. Also forgive any jank debt across a
      // pause; refocus frames are always rough.
      if (loopStartAt < 0) loopStartAt = (performance.now() - start) / 1000;
      slowFrames = 0;
    }
    renderer.setAnimationLoop(on && !document.hidden ? tick : null);
  }
  document.addEventListener('visibilitychange', () => setLoop(loopOn));

  /* Diagnostic HUD, activated only by a ?shd URL param. Runs its OWN rAF
     loop so it measures the page's real frame cadence during every phase,
     including while the hero loop is idled behind the intro. Each 500 ms
     window is drawn on screen and appended to localStorage 'shd-log' so a
     run in any same-origin tab can be read back afterwards. */
  if (new URLSearchParams(location.search).has('shd')) {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;left:8px;bottom:8px;z-index:99999;background:rgba(0,0,0,.78);' +
      'color:#7fff9f;font:11px/1.5 monospace;padding:6px 9px;pointer-events:none;' +
      'white-space:pre;border-radius:4px';
    el.textContent = 'shd: warming';
    document.body.appendChild(el);
    const log = [];
    let hLast = performance.now(), hFrames = 0, hWorst = 0, hWin = hLast;
    const hudLoop = () => {
      const now = performance.now(), hDt = now - hLast;
      hLast = now;
      hFrames += 1;
      if (hDt > hWorst) hWorst = hDt;
      if (now - hWin >= 500) {
        const entry = {
          t: Math.round(now),
          fps: Math.round((hFrames * 1000) / (now - hWin)),
          worst: Math.round(hWorst),
          lvl: degradeLevel,
          loop: loopOn ? 1 : 0,
          pace: paceHalf ? 2 : 1,
        };
        log.push(entry);
        if (log.length > 240) log.shift();
        try { localStorage.setItem('shd-log', JSON.stringify(log)); } catch (e) { /* full/blocked */ }
        entry.cal = Math.round(calibratedCost);
        el.textContent =
          `fps ${entry.fps}  worst ${entry.worst}ms\n` +
          `level ${degradeLevel}  loop ${loopOn ? 'on' : 'idle'}  pace ${paceHalf ? '1/2' : 'full'}\n` +
          `pr ${renderer.getPixelRatio().toFixed(2)}  buf ${renderer.domElement.width}x${renderer.domElement.height}  ` +
          `hz ${Math.round(1000 / displayInterval)}  cal ${calibratedCost < 0 ? '?' : Math.round(calibratedCost) + 'ms'}`;
        hFrames = 0; hWorst = 0; hWin = now;
      }
      requestAnimationFrame(hudLoop);
    };
    requestAnimationFrame(hudLoop);
  }

  tick();
  tick(); // second frame catches programs the first one's state changes gated
  measureCost(); // sync GPU timing, inside the same invisible init task

  const introUp =
    document.documentElement.classList.contains('intro-pending') &&
    !window.__mhIntroDone;
  if (introUp) {
    let began = false;
    const begin = () => {
      if (began) return;
      began = true;
      // Scroll is never locked while the intro is up, so the visitor may be
      // anywhere on the page by now. Snap the eased scroll state to reality
      // before the first frame; otherwise the reveal spends ~half a second
      // sweeping the hero scene across whatever section they scrolled to.
      readScroll();
      scrollP = scrollTarget;
      pickLevel(); // no-op if already run; covers a click-skip early dock
      setLoop(true);
    };
    addEventListener('mh:intro-done', begin, { once: true });
    // Belt-and-braces floor in case the intro never signals, counted in
    // VISIBLE time (in a hidden tab the intro legitimately waits for focus,
    // and there is nothing to render for anyway).
    let floorTimer = null;
    const armFloor = () => {
      if (floorTimer) { clearTimeout(floorTimer); floorTimer = null; }
      if (began) return;
      if (document.visibilityState === 'visible') floorTimer = setTimeout(begin, 10000);
    };
    document.addEventListener('visibilitychange', armFloor);
    armFloor();
  } else {
    setLoop(true);
  }

  new ResizeObserver(() => { frameCamera(); buildRide(); }).observe(stage);
}
