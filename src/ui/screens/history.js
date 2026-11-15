import { h, cardView, iconEl, ui } from '../dom.js';
import { topBar } from './campaign.js';
import { CARDS, PLAYER_CARD_IDS, TYPE_HY } from '../../data/cards.js';
import { CHAPTERS } from '../../data/campaign.js';
import { isBattleUnlocked } from '../store.js';
import { audio } from '../audio.js';

const FILTERS = [['all', 'Բոլորը'], ['soldier', 'Զինվորներ'], ['hero', 'Հերոսներ'], ['spell', 'Հմայքներ'], ['building', 'Կառույցներ'], ['enemy', 'Հակառակորդներ']];

/** Collection / codex: every card with its history; locked cards are shown as silhouettes. */
export function historyScreen(app, params = {}) {
  const p = app.profile;
  let filter = params.filter || 'all';
  const met = new Set();
  for (const ch of CHAPTERS) for (const b of ch.battles) {
    if (isBattleUnlocked(p, b.id)) b.aiDeck.filter(id => CARDS[id].enemyOnly).forEach(id => met.add(id));
  }
  const enemyIds = [...new Set(CHAPTERS.flatMap(ch => ch.battles.flatMap(b => b.aiDeck)).filter(id => CARDS[id].enemyOnly))];
  const typeOf = (id) => (CARDS[id].enemyOnly ? 'enemy' : CARDS[id].type === 'special' ? 'hero' : CARDS[id].type);
  const known = (id) => (CARDS[id].enemyOnly ? met.has(id) : p.unlocked.includes(id));
  const entry = id => h('article.codex-entry', {},
    cardView(id, { small: true }),
    h('div', {}, h('h4', {}, CARDS[id].nameHy, ' ', h('small', {}, TYPE_HY[CARDS[id].type])),
      CARDS[id].tag ? h(`span.tag.${CARDS[id].tag === 'ավանդություն' ? 'legend' : 'history'}`, {}, CARDS[id].tag === 'ավանդություն' ? 'Ըստ ավանդության' : 'Պատմական') : null,
      CARDS[id].abilityHy ? h('p.ability', {}, CARDS[id].abilityHy) : null,
      h('p.history', {}, CARDS[id].historyHy)));
  const lockedEntry = id => h('article.codex-entry.locked', {},
    h('div.card.small.silhouette', {}, h('div.card-frame'), h('div.card-art', {}, iconEl(id, 'card-icon')), h('div.sil-lock', {}, ui('lock'))),
    h('div', {}, h('h4', {}, '???'), h('p.hint', {}, CARDS[id].enemyOnly ? 'Այս հակառակորդին դեռ չես հանդիպել։' : CARDS[id].type === 'hero' || CARDS[id].type === 'special' ? 'Բացվում է արշավի գլխի բոսին հաղթելիս։' : 'Բացվում է արշավի մարտերը հաղթելիս։')));
  const root = h('div.screen.history');
  function render() {
    const ids = [...PLAYER_CARD_IDS, ...enemyIds].filter(id => filter === 'all' || typeOf(id) === filter);
    const mine = PLAYER_CARD_IDS.filter(id => p.unlocked.includes(id)).length;
    root.replaceChildren(
      topBar(app, 'Քարտերի հավաքածու'),
      h('div.history-body', {},
        h('p.hint', {}, `Բացված է ${mine} / ${PLAYER_CARD_IDS.length} քարտ։ «Ըստ ավանդության» նշված քարտերը հիմնված են ավանդազրույցների վրա, «Պատմական» նշվածները՝ փաստագրված պատմության։`),
        h('div.choices.filters', {}, FILTERS.map(([k, label]) =>
          h(`button.choice${filter === k ? '.on' : ''}`, { dataset: { filter: k }, onclick: () => { audio.sfx('click'); filter = k; render(); } }, h('b', {}, label)))),
        h('div.codex', {}, ids.map(id => (known(id) ? entry(id) : lockedEntry(id))))));
  }
  render();
  return root;
}
