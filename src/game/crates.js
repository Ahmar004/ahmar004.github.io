/**
 * Hanging crate targets.
 *
 * Each crate is a dynamic rigid body tethered to a static anchor on the beam
 * by a PointToPointConstraint, which makes it a real pendulum — near misses
 * set it swinging, and a solid hit sends it spinning into its neighbours.
 *
 * Crates do not shatter on the first solid hit. Each one takes three: the
 * first splits it, the second spreads that split into three cracks, and only
 * the third breaks it open. That is deliberate — a one-hit crate meant a
 * ricochet or a flying shard could knock down a neighbour, and the page would
 * scroll to a section the visitor never aimed at.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { signTexture, segmentMesh, stretchBetween } from './objects.js';
import { sections } from '../content.js';

const DEFAULT_CRATE_SIZE = 2.0;
const MIN_CHAIN = 1.2;
const SIGN_DROP_RATIO = 0.21;
/** Impact speed that counts as a solid hit rather than a graze. */
const HIT_IMPULSE = 5.5;
/** Solid hits a crate survives before it comes apart. */
const HITS_TO_BREAK = 3;
/**
 * One impact arrives as a burst of contact events over several frames — the
 * bird bounces, the crate swings back into it, shards clip it on the way out.
 * Hits inside this window are all the same hit.
 */
const HIT_COOLDOWN_MS = 420;

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();

export class CrateField {
  /**
   * @param {object} deps  { scene, world, materials, layout, quality }
   * @param {(crate: object) => void} onBreak  called once per crate destroyed
   */
  constructor(deps, onBreak) {
    this.deps = deps;
    this.onBreak = onBreak;
    this.crates = [];
    this.debris = [];
    this.group = new THREE.Group();
    deps.scene.add(this.group);

    // Crates are smaller in portrait, where six of them share a phone screen.
    this.size = deps.layout.crateSize ?? DEFAULT_CRATE_SIZE;
    this.signScale = deps.layout.signScale ?? 1;
    this.signDrop = this.size * SIGN_DROP_RATIO;

    // One shard geometry shared by every piece of debris the field ever makes.
    this.shardSize = this.size / 3.1;
    this.shardGeo = new THREE.BoxGeometry(this.shardSize, this.shardSize, this.shardSize * 0.55);

    // Damage decals sit on a shell a hair outside the crate, so the cracks
    // never fight the wood underneath for the same depth.
    this.crackGeo = null;

    this.build();
  }

  /** Hangs one crate per entry in the layout. Every crate is on the board
   *  from the first frame — none are held back. */
  build() {
    const { world, materials, layout, quality } = this.deps;
    this.size = layout.crateSize ?? DEFAULT_CRATE_SIZE;
    this.signScale = layout.signScale ?? 1;
    this.signDrop = this.size * SIGN_DROP_RATIO;

    // Rebuilt with the field, because a relayout changes the crate size.
    this.crackGeo?.dispose();
    const shell = this.size * 1.008;
    this.crackGeo = new THREE.BoxGeometry(shell, shell, shell);

    layout.crates.forEach((spot) => {
      const section = sections.find((s) => s.id === spot.id);
      if (!section) return;
      this.crates.push(this.#makeCrate(spot, section, world, materials, quality, layout));
    });
  }

  #makeCrate(spot, section, world, materials, quality, layout) {
    const size = this.size;
    const half = size / 2;
    // Anchor on the beam itself, so the chain actually reaches it rather
    // than stopping in mid-air.
    const chainLength = Math.max(MIN_CHAIN, layout.beamY - spot.y - half);
    const anchorPos = new THREE.Vector3(spot.x, spot.y + half + chainLength, spot.z);

    /* visual */
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      materials.crate.clone()
    );
    mesh.material.color = new THREE.Color(section.accent).lerp(new THREE.Color('#c98a4b'), 0.62);
    mesh.castShadow = quality.shadows;
    mesh.receiveShadow = quality.shadows;
    this.group.add(mesh);

    /* label sign, hanging just under the crate */
    const signTex = signTexture(section.label, section.accent);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 1.5 * this.signScale, size * 0.38 * this.signScale),
      new THREE.MeshStandardMaterial({
        map: signTex,
        roughness: 0.85,
        transparent: true,
        side: THREE.DoubleSide,
      })
    );
    sign.castShadow = quality.shadows;
    this.group.add(sign);

    /* two little ropes from crate to sign */
    const signRopes = [-1, 1].map(() => {
      const rope = segmentMesh(0.035, materials.chain);
      this.group.add(rope);
      return rope;
    });

    /* chain up to the beam */
    const chain = segmentMesh(0.075, materials.chain);
    this.group.add(chain);

    const hook = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.055, 6, 12),
      materials.chain
    );
    hook.position.copy(anchorPos);
    hook.rotation.x = Math.PI / 2;
    this.group.add(hook);

    /* physics */
    const body = new CANNON.Body({
      mass: 3.2,
      shape: new CANNON.Box(new CANNON.Vec3(half, half, half)),
      position: new CANNON.Vec3(spot.x, spot.y, spot.z),
      material: world.crateMaterial,
      linearDamping: 0.12,
      angularDamping: 0.28,
    });
    world.addBody(body);

    const anchorBody = new CANNON.Body({ type: CANNON.Body.STATIC });
    anchorBody.position.set(anchorPos.x, anchorPos.y, anchorPos.z);
    world.addBody(anchorBody);

    const constraint = new CANNON.PointToPointConstraint(
      anchorBody,
      new CANNON.Vec3(0, 0, 0),
      body,
      new CANNON.Vec3(0, half + chainLength, 0)
    );
    world.addConstraint(constraint);

    const crate = {
      id: spot.id,
      section,
      mesh,
      sign,
      signRopes,
      chain,
      hook,
      body,
      anchorBody,
      constraint,
      anchorPos,
      broken: false,
      hits: 0,
      lastHitAt: 0,
      cracks: null,
    };

    body.addEventListener('collide', (event) => {
      if (crate.broken) return;
      const other = event.body;
      // Only projectiles and flying debris can break a crate — not a
      // neighbouring crate simply bumping into it.
      if (!other.userData?.isProjectile) return;

      const impact = Math.abs(event.contact.getImpactVelocityAlongNormal());
      if (impact >= HIT_IMPULSE) {
        this.#takeHit(crate, other.velocity);
      } else if (impact > 1.4) {
        this.deps.onGraze?.(impact);
      }
    });

    return crate;
  }

  /**
   * Books one solid hit against a crate: cracks it, or breaks it if this was
   * the third. Repeat contacts from the same impact are ignored.
   */
  #takeHit(crate, impactVelocity) {
    const now = performance.now();
    if (now - crate.lastHitAt < HIT_COOLDOWN_MS) return;
    crate.lastHitAt = now;
    crate.hits += 1;

    if (crate.hits >= HITS_TO_BREAK) {
      this.break(crate, impactVelocity);
      return;
    }

    this.#showCracks(crate);
    this.deps.onDamage?.(crate, {
      hits: crate.hits,
      left: HITS_TO_BREAK - crate.hits,
    });
  }

  /** Lays the damage decal for the crate's current hit count over its faces. */
  #showCracks(crate) {
    const stage = this.deps.materials.crackStages[crate.hits - 1];
    if (!stage) return;

    if (crate.cracks) {
      crate.cracks.material = stage;
    } else {
      crate.cracks = new THREE.Mesh(this.crackGeo, stage);
      // A child of the crate, so it swings and spins with it for free.
      crate.mesh.add(crate.cracks);
    }
    // Split wood reads darker even where the cracks themselves don't land.
    crate.mesh.material.color.multiplyScalar(0.88);
  }

  /**
   * Destroys a crate, scatters debris, and notifies the caller.
   *
   * `silent` restores a crate that was already down on a previous visit:
   * it is removed from the board with no debris, no sound and no scroll,
   * because nothing just happened — the page is only catching up to saved
   * progress.
   */
  break(crate, impactVelocity, { silent = false } = {}) {
    if (crate.broken) return;
    crate.broken = true;

    const { world, quality } = this.deps;
    const colour = crate.mesh.material.color.clone();

    world.removeConstraint(crate.constraint);
    world.removeBody(crate.body);
    world.removeBody(crate.anchorBody);

    this.#disposeVisuals(crate, { keepHook: true });

    if (silent) {
      this.onBreak(crate, { silent: true });
      return;
    }

    /* debris */
    const count = quality.debrisPerCrate;
    const size = this.shardSize;

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: colour.clone().multiplyScalar(0.75 + Math.random() * 0.5),
        roughness: 0.95,
        flatShading: true,
      });
      const shard = new THREE.Mesh(this.shardGeo, mat);
      shard.castShadow = quality.shadows;
      this.group.add(shard);

      const body = new CANNON.Body({
        mass: 0.35,
        shape: new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size * 0.275)),
        material: world.crateMaterial,
        linearDamping: 0.05,
        angularDamping: 0.12,
      });
      body.position.copy(crate.body.position);
      body.position.x += (Math.random() - 0.5) * this.size * 0.7;
      body.position.y += (Math.random() - 0.5) * this.size * 0.7;
      body.position.z += (Math.random() - 0.5) * this.size * 0.7;
      body.userData = { isProjectile: true };

      const spread = 4.5;
      body.velocity.set(
        (impactVelocity?.x ?? 0) * 0.35 + (Math.random() - 0.5) * spread,
        (impactVelocity?.y ?? 0) * 0.2 + Math.random() * spread * 0.9,
        (impactVelocity?.z ?? 0) * 0.35 + (Math.random() - 0.5) * spread
      );
      body.angularVelocity.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      );
      world.addBody(body);

      this.debris.push({ mesh: shard, body, born: performance.now(), mat });
    }

    this.onBreak(crate, { silent: false });
  }

  #disposeVisuals(crate, { keepHook = false } = {}) {
    const kill = (obj) => {
      if (!obj) return;
      this.group.remove(obj);
      obj.geometry?.dispose();
      if (obj.material) {
        obj.material.map?.dispose();
        obj.material.dispose();
      }
    };
    // The decal's geometry and material are shared with the rest of the
    // field, so it is only detached here — never disposed.
    if (crate.cracks) {
      crate.mesh.remove(crate.cracks);
      crate.cracks = null;
    }
    kill(crate.mesh);
    kill(crate.sign);
    crate.signRopes.forEach(kill);
    kill(crate.chain);
    if (!keepHook) kill(crate.hook);
  }

  /** Copies physics transforms onto the meshes. Called every frame. */
  sync() {
    const half = this.size / 2;

    for (const crate of this.crates) {
      if (crate.broken) continue;

      crate.mesh.position.copy(crate.body.position);
      crate.mesh.quaternion.copy(crate.body.quaternion);

      // chain: beam anchor → the crate's top attachment point
      _from.copy(crate.anchorPos);
      _to.set(0, half, 0).applyQuaternion(crate.mesh.quaternion).add(crate.mesh.position);
      stretchBetween(crate.chain, _from, _to);

      // sign hangs below the crate, swinging with it
      _from.set(0, -half, 0).applyQuaternion(crate.mesh.quaternion).add(crate.mesh.position);
      crate.sign.position.copy(_from);
      crate.sign.position.y -= this.signDrop + this.size * 0.19;
      crate.sign.quaternion.copy(crate.mesh.quaternion);

      crate.signRopes.forEach((rope, i) => {
        const side = i === 0 ? -1 : 1;
        _from
          .set(side * this.size * 0.44, -half, 0)
          .applyQuaternion(crate.mesh.quaternion)
          .add(crate.mesh.position);
        _to
          .set(side * this.size * 0.44, -half - this.signDrop, 0)
          .applyQuaternion(crate.mesh.quaternion)
          .add(crate.mesh.position);
        stretchBetween(rope, _from, _to);
      });
    }

    // debris: sync, then retire once it has settled or fallen away
    const now = performance.now();
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.mesh.position.copy(d.body.position);
      d.mesh.quaternion.copy(d.body.quaternion);

      const old = now - d.born > 9000;
      const gone = d.body.position.y < -8;
      if (old || gone) {
        this.deps.world.removeBody(d.body);
        this.group.remove(d.mesh);
        d.mat.dispose();
        this.debris.splice(i, 1);
      }
    }
    // The shared box geometry is disposed with the field, not per shard.
  }

  /** Re-hangs every crate. Already-revealed sections stay revealed. */
  reset() {
    this.crates.forEach((crate) => {
      if (crate.broken) {
        this.group.remove(crate.hook);
        crate.hook.geometry.dispose();
      } else {
        this.deps.world.removeConstraint(crate.constraint);
        this.deps.world.removeBody(crate.body);
        this.deps.world.removeBody(crate.anchorBody);
        this.#disposeVisuals(crate);
      }
    });
    this.debris.forEach((d) => {
      this.deps.world.removeBody(d.body);
      this.group.remove(d.mesh);
      d.mat.dispose();
    });
    this.crates = [];
    this.debris = [];
    this.build();
  }

  /** Crates still hanging. */
  get remaining() {
    return this.crates.filter((c) => !c.broken).length;
  }

  dispose() {
    this.crates.forEach((crate) => {
      if (!crate.broken) {
        this.deps.world.removeConstraint(crate.constraint);
        this.deps.world.removeBody(crate.body);
        this.deps.world.removeBody(crate.anchorBody);
      }
      this.#disposeVisuals(crate);
    });
    this.debris.forEach((d) => {
      this.deps.world.removeBody(d.body);
      d.mat.dispose();
    });
    this.shardGeo.dispose();
    this.crackGeo?.dispose();
    this.deps.scene.remove(this.group);
  }
}
