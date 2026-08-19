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

/* ── shared materials ─────────────────────────────────────────── */

export function createMaterials() {
  const wood = woodTexture();
  return {
    crate: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.92, metalness: 0 }),
    beam: new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.95 }),
    chain: new THREE.MeshStandardMaterial({ color: 0x8a8f9c, roughness: 0.45, metalness: 0.7 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x4a8a53, roughness: 1 }),
    groundDark: new THREE.MeshStandardMaterial({ color: 0x2b5233, roughness: 1 }),
    hill: new THREE.MeshStandardMaterial({ color: 0x2a3a5c, roughness: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x3b2418, roughness: 0.8 }),
    dispose() {
      wood.dispose();
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
