/**
 * The playfield: renderer, physics world, input and the frame loop.
 *
 * Everything here is additive. If this module throws or never loads, the
 * portfolio below still works — see main.js for the fallback path.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import { detectQuality, makePerfWatchdog } from './quality.js';
import { createMaterials, createBird } from './objects.js';
import { addLights, buildScenery, layoutFor, LAYOUTS } from './world.js';
import { CrateField } from './crates.js';
import { Slingshot, OVERLAY_LAYER } from './slingshot.js';
import { sfx, setMuted, isMuted } from './sound.js';
import {
  unlockSection,
  unlockAll,
  markBroken,
  isBroken,
  brokenCount,
  clearBroken,
} from '../ui/app.js';

const GRAVITY = -14;
const BIRD_RADIUS = 0.62;
const FIXED_STEP = 1 / 60;

export function startGame(canvas) {
  if (!canvas) return null;

  const quality = detectQuality();
  const clock = new THREE.Clock();

  /* ── renderer ─────────────────────────────────────────────── */

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true, // sky comes from the CSS gradient, so the theme toggle works
    antialias: quality.antialias,
    powerPreference: 'high-performance',
  });
  renderer.setClearAlpha(0);
  // The frame draws the world and then the slingshot over it, so the passes
  // are cleared by hand.
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  if (quality.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 120);
  const cameraHome = new THREE.Vector3();

  /* ── physics ──────────────────────────────────────────────── */

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.solver.iterations = 12;

  world.groundMaterial = new CANNON.Material('ground');
  world.crateMaterial = new CANNON.Material('crate');
  world.birdMaterial = new CANNON.Material('bird');

  world.addContactMaterial(
    new CANNON.ContactMaterial(world.birdMaterial, world.crateMaterial, {
      friction: 0.35,
      restitution: 0.3,
    })
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(world.crateMaterial, world.groundMaterial, {
      friction: 0.55,
      restitution: 0.18,
    })
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(world.birdMaterial, world.groundMaterial, {
      friction: 0.4,
      restitution: 0.35,
    })
  );

  /* ── scene contents ───────────────────────────────────────── */

  const materials = createMaterials();
  let layout = layoutFor(window.innerWidth / window.innerHeight);

  const lights = addLights(scene, quality, layout);
  // Every light has to reach the overlay layer too, or the pass that draws
  // the slingshot renders it in the dark.
  scene.traverse((o) => {
    if (o.isLight) o.layers.enableAll();
  });
  let scenery = buildScenery(scene, world, materials, layout, quality);

  const hud = {
    root: document.getElementById('hud'),
    hint: document.getElementById('hudHint'),
    hintText: document.getElementById('hudHintText'),
    count: document.getElementById('hitCount'),
    reset: document.getElementById('resetBtn'),
  };
  hud.root.hidden = false;
  hud.reset.hidden = false;

  let hintTimer = null;
  function say(message, holdFor = 4200) {
    if (!hud.hintText) return;
    hud.hintText.textContent = message;
    hud.hint.classList.remove('is-faded');
    clearTimeout(hintTimer);
    if (holdFor) hintTimer = setTimeout(() => hud.hint.classList.add('is-faded'), holdFor);
  }

  function refreshCount() {
    hud.count.textContent = String(brokenCount());
  }
  refreshCount();

  const crates = new CrateField(
    {
      scene,
      world,
      materials,
      layout,
      quality,
      onGraze: () => sfx.thud(),
      onDamage: handleDamage,
    },
    handleBreak
  );

  // Re-applies the crates knocked down earlier in this visit. The board is
  // rebuilt from scratch when the device rotates between portrait and
  // landscape, and crates you already shot must not come back.
  //
  // This is a restore, not gameplay: it must not replay the break — no
  // debris, no sound, and above all no scroll, or the page jumps somewhere
  // the visitor never asked to go. Game progress is not persisted across
  // visits, so on load this is a no-op and the board hangs full.
  function syncBoardToProgress() {
    crates.crates.forEach((crate) => {
      if (isBroken(crate.id)) crates.break(crate, null, { silent: true });
    });
  }
  syncBoardToProgress();

  let slingshot = new Slingshot(scene, materials, layout, quality, GRAVITY);

  /** A crate took a solid hit and cracked, but is still hanging. */
  function handleDamage(crate, { left }) {
    sfx.splinter();
    const label = crate.section.label.toLowerCase();
    say(
      left === 1
        ? `${label} is splintering · one more hit`
        : `${label} cracked · ${left} more hits`,
      2800
    );
  }

  function handleBreak(crate, { silent = false } = {}) {
    markBroken(crate.id);
    refreshCount();

    if (silent) {
      // Restoring saved progress on load: reveal the section in place and
      // leave the visitor exactly where they are.
      unlockSection(crate.id, false);
      return;
    }

    sfx.crack();
    setTimeout(() => sfx.chime(), 160);
    unlockSection(crate.id, true);

    const left = crates.remaining;
    if (left === 0) {
      say('Board cleared. Every section is open — scroll on.', 6000);
    } else {
      say(`${crate.section.label.toLowerCase()} unlocked · ${left} to go`, 3200);
    }
  }

  /* ── bird lifecycle ───────────────────────────────────────── */

  let birdIndex = 0;
  let bird = null; // { mesh, body|null, launchedAt, restingSince }

  /**
   * Yaw that turns a bird — modelled beak-along-+X — to look the visitor in
   * the eye. It aims at the camera rather than simply a quarter turn out of
   * the scene, because the slingshot stands far to the left of frame and a
   * fixed turn would leave the bird staring past them.
   *
   * It wears this for as long as it sits in the pouch; once fired it takes
   * its orientation from the physics body and tumbles freely.
   */
  function facingCamera(position) {
    return Math.atan2(-(cameraHome.z - position.z), cameraHome.x - position.x);
  }
  const trailPositions = new Float32Array(24 * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  const trail = new THREE.Points(
    trailGeo,
    new THREE.PointsMaterial({
      size: 0.22,
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  trail.frustumCulled = false;
  trail.visible = false;
  scene.add(trail);
  let trailCursor = 0;

  /**
   * White dots read well against the dusk sky and vanish against the light
   * theme's, so the aim preview and the flight trail both switch to ink with
   * the toggle.
   */
  const DOT_COLOUR = { dark: 0xffffff, light: 0x0b1220 };
  let lightTheme = document.documentElement.classList.contains('light');

  function applyDotTheme() {
    const hex = lightTheme ? DOT_COLOUR.light : DOT_COLOUR.dark;
    trail.material.color.setHex(hex);
    trail.material.opacity = lightTheme ? 0.58 : 0.4;
    slingshot.setDotColour(hex);
  }
  applyDotTheme();

  document.addEventListener('theme:changed', (event) => {
    lightTheme = event.detail.light;
    applyDotTheme();
  });

  function loadBird() {
    const mesh = createBird(BIRD_RADIUS, birdIndex++);
    mesh.position.copy(slingshot.pouch);
    mesh.rotation.set(0, facingCamera(mesh.position), 0);
    // Sitting in the pouch, the bird belongs to the stand and is drawn with
    // it — otherwise the prongs it nestles between would cover it.
    mesh.traverse((o) => o.layers.set(OVERLAY_LAYER));
    scene.add(mesh);
    bird = { mesh, body: null, launchedAt: 0, restingSince: 0 };
    trail.visible = false;
  }

  function fireBird(velocity) {
    if (!bird || bird.body) return;

    const body = new CANNON.Body({
      mass: 1.6,
      shape: new CANNON.Sphere(BIRD_RADIUS),
      material: world.birdMaterial,
      linearDamping: 0.02,
      angularDamping: 0.12,
    });
    body.position.set(bird.mesh.position.x, bird.mesh.position.y, bird.mesh.position.z);
    // Carries the aiming pose into the flight, so the bird spins on from
    // where it was rather than snapping side-on at the moment of release.
    const q = bird.mesh.quaternion;
    body.quaternion.set(q.x, q.y, q.z, q.w);
    body.velocity.set(velocity.x, velocity.y, velocity.z);
    body.angularVelocity.set(0, 0, -velocity.x * 0.4);
    body.userData = { isProjectile: true };
    world.addBody(body);

    // In flight it is part of the world again, so crates can pass in front.
    bird.mesh.traverse((o) => o.layers.set(0));

    bird.body = body;
    bird.launchedAt = performance.now();
    bird.restingSince = 0;

    for (let i = 0; i < 24; i++) {
      trailPositions.set([body.position.x, body.position.y, body.position.z], i * 3);
    }
    trailGeo.attributes.position.needsUpdate = true;
    trail.visible = true;

    sfx.launch();
    shotsFired++;
    if (shotsFired === 3 && brokenCount() === 0) {
      say('Tip: pull further back for more power, and aim above the crate.', 5000);
    }
  }

  function retireBird() {
    if (!bird) return;
    if (bird.body) world.removeBody(bird.body);
    scene.remove(bird.mesh);
    bird.mesh.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    bird = null;
    loadBird();
  }

  let shotsFired = 0;
  loadBird();

  /* ── aiming ───────────────────────────────────────────────── */

  const raycaster = new THREE.Raycaster();
  const aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const pointer = new THREE.Vector2();
  const hit = new THREE.Vector3();
  let aiming = false;
  let lastStretchSound = 0;
  // Aiming is relative: the pouch moves by however far you drag, from
  // wherever you happened to grab. Absolute aiming teleports the pouch to
  // your first touch, which is unusable on a phone.
  const dragStart = new THREE.Vector3();
  const dragTarget = new THREE.Vector3();

  function pointerToWorld(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return raycaster.ray.intersectPlane(aimPlane, hit) ? hit : null;
  }

  function beginAim(event) {
    if (!bird || bird.body) return;
    sfx.unlock();
    const point = pointerToWorld(event);
    if (!point) return;
    aiming = true;
    dragStart.copy(point);
    canvas.setPointerCapture?.(event.pointerId);
    updateAim(event);
  }

  function updateAim(event) {
    if (!aiming || !bird || bird.body) return;
    const point = pointerToWorld(event);
    if (!point) return;
    dragTarget.copy(slingshot.rest).add(point).sub(dragStart);
    const drawn = slingshot.clampDraw(dragTarget);
    slingshot.setPouch(drawn);
    bird.mesh.position.copy(drawn);

    // Still facing the visitor, but tipping its head along the launch angle.
    const v = slingshot.launchVelocity;
    bird.mesh.rotation.set(0, facingCamera(drawn), Math.atan2(v.y, v.x));

    slingshot.showTrajectory();

    const now = performance.now();
    if (now - lastStretchSound > 110 && slingshot.power > 0.05) {
      lastStretchSound = now;
      sfx.stretch(slingshot.power);
    }
  }

  function endAim(event) {
    if (!aiming) return;
    aiming = false;
    canvas.releasePointerCapture?.(event?.pointerId);
    if (!bird || bird.body) return;

    if (slingshot.power < 0.08) {
      slingshot.release();
      bird.mesh.position.copy(slingshot.rest);
      bird.mesh.rotation.set(0, facingCamera(slingshot.rest), 0);
      return;
    }
    const velocity = slingshot.launchVelocity;
    slingshot.release();
    fireBird(velocity);
  }

  canvas.addEventListener('pointerdown', beginAim);
  canvas.addEventListener('pointermove', updateAim);
  canvas.addEventListener('pointerup', endAim);
  canvas.addEventListener('pointercancel', endAim);
  canvas.addEventListener('lostpointercapture', endAim);

  /* keyboard aiming — the game must be playable without a pointer */
  canvas.removeAttribute('aria-hidden');
  canvas.setAttribute('tabindex', '0');
  canvas.setAttribute('role', 'application');
  canvas.setAttribute(
    'aria-label',
    'Slingshot playfield. Use the arrow keys to aim and adjust power, then press space to fire and reveal a portfolio section. Every section is also readable by scrolling down.'
  );

  let keyAngle = 0.62; // radians above horizontal
  let keyPower = 0.65;

  function applyKeyboardAim() {
    if (!bird || bird.body) return;
    const offset = new THREE.Vector3(
      -Math.cos(keyAngle),
      -Math.sin(keyAngle),
      0
    ).multiplyScalar(keyPower * 3.4);
    const drawn = slingshot.clampDraw(slingshot.rest.clone().add(offset));
    slingshot.setPouch(drawn);
    bird.mesh.position.copy(drawn);
    bird.mesh.rotation.set(0, facingCamera(drawn), keyAngle);
    slingshot.showTrajectory();
  }

  canvas.addEventListener('keydown', (event) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    sfx.unlock();

    if (event.key === 'ArrowUp') keyAngle = Math.min(1.45, keyAngle + 0.06);
    if (event.key === 'ArrowDown') keyAngle = Math.max(-0.2, keyAngle - 0.06);
    if (event.key === 'ArrowRight') keyPower = Math.min(1, keyPower + 0.06);
    if (event.key === 'ArrowLeft') keyPower = Math.max(0.1, keyPower - 0.06);

    if (event.key === ' ' || event.key === 'Enter') {
      applyKeyboardAim();
      const velocity = slingshot.launchVelocity;
      slingshot.release();
      fireBird(velocity);
    } else {
      applyKeyboardAim();
      sfx.stretch(keyPower);
    }
  });

  canvas.addEventListener('focus', () => {
    say('Arrow keys aim and set power · space fires', 5000);
  });

  /* ── HUD controls ─────────────────────────────────────────── */

  hud.reset.addEventListener('click', () => {
    sfx.unlock();
    sfx.reset();
    // Every crate hangs again, so the shot-down tally has to go with them —
    // otherwise the HUD reads "6 / 6 knocked down" over a full board, and
    // the next orientation change would silently clear it all over again.
    clearBroken();
    crates.reset();
    refreshCount();
    say('Crates re-hung. Everything you already opened stays open.', 3600);
  });

  const muteBtn = document.createElement('button');
  muteBtn.className = 'ghost-btn';
  muteBtn.type = 'button';
  muteBtn.textContent = '🔊 Sound';
  muteBtn.setAttribute('aria-pressed', 'false');
  muteBtn.addEventListener('click', () => {
    const next = !isMuted();
    setMuted(next);
    muteBtn.textContent = next ? '🔇 Sound' : '🔊 Sound';
    muteBtn.setAttribute('aria-pressed', String(next));
  });
  hud.reset.parentElement.insertBefore(muteBtn, hud.reset);

  /* ── resize & camera framing ──────────────────────────────── */

  /** Sky left showing between the bottom of the top bar and the beam. */
  const SKY_GAP_PX = 14;

  /** How much of the canvas the fixed top bar covers, as a fraction. */
  function barCoverage(height) {
    const bar = document.getElementById('topbar')?.getBoundingClientRect().height ?? 60;
    // Capped, so a very short window can never squeeze the scene to nothing.
    return Math.min((bar + SKY_GAP_PX) / height, 0.3);
  }

  /**
   * Frames the layout bounds inside the part of the canvas the top bar does
   * *not* cover, and hangs the top of those bounds directly under the bar.
   * The bar sits over the canvas, so without this the beam the crates hang
   * from is the first thing it hides.
   */
  function fitCamera() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const aspect = width / height;

    const b = layout.bounds;
    const cx = (b.minX + b.maxX) / 2;
    const hidden = barCoverage(height);

    const vFov = THREE.MathUtils.degToRad(camera.fov);
    // Framed as if the scene were taller by whatever the bar covers, which
    // is what pulls the camera back and shrinks the playfield a little.
    const distV = (b.maxY - b.minY) / (1 - hidden) / 2 / Math.tan(vFov / 2);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const distH = (b.maxX - b.minX) / 2 / Math.tan(hFov / 2);

    const dist = Math.max(distV, distH) * 1.05;
    const halfHeight = dist * Math.tan(vFov / 2);
    // Puts b.maxY exactly `hidden` of the way down the canvas — level with
    // the bar's lower edge, plus the sliver of sky.
    const cy = b.maxY - halfHeight * (1 - 2 * hidden);

    camera.aspect = aspect;
    cameraHome.set(cx, cy, dist);
    camera.position.copy(cameraHome);
    camera.lookAt(cx, cy, 0);
    camera.updateProjectionMatrix();

    // A waiting bird looks at the camera, so it has to be re-aimed whenever
    // the camera moves.
    if (bird && !bird.body) {
      bird.mesh.rotation.set(0, facingCamera(bird.mesh.position), 0);
    }
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.maxDpr));
    renderer.setSize(width, height, false);
    fitCamera();
  }

  // Portrait and landscape need genuinely different crate arrangements, so
  // crossing the threshold rebuilds the scene. Revealed sections stay
  // revealed — their crates are re-broken immediately.
  const orientationOf = (l) => (l === LAYOUTS.portrait ? 'portrait' : 'landscape');
  let orientation = orientationOf(layout);

  function maybeRelayout() {
    const next = layoutFor((canvas.clientWidth || 1) / (canvas.clientHeight || 1));
    if (orientationOf(next) === orientation) return;
    orientation = orientationOf(next);
    layout = next;

    scenery.dispose();
    scenery = buildScenery(scene, world, materials, layout, quality);

    if (quality.shadows) {
      const s = Math.max(layout.beamHalfWidth, layout.beamY) + 8;
      Object.assign(lights.sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s });
      lights.sun.shadow.camera.updateProjectionMatrix();
    }

    crates.deps.layout = layout;
    crates.reset();
    syncBoardToProgress();

    slingshot.dispose();
    slingshot = new Slingshot(scene, materials, layout, quality, GRAVITY);
    applyDotTheme();

    retireBird();
    fitCamera();
  }

  let resizeTimer = null;
  const onResize = () => {
    resize();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(maybeRelayout, 260);
  };
  window.addEventListener('resize', onResize);
  resize();

  /* ── pause when off-screen ────────────────────────────────── */

  let visible = true;
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) clock.getDelta(); // discard the gap so physics doesn't jump
    },
    { threshold: 0.02 }
  );
  visibilityObserver.observe(canvas);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) clock.getDelta();
  });

  /* ── frame loop ───────────────────────────────────────────── */

  const watchdog = makePerfWatchdog(() => {
    say('This device is struggling — the full portfolio is right below. ↓', 9000);
  });

  let accumulator = 0;
  let running = true;
  const camTarget = new THREE.Vector3();

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);

    const delta = Math.min(clock.getDelta(), 0.1);
    if (!visible) return;
    watchdog(delta);

    accumulator += delta;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 4) {
      world.step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps++;
    }

    crates.sync();

    /* bird */
    if (bird?.body) {
      const b = bird.body;
      bird.mesh.position.copy(b.position);
      bird.mesh.quaternion.copy(b.quaternion);

      trailPositions.set([b.position.x, b.position.y, b.position.z], trailCursor * 3);
      trailCursor = (trailCursor + 1) % 24;
      trailGeo.attributes.position.needsUpdate = true;

      const speed = b.velocity.length();
      const outOfBounds =
        b.position.y < layout.bounds.minY - 6 ||
        b.position.x < layout.bounds.minX - 8 ||
        b.position.x > layout.bounds.maxX + 8;

      if (speed < 0.7) {
        if (!bird.restingSince) bird.restingSince = performance.now();
      } else {
        bird.restingSince = 0;
      }

      const settled = bird.restingSince && performance.now() - bird.restingSince > 900;
      const expired = performance.now() - bird.launchedAt > 7000;

      if (outOfBounds || settled || expired) retireBird();
    }

    /* camera drifts after the bird, then eases home */
    camTarget.copy(cameraHome);
    if (bird?.body) {
      camTarget.x += THREE.MathUtils.clamp(bird.body.position.x - cameraHome.x, -6, 6) * 0.22;
      camTarget.y += THREE.MathUtils.clamp(bird.body.position.y - cameraHome.y, -4, 5) * 0.14;
    }
    camera.position.lerp(camTarget, 1 - Math.pow(0.0016, delta));

    // The world first, then the stand — and the bird waiting on it — over a
    // cleared depth buffer, so the beam's posts can never swallow the stand.
    renderer.clear();
    camera.layers.set(0);
    renderer.render(scene, camera);
    renderer.clearDepth();
    camera.layers.set(OVERLAY_LAYER);
    renderer.render(scene, camera);
  }

  requestAnimationFrame(frame);

  /* ── opening hint ─────────────────────────────────────────── */

  const opener = quality.mobile
    ? 'Drag back and let go — three solid hits break a crate'
    : 'Drag back and release — three solid hits break a crate. Tab then space also works';
  say(opener, 7000);

  if (brokenCount() > 0) {
    say('Welcome back — the crates you hit last time are still down.', 5000);
  }

  /* ── teardown ─────────────────────────────────────────────── */

  return {
    stop() {
      running = false;
      window.removeEventListener('resize', onResize);
      visibilityObserver.disconnect();
      crates.dispose();
      slingshot.dispose();
      materials.dispose();
      renderer.dispose();
    },
    unlockEverything: () => unlockAll(false),
  };
}
