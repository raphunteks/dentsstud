/* Render Center card loop (GSAP). One timeline, about 3.6 s a cycle; transform and text only.
   Rests on its finished state under reduced motion; pauses off screen and on the pause button; restarts on hover. */
(function () {
  const card = document.querySelector('[data-gsap-rq]');
  const btn = document.querySelector('[data-gsap-pause]');
  if (!card || !window.gsap) return;
  const bars = [...card.querySelectorAll('.rq__bar i')];
  const states = [...card.querySelectorAll('[data-rq-state]')];
  const from = [0.62, 0.28, 0];
  const to = [1, 0.64, 0.18];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const label = (i, v) => (states[i].textContent = v >= 1 ? 'Selesai' : `${Math.round(v * 100)}%`);
  if (reduced) {
    bars.forEach((b, i) => gsap.set(b, { scaleX: to[i] }));
    to.forEach((v, i) => label(i, v));
    if (btn) btn.hidden = true;
    return;
  }

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, defaults: { ease: 'power2.inOut' } });
  bars.forEach((b, i) => {
    const o = { v: from[i] };
    tl.fromTo(b, { scaleX: from[i] }, { scaleX: to[i], duration: 2.4, transformOrigin: '0 50%' }, i * 0.15);
    tl.fromTo(o, { v: from[i] }, { v: to[i], duration: 2.4, onUpdate: () => label(i, o.v) }, i * 0.15);
  });
  tl.to({}, { duration: 0.6 });

  let userPaused = false;
  const io = new IntersectionObserver(([e]) => (e.isIntersecting && !userPaused ? tl.play() : tl.pause()), { threshold: 0.2 });
  io.observe(card);
  card.parentElement.addEventListener('pointerenter', () => !userPaused && tl.restart());
  btn?.addEventListener('click', () => {
    userPaused = !userPaused;
    userPaused ? tl.pause() : tl.play();
    btn.setAttribute('aria-pressed', String(userPaused));
    btn.textContent = userPaused ? 'Putar animasi' : 'Jeda animasi';
  });
})();
