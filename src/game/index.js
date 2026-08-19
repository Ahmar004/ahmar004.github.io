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
import { Slingshot } from './slingshot.js';
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
    { scene, world, materials, layout, quality, onGraze: () => sfx.thud() },
    handleBreak
  );

  // Crates for sections already revealed in a previous visit start knocked
  // down, so returning visitors aren't asked to replay the game.
  function syncBoardToProgress() {
    crates.crates.forEach((crate) => {
      if (isBroken(crate.id)) crates.break(crate, null);
    });
    if (crates.remaining === 0) {
      crates.revealHidden();
      crates.crates.forEach((crate) => {
        if (isBroken(crate.id)) crates.break(crate, null);
      });
    }
  }
  syncBoardToProgress();

  let slingshot = new Slingshot(scene, materials, layout, quality, GRAVITY);

  function handleBreak(crate) {
    sfx.crack();
    setTimeout(() => sfx.chime(), 160);
    markBroken(crate.id);
    unlockSection(crate.id, true);
    refreshCount();

    const left = crates.remaining;
    if (left === 0 && !crate.section.hidden) {
      if (crates.revealHidden()) {
        say('Board cleared — and something else just dropped in. 👀', 7000);
      } else {
        say('Every crate down. Scroll on.', 6000);
      }
    } else if (crate.section.hidden) {
      say('You found it. Nice shooting.', 6000);
    } else {
      say(`${crate.section.label.toLowerCase()} unlocked · ${left} to go`, 3200);
    }
  }

  /* ── bird lifecycle ───────────────────────────────────────── */

  let birdIndex = 0;
  let bird = null; // { mesh, body|null, launchedAt, restingSince }
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

  function loadBird() {
    const mesh = createBird(BIRD_RADIUS, birdIndex++);
    mesh.position.copy(slingshot.pouch);
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
    body.velocity.set(velocity.x, velocity.y, velocity.z);
    body.angularVelocity.set(0, 0, -velocity.x * 0.4);
    body.userData = { isProjectile: true };
    world.addBody(body);

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

    // Point the bird along its launch vector.
    const v = slingshot.launchVelocity;
    bird.mesh.rotation.z = Math.atan2(v.y, v.x);

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

  function fitCamera() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const aspect = width / height;

    const b = layout.bounds;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;

    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const distV = (b.maxY - b.minY) / 2 / Math.tan(vFov / 2);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const distH = (b.maxX - b.minX) / 2 / Math.tan(hFov / 2);

    camera.aspect = aspect;
    cameraHome.set(cx, cy, Math.max(distV, distH) * 1.05);
    camera.position.copy(cameraHome);
    camera.lookAt(cx, cy, 0);
    camera.updateProjectionMatrix();
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

    renderer.render(scene, camera);
  }

  requestAnimationFrame(frame);

  /* ── opening hint ─────────────────────────────────────────── */

  const opener = quality.mobile
    ? 'Drag back and let go'
    : 'Drag back from the slingshot and release — or press Tab then space';
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
