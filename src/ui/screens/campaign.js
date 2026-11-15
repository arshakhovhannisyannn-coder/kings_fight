import { h, stars, cardView, ornament, iconEl, ui, btn } from '../dom.js';
import { CHAPTERS, getBattle, getChapter } from '../../data/campaign.js';
import { CARDS, STARTER_DECK, validateDeck } from '../../data/cards.js';
import { CONFIG } from '../../data/config.js';
import { isBattleUnlocked, deckEditorUnlocked } from '../store.js';
import { LEVEL_HY } from '../../ai/index.js';
import { audio } from '../audio.js';
import { campaignMap, araratScene } from '../../../assets/scenes.js';

export function topBar(app, title, back = 'menu', backParams = {}) {
  return h('div.topbar', {},
    btn('.ghost', '← Հետ', () => app.go(back, backParams)),
    h('h2', {}, title), h('span.spacer'));
}

/** Campaign: a decorative illustrated path with the 7 chapters as nodes, and the battles of the selected chapter. */
export function campaignScreen(app, params = {}) {
  const p = app.profile;
  const map = campaignMap();
  const chapterOpen = (ch) => isBattleUnlocked(p, ch.battles[0].id);
  const chapterStars = (ch) => ch.battles.reduce((a, b) => a + (p.stars[b.id] || 0), 0);
  const chapterDone = (ch) => ch.battles.every(b => (p.stars[b.id] || 0) > 0);
  let current = params.chapter || [...CHAPTERS].reverse().find(chapterOpen)?.id || 1;
  const root = h('div.screen.campaign');

  function render() {
    const ch = getChapter(current);
    const open = chapterOpen(ch);
    root.replaceChildren(
      topBar(app, 'Արշավ'),
      h('div.map-wrap', {},
        h('div.map', {}, h('div.map-art', { html: map.svg }),
          CHAPTERS.map((c, i) => {
            const o = chapterOpen(c), done = chapterDone(c);
            const node = h(`button.map-node${o ? '' : '.locked'}${done ? '.done' : ''}${c.id === current ? '.current' : ''}`, {
              style: { left: `${map.nodes[i].x / 10}%`, top: `${map.nodes[i].y / 5.6}%` },
              onclick: () => { audio.sfx('click'); current = c.id; render(); },
              onmouseenter: () => audio.sfx('hover'),
            },
              h('span.node-disc', {}, o ? iconEl(c.heroUnlock, 'node-hero') : ui('lock', 'node-lock')),
              h('span.node-num', {}, c.id),
              h('span.node-title', {}, c.titleHy),
              h('span.node-stars', {}, `${chapterStars(c)} / 9 `, ui('star')));
            if (!p.unlocked.includes(c.heroUnlock)) node.classList.add('hero-locked');
            return node;
          }))),
      h(`section.chapter${open ? '' : '.locked'}`, {},
        h('div.chapter-head', {},
          h('span.chapter-num', {}, ch.id),
          h('div', {}, h('h3', {}, ch.titleHy), h('span.period', {}, ch.periodHy),
            h(`span.tag.${ch.legend ? 'legend' : 'history'}`, {}, ch.legend ? 'Ըստ ավանդության' : 'Պատմական')),
          h('span.hero-reward', { title: 'Գլխի պարգևը' }, ui('gift'), ' ', CARDS[ch.heroUnlock].nameHy,
            p.unlocked.includes(ch.heroUnlock) ? [' ', ui('check', 'ok')] : '')),
        open ? null : h('p.hint', {}, 'Այս գլուխը բացվում է նախորդ գլխի բոսին հաղթելուց հետո։'),
        h('div.battles', {}, ch.battles.map(b => {
          const unlocked = isBattleUnlocked(p, b.id);
          return h(`button.battle-node${unlocked ? '' : '.locked'}${b.bossId ? '.boss' : ''}`, {
            disabled: !unlocked, onclick: () => { audio.sfx('click'); app.go('intro', { battleId: b.id }); }, onmouseenter: () => { if (unlocked) audio.sfx('hover'); },
          },
            b.bossId ? iconEl(b.bossId, 'boss-spr') : null,
            h('span.battle-id', {}, b.id, unlocked ? '' : [' ', ui('lock')]),
            h('span.battle-title', {}, b.titleHy),
            h('span.battle-level', {}, LEVEL_HY[b.aiLevel] + (b.bossId ? ' · Բոս' : '')),
            stars(p.stars[b.id] || 0));
        }))));
  }
  render();
  return root;
}

/** Chapter / battle intro: art banner, history text, enemy preview, start button. */
export function introScreen(app, { battleId }) {
  const b = getBattle(battleId), ch = getChapter(b.chapter), p = app.profile;
  // before the deck editor is unlocked the starter deck is used automatically
  let deck = deckEditorUnlocked(p) ? p.deck : STARTER_DECK;
  if (!validateDeck(deck, CONFIG, p.unlocked).ok) deck = STARTER_DECK;
  const enemyCards = [...new Set(b.aiDeck)];
  const start = () => app.go('battle', {
    mode: 'campaign', battleId: b.id, playerDeck: deck, aiDeck: b.aiDeck, aiLevel: b.aiLevel,
    aiTimeMs: b.aiTimeMs, aiMaxDepth: b.aiMaxDepth,
    timer: b.tutorial ? 0 : p.settings.timer, seed: b.seed + (p.stars[b.id] ? Date.now() % 100000 : 0), tutorial: b.tutorial,
  });
  const foe = iconEl(b.bossId || enemyCards.find(id => CARDS[id].enemyOnly) || enemyCards[0], 'banner-spr');
  foe.classList.add('foe', 'foe-side');
  const hero = iconEl(ch.heroUnlock, 'banner-spr');
  hero.classList.add('hero-side');
  return h('div.screen.intro', {},
    topBar(app, `Գլուխ ${ch.id}. ${ch.titleHy}`, 'campaign', { chapter: ch.id }),
    h('div.intro-body', {},
      h('div.chapter-banner', {},
        h('div.banner-art', { html: araratScene('i') }),
        hero, foe,
        h('div.banner-text', {}, h('span.banner-period', {}, ch.periodHy), h('h3', {}, `Մարտ ${b.id}. ${b.titleHy}`))),
      ch.legend ? h('div.legend-banner', {}, ui('scroll'), ' Ըստ ավանդության — այս գլխի բովանդակությունը ավանդազրույց է, ոչ թե փաստագրված պատմություն') : null,
      h('p.chapter-intro', {}, ch.introHy),
      h('p.battle-intro', {}, b.introHy),
      h('div.intro-meta', {},
        h('span.pill', {}, 'Հակառակորդի մակարդակ՝ ', h('b', {}, LEVEL_HY[b.aiLevel])),
        b.bossId ? h('span.pill.boss', {}, 'Բոս՝ ', h('b', {}, CARDS[b.bossId].nameHy)) : null,
        b.tutorial ? h('span.pill', {}, 'Ուսուցողական մարտ (առանց ժամաչափի)') : null),
      h('div.intro-decks', {},
        h('div', {}, h('h4', {}, 'Հակառակորդի զորքը'),
          h('div.card-row', {}, enemyCards.map(id => cardView(id, { small: true, foe: true, count: b.aiDeck.filter(x => x === id).length })))),
        h('div', {}, h('h4', {}, 'Քո կապուկը'),
          h('div.card-row', {}, deck.map(id => cardView(id, { small: true }))))),
      h('div.actions', {},
        deckEditorUnlocked(p) ? btn('', 'Փոխել կապուկը', () => app.go('deck', { back: 'intro', backParams: { battleId } })) : null,
        btn('.primary.big', [ui('swords'), ' Սկսել մարտը'], start)),
      ornament()));
}
