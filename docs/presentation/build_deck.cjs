// Արքաների Մարտ — I ատեստավորման պրեզենտացիա (6 սլայդ). Generator of Arqaneri_Mart_I_atestavorum.pptx.
// Needs pptxgenjs (NOT a project dependency — install it outside the project):
//   mkdir <tmp> && cd <tmp> && npm init -y && npm i pptxgenjs@3.12.0
//   NODE_PATH=<tmp>/node_modules node docs/presentation/build_deck.cjs docs/presentation/Arqaneri_Mart_I_atestavorum.pptx
// Theme colors are written by the pptx skill's apply_theme.js (path below, or env APPLY_THEME); without it the
// deck falls back to Office's stock palette, so the script stops instead.
// Check the result in real PowerPoint: cscript //nologo docs/presentation/render_slides.js <pptx> <outdir>deck.png
// Slide images: docs/screenshots (made by `npm run smoke`) and their crops in img/ (powershell -File docs/presentation/crop_shots.ps1).
// Slide 6 chart data: search for "labels: ['v1.0'".
const pptxgen = require('pptxgenjs');
const path = require('path');
const APPLY_THEME = process.env.APPLY_THEME || 'C:/Users/USER/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/local-agent-mode-sessions/skills-plugin/96f5e425-54fa-4e94-b83b-00f921970004/df95c20c-b86e-4380-a480-66f4a0f83cc2/skills/pptx/scripts/apply_theme.js';
const { applyTheme } = require(APPLY_THEME);

const OUT = process.argv[2] || 'deck.pptx';
const SHOTS = path.join(__dirname, '..', 'screenshots') + '/';
const IMG = path.join(__dirname, 'img') + '/'; // crops of the screenshots, made by crop_shots.ps1

// Game palette: pomegranate, ink, apricot, tuff
const HEX = {
  ink: '2A1A17', pom: 'A3242F', pomDark: '6E1620', apricot: 'E08A2E', tuff: 'F3E6DC',
  white: 'FFFFFF', muted: '6B5A55', sage: '3F7A4A', line: 'D9C7BC', soft: 'FBF3EE',
};
const THEME = {
  name: 'Arqaneri Mart',
  headFontFace: 'Segoe UI Semibold',
  bodyFontFace: 'Segoe UI',
  colors: {
    dk1: HEX.ink, lt1: HEX.white, dk2: HEX.pomDark, lt2: HEX.tuff,
    accent1: HEX.pom, accent2: HEX.apricot, accent3: HEX.sage, accent4: HEX.muted, accent5: '2F5D7C', accent6: 'C9971F',
    hlink: HEX.pom, folHlink: HEX.pomDark,
  },
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 × 7.5
pres.title = 'Արքաների Մարտ — I ատեստավորում';
pres.author = '[Ուսանողի անուն]';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const W = 13.333, M = 0.6;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: 'TITLE_DARK',
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 1.2, w: 4.1, h: 0.8, fontSize: 28, bold: true, color: C.background1, valign: 'top', align: 'left', margin: 0 }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'CONTENT',
  background: { color: C.background1 },
  margin: [0.5, 0.6, 0.5, 0.6],
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.35, w: W - 2 * M, h: 0.85, fontSize: 32, bold: true, color: C.text1, valign: 'middle', margin: 0 }, text: '' } },
    { text: { text: 'Արքաների Մարտ · I ատեստավորում', options: { x: M, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: C.accent4, margin: 0 } } },
  ],
  slideNumber: { x: W - M - 0.6, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.accent4, align: 'right' },
});

// ---------- helpers ----------
let objN = 0;
const name = (s) => `${s}-${++objN}`;
function badge(slide, x, y, label, fill = C.accent1, size = 0.5) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: size, h: size, fill: { color: fill }, line: { color: fill }, objectName: name('badge') });
  slide.addText(label, { x, y, w: size, h: size, fontSize: size >= 0.5 ? 16 : 12, bold: true, color: C.background1, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: name('badge-text') });
}
function card(slide, x, y, w, h, fill = C.background2) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill }, objectName: name('card') });
}
const shadow = () => ({ type: 'outer', color: '000000', opacity: 0.18, blur: 8, offset: 3, angle: 90 });

// =====================================================================
// 1. Title
// =====================================================================
pres.addSection({ title: 'Վերնագիր' });
{
  const s = pres.addSlide({ masterName: 'TITLE_DARK', sectionTitle: 'Վերնագիր' });
  s.addText('Արքաների Մարտ', { placeholder: 'title' });
  s.addText('Ինտելեկտուալ հակառակորդով տրամաբանական խաղի ծրագրային ապահովման մշակում և ներդրում', {
    x: M, y: 2.15, w: 3.9, h: 1.6, fontSize: 15, color: C.background2, valign: 'top', margin: 0, isTextBox: true, objectName: 'subtitle' });
  s.addShape(pres.shapes.RECTANGLE, { x: M, y: 4.05, w: 1.2, h: 0.05, fill: { color: C.accent2 }, line: { color: C.accent2 }, objectName: 'title-rule' });
  const rows = [
    ['Համալսարան, ֆակուլտետ', '[               ]'],
    ['Ուսանող', '[                         ]'],
    ['Ղեկավար', '[                         ]'],
  ];
  rows.forEach(([k, v], i) => {
    s.addText([{ text: k + '՝ ', options: { bold: true, color: 'F3C9A0' } }, { text: v, options: { color: C.background1 } }], {
      x: M, y: 4.4 + i * 0.45, w: 4.2, h: 0.4, fontSize: 13, margin: 0, valign: 'middle', isTextBox: true, objectName: name('meta') });
  });
  s.addText('I ատեստավորում · 16–20.11.2026', { x: M, y: 6.35, w: 4.2, h: 0.4, fontSize: 14, bold: true, color: 'F3C9A0', margin: 0, isTextBox: true, objectName: 'date' });
  // the game's own main menu, full height on the right
  s.addImage({ path: IMG + 'menu.png', x: W - 7.5 * 810 / 720, y: 0, w: 7.5 * 810 / 720, h: 7.5, altText: 'Խաղի գլխավոր մենյուն', objectName: 'title-shot' });
  s.addNotes('Բարև Ձեզ։ Իմ ավարտական աշխատանքի թեման է ինտելեկտուալ հակառակորդով տրամաբանական խաղի ծրագրային ապահովման մշակումը։ Որպես խաղ ընտրել եմ «Արքաների Մարտ» քարտային-մարտավարական խաղը՝ հայոց պատմության թեմայով, որտեղ մարդը խաղում է արհեստական բանականության դեմ։ I ատեստավորման համար կներկայացնեմ առաջին երեք փուլերը. խնդրին ծանոթացումը, գրականության ուսումնասիրությունը և խնդիրների ձևակերպումը, իսկ հիմնական ուշադրությունը կդարձնեմ AI-ին։');
}

// =====================================================================
// 2. Ծանոթացում խնդիրներին
// =====================================================================
pres.addSection({ title: 'Խնդիրներ' });
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Խնդիրներ' });
  s.addText('1. Ծանոթացում խնդիրներին', { placeholder: 'title' });
  // left: the real board (crop of a battle screenshot)
  const bh = 5.3, bw2 = bh * 366 / 474;
  s.addImage({ path: IMG + 'board.png', x: M, y: 1.35, w: bw2, h: bh, shadow: shadow(), altText: 'Խաղի դաշտը՝ 7×9, աշտարակներ, գետ և կամուրջներ', objectName: 'board-shot' });
  const IX = M + bw2 + 0.45, IW = 4.25;
  s.addText('Ի՞նչ պետք է ստեղծել', { x: IX, y: 1.35, w: IW, h: 0.4, fontSize: 18, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: 'lead' });
  const items = [
    ['Տրամաբանական խաղ', 'Օրիգինալ քարտային-մարտավարական խաղ 7×9 դաշտում. 2 աշտարակ + Արքայի ամրոց, գետ և կամուրջներ, 20 ռաունդ'],
    ['Ինտելեկտուալ հակառակորդ', 'AI, որը որոշում է կայացնում ինքնուրույն, առանց մարդու հուշման, և կարող է հաղթել'],
    ['Դժվարության 3 մակարդակ', 'Հեշտ, Միջին, Դժվար՝ տարբեր ալգորիթմներով, ոչ թե նույն ալգորիթմի «խաբելով»'],
    ['Թաքնված ինֆորմացիա', 'Երկու կողմերը քարտերը դնում են միաժամանակ. AI-ը չի տեսնում խաղացողի ձեռքը'],
  ];
  items.forEach(([h, d], i) => {
    const y = 1.95 + i * 1.2;
    badge(s, IX, y + 0.03, String(i + 1), C.accent1, 0.42);
    s.addText(h, { x: IX + 0.6, y, w: IW - 0.6, h: 0.38, fontSize: 15, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: name('item-h') });
    s.addText(d, { x: IX + 0.6, y: y + 0.38, w: IW - 0.6, h: 0.78, fontSize: 12, color: C.accent4, margin: 0, valign: 'top', isTextBox: true, objectName: name('item-d') });
  });
  // right: theme column with the campaign map and the player's hand
  const TX = IX + IW + 0.35, TW = W - M - TX;
  card(s, TX, 1.35, TW, 5.3, C.background2);
  s.addText('Թեման՝ հայոց պատմություն', { x: TX + 0.2, y: 1.5, w: TW - 0.4, h: 0.4, fontSize: 15, bold: true, color: C.text2, margin: 0, isTextBox: true, objectName: 'theme-h' });
  const mw = TW - 0.4, mh = mw * 366 / 642;
  s.addImage({ path: IMG + 'map.png', x: TX + 0.2, y: 2.12, w: mw, h: mh, altText: 'Արշավի քարտեզը՝ 7 գլուխ', objectName: 'map-shot' });
  s.addText('Արշավ՝ 7 գլուխ, 21 մարտ. Հայկից մինչև Սարդարապատ', { x: TX + 0.2, y: 2.2 + mh, w: mw, h: 0.5, fontSize: 11, color: C.text1, margin: 0, valign: 'top', isTextBox: true, objectName: 'map-caption' });
  const hh = mw * 167 / 562, hy = 2.95 + mh;
  s.addImage({ path: IMG + 'hand.png', x: TX + 0.2, y: hy, w: mw, h: hh, altText: 'Խաղացողի ձեռքը՝ 4 քարտ', objectName: 'hand-shot' });
  s.addText('32 քարտ՝ զորքեր, հերոսներ, հմայքներ, կառույցներ. կապուկում՝ 8 տարբեր քարտ', { x: TX + 0.2, y: hy + hh + 0.05, w: mw, h: 0.7, fontSize: 11, color: C.text1, margin: 0, valign: 'top', isTextBox: true, objectName: 'hand-caption' });
  s.addNotes('Առաջին փուլում ծանոթացա խնդրին. պետք է ստեղծել տրամաբանական խաղ և ինտելեկտուալ հակառակորդ։ Խաղը օրիգինալ է. դաշտում կան աշտարակներ, գետ ու կամուրջներ, և հաղթում է նա, ով ավերում է հակառակորդի Արքայի ամրոցը։ Կարևոր պահանջներից մեկն այն է, որ AI-ը լինի արդար. քանի որ քարտերը դրվում են միաժամանակ, AI-ը չգիտի խաղացողի ձեռքը, և սա թաքնված ինֆորմացիայով խաղ է, ինչն ավելի բարդ է, քան շախմատը։');
}

// =====================================================================
// 3. Գրականություն
// =====================================================================
pres.addSection({ title: 'Գրականություն' });
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Գրականություն' });
  s.addText('2. Գրականության ուսումնասիրում', { placeholder: 'title' });
  const refs = [
    ['Russell, Norvig', 'Artificial Intelligence: A Modern Approach', 'Մրցակցային որոնում, Minimax, գնահատման ֆունկցիա'],
    ['Knuth, Moore (1975)', 'An Analysis of Alpha-Beta Pruning', 'Alpha-Beta հատում և քայլերի դասավորության դերը'],
    ['Kocsis, Szepesvári (2006)', 'Bandit Based Monte-Carlo Planning', 'UCT. UCB1 բանաձևը ծառում (exploration / exploitation)'],
    ['Browne et al. (2012)', 'A Survey of Monte Carlo Tree Search Methods', 'MCTS-ի 4 փուլերը, progressive widening'],
    ['Cowling, Powley, Whitehouse (2012)', 'Information Set Monte Carlo Tree Search', 'Թաքնված ինֆորմացիա. դետերմինիզացիա'],
    ['Yannakakis, Togelius (2018)', 'Artificial Intelligence and Games', 'AI-ը խաղերում. հակառակորդ, դժվարություն, ինքնախաղ'],
  ];
  const cw = 3.75, ch = 1.62, gx = 0.25, gy = 0.16, x0 = M, y0 = 1.4;
  refs.forEach(([au, ti, use], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = x0 + col * (cw + gx), y = y0 + row * (ch + gy);
    card(s, x, y, cw, ch, C.background2);
    badge(s, x + 0.2, y + 0.18, String(i + 1), i < 2 ? C.accent2 : C.accent1, 0.4);
    s.addText(au, { x: x + 0.72, y: y + 0.15, w: cw - 0.9, h: 0.46, fontSize: 12, bold: true, color: C.text2, margin: 0, valign: 'middle', isTextBox: true, objectName: name('ref-author') });
    s.addText(ti, { x: x + 0.2, y: y + 0.66, w: cw - 0.4, h: 0.46, fontSize: 12, italic: true, color: C.text1, margin: 0, valign: 'top', isTextBox: true, objectName: name('ref-title') });
    s.addText(use, { x: x + 0.2, y: y + 1.13, w: cw - 0.4, h: 0.44, fontSize: 11, color: C.accent4, margin: 0, valign: 'top', isTextBox: true, objectName: name('ref-use') });
  });
  // right: the same ideas inside the game (its own "How the AI thinks" window)
  const ex = M + 2 * cw + gx + 0.4, ew = W - M - ex, eh = ew * 633 / 684;
  s.addImage({ path: IMG + 'explainer.png', x: ex, y: 1.4, w: ew, h: eh, shadow: shadow(), altText: 'Խաղի «Ինչպե՞ս է մտածում AI-ը» պատուհանը՝ Minimax-ի ծառով', objectName: 'explainer-shot' });
  s.addText('Գրականության գաղափարները խաղի մեջ. «Ինչպե՞ս է մտածում AI-ը» պատուհանը բացատրում է Minimax-ը, Alpha-Beta հատումը և MCTS-ը', {
    x: ex, y: 1.5 + eh, w: ew, h: 0.8, fontSize: 11, italic: true, color: C.accent4, margin: 0, valign: 'top', isTextBox: true, objectName: 'explainer-caption' });
  s.addText([
    { text: 'Ծիրանագույն՝ ', options: { bold: true, color: C.accent2 } }, { text: 'դասական որոնում («Միջին» մակարդակ)    ', options: { color: C.accent4 } },
    { text: 'Նռնագույն՝ ', options: { bold: true, color: C.accent1 } }, { text: 'Monte Carlo մեթոդներ («Դժվար» մակարդակ)', options: { color: C.accent4 } },
  ], { x: M, y: 6.72, w: 2 * cw + gx, h: 0.25, fontSize: 10, margin: 0, isTextBox: true, objectName: 'legend' });
  s.addNotes('Երկրորդ փուլում ուսումնասիրեցի խաղային AI-ի հիմնական գրականությունը։ Russell-ի և Norvig-ի դասագրքից և Knuth-ի ու Moore-ի աշխատանքից վերցրել եմ Minimax-ը և Alpha-Beta հատումը, որոնց վրա հիմնված է «Միջին» մակարդակը։ Kocsis-ի և Szepesvári-ի UCT ալգորիթմը և Browne-ի ակնարկը MCTS-ի հիմքն են, որն օգտագործում է «Դժվար» մակարդակը։ Քանի որ մեր խաղում ձեռքը թաքնված է, Cowling-ի աշխատանքից վերցրել եմ դետերմինիզացիայի գաղափարը. AI-ը փորձում է խաղացողի հնարավոր ձեռքերը և միջինացնում արդյունքը։');
}

// =====================================================================
// 4. Խնդիրների ձևակերպում
// =====================================================================
pres.addSection({ title: 'Ձևակերպում' });
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Ձևակերպում' });
  s.addText('3. Խնդիրների ձևակերպում', { placeholder: 'title' });
  const steps = [
    ['Խաղի շարժիչ', 'Կանոնները առանձին մոդուլ են՝ առանց ինտերֆեյսի. AI-ը կարող է արագ խաղալ հազարավոր խաղեր'],
    ['3 մակարդակի AI', 'Հեշտ՝ կանոններ, Միջին՝ Minimax + Alpha-Beta, Դժվար՝ MCTS (UCB1)'],
    ['Արդարություն', 'AI-ը տեսնում է միայն բաց ինֆորմացիան. դաշտը, խաղացողի կապուկի կազմը և խաղացած քարտերը'],
    ['Բացատրելիություն', '«AI-ն ինչ է մտածում» վահանակ. թեկնածու քայլեր, հաղթելու հավանականություն, պատճառ'],
  ];
  const bw = 2.85, gap = 0.28;
  const sw = 3.2, sh = 1.6, sg = 0.2;
  steps.forEach(([h, d], i) => {
    const x = M + (i % 2) * (sw + sg), y = 1.4 + Math.floor(i / 2) * (sh + sg);
    card(s, x, y, sw, sh, i === 1 ? C.text2 : C.background2);
    badge(s, x + 0.2, y + 0.18, String(i + 1), i === 1 ? C.accent2 : C.accent1, 0.4);
    s.addText(h, { x: x + 0.72, y: y + 0.18, w: sw - 0.9, h: 0.4, fontSize: 14, bold: true, color: i === 1 ? C.background1 : C.text1, margin: 0, valign: 'middle', isTextBox: true, objectName: name('step-h') });
    s.addText(d, { x: x + 0.2, y: y + 0.7, w: sw - 0.4, h: 0.85, fontSize: 11, color: i === 1 ? C.background2 : C.accent4, margin: 0, valign: 'top', isTextBox: true, objectName: name('step-d') });
  });
  // right: a real battle against the Hard AI — all four requirements on one screen
  const fx = M + 2 * sw + sg + 0.35, fw = W - M - fx, fh = fw * 720 / 1360;
  s.addImage({ path: SHOTS + '09_battle_hard.png', x: fx, y: 1.4, w: fw, h: fh, shadow: shadow(), altText: 'Մարտ «Դժվար» AI-ի դեմ. դաշտ, ձեռք և AI-ի վահանակ', objectName: 'battle-shot' });
  s.addText('Պատրաստի խաղը. մարտ «Դժվար» (MCTS) AI-ի դեմ, աջում՝ «AI-ն ինչ է մտածում» վահանակը', {
    x: fx, y: 1.5 + fh, w: fw, h: 0.5, fontSize: 11, italic: true, color: C.accent4, margin: 0, valign: 'top', isTextBox: true, objectName: 'battle-caption' });
  s.addText('Չափելի նպատակներ (ստուգվում են ինքնախաղով)', { x: M, y: 4.95, w: 8, h: 0.4, fontSize: 16, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: 'goals-h' });
  const goals = [['≥ 85%', 'Միջինը հաղթում է Հեշտին'], ['≥ 70%', 'Դժվարը հաղթում է Միջինին'], ['< 10%', 'ոչ-ոքի հավասար ուժերի դեպքում'], ['≤ 8 վրկ', 'AI-ի մտածելու ժամանակը ռաունդում']];
  goals.forEach(([v, l], i) => {
    const x = M + i * (bw + gap);
    s.addText(v, { x, y: 5.4, w: bw, h: 0.65, fontSize: 32, bold: true, color: C.text2, margin: 0, isTextBox: true, objectName: name('goal-v') });
    s.addText(l, { x, y: 6.08, w: bw, h: 0.6, fontSize: 12, color: C.accent4, margin: 0, valign: 'top', isTextBox: true, objectName: name('goal-l') });
  });
  s.addNotes('Երրորդ փուլում խնդիրը ձևակերպեցի կոնկրետ պահանջներով։ Խաղի կանոնները առանձնացված են ինտերֆեյսից, որպեսզի AI-ը կարողանա խաղալ ինքն իր դեմ և մենք կարողանանք չափել նրա ուժը։ AI-ը ունի երեք մակարդակ՝ տարբեր ալգորիթմներով։ Այն արդար է. չի տեսնում խաղացողի քարտերը։ Եվ բացատրելի է. խաղի ընթացքում երևում է, թե ինչ տարբերակներ է դիտարկել և ինչու է ընտրել տվյալ քայլը։ Ներքևում չափելի նպատակներն են, որոնք ստուգում ենք AI-ն AI-ի դեմ խաղացնելով։');
}

// =====================================================================
// 5. Ինչպես է աշխատում AI-ը
// =====================================================================
pres.addSection({ title: 'AI' });
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'AI' });
  s.addText('Ինչպես է աշխատում AI-ը', { placeholder: 'title' });
  const levels = [
    ['Հեշտ', 'Կանոններ', 'Առանց առաջ նայելու. «պաշտպանիր աշտարակը», «դիր կամրջի դիմաց», 30% պատահական քայլ', C.accent3],
    ['Միջին', 'Minimax + Alpha-Beta', 'Ծառը մինչև 3 քայլ խորությամբ, իտերատիվ խորացում, հոռետեսական ենթադրություն թաքնված ձեռքի մասին', C.accent2],
    ['Դժվար', 'MCTS (UCB1)', 'Հազարավոր կարճ սիմուլյացիաներ ամեն քայլում, դետերմինիզացիա, progressive widening, Minimax-ի նախնական գնահատական', C.accent1],
  ];
  levels.forEach(([lv, alg, d, col], i) => {
    const y = 1.4 + i * 1.45;
    card(s, M, y, 6.3, 1.25, C.background2);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 0.2, y: y + 0.2, w: 1.35, h: 0.85, rectRadius: 0.1, fill: { color: col }, line: { color: col }, objectName: name('lv-pill') });
    s.addText(lv, { x: M + 0.2, y: y + 0.2, w: 1.35, h: 0.85, fontSize: 16, bold: true, color: C.background1, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: name('lv') });
    s.addText(alg, { x: M + 1.8, y: y + 0.12, w: 4.3, h: 0.38, fontSize: 15, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: name('lv-alg') });
    s.addText(d, { x: M + 1.8, y: y + 0.5, w: 4.3, h: 0.7, fontSize: 12, color: C.accent4, margin: 0, valign: 'top', isTextBox: true, objectName: name('lv-d') });
  });
  // evaluation function
  card(s, M, 5.85, 6.3, 1.0, C.text2);
  s.addText([
    { text: 'Գնահատման ֆունկցիա՝ ', options: { bold: true, color: 'F3C9A0' } },
    { text: '5·ամրոց + 3·աշտարակներ + 2·զորքի արժեք + 1.5·գետն անցածներ + 0.5·ոսկի − 2·սպառնալիք', options: { color: C.background1 } },
  ], { x: M + 0.25, y: 5.92, w: 5.8, h: 0.86, fontSize: 13, margin: 0, valign: 'middle', isTextBox: true, objectName: 'eval' });
  // AI panel crop
  const ph = 5.1, pw = ph * 338 / 492, px = 7.3;
  s.addImage({ path: IMG + 'ai_panel.png', x: px, y: 1.4, w: pw, h: ph, shadow: shadow(), altText: 'AI-ի վահանակ «Դժվար» մակարդակում', objectName: 'ai-panel' });
  // callouts: [fraction of the panel height, label]
  [[0.29, 'MCTS-ի իտերացիաներ և ծառի չափը'], [0.6, 'Լավագույն 3 քայլը՝ հաղթելու %-ով'], [0.86, 'Բացատրություն բառերով']].forEach(([f, t]) => {
    const cy = 1.4 + ph * f;
    s.addShape(pres.shapes.LINE, { x: px + pw + 0.05, y: cy, w: 0.3, h: 0, line: { color: C.accent2, width: 2 }, objectName: name('callout-line') });
    s.addText(t, { x: px + pw + 0.42, y: cy - 0.4, w: W - M - (px + pw + 0.42), h: 0.8, fontSize: 10.5, bold: true, color: C.text2, margin: 0, valign: 'middle', isTextBox: true, objectName: name('callout') });
  });
  s.addNotes('AI-ի երեք մակարդակները տարբեր ալգորիթմներ են։ «Հեշտ»-ը առաջ չի նայում, գործում է կանոններով։ «Միջին»-ը Minimax է Alpha-Beta հատումով. նա սիմուլացնում է իր քայլը, խաղացողի լավագույն պատասխանը և գնահատում արդյունքը։ «Դժվար»-ը Monte Carlo Tree Search է. ամեն քայլում խաղում է հազարավոր կարճ սիմուլյացիաներ, UCB1 բանաձևով հավասարակշռում է լավ քայլերի օգտագործումը և նորերի փորձարկումը։ Քանի որ խաղացողի ձեռքը թաքնված է, ամեն սիմուլյացիայում պատահականորեն ընտրում է հնարավոր ձեռք։ Բոլոր մակարդակները դիրքը գնահատում են նույն ֆունկցիայով։ Աջում իրական վահանակն է. երևում են իտերացիաների քանակը, լավագույն երեք քայլերը և բացատրությունը։');
}

// =====================================================================
// 6. Ինքնախաղի փորձեր և բարելավումներ
// =====================================================================
pres.addSection({ title: 'Փորձեր' });
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Փորձեր' });
  s.addText('Ինքնախաղի փորձեր և բարելավումներ', { placeholder: 'title' });
  s.addText('AI-ը չի «սովորում» նեյրոնային ցանցով. նրա ուժը չափվում և բարելավվում է AI-ն AI-ի դեմ հազարավոր խաղերով (self-play)', {
    x: M, y: 1.3, w: W - 2 * M, h: 0.45, fontSize: 14, italic: true, color: C.accent4, margin: 0, isTextBox: true, objectName: 'lead6' });
  s.addChart(pres.charts.BAR, [
    { name: 'Ոչ-ոքի (Միջին—Միջին), %', labels: ['v1.0', 'v1.1', 'v1.2', 'v1.3', 'v1.4'], values: [77.5, 0, 1, 0, 10] },
    { name: 'Դժվարի հաղթանակ Միջինի դեմ, %', labels: ['v1.0', 'v1.1', 'v1.2', 'v1.3', 'v1.4'], values: [60, 80, 81, 75, 90] },
  ], {
    x: M, y: 1.85, w: 6.6, h: 4.6, barDir: 'col', barGapWidthPct: 60,
    chartColors: [HEX.muted, HEX.pom], showLegend: true, legendPos: 'b', legendFontSize: 12, legendFontFace: '+mn-lt', legendColor: HEX.ink,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 11, dataLabelFontFace: '+mn-lt', dataLabelColor: HEX.ink, dataLabelFormatCode: 'General',
    catAxisLabelColor: HEX.ink, catAxisLabelFontSize: 12, catAxisLabelFontFace: '+mn-lt',
    valAxisLabelColor: HEX.muted, valAxisLabelFontSize: 10, valAxisLabelFontFace: '+mn-lt', valAxisMaxVal: 100, valAxisMinVal: 0,
    valGridLine: { color: HEX.line, size: 0.5 }, catGridLine: { style: 'none' },
    showTitle: false, objectName: 'results-chart',
  });
  const facts = [
    ['77.5% → 0%', 'ոչ-ոքի. հերթափոխային քայլերը փոխարինվեցին միաժամանակյա ռաունդներով'],
    ['26–4 vs 17–10', 'MCTS-ի rollout-ը 6 ռաունդից դարձավ 3. կարճ սիմուլյացիան ավելի ուժեղ է'],
    ['100% → 0–10%', 'ոչ-ոքի մեծ դաշտում. գտնվեց և ուղղվեց ճանապարհների քեշի սխալ (Zobrist hash)'],
    ['4 կշռի հավաքածու', 'գնահատման ֆունկցիայի 4 տարբերակ մրցեցին իրար դեմ. 7×9-ում լավագույնը «Նյութական»-ն է (67%)'],
  ];
  facts.forEach(([v, d], i) => {
    const y = 1.9 + i * 1.15;
    s.addText(v, { x: 7.65, y, w: 5.1, h: 0.45, fontSize: 20, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: name('fact-v') });
    s.addText(d, { x: 7.65, y: y + 0.45, w: 5.1, h: 0.6, fontSize: 12, color: C.text1, margin: 0, valign: 'top', isTextBox: true, objectName: name('fact-d') });
  });
  s.addText('Աղբյուր՝ docs/experiments, docs/DECISIONS.md (12–100 խաղ ամեն չափման համար)', { x: M, y: 6.5, w: 7, h: 0.3, fontSize: 10, color: C.accent4, margin: 0, isTextBox: true, objectName: 'source' });
  s.addNotes('Կարևոր է ճիշտ ասել. մեր AI-ը նեյրոնային ցանց չէ և «train» չի արվում։ Նրա ուժը մենք չափում և բարելավում ենք ինքնախաղով. AI-ը հազարավոր խաղեր է խաղում AI-ի դեմ, և մենք համեմատում ենք թվերը։ Առաջին տարբերակում հավասար AI-ների խաղերի 77.5%-ը ոչ-ոքի էր. միաժամանակյա ռաունդներից հետո՝ 0%։ MCTS-ի սիմուլյացիաները կարճացնելով, «Դժվար»-ը սկսեց հաղթել «Միջին»-ին 26 անգամ 4 պարտության դիմաց։ Մեծ դաշտ փորձելիս բոլոր խաղերը ոչ-ոքի էին. վերլուծությամբ գտանք ծրագրային սխալ ճանապարհների քեշում և ուղղեցինք։ Արդյունքում «Դժվար»-ը հաղթում է «Միջին»-ին մոտ 75–90%, իսկ «Միջին»-ը «Հեշտ»-ին՝ 100%, ինչը համապատասխանում է մեր նպատակներին։ Հաջորդ փուլում կշարունակենք իրական խաղացողների հետ փորձարկումը։ Շնորհակալություն։');
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
})();
