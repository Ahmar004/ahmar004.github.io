/**
 * Renders every portfolio section from content.js into real HTML.
 *
 * Sections are always present in the DOM regardless of game state — "locked"
 * is a purely visual treatment, so search engines, screen readers and
 * no-WebGL visitors get the complete portfolio.
 */

import { profile, sections } from '../content.js';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Content authored in content.js may contain intentional <strong> tags. */
const rich = (s) => String(s);

function tags(list, accentClass = 'is-accent') {
  return list
    .map((t) => `<span class="tag ${accentClass}">${esc(t)}</span>`)
    .join('');
}

/* ── section body renderers, one per `type` ───────────────────── */

const renderers = {
  timeline: (items) => `
    <div class="timeline">
      ${items
        .map(
          (it) => `
        <article class="tl-card reveal">
          <div class="tl-marker" aria-hidden="true"></div>
          <div class="tl-head">
            <div>
              <h3 class="tl-role">${esc(it.role)}</h3>
              <p class="tl-org">${esc(it.org)}</p>
            </div>
            <span class="tl-period${it.current ? ' is-current' : ''}">${esc(it.period)}</span>
          </div>
          <p class="tl-meta">${esc(it.meta)}</p>
          <ul class="tl-bullets">
            ${it.bullets.map((b) => `<li>${rich(b)}</li>`).join('')}
          </ul>
        </article>`
        )
        .join('')}
    </div>`,

  cards: (items) => `
    <div class="cards">
      ${items
        .map((it) => {
          const tag = it.link ? 'a' : 'article';
          const attrs = it.link
            ? ` href="${esc(it.link)}" target="_blank" rel="noopener noreferrer"`
            : '';
          return `
        <${tag} class="card reveal${it.featured ? ' is-featured' : ''}"${attrs}>
          <span class="card-glow" aria-hidden="true"></span>
          <div class="card-top">
            <span class="card-icon" aria-hidden="true">${it.icon}</span>
            <div class="card-flags">
              ${it.badge ? `<span class="chip">${esc(it.badge)}</span>` : ''}
              ${it.oss ? '<span class="chip is-oss">OSS</span>' : ''}
              ${it.link ? '<span class="card-arrow" aria-hidden="true">↗</span>' : ''}
            </div>
          </div>
          <h3 class="card-name">${esc(it.name)}</h3>
          <p class="card-desc">${esc(it.desc)}</p>
          <div class="tags">${tags(it.tags)}</div>
        </${tag}>`;
        })
        .join('')}
    </div>`,

  skills: (items) => `
    <div class="cards cards-skills">
      ${items
        .map(
          (g) => `
        <article class="card skill-card reveal" style="--group: ${g.color}">
          <div class="skill-head">
            <span class="skill-dot" aria-hidden="true"></span>
            <h3 class="skill-group">${esc(g.group)}</h3>
          </div>
          <div class="tags">
            ${g.skills.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}
          </div>
        </article>`
        )
        .join('')}
    </div>`,

  education: (items) => `
    <div class="edu-list">
      ${items
        .map(
          (e) => `
        <article class="edu-card reveal">
          <span class="edu-icon" aria-hidden="true">${e.icon}</span>
          <div>
            <h3 class="edu-inst">${esc(e.institution)}</h3>
            <p class="edu-degree">${esc(e.degree)}</p>
            <p class="edu-period">${esc(e.period)}</p>
            ${e.note ? `<p class="edu-note">${esc(e.note)}</p>` : ''}
            ${
              e.awards.length
                ? `<div class="awards">${e.awards
                    .map((a) => `<span class="award is-${a.kind}">${esc(a.text)}</span>`)
                    .join('')}</div>`
                : ''
            }
          </div>
        </article>`
        )
        .join('')}
    </div>`,

  courses: (items) => `
    <div class="course-list">
      ${items
        .map((c) => {
          const tag = c.link ? 'a' : 'div';
          const attrs = c.link
            ? ` href="${esc(c.link)}" target="_blank" rel="noopener noreferrer"`
            : '';
          const done = c.status === 'Certified';
          return `
        <${tag} class="course reveal"${attrs}>
          <span class="course-icon" aria-hidden="true">${c.icon}</span>
          <div class="course-body">
            <p class="course-name">${esc(c.name)}</p>
            <p class="course-provider">${esc(c.provider)}</p>
          </div>
          <span class="course-status${done ? ' is-done' : ''}">${esc(c.status)}</span>
        </${tag}>`;
        })
        .join('')}
    </div>`,

  pills: (items) => `
    <div class="pills">
      ${items.map((p) => `<span class="pill reveal">${p}</span>`).join('')}
    </div>`,

  contact: () => `
    <div class="contact reveal">
      <div class="contact-links">
        <a class="contact-btn is-primary" href="mailto:${esc(profile.email)}">
          <span aria-hidden="true">✉</span> ${esc(profile.email)}
        </a>
        <a class="contact-btn" href="${esc(profile.github)}" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .5C5.6.5.5 5.6.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.5-.3-5.2-1.3-5.2-5.7 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 5.4 18.3 5.7 18.3 5.7c.6 1.6.2 2.8.1 3.1.7.9 1.2 1.9 1.2 3.2 0 4.5-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6C20.2 21.4 23.5 17.1 23.5 12 23.5 5.6 18.4.5 12 .5z"/></svg>
          ${esc(profile.githubHandle)}
        </a>
        <a class="contact-btn" href="${esc(profile.linkedin)}" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.59 0 4.26 2.36 4.26 5.43v6.31zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.57V9h3.55v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>
          LinkedIn
        </a>
        <a class="contact-btn" href="${esc(profile.resume)}" download>
          <span aria-hidden="true">📄</span> Download résumé
        </a>
      </div>
      <p class="contact-loc">📍 ${esc(profile.location)} · ${esc(profile.phone)}</p>
    </div>`,
};

/* ── public API ───────────────────────────────────────────────── */

export function renderSections(root) {
  root.innerHTML = sections
    .map(
      (s) => `
    <section class="section is-locked" id="${s.id}" style="--accent: ${s.accent}" data-section="${s.id}">
      <div class="section-head">
        <p class="section-kicker">${esc(s.kicker)}</p>
        <h2 class="section-title">${esc(s.title)}</h2>
        <p class="section-intro">${esc(s.intro)}</p>
      </div>
      ${renderers[s.type](s.items)}
    </section>`
    )
    .join('');
}

export function renderNav(desktopRoot, mobileRoot) {
  const links = sections
    .filter((s) => !s.hidden)
    .map((s) => ({ id: s.id, label: s.label }));
  links.push({ id: 'beyond', label: 'BEYOND CODE' });

  const hamburger = desktopRoot.querySelector('#hamburger');
  links.forEach((l) => {
    const a = document.createElement('a');
    a.className = 'nav-link';
    a.href = `#${l.id}`;
    a.textContent = l.label.toLowerCase();
    desktopRoot.insertBefore(a, hamburger);
  });

  mobileRoot.innerHTML = links
    .map((l) => `<a class="mobile-link" href="#${l.id}">${esc(l.label)}</a>`)
    .join('');
}

export function renderIntro() {
  const blurb = document.getElementById('introBlurb');
  if (blurb) blurb.textContent = profile.blurb;
  const total = document.getElementById('totalCount');
  if (total) total.textContent = String(sections.filter((s) => !s.hidden).length);
}
