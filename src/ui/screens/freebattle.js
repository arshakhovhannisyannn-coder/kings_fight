import { h, cardView, ui } from '../dom.js';
import { topBar } from './campaign.js';
import { DECK_PRESETS } from '../../data/campaign.js';
import { STARTER_DECK, validateDeck } from '../../data/cards.js';
import { CONFIG } from '../../data/config.js';
import { LEVEL_HY, ALGO_HY } from '../../ai/index.js';

export function freeBattleScreen(app, params = {}) {
  const p = app.profile, s = p.settings;
  const st = { level: params.level || 'medium', aiDeck: params.aiDeck || 'starter', timer: s.timer, deckKey: params.deckKey || 'mine' };
  const root = h('div.screen.free');

  const playerDeck = () => {
    if (st.deckKey === 'mine') return s.allCards && p.freeDeck ? p.freeDeck : p.deck;
    return DECK_PRESETS[st.deckKey].cards;
  };
  const choice = (group, value, label, sub = null) =>
    h(`button.choice${st[group] === value ? '.on' : ''}`, { onclick: () => { st[group] = value; render(); } }, h('b', {}, label), sub ? h('small', {}, sub) : null);

  function render() {
    const deck = playerDeck();
    const allowed = s.allCards ? null : p.unlocked;
    const valid = validateDeck(deck, CONFIG, allowed);
    const presetOk = key => s.allCards || validateDeck(DECK_PRESETS[key].cards, CONFIG, p.unlocked).ok;
    const playerPresets = ['starter', 'cavalry', 'archers', 'fortress', 'heroes'].filter(presetOk);
    root.replaceChildren(
      topBar(app, 'Ազատ մարտ'),
      h('div.free-body', {},
        h('section.panel', {},
          h('h3', {}, 'Քո կապուկը'),
          h('div.choices', {},
            choice('deckKey', 'mine', s.allCards ? 'Իմ կապուկը (բոլոր քարտերից)' : 'Իմ կապուկը'),
            playerPresets.map(k => choice('deckKey', k, DECK_PRESETS[k].nameHy))),
          h('div.card-row', {}, deck.map(id => cardView(id, { small: true }))),
          valid.ok ? null : h('p.error', {}, valid.errors.join(' ')),
          h('div.row', {},
            h('label.toggle', {},
              h('input', { type: 'checkbox', checked: s.allCards, onchange: (e) => { s.allCards = e.target.checked; app.save(); render(); } }),
              ' Բոլոր քարտերը (ցուցադրական ռեժիմ)'),
            h('button.btn', { onclick: () => app.go('deck', { demo: s.allCards, back: 'free' }), disabled: !s.allCards && !((p.stars['1-3'] || 0) > 0),
              title: 'Արշավում խմբագրիչը բացվում է 1-3 մարտից հետո. ցուցադրական ռեժիմում՝ միշտ' }, 'Խմբագրել իմ կապուկը'))),
        h('section.panel', {},
          h('h3', {}, 'Հակառակորդ (AI)'),
          h('div.choices', {}, ['easy', 'medium', 'hard'].map(l => choice('level', l, LEVEL_HY[l], ALGO_HY[l]))),
          h('h4', {}, 'AI-ի կապուկը'),
          h('div.choices.wrap', {}, Object.keys(DECK_PRESETS).map(k => choice('aiDeck', k, DECK_PRESETS[k].nameHy))),
          h('div.card-row', {}, DECK_PRESETS[st.aiDeck].cards.map(id => cardView(id, { small: true })))),
        h('section.panel', {},
          h('h3', {}, 'Պլանավորման ժամաչափ'),
          h('div.choices', {}, [[5, '5 վրկ'], [8, '8 վրկ'], [12, '12 վրկ'], [0, 'Անջատված']].map(([v, l]) => choice('timer', v, l))),
          h('div.actions', {},
            h('button.btn.primary.big', {
              disabled: !valid.ok,
              onclick: () => app.go('battle', {
                mode: 'free', playerDeck: deck, aiDeck: DECK_PRESETS[st.aiDeck].cards, aiLevel: st.level,
                timer: st.timer, seed: (Date.now() % 1000000) + 1, freeParams: { level: st.level, aiDeck: st.aiDeck, deckKey: st.deckKey },
              }),
            }, ui('swords'), ' Սկսել մարտը')))));
  }
  render();
  return root;
}
