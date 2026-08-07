/*
  Post-hero page flow: the thread and the reveal choreography.

  The thread is a thin vertical line in the left gutter that draws itself as
  the visitor scrolls, continuing the hero's golden river down through the
  page as a copper-to-hairline stroke. Station nodes light as it passes each
  section. Reveals give sections and cards a quiet staggered entrance.

  Mobile-first: everything here is scroll and viewport driven, works at the
  344px cover-screen floor, adds no WebGL, and respects reduced motion (all
  content visible immediately, thread fully drawn). Without JS the page is
  fully readable: the hidden initial states apply only under .js-flow.
*/

export default function initPageFlow() {
  const docEl = document.documentElement;
  if (docEl.classList.contains('js-flow')) return;
  docEl.classList.add('js-flow');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Reveals: staggered within each parent group */
  const targets = [
    ...document.querySelectorAll('[data-reveal], [data-reveal-child]'),
  ];
  const groupCounts = new Map();
  for (const el of document.querySelectorAll('[data-reveal-child]')) {
    const parent = el.parentElement;
    const i = groupCounts.get(parent) || 0;
    groupCounts.set(parent, i + 1);
    el.style.transitionDelay = `${Math.min(i * 70, 420)}ms`;
  }
  if (reduced) {
    for (const el of targets) el.classList.add('is-in');
  } else if (targets.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    for (const el of targets) io.observe(el);
  }

  /* The thread rail. It is invisible (the visible line is the canvas
     strand); this only measures, so the reveal choreography above stays
     tied to the same geometry. */
  const scope = document.querySelector('[data-thread-scope]');
  const line = document.querySelector('[data-thread-line]');
  if (!scope || !line) return;

  let lineTop = 0, lineH = 1;

  function measure() {
    const scopeTop = scope.getBoundingClientRect().top + window.scrollY;
    // offsetTop/offsetHeight are layout values, unaffected by the scaleY
    lineTop = scopeTop + line.offsetTop;
    lineH = Math.max(1, line.offsetHeight);
  }

  function update() {
    ticking = false;
    const trigger = window.scrollY + window.innerHeight * 0.62;
    const p = Math.min(1, Math.max(0, (trigger - lineTop) / lineH));
    line.style.transform = `scaleY(${p})`;
  }

  let ticking = false;
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  if (reduced) {
    measure();
    line.style.transform = 'scaleY(1)';
    return;
  }

  measure();
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  new ResizeObserver(() => {
    measure();
    onScroll();
  }).observe(scope);
}
