import { h, iconEl, ui, btn, cardView } from '../dom.js';
import { topBar } from './campaign.js';
import { audio } from '../audio.js';

const foe = (id, cls = 'ht-spr') => { const el = iconEl(id, cls); el.classList.add('foe'); return el; };
const arrow = () => h('span.ht-arrow', {}, '→');

/** «Ինչպես խաղալ»: six illustrated slides that reuse the game's own art. */
const SLIDES = [
  { title: 'Նպատակը', art: () => [iconEl('spearman', 'ht-spr'), iconEl('cavalry', 'ht-spr'), arrow(), foe('tower_king', 'ht-spr.xl')],
    text: 'Ավերիր թշնամու Արքայի ամրոցը՝ վերևի կենտրոնում։ Եթե 20 ռաունդում ոչ ոքի դա չի հաջողվում, հաղթում է ավելի շատ աշտարակ ավերած կողմը, հավասարության դեպքում՝ նա, ում աշտարակներն ավելի շատ կյանք են պահպանել։' },
  { title: 'Ռաունդը՝ պլանավորում և մարտ', art: () => [h('span.ht-chip', {}, ui('hourglass'), ' Պլանավորում'), arrow(), h('span.ht-chip.red', {}, ui('swords'), ' Մարտ ×3')],
    text: 'Ամեն ռաունդ դու և AI-ը քարտերը դնում եք միաժամանակ և չեք տեսնում իրար քարտերը։ Հետո սկսվում է մարտը՝ երեք պահ, որոնց ընթացքում երկու կողմի զորքերը միասին քայլում և հարձակվում են, իսկ աշտարակները կրակում են։' },
  { title: 'Քարտեր և ոսկի', art: () => [iconEl('gold', 'ht-spr'), cardView('spearman', { small: true, noTip: true }), cardView('archer', { small: true, noTip: true }), cardView('vahagn', { small: true, noTip: true })],
    text: 'Քարտի անկյունի թիվը նրա գինն է։ Ամեն ռաունդ ստանում ես ոսկի (սկզբում +2, վերջում +5), չծախսածը մնում է։ Մեկ ռաունդում կարելի է դնել մինչև 3 քարտ։ Դրված քարտը հետ չի վերցվում, իսկ նրա տեղը ձեռքում անմիջապես զբաղեցնում է «Հաջորդը» քարտը։' },
  { title: 'Զորքեր և կամուրջներ', art: () => [iconEl('shieldbearer', 'ht-spr'), iconEl('archer', 'ht-spr'), arrow(), foe('giant', 'ht-spr')],
    text: 'Զորքը դրվում է քո գոտում (դաշտի քո կեսը՝ գետից մինչև աշտարակների շարքը) և ինքն է գնում դեպի մոտակա կամուրջը, հետո՝ թշնամու աշտարակները։ Նոր դրված զորքը կարող է հարձակվել անմիջապես, եթե թշնամին արդեն մոտ է։ Աշտարակները կրակում են մինչև 2 վանդակ. որքան մոտ է թշնամին, այնքան ուժեղ է հարվածը (փոքր աշտարակ՝ 2 և 1, ամրոց՝ 3 և 2)։ Հեռահար զորքերը պահիր ամուր զորքերի հետևում։' },
  { title: 'Հմայքներ, կառույցներ, հերոսներ', art: () => [iconEl('vahagn', 'ht-spr'), iconEl('anahit', 'ht-spr'), iconEl('archertower', 'ht-spr'), iconEl('tigran', 'ht-spr')],
    text: 'Հմայքները գործում են անմիջապես. «Վահագնի կրակը» վնասում է 2×2 տարածքը, «Արարատի օրհնությունը» բուժում է զորքերը։ Կառույցները չեն շարժվում, բայց պաշտպանում են գոտիդ։ Հերոսները բացվում են արշավում և ունեն հատուկ ունակություններ։' },
  { title: 'Մտածող հակառակորդ', art: () => [h('span.ht-chip', {}, 'Հեշտ · կանոններ'), h('span.ht-chip', {}, 'Միջին · Minimax'), h('span.ht-chip.red', {}, 'Դժվար · MCTS')],
    text: 'AI-ը խաղում է ճիշտ նույն կանոններով և նույն ոսկով։ Մարտի ընթացքում «AI-ը ինչ է մտածում» վահանակը ցույց է տալիս նրա ալգորիթմը, դիտարկած քայլերը և ընտրության բացատրությունը։ Կառավարում. 1–4՝ քարտ, Space՝ «Պատրաստ է», Esc՝ չեղարկել, M՝ ձայն, I՝ տեղեկություն, F11՝ ամբողջ էկրան։' },
];

export function howtoScreen(app) {
  let i = 0;
  const root = h('div.screen.howto');
  function render() {
    const s = SLIDES[i];
    root.replaceChildren(
      topBar(app, 'Ինչպես խաղալ'),
      h('div.howto-body', {},
        h('div.slide', {},
          h('div.slide-num', {}, `${i + 1} / ${SLIDES.length}`),
          h('div.slide-art', {}, s.art()),
          h('h3', {}, s.title),
          h('p', {}, s.text)),
        h('div.slide-nav', {},
          btn('', '← Նախորդը', () => { i--; render(); }, { disabled: i === 0 }),
          h('div.dots', {}, SLIDES.map((_, k) => h(`button.dot${k === i ? '.on' : ''}`, { onclick: () => { audio.sfx('click'); i = k; render(); }, 'aria-label': `Էջ ${k + 1}` }))),
          i < SLIDES.length - 1 ? btn('.primary', 'Հաջորդը →', () => { i++; render(); })
            : btn('.primary', 'Խաղալ ուսուցողական մարտը', () => app.go('intro', { battleId: '1-1' })))));
  }
  render();
  return root;
}
