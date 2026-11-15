// Visual effects of the battle board: particles, projectiles, slashes, floating numbers, banners, coins.
// Everything is UI-only and uses the Web Animations API with transforms (cheap to animate).
import { h, iconEl } from './dom.js';

const MAX_PARTICLES = 70;

/**
 * @param fxLayer  absolutely positioned layer covering the board
 * @param o        { cols, rows, speed, reduce }  reduce = "reduce motion" (no particles, shake, slow-mo)
 */
export function createFx(fxLayer, o) {
  const { cols, rows } = o;
  let live = 0, dead = false;
  const size = () => ({ w: fxLayer.clientWidth / cols, h: fxLayer.clientHeight / rows });
  /** Pixel centre of a cell (fractions allowed). */
  const pos = (r, c) => { const s = size(); return { x: (c - 0.5) * s.w, y: (r - 0.5) * s.h, s }; };
  const dur = (ms) => Math.max(60, ms * o.speed);

  function spawn(cls, x, y, content = null) {
    const el = h(`div.fx-item.${cls}`, {}, content);
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    fxLayer.append(el);
    return el;
  }
  function run(el, frames, opts) {
    const a = el.animate(frames, { fill: 'forwards', ...opts });
    a.onfinish = a.oncancel = () => el.remove();
    return a;
  }

  /** Particle burst from a cell. */
  function burst(r, c, { count = 8, colors = ['#fff'], spread = 0.6, life = 520, up = 0, size: sz = 0.11, cls = 'dot' } = {}) {
    if (o.reduce || dead) return;
    const { x, y, s } = pos(r, c);
    for (let i = 0; i < count && live < MAX_PARTICLES; i++) {
      const ang = Math.random() * Math.PI * 2, dist = (0.25 + Math.random() * 0.75) * spread * s.w;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - up * s.h;
      const el = spawn(`particle.${cls}`, x, y);
      const d = Math.max(3, sz * s.w * (0.6 + Math.random() * 0.8));
      el.style.width = el.style.height = `${d}px`;
      el.style.background = colors[i % colors.length];
      live++;
      const a = run(el, [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.3)`, opacity: 0 },
      ], { duration: dur(life * (0.7 + Math.random() * 0.6)), easing: 'cubic-bezier(.2,.7,.3,1)' });
      a.finished.catch(() => {}).finally(() => { live--; });
    }
  }
  const dust = (r, c) => burst(r + 0.3, c, { count: 6, colors: ['#e9d9bf', '#cdb89a'], spread: 0.55, life: 420, size: 0.13 });
  const sparks = (r, c, colors = ['#fff', '#ffe58a']) => burst(r, c, { count: 6, colors, spread: 0.45, life: 320, size: 0.08 });
  const debris = (r, c, n = 14) => burst(r, c, { count: n, colors: ['#e9b89c', '#cf9273', '#6b5b57'], spread: 1.1, life: 800, size: 0.16, cls: 'chip' });
  const sparkleUp = (r, c, colors = ['#ffe58a', '#9be08f', '#fff']) => burst(r, c, { count: 7, colors, spread: 0.35, life: 800, up: 0.7, size: 0.09, cls: 'spark' });
  const flames = (r, c) => burst(r, c, { count: 10, colors: ['#ff7a3c', '#ffb238', '#ffe58a', '#e0452a'], spread: 0.6, life: 620, up: 0.5, size: 0.2 });

  /** Projectile flying on an arc from one cell to another. kind: arrow | stone | ball | bolt */
  function projectile(from, to, kind = 'arrow', ms = 200) {
    if (dead) return 0;
    const a = pos(from.row, from.col), b = pos(to.row, to.col);
    const dx = b.x - a.x, dy = b.y - a.y;
    const arc = o.reduce ? 0 : Math.min(a.s.h * 0.45, Math.hypot(dx, dy) * 0.22) * (kind === 'bolt' ? 0.3 : 1);
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const el = spawn(`shot.${kind}`, a.x, a.y);
    const d = dur(ms);
    run(el, [
      { transform: `translate(-50%,-50%) translate(0px,0px) rotate(${ang - 18}deg)` },
      { transform: `translate(-50%,-50%) translate(${dx / 2}px,${dy / 2 - arc}px) rotate(${ang}deg)`, offset: 0.5 },
      { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) rotate(${ang + 18}deg)` },
    ], { duration: d, easing: 'linear' });
    return d;
  }
  /** Melee slash arc on the target cell. */
  function slash(r, c, angleDeg) {
    if (dead) return;
    const { x, y } = pos(r, c);
    const el = spawn('slash', x, y);
    run(el, [
      { transform: `translate(-50%,-50%) rotate(${angleDeg - 50}deg) scale(.6)`, opacity: 0 },
      { transform: `translate(-50%,-50%) rotate(${angleDeg}deg) scale(1.05)`, opacity: 1, offset: 0.4 },
      { transform: `translate(-50%,-50%) rotate(${angleDeg + 40}deg) scale(1.15)`, opacity: 0 },
    ], { duration: dur(240), easing: 'ease-out' });
  }
  /** Floating text (damage, heal, block). */
  function floatText(r, c, text, cls) {
    if (dead) return;
    const { x, y, s } = pos(r - 0.15, c + (Math.random() - 0.5) * 0.3);
    const el = spawn(`float.${cls}`, x, y, text);
    run(el, [
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%,-70%) scale(1.15)', opacity: 1, offset: 0.2 },
      { transform: `translate(-50%, calc(-50% - ${s.h * 0.55}px)) scale(1)`, opacity: 0 },
    ], { duration: Math.max(500, dur(900)), easing: 'ease-out' });
  }
  /** Expanding ring (spell impact, placement). */
  function ring(r, c, color = '#fff', scale = 1.6) {
    if (dead) return;
    const { x, y, s } = pos(r, c);
    const el = spawn('ring', x, y);
    el.style.width = el.style.height = `${s.w * 0.8}px`;
    el.style.borderColor = color;
    run(el, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0.9 }, { transform: `translate(-50%,-50%) scale(${scale})`, opacity: 0 }], { duration: dur(450), easing: 'ease-out' });
  }
  /** Speed lines sweeping over a unit (war horn). */
  function wind(r, c, up) {
    if (o.reduce || dead) return;
    const { x, y, s } = pos(r, c);
    for (let i = 0; i < 3; i++) {
      const el = spawn('windline', x + (i - 1) * s.w * 0.22, y);
      el.style.height = `${s.h * 0.5}px`;
      run(el, [{ transform: `translate(-50%,-50%) translateY(${up ? 30 : -30}%)`, opacity: 0 }, { opacity: 0.9, offset: 0.3 },
        { transform: `translate(-50%,-50%) translateY(${up ? -90 : 90}%)`, opacity: 0 }], { duration: dur(500), delay: i * 60 });
    }
  }
  /** A coin flying from a board cell to a HUD element (bounty). */
  function coinTo(r, c, targetEl, label) {
    if (dead || !targetEl || !targetEl.isConnected) return;
    const { x, y, s } = pos(r, c);
    const br = fxLayer.getBoundingClientRect(), tr = targetEl.getBoundingClientRect();
    const el = h('div.coin-fly', {}, iconEl('gold', 'coin-spr'), h('b', {}, label));
    el.style.left = `${br.left + x}px`; el.style.top = `${br.top + y}px`;
    document.body.append(el);
    const dx = tr.left + tr.width / 2 - (br.left + x), dy = tr.top + tr.height / 2 - (br.top + y);
    const a = el.animate(o.reduce
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: `translate(-50%, calc(-50% - ${s.h * 0.4}px)) scale(1.1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 0.9 }],
    { duration: dur(700), easing: 'cubic-bezier(.5,0,.6,1)' });
    a.onfinish = a.oncancel = () => el.remove();
  }
  /** Shake an element (board, tower). */
  function shake(el, strength = 6, ms = 400) {
    if (o.reduce || dead || !el) return;
    const k = strength;
    el.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${-k}px,${k / 2}px)` }, { transform: `translate(${k}px,${-k / 2}px)` },
      { transform: `translate(${-k / 2}px,${k / 3}px)` }, { transform: `translate(${k / 2}px,0)` }, { transform: 'translate(0,0)' }], { duration: dur(ms) });
  }
  /** Brief slow motion of every running animation in the document (King's castle falls). */
  function slowMo(ms = 520, rate = 0.25) {
    if (o.reduce || dead) return;
    const anims = document.getAnimations();
    for (const a of anims) { try { a.playbackRate = rate; } catch { /* finished */ } }
    setTimeout(() => { for (const a of anims) { try { a.playbackRate = 1; } catch { /* finished */ } } }, ms);
  }
  /** Big centred banner over the board ("Round 5", "Battle!"). Does not block input. */
  function banner(host, text, cls = '', ms = 620) {
    if (dead) return;
    const el = h(`div.banner${cls ? '.' + cls : ''}`, {}, h('span', {}, text));
    host.append(el);
    const a = el.animate(o.reduce
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
      : [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.06)', offset: 0.22 },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.75 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.15)' }],
    { duration: Math.max(420, dur(ms)), easing: 'ease-out' });
    a.onfinish = a.oncancel = () => el.remove();
  }

  return {
    pos, burst, dust, sparks, debris, sparkleUp, flames, projectile, slash, floatText, ring, wind, coinTo, shake, slowMo, banner,
    dispose() { dead = true; fxLayer.replaceChildren(); document.querySelectorAll('.coin-fly').forEach(e => e.remove()); },
  };
}

/** Falling petals / confetti over a container (victory). Returns a stop function. */
export function confetti(host, { count = 46, colors = ['#e08a2e', '#a3242f', '#f0c044', '#fbf4ee', '#7fae6b'] } = {}) {
  const els = [];
  for (let i = 0; i < count; i++) {
    const el = h('div.confetti');
    el.style.left = `${Math.random() * 100}%`;
    el.style.background = colors[i % colors.length];
    el.style.animationDelay = `${Math.random() * 2.5}s`;
    el.style.animationDuration = `${3 + Math.random() * 3}s`;
    el.style.setProperty('--drift', `${(Math.random() - 0.5) * 160}px`);
    host.append(el);
    els.push(el);
  }
  return () => els.forEach(e => e.remove());
}
