/**
 * Document-side behaviour: navigation, theme, scroll reveal, and the
 * unlock/scroll choreography triggered when a crate is knocked down.
 *
 * This module knows nothing about three.js. If WebGL never boots, every
 * function here still works and the portfolio reads as a normal site.
 */

import { profile, sections } from '../content.js';

export const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

const STORAGE_KEY = 'ahmar-portfolio';

/**
 * How long the page waits after a crate breaks before it scrolls down to the
 * section that crate unlocked. Long enough to watch the shards fly, tumble
 * and land — scrolling away mid-explosion throws away the best moment in the
 * whole playfield.
 */
const BREAK_TO_SCROLL_MS = 1650;

/** Sections whose content is revealed. Scrolling to one is enough. This is
 *  the half that persists: content you have already opened stays open. */
const unlocked = new Set();
/**
 * Crates actually shot down. Deliberately *not* persisted — the board is a
 * game, and every visit starts with a full one. Restoring it across visits
 * only ever emptied the playfield before the visitor had seen it, and it
 * bought nothing: `unlocked` already keeps their sections readable, so a
 * full board asks them to replay nothing.
 *
 * It still has to survive an orientation change within a single visit,
 * which is why it is tracked at all.
 */
const broken = new Set();

/* ── persistence ──────────────────────────────────────────────── */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.unlocked)) saved.unlocked.forEach((id) => unlocked.add(id));
    // `saved.broken` from older versions is ignored on purpose; see above.
    if (saved.theme === 'light') document.documentElement.classList.add('light');
  } catch {
    /* private mode or corrupt value — defaults are fine */
  }
}

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        unlocked: [...unlocked],
        theme: document.documentElement.classList.contains('light') ? 'light' : 'dark',
      })
    );
  } catch {
    /* ignore */
  }
}

/* ── unlocking ────────────────────────────────────────────────── */

function applyUnlockClass(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('is-locked');
  el.classList.add('is-unlocked');
}

/**
 * Mark a section as revealed.
 * @param {string} id            section id from content.js
 * @param {boolean} scrollTo     smooth-scroll the page down to it
 */
export function unlockSection(id, scrollTo = true) {
  const el = document.getElementById(id);
  if (!el) return;

  const isNew = !unlocked.has(id);
  unlocked.add(id);
  applyUnlockClass(id);
  saveState();

  // The entrance pulse has to start when the section comes into view, not
  // when it was unlocked — held back until the scroll, it would otherwise
  // play and finish while the visitor is still watching the crate explode.
  const pulse = () => {
    if (!isNew) return;
    el.classList.add('is-just-hit');
    setTimeout(() => el.classList.remove('is-just-hit'), 1200);
  };

  if (scrollTo) {
    // Let the crate visibly break, and its debris settle, before the page moves.
    const delay = prefersReducedMotion ? 0 : BREAK_TO_SCROLL_MS;
    setTimeout(() => {
      pulse();
      el.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }, delay);
  } else {
    pulse();
  }

  document.dispatchEvent(
    new CustomEvent('section:unlocked', { detail: { id, count: unlocked.size } })
  );
}

export function unlockAll(scrollTo = false) {
  sections.forEach((s) => {
    unlocked.add(s.id);
    applyUnlockClass(s.id);
  });
  saveState();
  if (scrollTo) document.getElementById('content')?.scrollIntoView({ behavior: 'smooth' });
  document.dispatchEvent(
    new CustomEvent('section:unlocked', { detail: { id: null, count: unlocked.size } })
  );
}

/** Records that a crate was shot down, as distinct from merely scrolled to. */
export function markBroken(id) {
  broken.add(id);
}
export const isBroken = (id) => broken.has(id);
export const brokenCount = () => broken.size;
/** Called when the board is re-hung, so the HUD counter matches what hangs. */
export function clearBroken() {
  broken.clear();
}

/* ── nav, theme, chrome ───────────────────────────────────────── */

function initNav() {
  const menu = document.getElementById('mobileMenu');
  const hamburger = document.getElementById('hamburger');
  const progress = document.getElementById('pageProgress');

  const closeMenu = () => {
    menu.classList.remove('is-open');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.textContent = '☰';
  };

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle('is-open');
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.textContent = open ? '✕' : '☰';
  });

  document.addEventListener('click', (e) => {
    if (menu.classList.contains('is-open') && !menu.contains(e.target)) closeMenu();
  });
  menu.addEventListener('click', (e) => {
    if (e.target.matches('.mobile-link')) closeMenu();
  });

  // Any nav link to a locked section unlocks it — the game is never a gate.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (target.classList.contains('section')) {
      unlockSection(id, false);
    }
    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  });

  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
        ticking = false;
      });
    },
    { passive: true }
  );
}

function initTheme() {
  const btn = document.getElementById('themeBtn');
  const sync = () => {
    const light = document.documentElement.classList.contains('light');
    btn.textContent = light ? '☀️' : '🌙';
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', light ? '#e6e9ee' : '#080e1a');
    document.dispatchEvent(new CustomEvent('theme:changed', { detail: { light } }));
  };
  btn.addEventListener('click', () => {
    document.documentElement.classList.toggle('light');
    saveState();
    sync();
  });
  sync();
}

function initScrollUnlock() {
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        if (!unlocked.has(e.target.id)) unlockSection(e.target.id, false);
        obs.unobserve(e.target);
      });
    },
    // Fire when the section's top edge crosses 75% of the viewport. A
    // percentage threshold would never trigger for sections taller than a
    // few screens, which the projects list certainly is.
    { threshold: 0, rootMargin: '0px 0px -25% 0px' }
  );
  document.querySelectorAll('.section').forEach((el) => obs.observe(el));
}

function initReveal() {
  if (prefersReducedMotion) {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-visible');
        obs.unobserve(e.target);
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  );
  document.querySelectorAll('.reveal').forEach((el) => obs.observe(el));
}

function initTypewriter() {
  const el = document.getElementById('typedRole');
  if (!el) return;
  const phrases = profile.roles;

  if (prefersReducedMotion) {
    el.textContent = phrases[0];
    return;
  }

  let phrase = 0;
  let chars = 0;
  let deleting = false;

  const tick = () => {
    const current = phrases[phrase];
    if (deleting) {
      el.textContent = current.slice(0, --chars);
      if (chars === 0) {
        deleting = false;
        phrase = (phrase + 1) % phrases.length;
      }
      setTimeout(tick, 40);
    } else {
      el.textContent = current.slice(0, ++chars);
      if (chars === current.length) {
        deleting = true;
        setTimeout(tick, 1700);
        return;
      }
      setTimeout(tick, 70);
    }
  };
  setTimeout(tick, 700);
}

/* ── boot ─────────────────────────────────────────────────────── */

export function initDocument() {
  loadState();
  // Re-apply anything unlocked in a previous visit.
  unlocked.forEach(applyUnlockClass);

  initNav();
  initTheme();
  initReveal();
  initScrollUnlock();
  initTypewriter();

  document.getElementById('skipBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    unlockAll(true);
  });
}
