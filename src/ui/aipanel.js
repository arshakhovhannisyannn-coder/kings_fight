// "What is the AI thinking" panel: statistics, top candidates, explanation, feature deltas,
// win-probability chart and the "how does it work" explainer with SVG diagrams.
import { h, ui, modal, btn } from './dom.js';

const fmtScore = (x) => (Number.isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(1) : x > 0 ? '+∞ (հաղթանակ)' : '−∞ (պարտություն)');

/** Line chart of the AI's own win-probability estimate per round. history: [{ round, p }] */
export function winChart(history, rounds) {
  const W = 300, H = 110, L = 30, R = 8, T = 8, B = 20;
  const x = (r) => L + (W - L - R) * (r - 1) / Math.max(1, rounds - 1);
  const y = (p) => T + (H - T - B) * (1 - p);
  const pts = history.map(d => `${x(d.round).toFixed(1)},${y(d.p).toFixed(1)}`);
  const last = history[history.length - 1];
  const grid = [0, 0.5, 1].map(p => `<line x1="${L}" x2="${W - R}" y1="${y(p)}" y2="${y(p)}" stroke="#d6bfb0" stroke-width="1" ${p === 0.5 ? 'stroke-dasharray="4 4"' : ''}/>` +
    `<text x="${L - 5}" y="${y(p) + 3.5}" text-anchor="end" font-size="9" fill="#6b4f47">${p * 100}%</text>`).join('');
  const ticks = [1, 5, 10, 15, 20].filter(r => r <= rounds).map(r => `<text x="${x(r)}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#6b4f47">${r}</text>`).join('');
  const area = pts.length > 1 ? `<path d="M${x(history[0].round)},${y(0)} L${pts.join(' L')} L${x(last.round)},${y(0)}z" fill="#a3242f" opacity=".12"/>` : '';
  const line = pts.length > 1 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="#a3242f" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>` : '';
  const dot = last ? `<circle cx="${x(last.round)}" cy="${y(last.p)}" r="4" fill="#a3242f" stroke="#fff" stroke-width="1.5"/>` : '';
  return h('div.win-chart', { html: `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AI-ի գնահատած հաղթելու հավանականությունը">${grid}${ticks}${area}${line}${dot}</svg>` });
}

/**
 * Fill the panel body with the result of chooseMove().
 * @param body     container element
 * @param r        { stats, top, explanation, deltas }
 * @param history  [{ round, p }] win-probability estimates so far
 */
export function renderAiPanel(body, r, history, rounds) {
  const s = r.stats;
  const rows = [['Մակարդակ', s.levelHy], ['Ալգորիթմ', s.algorithmHy]];
  if (s.level === 'hard') rows.push(['Իտերացիաներ (սիմուլյացիաներ)', s.iterations], ['Ծառի հանգույցներ', s.nodes], ['Ծառի առավելագույն խորություն', `${s.depth} քայլ`]);
  else if (s.level === 'medium') rows.push(['Գնահատված վիճակներ', s.nodes], ['Որոնման խորություն', `${s.depth} կիսաքայլ${s.partial ? ' (մասնակի)' : ''}`], ['Alpha-Beta հատումներ', s.cutoffs]);
  else rows.push(['Դիտարկված քայլեր', s.nodes], ['Որոնման խորություն', '0 (առանց առաջ նայելու)']);
  rows.push(['Ծախսված ժամանակ', `${Math.round(s.timeMs)} մվ`]);
  const maxDelta = Math.max(1, ...r.deltas.map(d => (Number.isFinite(d.delta) ? Math.abs(d.delta) : 0)));
  const chartTitle = s.level === 'hard' ? 'AI-ի գնահատած հաղթելու հավանականությունը (MCTS արմատ)'
    : s.level === 'medium' ? 'AI-ի գնահատած հաղթելու հավանականությունը (σ(գնահատական))' : 'Դիրքի գնահատականը AI-ի տեսանկյունից (σ)';
  body.replaceChildren(...[
    h('table.ai-stats', {}, rows.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v)))),
    h('h4', {}, 'Լավագույն թեկնածու քայլերը'),
    h('ol.ai-top', {}, r.top.map((t, i) => h(`li${t.chosen ? '.chosen' : ''}`, {},
      h('span.num', {}, i + 1),
      h('span.mv', {}, t.text),
      t.winRate !== undefined ? h('span.val', {}, `${(100 * t.winRate).toFixed(1)}% հաղթանակ · ${t.visits} այց`)
        : t.score !== undefined ? h('span.val', {}, `${t.bound ? '≤ ' : ''}գնահատական ${fmtScore(t.score)}`) : null,
      t.chosen ? h('span.badge', {}, 'ընտրված') : null))),
    s.rules && s.rules.length ? h('div.ai-rules', {}, h('h4', {}, 'Գործած կանոնը'), s.rules.map(t => h('p.ai-rule', {}, t))) : null,
    h('h4', {}, 'Բացատրություն'),
    h('p.ai-explain', {}, r.explanation),
    history.length ? h('div', {}, h('h4', {}, chartTitle), winChart(history, rounds)) : null,
    r.deltas.length ? h('div.ai-deltas', {}, h('h4', {}, 'Քայլի ազդեցությունը գնահատման ֆունկցիայի վրա'),
      r.deltas.map(d => h('div.delta-row', {},
        h('span.d-label', {}, d.labelHy),
        h('span.d-bar', {}, h(`span.d-fill.${d.delta >= 0 ? 'pos' : 'neg'}`, { style: { width: `${Math.min(100, 100 * Math.abs(Number.isFinite(d.delta) ? d.delta : maxDelta) / maxDelta)}%` } })),
        h('span.d-val', {}, fmtScore(d.delta))))) : null].filter(Boolean));
}

// ---------- explainer ----------
const box = (x, y, w, hgt, text, fill = '#fbf4ee', sub = '') => `<rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="8" fill="${fill}" stroke="#2a1a17" stroke-width="2"/>` +
  `<text x="${x + w / 2}" y="${y + hgt / 2 + (sub ? -2 : 4)}" text-anchor="middle" font-size="12" font-weight="700" fill="#2a1a17">${text}</text>` +
  (sub ? `<text x="${x + w / 2}" y="${y + hgt / 2 + 13}" text-anchor="middle" font-size="9.5" fill="#6b4f47">${sub}</text>` : '');
const arrow = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2a1a17" stroke-width="2" marker-end="url(#ah)"/>`;
const defs = '<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#2a1a17"/></marker></defs>';
const node = (x, y, label, fill = '#fbf4ee', r = 15) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#2a1a17" stroke-width="2"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#2a1a17">${label}</text>`;
const edge = (x1, y1, x2, y2, cut = false) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${cut ? '#a3242f' : '#2a1a17'}" stroke-width="2" ${cut ? 'stroke-dasharray="4 4"' : ''}/>`;

const ROUND_SVG = `<svg viewBox="0 0 560 96" xmlns="http://www.w3.org/2000/svg">${defs}
  ${box(4, 20, 118, 52, 'Ռաունդի սկիզբ', '#f3e6dc', 'եկամուտ, նույն դիրքը')}
  ${arrow(122, 46, 146, 46)}${box(148, 20, 118, 52, 'AI-ի պլան', '#f8dfe0', 'առանց քո քարտերը տեսնելու')}
  ${arrow(266, 46, 290, 46)}${box(292, 20, 118, 52, 'Հակառակորդի պատասխան', '#fff1dc', 'ամենավատ դեպքը AI-ի համար')}
  ${arrow(410, 46, 434, 46)}${box(436, 20, 120, 52, 'Մարտ → գնահատում', '#dfeadb', '3 պահ, հետո f(դիրք)')}
</svg>`;
const MINIMAX_SVG = `<svg viewBox="0 0 560 190" xmlns="http://www.w3.org/2000/svg">
  ${edge(280, 30, 130, 90)}${edge(280, 30, 280, 90)}${edge(280, 30, 430, 90)}
  ${edge(130, 90, 80, 150)}${edge(130, 90, 180, 150)}${edge(280, 90, 240, 150)}${edge(280, 90, 320, 150, true)}${edge(430, 90, 390, 150)}${edge(430, 90, 470, 150, true)}
  ${node(280, 30, '+3', '#f8dfe0', 17)}${node(130, 90, '+3', '#fff1dc')}${node(280, 90, '≤1', '#fff1dc')}${node(430, 90, '≤0', '#fff1dc')}
  ${node(80, 150, '+3', '#dfeadb')}${node(180, 150, '+5', '#dfeadb')}${node(240, 150, '+1', '#dfeadb')}${node(320, 150, '?', '#eee')}${node(390, 150, '0', '#dfeadb')}${node(470, 150, '?', '#eee')}
  <text x="310" y="26" font-size="11" fill="#6b4f47">MAX — AI-ն ընտրում է առավելագույնը</text>
  <text x="462" y="94" font-size="11" fill="#6b4f47">MIN — հակառակորդը</text>
  <text x="300" y="184" font-size="11" fill="#a3242f">կտրված ճյուղեր (Alpha-Beta). արդեն պարզ է, որ ավելի լավը չեն</text>
</svg>`;
const MCTS_SVG = `<svg viewBox="0 0 560 150" xmlns="http://www.w3.org/2000/svg">${defs}
  ${[['1. Ընտրություն', 'UCB1-ով իջնում ենք ծառով', '#f8dfe0'], ['2. Ընդլայնում', 'ավելացնում ենք նոր հանգույց', '#fff1dc'], ['3. Սիմուլյացիա', 'խաղում ենք 3 ռաունդ առաջ', '#dfeadb'], ['4. Հետտարածում', 'արդյունքը գրում ենք վերև', '#e9dcf2']]
    .map(([t, s, f], i) => `${box(6 + i * 139, 14, 128, 56, t, f, s)}${i < 3 ? arrow(134 + i * 139, 42, 144 + i * 139, 42) : ''}`).join('')}
  ${[0, 1, 2, 3].map(i => { const x = 70 + i * 139; return edge(x, 92, x - 22, 122) + edge(x, 92, x + 22, 122) + node(x, 92, '', '#fbf4ee', 9) + node(x - 22, 122, '', i === 0 ? '#a3242f' : '#fbf4ee', 8) + node(x + 22, 122, '', i >= 1 ? (i === 1 ? '#e08a2e' : i === 2 ? '#3f7a4a' : '#7b4a9e') : '#fbf4ee', 8); }).join('')}
  <text x="280" y="146" text-anchor="middle" font-size="11" fill="#6b4f47">Կրկնվում է հազարավոր անգամ. ամենաշատ այցելված քայլն ընտրվում է</text>
</svg>`;

export function showExplainer() {
  modal(h('div.explainer', {},
    h('h2', {}, 'Ինչպե՞ս է մտածում AI-ը'),
    h('h3', {}, 'Ռաունդի մոդելը'),
    h('div.diagram', { html: ROUND_SVG }),
    h('p', {}, 'Դու և AI-ը քարտերը դնում եք միաժամանակ, ուստի AI-ը չի տեսնում քո այս ռաունդի քարտերը։ Նա որոշում է ռաունդի սկզբի դիրքից և ենթադրում, որ դու կպատասխանես լավագույն ձևով. սա զգույշ (պեսիմիստական) ենթադրություն է։ Քո ձեռքի քարտերը AI-ը չգիտի. նա գիտի միայն կապուկիդ կազմը և վերջին խաղացած քարտերը։'),
    h('h3', {}, 'Հեշտ — կանոններ'),
    h('p', {}, 'Առանց առաջ նայելու. պաշտպանվել, եթե թշնամին մոտ է աշտարակին, հակառակ դեպքում՝ զորք դնել կամրջի դիմաց։ Երբեմն կատարում է պատահական քայլ։'),
    h('h3', {}, 'Միջին — Minimax + Alpha-Beta'),
    h('div.diagram', { html: MINIMAX_SVG }),
    h('p', {}, 'AI-ը կառուցում է քայլերի ծառ. իր քայլերում ընտրում է առավելագույն գնահատականը, հակառակորդի քայլերում՝ նվազագույնը։ Alpha-Beta հատումը բաց է թողնում այն ճյուղերը, որոնք արդյունքը չեն կարող փոխել։ Տերևները գնահատվում են ֆունկցիայով՝ ամրոցի և աշտարակների կյանք, զորքի արժեք, գետն անցած զորքեր, ոսկի, սպառնալիք։'),
    h('h3', {}, 'Դժվար — Monte Carlo Tree Search'),
    h('div.diagram', { html: MCTS_SVG }),
    h('p', {}, 'MCTS-ը չորս քայլ է կրկնում, քանի դեռ ժամանակ կա. խոստումնալից ճյուղի ընտրություն (UCB1), նոր հանգույցի ավելացում, արագ սիմուլյացիա և արդյունքի հետտարածում։ Քո անհայտ ձեռքը ամեն սիմուլյացիայում պատահականորեն «բաժանվում» է (դետերմինիզացիա)։ Վահանակի տոկոսները հենց այդ սիմուլյացիաների հաղթանակների մասն են։'),
    h('div.actions.center', {}, btn('.primary', 'Հասկացա', () => document.querySelector('.modal-close')?.click()))), { wide: true });
}

export function aiPanelHeader() { return [ui('brain'), ' AI-ը ինչ է մտածում']; }
