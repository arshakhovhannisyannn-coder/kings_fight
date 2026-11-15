// Small DOM helpers and shared components (card view, tooltip, modal, card info).
import { CARDS, TYPE_HY } from '../data/cards.js';
import { CONFIG } from '../data/config.js';
import { ICONS, IMAGES } from '../../assets/art.js';
import { hasSprite, spriteSvg, uiSvg } from '../../assets/sprites.js';
import { audio } from './audio.js';

/** Create an element: h('div.cls#id', { onclick, title, ... }, child, 'text', [children]) */
export function h(spec, attrs = {}, ...children) {
  const [tagAndId, ...classes] = spec.split('.');
  const [tag, id] = tagAndId.split('#');
  const el = document.createElement(tag || 'div');
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
}

/** Art of a card / unit / tower: an image file if configured, else the SVG sprite, else the fallback glyph. */
export function iconEl(id, cls = 'icon') {
  if (IMAGES[id]) return h(`img.${cls}`, { src: `../../assets/${IMAGES[id]}`, alt: '' });
  if (hasSprite(id)) return h(`span.${cls}.spr${CARDS[id]?.enemyOnly ? '.foe' : ''}`, { html: spriteSvg(id) });
  return h(`span.${cls}`, {}, ICONS[id] || '?');
}
/** Small single-colour UI icon (heart, sword, lock, ...). */
export function ui(name, cls = '') { return h(`span.ui${cls ? '.' + cls : ''}`, { html: uiSvg(name) }); }

/** Button with a click sound. */
export function btn(cls, label, onclick, attrs = {}) {
  return h(`button.btn${cls}`, {
    ...attrs,
    onclick: (e) => { audio.sfx('click'); onclick && onclick(e); },
    onmouseenter: () => audio.sfx('hover'),
  }, label);
}

export function statLine(def) {
  if (def.type === 'spell') return null;
  const parts = [h('span.st.hp', { title: 'Կյանք' }, ui('hp'), def.hp)];
  if (def.atk) parts.push(h('span.st.atk', { title: 'Հարված' }, ui('atk'), def.atk));
  if (def.type !== 'building' && def.speed > 0) parts.push(h('span.st.spd', { title: 'Արագություն' }, ui('spd'), def.speed));
  if (def.range > 1) parts.push(h('span.st.rng', { title: 'Հեռահարություն' }, ui('rng'), def.range));
  return h('div.stats', {}, parts);
}

// ---------- hover info (tooltip after 0.5 s, "I" hotkey) ----------
let tipEl = null, tipTimer = null, hoverInfo = null;
export function hideTooltip() {
  if (tipTimer) { clearTimeout(tipTimer); tipTimer = null; }
  if (tipEl) { tipEl.remove(); tipEl = null; }
}
function tooltipContent(cardId) {
  const def = CARDS[cardId];
  return h('div.tooltip', {},
    h('div.tip-head', {}, h('b', {}, def.nameHy), h('span.tip-type', {}, `${TYPE_HY[def.type]} · ${def.cost} ոսկի`)),
    statLine(def),
    def.abilityHy ? h('p.tip-ability', {}, def.abilityHy) : null);
}
/** Show a tooltip for `el` after a short delay; `info` (optional) opens the full info with the "I" key. */
export function attachHover(el, content, info = null) {
  el.addEventListener('pointerenter', (ev) => {
    hoverInfo = info;
    if (ev.pointerType === 'touch' || !content) return;
    hideTooltip();
    tipTimer = setTimeout(() => {
      if (!el.isConnected) return;
      tipEl = typeof content === 'function' ? content() : content;
      document.body.append(tipEl);
      const r = el.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
      let x = r.left + r.width / 2 - t.width / 2, y = r.top - t.height - 10;
      if (y < 6) y = r.bottom + 10;
      tipEl.style.left = `${Math.max(6, Math.min(window.innerWidth - t.width - 6, x))}px`;
      tipEl.style.top = `${Math.max(6, Math.min(window.innerHeight - t.height - 6, y))}px`;
    }, 500);
  });
  const off = () => { hideTooltip(); if (hoverInfo === info) hoverInfo = null; };
  el.addEventListener('pointerleave', off);
  el.addEventListener('pointerdown', hideTooltip);
}
/** Open the info of whatever the mouse is over ("I" hotkey). Returns true if something was shown. */
export function showHoveredInfo() {
  if (!hoverInfo) return false;
  hideTooltip();
  hoverInfo();
  return true;
}

/**
 * A playing card. opts: { onclick, oninfo, disabled, selected, count, small, hotkey, missing, foe, glow, noTip }
 */
export function cardView(cardId, opts = {}) {
  const def = CARDS[cardId];
  const legendary = def.type === 'hero' || def.type === 'special';
  const cls = `div.card.type-${def.type}${legendary ? '.legendary' : ''}${opts.small ? '.small' : ''}${opts.disabled ? '.disabled' : ''}` +
    `${opts.selected ? '.selected' : ''}${opts.foe || def.enemyOnly ? '.foe' : ''}${opts.glow ? '.glow' : ''}`;
  const info = () => (opts.oninfo || showCardInfo)(cardId);
  const el = h(cls, { onclick: opts.onclick, dataset: { card: cardId } },
    h('div.card-frame'),
    h('div.cost', {}, h('span', {}, def.cost)),
    h('div.card-art', {}, iconEl(cardId, 'card-icon')),
    h('div.card-name', {}, def.nameHy),
    statLine(def) || h('div.stats.spell-label', {}, TYPE_HY[def.type]),
    def.tag ? h(`div.tag.${def.tag === 'ավանդություն' ? 'legend' : 'history'}`, {}, def.tag) : null,
    opts.count ? h('div.count', {}, '×' + opts.count) : null,
    opts.hotkey ? h('div.hotkey', {}, opts.hotkey) : null,
    opts.missing ? h('div.missing', {}, `−${opts.missing}`) : null,
    h('button.info-btn', { title: 'Տեղեկություն', onclick: (e) => { e.stopPropagation(); info(); } }, 'i'),
  );
  if (!opts.noTip) attachHover(el, () => tooltipContent(cardId), info);
  return el;
}
/** Face-down card (the AI's cards before the reveal, locked cards). */
export function cardBack(small = true) {
  return h(`div.card.back${small ? '.small' : ''}`, {}, h('div.card-frame'), h('div.back-emblem', { html: uiSvg('swords') }));
}

let modalEl = null, modalClose = null;
export function closeModal() { if (modalEl) { modalEl.remove(); modalEl = null; modalClose = null; } }
export function isModalOpen() { return !!modalEl; }
/** Close the open modal as the user would (runs its onclose). */
export function dismissModal() { if (modalClose) modalClose(); }
export function modal(content, { onclose, wide } = {}) {
  closeModal();
  hideTooltip();
  const close = () => { closeModal(); if (onclose) onclose(); };
  modalEl = h('div.modal-backdrop', { onclick: (e) => { if (e.target === modalEl) close(); } },
    h(`div.modal${wide ? '.wide' : ''}`, {}, h('button.modal-close', { onclick: close, title: 'Փակել' }, '✕'), content));
  modalClose = close;
  document.body.append(modalEl);
  return close;
}
/** In-app yes/no dialog (replaces window.confirm, which blocks the game loop). */
export function confirmDialog(text, yesLabel, onyes, noLabel = 'Չեղարկել') {
  const close = modal(h('div.confirm', {}, h('p', {}, text),
    h('div.actions.center', {},
      btn('', noLabel, () => close()),
      btn('.primary', yesLabel, () => { close(); onyes(); }))));
}

/** Full card details: stats, ability, tag and history text. `entity` adds the current HP of a unit on the board. */
export function showCardInfo(cardId, entity = null) {
  const def = CARDS[cardId];
  const rows = [];
  rows.push(['Տեսակ', TYPE_HY[def.type] + (def.enemyOnly ? ' (միայն հակառակորդի)' : '')]);
  rows.push(['Գին', `${def.cost} ոսկի`]);
  if (def.type !== 'spell') {
    rows.push(['Կյանք', entity ? `${entity.hp} / ${entity.maxHp}` : def.hp]);
    if (def.atk) rows.push(['Հարված', def.atk]);
    if (def.type !== 'building') rows.push(['Արագություն', def.speed === 0 ? 'անշարժ' : `${def.speed} վանդակ`]);
    if (def.atk) rows.push(['Հեռահարություն', def.range]);
  }
  const head = iconEl(cardId, 'big-icon');
  if (entity && entity.side === 1) head.classList.add('foe');
  modal(h('div.card-info', {},
    h('div.card-info-head', {}, head,
      h('div', {}, h('h2', {}, def.nameHy),
        def.tag ? h(`span.tag.${def.tag === 'ավանդություն' ? 'legend' : 'history'}`, {}, def.tag === 'ավանդություն' ? 'Ըստ ավանդության' : 'Պատմական') : null)),
    h('table.info-table', {}, rows.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v)))),
    def.abilityHy ? h('p.ability', {}, h('b', {}, 'Ունակություն. '), def.abilityHy) : null,
    entity && entity.invuln ? h('p.ability', {}, 'Այս պահին անխոցելի է։') : null,
    entity && entity.shield > 0 ? h('p.ability', {}, `Կանտեսի ևս ${entity.shield} հարված։`) : null,
    h('p.history', {}, def.historyHy),
  ));
}

export function infoForTower(e) {
  const king = e.cardId === 'tower_king';
  const byDist = CONFIG.towers[king ? 'king' : 'small'].atkByDist || [];
  const head = iconEl(e.cardId, 'big-icon');
  if (e.side === 1) head.classList.add('foe');
  modal(h('div.card-info', {},
    h('div.card-info-head', {}, head, h('div', {}, h('h2', {}, king ? 'Արքայի ամրոց' : 'Աշտարակ'))),
    h('table.info-table', {},
      h('tr', {}, h('th', {}, 'Կյանք'), h('td', {}, `${e.hp} / ${e.maxHp}`)),
      h('tr', {}, h('th', {}, 'Հարված'), h('td', {}, byDist.length ? byDist.join(' / ') : e.atk)),
      h('tr', {}, h('th', {}, 'Հեռահարություն'), h('td', {}, e.range))),
    byDist.length ? h('p.ability', {}, `Որքան մոտ է թշնամին, այնքան ուժեղ է կրակը. ${byDist.map((a, i) => `${i + 1} վանդակ՝ ${a}`).join(', ')}։`) : null,
    h('p.history', {}, king
      ? 'Արքայի ամրոցի ավերումը նշանակում է անմիջական պարտություն։ Ամրոցը կրակում է մարտի յուրաքանչյուր պահին՝ իր հեռահարության մեջ գտնվող ամենամոտ թշնամի զորքի վրա։'
      : 'Աշտարակը կրակում է մարտի յուրաքանչյուր պահին՝ իր հեռահարության մեջ գտնվող ամենամոտ թշնամի զորքի վրա։ 20 ռաունդից հետո հաղթում է ավելի շատ աշտարակ ավերած կողմը։')));
}

export function stars(n, max = 3) {
  return h('span.stars', {}, Array.from({ length: max }, (_, i) => h(`span.star${i < n ? '.on' : ''}`, { html: uiSvg('star') })));
}

export function ornament() { return h('div.ornament', { 'aria-hidden': 'true' }); }
