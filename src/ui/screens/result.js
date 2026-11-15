import { h, cardView, cardBack, ornament, ui, btn } from '../dom.js';
import { CARDS } from '../../data/cards.js';
import { getBattle, nextBattleId } from '../../data/campaign.js';
import { recordWin } from '../store.js';
import { audio } from '../audio.js';
import { confetti } from '../fx.js';
import { uiSvg } from '../../../assets/sprites.js';

const REASON_HY = {
  king: ['Թշնամու Արքայի ամրոցն ավերված է։', 'Քո Արքայի ամրոցն ավերվեց։'],
  towers: ['Դու ավելի շատ աշտարակ ավերեցիր։', 'Հակառակորդն ավելի շատ աշտարակ ավերեց։'],
  hp: ['Քո աշտարակներն ավելի շատ կյանք պահպանեցին։', 'Հակառակորդի աշտարակներն ավելի շատ կյանք պահպանեցին։'],
  draw: ['Ուժերը հավասար էին։', 'Ուժերը հավասար էին։'],
};

/** params: { mode, battleId, winner, reason, starsWon, towers:[mine destroyed, lost], rounds, stats, replay } */
export function resultScreen(app, params) {
  const won = params.winner === 0, draw = params.winner === 'draw';
  const reduce = !!app.profile.settings.reduceMotion;
  let unlocked = [];
  const battle = params.battleId ? getBattle(params.battleId) : null;
  const firstDeckUnlock = battle && battle.id === '1-3' && won && !(app.profile.stars['1-3'] > 0);
  if (battle && won) { unlocked = recordWin(app.profile, battle, params.starsWon); app.save(); }
  const next = battle && won ? nextBattleId(battle.id) : null;
  const st = params.stats || {};
  const timers = [];
  let stopConfetti = null;

  // stars fill one by one
  const starCount = won ? (battle ? params.starsWon : params.reason === 'king' ? 3 : params.towers[1] === 0 ? 2 : 1) : 0;
  const starEls = [0, 1, 2].map(() => h('span.star.big', { html: uiSvg('star') }));
  starEls.forEach((el, i) => {
    if (i >= starCount) return;
    timers.push(setTimeout(() => { el.classList.add('on', 'pop'); audio.sfx('star'); }, reduce ? 0 : 500 + i * 420));
  });
  timers.push(setTimeout(() => audio.sfx(won ? 'win' : draw ? 'click' : 'lose'), 120));
  audio.music(null);
  timers.push(setTimeout(() => audio.music('menu'), 3200));

  const stat = (label, value) => h('div.rstat', {}, h('b', {}, value ?? '—'), h('span', {}, label));
  const unlockCards = unlocked.map((id, i) => {
    const flip = h('div.flip.unlock-flip', {}, h('div.flip-inner', {}, h('div.flip-back', {}, cardBack(false)), h('div.flip-front', {}, cardView(id))));
    timers.push(setTimeout(() => { flip.classList.add('open', 'sparkle'); audio.sfx('flip'); }, reduce ? 0 : 1500 + starCount * 300 + i * 400));
    return flip;
  });

  const root = h(`div.screen.result${won ? '.win' : draw ? '.draw' : '.loss'}`, {},
    h('div.result-card', {},
      ornament(),
      h('h1', {}, won ? 'Հաղթանակ' : draw ? 'Ոչ-ոքի' : 'Պարտություն'),
      h('p.reason', {}, REASON_HY[params.reason][won || draw ? 0 : 1]),
      h('div.result-stars', {}, starEls),
      won ? h('p.hint', {}, '1 աստղ՝ հաղթանակ · 2՝ առանց աշտարակ կորցնելու · 3՝ թշնամու ամրոցի ավերում') : null,
      h('div.result-stats', {},
        stat('ռաունդ', params.rounds),
        stat('ավերած աշտարակ', params.towers[0]),
        stat('կորցրած աշտարակ', params.towers[1]),
        stat('դրված զորք', st.unitsPlaced),
        stat('հասցված վնաս', st.damage),
        stat('ծախսված ոսկի', st.goldSpent)),
      h('p.result-meta', {}, `Ավերված աշտարակներ՝ դու ${params.towers[0]} · հակառակորդը ${params.towers[1]} · ռաունդ ${params.rounds}`),
      unlocked.length ? h('div.unlocks', {}, h('h3', {}, 'Նոր քարտ է բացվել'),
        h('div.card-row.center', {}, unlockCards),
        h('p.history', {}, CARDS[unlocked[0]].historyHy)) : null,
      firstDeckUnlock ? h('p.ok', {}, ui('check'), ' Բացվեց կապուկի խմբագրիչը. այժմ կարող ես ինքդ կազմել կապուկը։') : null,
      battle && won && !next ? h('p.ok', {}, 'Դու ավարտեցիր ամբողջ արշավը։ Շնորհավորում ենք։') : null,
      h('div.actions.center', {},
        next ? btn('.primary.big.next-btn', 'Հաջորդ մարտը →', () => app.go('intro', { battleId: next })) : null,
        btn('.replay-btn', 'Կրկնել', () => app.go('battle', params.replay)),
        battle ? btn('', 'Արշավի քարտեզ', () => app.go('campaign', { chapter: battle.chapter }))
          : btn('', 'Ազատ մարտ', () => app.go('free', params.replay.freeParams || {})),
        btn('.ghost', 'Մենյու', () => app.go('menu'))),
      ornament()));
  if (won && !reduce) stopConfetti = confetti(root);
  app.cleanup = () => { timers.forEach(clearTimeout); if (stopConfetti) stopConfetti(); };
  return root;
}
