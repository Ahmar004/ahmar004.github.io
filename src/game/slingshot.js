/**
 * The slingshot: a forked frame, two rubber bands that follow the pouch,
 * and a dotted trajectory preview computed from the same gravity the
 * physics world uses — so the dots tell the truth.
 */

import * as THREE from 'three';
import { segmentMesh, stretchBetween } from './objects.js';

export const MAX_DRAW = 3.4;
export const LAUNCH_SPEED = 9.2; // world units/sec per unit of draw

/**
 * Render layer for things that are drawn last, over a cleared depth buffer.
 *
 * The stand shares the z = 0 plane with the beam's posts, and in portrait the
 * left prong sits inside one of them — geometrically behind it, and so
 * swallowed whole. Nothing moves to fix that; the stand simply draws on top.
 */
export const OVERLAY_LAYER = 1;

export class Slingshot {
  constructor(scene, materials, layout, quality, gravityY) {
    this.gravityY = gravityY;
    this.origin = layout.slingshot.clone();
    // Pouch rest position, between the two prongs.
    this.rest = this.origin.clone().add(new THREE.Vector3(0, 2.9, 0));
    this.pouch = this.rest.clone();

    this.group = new THREE.Group();
    scene.add(this.group);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9, flatShading: true });

    // trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 2.1, 7), woodMat);
    trunk.position.copy(this.origin).add(new THREE.Vector3(0, 1.05, 0));
    trunk.castShadow = quality.shadows;
    this.group.add(trunk);

    // two prongs forming the Y
    this.prongTips = [];
    [-1, 1].forEach((side) => {
      const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.0, 6), woodMat);
      prong.position.copy(this.origin).add(new THREE.Vector3(side * 0.42, 2.55, 0));
      prong.rotation.z = -side * 0.34;
      prong.castShadow = quality.shadows;
      this.group.add(prong);

      const tip = this.origin.clone().add(new THREE.Vector3(side * 0.74, 3.4, 0));
      this.prongTips.push(tip);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), woodMat);
      cap.position.copy(tip);
      this.group.add(cap);
    });

    // base rock the slingshot is planted in
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.9, 0),
      new THREE.MeshStandardMaterial({ color: 0x3c4655, roughness: 1, flatShading: true })
    );
    rock.position.copy(this.origin).add(new THREE.Vector3(0, 0.1, 0));
    rock.scale.set(1.1, 0.6, 1);
    rock.receiveShadow = quality.shadows;
    this.group.add(rock);

    // rubber bands
    this.bands = this.prongTips.map(() => {
      const band = segmentMesh(0.07, materials.rubber);
      this.group.add(band);
      return band;
    });

    // pouch
    this.pouchMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      materials.rubber
    );
    this.group.add(this.pouchMesh);

    // trajectory dots
    const positions = new Float32Array(quality.trajectoryDots * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dots = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.17,
        transparent: true,
        opacity: 0.75,
        sizeAttenuation: true,
        depthWrite: false,
      })
    );
    this.dots.visible = false;
    this.dots.frustumCulled = false;
    this.group.add(this.dots);

    // The whole stand rides the overlay layer. The trajectory preview stays
    // on the default one, so the dots keep being occluded by whatever they
    // fly behind, exactly as before.
    this.group.traverse((o) => o.layers.set(OVERLAY_LAYER));
    this.dots.layers.set(0);

    this.setPouch(this.rest);
  }

  /**
   * Recolours the trajectory dots. White reads well against the dusk sky but
   * disappears into the light theme's, so the caller swaps them for ink.
   */
  setDotColour(hex) {
    this.dots.material.color.setHex(hex);
  }

  /** Clamps a world-space aim point to the slingshot's draw radius. */
  clampDraw(point) {
    const offset = point.clone().sub(this.rest);
    offset.z = 0;
    const distance = offset.length();
    if (distance > MAX_DRAW) offset.multiplyScalar(MAX_DRAW / distance);
    // Only allow drawing back and around — never forward past the prongs.
    if (offset.x > 0.4) offset.x = 0.4;
    return this.rest.clone().add(offset);
  }

  setPouch(point) {
    this.pouch.copy(point);
    this.pouchMesh.position.copy(point);
    this.bands.forEach((band, i) => stretchBetween(band, this.prongTips[i], point));
  }

  /** Draw strength, 0 → 1. */
  get power() {
    return Math.min(1, this.pouch.distanceTo(this.rest) / MAX_DRAW);
  }

  /** Launch velocity implied by the current draw. */
  get launchVelocity() {
    const pull = this.rest.clone().sub(this.pouch);
    return pull.multiplyScalar(LAUNCH_SPEED);
  }

  release() {
    this.setPouch(this.rest);
    this.hideTrajectory();
  }

  showTrajectory() {
    const velocity = this.launchVelocity;
    const attr = this.dots.geometry.attributes.position;
    const count = attr.count;
    const step = 0.075;

    for (let i = 0; i < count; i++) {
      const t = i * step;
      attr.setXYZ(
        i,
        this.pouch.x + velocity.x * t,
        this.pouch.y + velocity.y * t + 0.5 * this.gravityY * t * t,
        this.pouch.z + velocity.z * t
      );
    }
    attr.needsUpdate = true;
    this.dots.geometry.computeBoundingSphere();
    this.dots.visible = this.power > 0.04;
    this.dots.material.opacity = 0.25 + this.power * 0.6;
  }

  hideTrajectory() {
    this.dots.visible = false;
  }

  dispose() {
    this.dots.geometry.dispose();
    this.dots.material.dispose();
    this.group.parent?.remove(this.group);
  }
}
