import './styles/main.css';
import { renderSections, renderNav, renderIntro } from './ui/sections.js';
import { initDocument, unlockAll, prefersReducedMotion } from './ui/app.js';

/* Phase 1: the portfolio itself. Runs first and never depends on WebGL. */
renderSections(document.getElementById('content'));
renderNav(document.getElementById('navLinks'), document.getElementById('mobileMenu'));
renderIntro();
initDocument();

/* Phase 2: the playfield, loaded lazily so it can never block the content. */
function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

if (webglAvailable() && !prefersReducedMotion) {
  import('./game/index.js')
    .then((m) => m.startGame(document.getElementById('scene')))
    .catch((err) => {
      console.warn('Playfield failed to start; falling back to the document view.', err);
      document.getElementById('skipBtn')?.click();
    });
} else {
  // No WebGL, or the visitor asked for reduced motion: show everything.
  unlockAll(false);
}
