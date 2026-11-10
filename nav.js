// Shared: the logo has no background, so it steps aside while reading (scrolling down) and returns on scroll up or near the top.
(() => {
  const nav = document.getElementById('nav');
  if (!nav) return;
  let last = scrollY, tick = false;
  const run = () => {
    tick = false;
    const y = scrollY;
    if (y < 80) nav.classList.remove('logo-away');
    else if (Math.abs(y - last) > 6) nav.classList.toggle('logo-away', y > last);
    last = y;
  };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(run); } }, { passive: true });
})();
