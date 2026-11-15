import { h, ui, ornament } from '../dom.js';
import { deckEditorUnlocked, totalStars } from '../store.js';
import { BATTLES } from '../../data/campaign.js';
import { audio } from '../audio.js';
import { araratScene } from '../../../assets/scenes.js';

/** Illustrated background with a soft mouse parallax. Returns { el, dispose }. */
export function sceneBackdrop(id) {
  const el = h('div.backdrop', { html: araratScene(id) });
  const onMove = (ev) => {
    el.style.setProperty('--px', ((ev.clientX / window.innerWidth) - 0.5).toFixed(3));
    el.style.setProperty('--py', ((ev.clientY / window.innerHeight) - 0.5).toFixed(3));
  };
  window.addEventListener('pointermove', onMove);
  return { el, dispose: () => window.removeEventListener('pointermove', onMove) };
}
const title = (text) => h('h1.game-title', { 'aria-label': text },
  [...text].map((ch, i) => h('span', { style: { animationDelay: `${i * 0.05}s` } }, ch === ' ' ? ' ' : ch)));

export function menuScreen(app) {
  const p = app.profile;
  const deckOpen = deckEditorUnlocked(p);
  const bg = sceneBackdrop('m');
  app.cleanup = bg.dispose;
  const item = (label, sub, onclick, disabled = false) =>
    h(`button.menu-item${disabled ? '.locked' : ''}`, {
      onclick: disabled ? null : () => { audio.sfx('click'); onclick(); }, onmouseenter: () => { if (!disabled) audio.sfx('hover'); }, disabled,
    }, h('span.menu-label', {}, label), h('span.menu-sub', {}, sub));
  return h('div.screen.menu', {},
    bg.el,
    h('div.menu-inner', {},
      h('header.title-block', {},
        ornament(),
        title('Արքաների Մարտ'),
        h('p.subtitle', {}, 'Մարտավարական քարտախաղ՝ հայոց պատմության էջերով'),
        ornament()),
      h('nav.menu-list', {},
        item('Արշավ', `7 գլուխ · 21 մարտ · ${totalStars(p)} / ${BATTLES.length * 3} աստղ`, () => app.go('campaign')),
        item('Ազատ մարտ', 'Ընտրիր կապուկը և AI-ի մակարդակը', () => app.go('free')),
        item('Կապուկի խմբագրիչ', deckOpen ? 'Կազմիր քո 8 քարտանոց կապուկը' : 'Բացվում է 1-3 մարտը հաղթելուց հետո', () => app.go('deck'), !deckOpen),
        h('div.menu-row', {},
          item('Ինչպես խաղալ', 'Կանոնները 6 նկարով', () => app.go('howto')),
          item('Քարտերի հավաքածու', 'Քարտերը և նրանց պատմությունը', () => app.go('history'))),
        h('div.menu-row', {},
          item('Վիճակագրություն', 'Հաղթանակներ, աստղեր, ժամանակ', () => app.go('stats')),
          item('Կարգավորումներ', 'Ձայն, ժամաչափ, արագություն', () => app.go('settings'))),
        window.appAPI ? item('Դուրս գալ', 'Փակել խաղը', () => window.appAPI.quit()) : null),
      h('footer.foot', {}, 'Դիպլոմային աշխատանք · «Ինտելեկտուալ հակառակորդով տրամաբանական խաղի ծրագրային միջոցի մշակումը և իրականացումը»')),
    h('div.version', {}, `v${app.version.replace(/\.0$/, '')}`),
    h('button.btn.ghost.small.corner-mute', { title: 'Ձայն (M)', onclick: (e) => { app.toggleMute(); e.currentTarget.replaceChildren(ui(audio.muted ? 'mute' : 'sound')); } }, ui(audio.muted ? 'mute' : 'sound')));
}

/** First launch: short animated intro (title over the Ararat scene), skippable by any key or click. */
export function splashScreen(app) {
  const bg = sceneBackdrop('s');
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    app.profile.introSeen = true;
    app.save();
    app.go('menu');
  };
  const timer = setTimeout(finish, 5200);
  const onKey = () => finish();
  window.addEventListener('keydown', onKey);
  app.cleanup = () => { clearTimeout(timer); window.removeEventListener('keydown', onKey); bg.dispose(); };
  return h('div.screen.splash', { onclick: finish },
    bg.el,
    h('div.splash-inner', {},
      title('Արքաների Մարտ'),
      h('p.splash-line.l1', {}, 'Հայկից մինչև Սարդարապատ'),
      h('p.splash-line.l2', {}, 'Յոթ գլուխ, մեկ դաշտ, մտածող հակառակորդ'),
      h('p.splash-skip', {}, 'Սեղմիր ցանկացած ստեղն՝ շարունակելու համար')));
}
