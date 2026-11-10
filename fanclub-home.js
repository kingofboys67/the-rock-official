// Home page Fan Club teaser: shows the visitor's own card if they've made one (saved by fanclub.js), otherwise a sample.
(async () => {
  const canvas = document.getElementById('fanclubHomeCard');
  if (!canvas || !window.RockCard) return;
  let member = null;
  try { member = JSON.parse(localStorage.getItem('rockFanClubMember')); } catch {}

  const sample = { number: 1, since: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase(), name: '', city: '', movie: '', style: 'volt' };
  let photo = null;
  if (member?.photo) {
    photo = await new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = member.photo; });
  }
  if (member?.name) {
    document.getElementById('fanclubHomeLede').textContent = `Welcome back, ${member.name.split(/\s+/)[0]}. Here’s your card, member No. ${String(member.number).padStart(6, '0')}.`;
    document.getElementById('fanclubHomeCta').textContent = 'View your card →';
  }
  await RockCard.fonts();
  RockCard.draw(canvas, member?.name ? member : sample, photo);
})();
