/**
 * Static scenery and the crate layout.
 *
 * The canvas renders with alpha, so the sky comes from the CSS gradient on
 * `.playfield` — which means the light/dark theme toggle recolours the sky
 * for free, with no work on the WebGL side.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Crate positions differ between landscape and portrait: a single sweeping
 * row reads well on a laptop but would be a sliver on a phone, so portrait
 * stacks the crates into a tighter cluster.
 */
export const LAYOUTS = {
  landscape: {
    // The beam rides high so it clears the intro copy; crates hang from it
    // on long chains.
    beamY: 13.5,
    beamHalfWidth: 12.4,
    crateSize: 2.0,
    slingshot: new THREE.Vector3(-10.6, 0, 0),
    // The left third of the frame belongs to the intro text, so the crate
    // cluster starts well right of centre-left.
    bounds: { minX: -13, maxX: 13, minY: -0.5, maxY: 13.9 },
    crates: [
      { id: 'experience', x: -4.3, y: 7.5, z: 0 },
      { id: 'projects', x: -1.4, y: 5.6, z: 0 },
      { id: 'skills', x: 1.5, y: 7.8, z: 0 },
      { id: 'education', x: 4.4, y: 5.5, z: 0 },
      { id: 'certificates', x: 7.3, y: 7.6, z: 0 },
      { id: 'contact', x: 10.0, y: 5.4, z: 0 },
      // Only hung once the other six are down.
      { id: 'beyond', x: 3.0, y: 10.6, z: -2.4 },
    ],
  },
  // Portrait is tall and narrow to match a phone's aspect: crates stack in
  // three rows of two rather than sweeping across a row that would be a
  // sliver on screen.
  portrait: {
    beamY: 16.0,
    beamHalfWidth: 4.3,
    crateSize: 1.35,
    // Labels need to be relatively larger when the crates are this small.
    signScale: 1.34,
    slingshot: new THREE.Vector3(-3.2, 0, 0),
    // Tall and narrow: the bounds ratio is matched to a phone so the scene
    // fills the screen instead of floating in the middle of it.
    bounds: { minX: -4.4, maxX: 4.4, minY: -0.6, maxY: 16.6 },
    crates: [
      { id: 'experience', x: -2.0, y: 10.2, z: 0 },
      { id: 'projects', x: 2.2, y: 10.6, z: 0 },
      { id: 'skills', x: -2.0, y: 7.6, z: 0 },
      { id: 'education', x: 2.2, y: 8.0, z: 0 },
      { id: 'certificates', x: -2.0, y: 5.0, z: 0 },
      { id: 'contact', x: 2.2, y: 5.4, z: 0 },
      { id: 'beyond', x: 0.2, y: 12.8, z: -1.8 },
    ],
  },
};

export const layoutFor = (aspect) => (aspect < 1.05 ? LAYOUTS.portrait : LAYOUTS.landscape);

/* ── lights ───────────────────────────────────────────────────── */

export function addLights(scene, quality, layout) {
  // Warm low sun from the right, mirroring the sunset in the CSS gradient.
  const sun = new THREE.DirectionalLight(0xffe0b0, 2.7);
  sun.position.set(11, 15, 10);
  if (quality.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 70;
    // Cover the whole play area, or the shadow map edge shows as a hard
    // rectangle across the grass.
    const s = Math.max(layout.beamHalfWidth, layout.beamY) + 8;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0015;
    sun.shadow.normalBias = 0.025;
  }
  scene.add(sun);

  // Cool sky fill so the shadow side reads as dusk, not black.
  scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x3a4a5f, 1.95));

  // Rim light from behind-left to separate crates from the sky.
  const rim = new THREE.DirectionalLight(0x8fc0ff, 0.85);
  rim.position.set(-12, 7, -10);
  scene.add(rim);

  return { sun, rim };
}

/* ── scenery ──────────────────────────────────────────────────── */

/**
 * Builds the static scenery.
 * @returns {{group: THREE.Group, bodies: CANNON.Body[], dispose: () => void}}
 */
export function buildScenery(scene, world, materials, layout, quality) {
  const group = new THREE.Group();
  const bodies = [];
  const half = layout.beamHalfWidth;

  /* Ground slab */
  const groundHeight = 1.4;
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(half * 2 + 12, groundHeight, 16),
    materials.ground
  );
  ground.position.set(0, -groundHeight / 2, 0);
  ground.receiveShadow = quality.shadows;
  group.add(ground);

  // Darker earth band under the grass.
  const earth = new THREE.Mesh(
    new THREE.BoxGeometry(half * 2 + 12, 3, 15.4),
    materials.groundDark
  );
  earth.position.set(0, -groundHeight - 1.5, 0);
  group.add(earth);

  const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Box(new CANNON.Vec3(half + 6, groundHeight / 2, 8)),
    position: new CANNON.Vec3(0, -groundHeight / 2, 0),
    material: world.groundMaterial,
  });
  world.addBody(groundBody);
  bodies.push(groundBody);

  /* Silhouette hills far behind, purely decorative */
  const hills = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const r = 3 + Math.random() * 4;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.15, 5), materials.hill);
    hill.position.set(-half - 4 + (i / 6) * (half * 2 + 8), -0.6, -13 - Math.random() * 5);
    hill.rotation.y = Math.random() * Math.PI;
    hills.add(hill);
  }
  group.add(hills);

  /* Overhead beam the crates hang from */
  const beam = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.72, 0.72), materials.beam);
  beam.position.set(0, layout.beamY, 0);
  beam.castShadow = quality.shadows;
  group.add(beam);

  // Beam supports at each end, running down out of frame.
  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, layout.beamY + 2, 0.62),
      materials.beam
    );
    post.position.set(side * (half - 0.3), (layout.beamY - 2) / 2, 0);
    post.castShadow = quality.shadows;
    group.add(post);

    // diagonal brace
    const brace = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.34, 0.34), materials.beam);
    brace.position.set(side * (half - 1.2), layout.beamY - 0.9, 0);
    brace.rotation.z = side * (Math.PI / 4);
    group.add(brace);
  });

  scene.add(group);

  return {
    group,
    bodies,
    dispose() {
      bodies.forEach((b) => world.removeBody(b));
      group.traverse((o) => o.geometry?.dispose());
      scene.remove(group);
    },
  };
}
