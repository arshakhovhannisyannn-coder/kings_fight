import { h, cardView } from '../dom.js';
import { topBar } from './campaign.js';
import { CARDS, STARTER_DECK, validateDeck, TYPE_HY } from '../../data/cards.js';
import { CONFIG } from '../../data/config.js';
import { availableCards, deckEditorUnlocked } from '../store.js';

/** Deck editor. params.demo = build from all cards (Free Battle demo mode, saved separately). */
export function deckScreen(app, params = {}) {
  const p = app.profile;
  const demo = !!params.demo;
  if (!demo && !deckEditorUnlocked(p)) {
    return h('div.screen', {}, topBar(app, 'Կապուկի խմբագրիչ'),
      h('p.locked-note', {}, 'Կապուկի խմբագրիչը բացվում է 1-3 մարտը (Հայոց ձորի ճակատամարտը) հաղթելուց հետո։ Մինչ այդ օգտագործվում է սկզբնական կապուկը։'));
  }
  const pool = availableCards(p, demo);
  let deck = (demo ? (p.freeDeck || p.deck) : p.deck).filter(id => pool.includes(id));
  const root = h('div.screen.deck');
  const limits = CONFIG.deckLimits;

  function render() {
    const v = validateDeck(deck, CONFIG, pool);
    const count = id => deck.filter(x => x === id).length;
    const legendary = deck.filter(id => ['hero', 'special'].includes(CARDS[id].type)).length;
    const canAdd = id => deck.length < CONFIG.deckSize && count(id) < limits.maxCopies[CARDS[id].type]
      && (!['hero', 'special'].includes(CARDS[id].type) || legendary < limits.maxLegendary);
    const avgCost = deck.length ? (deck.reduce((a, id) => a + CARDS[id].cost, 0) / deck.length).toFixed(1) : '—';
    root.replaceChildren(
      topBar(app, demo ? 'Կապուկի խմբագրիչ (բոլոր քարտերը)' : 'Կապուկի խմբագրիչ', params.back || 'menu', params.backParams || {}),
      h('div.deck-body', {},
        h('section.panel', {},
          h('h3', {}, `Կապուկ՝ ${deck.length} / ${CONFIG.deckSize}`, h('small', {}, ` · միջին գին՝ ${avgCost} · լեգենդար՝ ${legendary} / ${limits.maxLegendary}`)),
          h('div.card-row.deck-row', {}, deck.map((id, i) => cardView(id, { small: true, onclick: () => { deck.splice(i, 1); render(); } })),
            Array.from({ length: CONFIG.deckSize - deck.length }, () => h('div.card.small.empty', {}, '+'))),
          h('p.hint', {}, 'Սեղմիր կապուկի քարտին՝ հանելու համար, ներքևի քարտին՝ ավելացնելու համար։'),
          v.ok ? h('p.ok', {}, 'Կապուկը պատրաստ է') : h('p.error', {}, v.errors.join(' ')),
          h('div.actions', {},
            h('button.btn', { onclick: () => { deck = [...STARTER_DECK]; render(); } }, 'Սկզբնական կապուկ'),
            h('button.btn.primary', {
              disabled: !v.ok,
              onclick: async () => { if (demo) p.freeDeck = [...deck]; else p.deck = [...deck]; await app.save(); app.go(params.back || 'menu', params.backParams || {}); },
            }, 'Պահպանել'))),
        h('section.panel', {},
          h('h3', {}, 'Հասանելի քարտեր'),
          h('p.hint', {}, `Սահմանափակումներ. զինվոր՝ մինչև ${limits.maxCopies.soldier} օրինակ, հմայք և կառույց՝ մինչև ${limits.maxCopies.spell}, հերոս՝ 1, ընդամենը ${limits.maxLegendary} լեգենդար քարտ։`),
          ['soldier', 'hero', 'special', 'spell', 'building'].map(type => {
            const ids = pool.filter(id => CARDS[id].type === type);
            if (!ids.length) return null;
            return h('div.pool-group', {}, h('h4', {}, TYPE_HY[type]),
              h('div.card-row', {}, ids.map(id => cardView(id, {
                small: true, disabled: !canAdd(id), count: count(id) || null,
                onclick: () => { if (canAdd(id)) { deck.push(id); render(); } },
              }))));
          }))));
  }
  render();
  return root;
}
