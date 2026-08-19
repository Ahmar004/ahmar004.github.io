/**
 * Procedural geometry, textures and small helpers shared across the scene.
 * Nothing here loads a file — every texture is drawn to a canvas at boot,
 * which keeps the repository tiny and the site instant.
 */

import * as THREE from 'three';

/* ── textures ─────────────────────────────────────────────────── */

/** Wood grain for crate faces. */
function woodTexture(base = '#8b5a2b', grain = '#6b4423') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');

  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);

  // grain lines
  g.strokeStyle = grain;
  g.globalAlpha = 0.35;
  g.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const y = Math.random() * 128;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 128; x += 16) {
      g.lineTo(x, y + Math.sin((x + i * 9) * 0.08) * 2.2);
    }
    g.stroke();
  }

  // plank seams
  g.globalAlpha = 0.5;
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.lineWidth = 2;
  [32, 64, 96].forEach((y) => {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(128, y);
    g.stroke();
  });

  // border
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 122, 122);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A hanging wooden sign carrying a section label. */
export function signTexture(label, accent = '#ffd27f') {
  const w = 512;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');

  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#a9713c');
  grad.addColorStop(1, '#7c4a24');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 8;
  g.strokeRect(4, 4, w - 8, h - 8);

  g.strokeStyle = 'rgba(255,255,255,0.14)';
  g.lineWidth = 2;
  g.strokeRect(16, 16, w - 32, h - 32);

  g.font = 'bold 54px "JetBrains Mono", ui-monospace, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillText(label, w / 2 + 3, h / 2 + 4);
  g.fillStyle = accent;
  g.fillText(label, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ── crack decals ─────────────────────────────────────────────── */

/**
 * Damage cracks, drawn on a transparent canvas so they can be layered over
 * a crate's wood without rebuilding its own texture.
 *
 * The paths are fixed and the jitter comes from a seeded generator, so the
 * two-crack stage always contains the one-crack stage's line, unchanged:
 * damage accumulates on screen instead of being redrawn each hit.
 */
const CRACK_PATHS = [
  { x: 0.5, y: 0.06, angle: 1.5, len: 0.82 },
  { x: 0.1, y: 0.4, angle: 0.24, len: 0.64 },
  { x: 0.9, y: 0.92, angle: -2.1, len: 0.72 },
];

/** Tiny deterministic PRNG, so every crate cracks the same way. */
function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function drawCrack(g, size, spec, rand) {
  const steps = 10;
  const step = (spec.len * size) / steps;
  const points = [];
  let x = spec.x * size;
  let y = spec.y * size;
  let angle = spec.angle;

  for (let i = 0; i <= steps; i++) {
    points.push([x, y]);
    angle += (rand() - 0.5) * 0.85;
    x += Math.cos(angle) * step;
    y += Math.sin(angle) * step;
  }

  const stroke = (pts, width, colour, dx = 0, dy = 0) => {
    g.lineWidth = width;
    g.strokeStyle = colour;
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px + dx, py + dy) : g.moveTo(px + dx, py + dy)));
    g.stroke();
  };

  stroke(points, 7, 'rgba(30,17,8,0.35)');          // bruised wood around the split
  stroke(points, 2.6, 'rgba(11,6,3,0.95)');         // the split itself
  stroke(points, 1, 'rgba(255,231,186,0.4)', 1.6, 1.6); // splintered edge catching light

  // short splinters branching off the main line
  for (let i = 2; i < points.length - 1; i += 3) {
    const [px, py] = points[i];
    const a = spec.angle + (rand() - 0.5) * 2.4;
    const len = size * (0.05 + rand() * 0.07);
    stroke([[px, py], [px + Math.cos(a) * len, py + Math.sin(a) * len]], 1.8, 'rgba(11,6,3,0.8)');
  }
}

/** A transparent texture carrying the first `count` cracks. */
export function crackTexture(count) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const rand = seeded(20260819);
  CRACK_PATHS.slice(0, count).forEach((spec) => drawCrack(g, size, spec, rand));

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ── shared materials ─────────────────────────────────────────── */

export function createMaterials() {
  const wood = woodTexture();
  // One crack for the first hit, three for the second — see CrateField.
  const crackMaps = [crackTexture(1), crackTexture(3)];
  const crackStages = crackMaps.map(
    (map) =>
      new THREE.MeshStandardMaterial({
        map,
        transparent: true,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
  );
  return {
    crackStages,
    crate: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.92, metalness: 0 }),
    beam: new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.95 }),
    chain: new THREE.MeshStandardMaterial({ color: 0x8a8f9c, roughness: 0.45, metalness: 0.7 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x4a8a53, roughness: 1 }),
    groundDark: new THREE.MeshStandardMaterial({ color: 0x2b5233, roughness: 1 }),
    hill: new THREE.MeshStandardMaterial({ color: 0x2a3a5c, roughness: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x3b2418, roughness: 0.8 }),
    dispose() {
      wood.dispose();
      crackMaps.forEach((m) => m.dispose());
      crackStages.forEach((m) => m.dispose());
    },
  };
}

/* ── geometry helpers ─────────────────────────────────────────── */

const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

/**
 * Orients and stretches a unit-height cylinder so it spans `from` → `to`.
 * Used for chains and slingshot bands, both of which move every frame.
 */
export function stretchBetween(mesh, from, to) {
  _dir.subVectors(to, from);
  const length = _dir.length();
  if (length < 1e-4) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  _mid.addVectors(from, to).multiplyScalar(0.5);
  mesh.position.copy(_mid);
  _quat.setFromUnitVectors(_up, _dir.normalize());
  mesh.quaternion.copy(_quat);
  mesh.scale.set(1, length, 1);
}

/** A cylinder authored at unit height so `stretchBetween` can scale it. */
export function segmentMesh(radius, material) {
  const geo = new THREE.CylinderGeometry(radius, radius, 1, 6, 1, true);
  const mesh = new THREE.Mesh(geo, material);
  mesh.matrixAutoUpdate = true;
  return mesh;
}

/* ── birds ────────────────────────────────────────────────────── */

const BIRD_COLOURS = ['#f05c4a', '#4fc3f7', '#fbbf24', '#34d399', '#a78bfa', '#f472b6'];

/**
 * A round low-poly bird: body, beak, eyes, brow and tail feathers.
 * Original artwork — no third-party characters or assets.
 */
export function createBird(radius = 0.62, index = 0) {
  const group = new THREE.Group();
  const colour = new THREE.Color(BIRD_COLOURS[index % BIRD_COLOURS.length]);

  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius, 2),
    new THREE.MeshStandardMaterial({ color: colour, roughness: 0.65, flatShading: true })
  );
  body.castShadow = true;
  group.add(body);

  // pale belly patch
  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.72, 12, 10),
    new THREE.MeshStandardMaterial({ color: colour.clone().lerp(new THREE.Color('#fff2d6'), 0.75), roughness: 0.8 })
  );
  belly.position.set(0, -radius * 0.25, radius * 0.42);
  belly.scale.set(1, 0.8, 0.55);
  group.add(belly);

  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.3, radius * 0.62, 5),
    new THREE.MeshStandardMaterial({ color: 0xffa41b, roughness: 0.5, flatShading: true })
  );
  beak.position.set(radius * 0.86, -radius * 0.06, 0);
  beak.rotation.z = -Math.PI / 2;
  group.add(beak);

  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  const pupil = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.3 });
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.22, 10, 8), eyeWhite);
    eye.position.set(radius * 0.5, radius * 0.3, side * radius * 0.34);
    group.add(eye);

    const dot = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.1, 8, 6), pupil);
    dot.position.set(radius * 0.66, radius * 0.32, side * radius * 0.36);
    group.add(dot);

    // angry brow
    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.42, radius * 0.11, radius * 0.13),
      pupil
    );
    brow.position.set(radius * 0.58, radius * 0.52, side * radius * 0.34);
    brow.rotation.z = side * 0.34 - 0.34;
    group.add(brow);
  });

  const tailMat = new THREE.MeshStandardMaterial({
    color: colour.clone().multiplyScalar(0.72),
    roughness: 0.7,
    flatShading: true,
  });
  [-0.3, 0, 0.3].forEach((tilt) => {
    const feather = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.16, radius * 0.7, 4), tailMat);
    feather.position.set(-radius * 0.92, radius * 0.2 + tilt * 0.35, 0);
    feather.rotation.z = Math.PI / 2 + tilt;
    group.add(feather);
  });

  return group;
}
