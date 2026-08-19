/**
 * Picks a rendering tier from what the device tells us about itself.
 * Everything expensive in the scene reads its budget from here.
 */

export function detectQuality() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth < 820;
  const mobile = coarse || narrow;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const weak = mobile && (cores <= 4 || memory <= 4);

  return {
    tier: weak ? 'low' : mobile ? 'mid' : 'high',
    mobile,
    shadows: !mobile,
    antialias: !mobile,
    maxDpr: mobile ? 1.5 : 2,
    debrisPerCrate: weak ? 5 : mobile ? 8 : 12,
    trajectoryDots: weak ? 14 : 22,
    shadowMapSize: 1024,
  };
}

/**
 * Watches frame time and calls `onStruggle` once if the device clearly
 * cannot keep up, so the caller can offer the plain document view.
 */
export function makePerfWatchdog(onStruggle) {
  let slowFrames = 0;
  let fired = false;
  return (delta) => {
    if (fired) return;
    slowFrames = delta > 1 / 28 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
    if (slowFrames > 90) {
      fired = true;
      onStruggle();
    }
  };
}
