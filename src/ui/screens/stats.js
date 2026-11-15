import { h, cardView, ui } from '../dom.js';
import { topBar } from './campaign.js';
import { totalStars, favouriteCard } from '../store.js';
import { BATTLES } from '../../data/campaign.js';
import { PLAYER_CARD_IDS, CARDS } from '../../data/cards.js';
import { LEVEL_HY, ALGO_HY } from '../../ai/index.js';

function fmtTime(ms) {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} րոպե` : `${Math.floor(m / 60)} ժ ${m % 60} ր`;
}

/** Statistics: wins / losses per AI level, stars, play time, favourite card. */
export function statsScreen(app) {
  const p = app.profile, s = p.stats;
  const fav = favouriteCard(p);
  const threeStar = Object.values(p.stars).filter(x => x === 3).length;
  const tile = (value, label) => h('div.stat-tile', {}, h('b', {}, value), h('span', {}, label));
  return h('div.screen.stats', {},
    topBar(app, 'Վիճակագրություն'),
    h('div.stats-body', {},
      h('div.stat-tiles', {},
        tile(s.battles, 'մարտ'),
        tile(`${totalStars(p)} / ${BATTLES.length * 3}`, 'աստղ արշավում'),
        tile(threeStar, 'մարտ 3 աստղով'),
        tile(s.castles, 'ավերած ամրոց'),
        tile(fmtTime(s.playMs), 'խաղաժամանակ'),
        tile(`${p.unlocked.length} / ${PLAYER_CARD_IDS.length}`, 'բացված քարտ')),
      h('section.panel', {},
        h('h3', {}, 'Արդյունքներն ըստ AI-ի մակարդակի'),
        h('table.stats-table', {},
          h('tr', {}, h('th', {}, 'Մակարդակ'), h('th', {}, 'Ալգորիթմ'), h('th', {}, 'Հաղթանակ'), h('th', {}, 'Պարտություն'), h('th', {}, 'Ոչ-ոքի'), h('th', {}, 'Հաղթելու %')),
          ['easy', 'medium', 'hard'].map(lv => {
            const r = s.byLevel[lv], n = r.wins + r.losses + r.draws;
            return h('tr', {}, h('td', {}, h('b', {}, LEVEL_HY[lv])), h('td.muted', {}, ALGO_HY[lv]), h('td.ok', {}, r.wins), h('td.error', {}, r.losses), h('td', {}, r.draws),
              h('td', {}, n ? `${Math.round(100 * r.wins / n)}%` : '—'));
          }))),
      h('section.panel.fav', {},
        h('h3', {}, 'Սիրելի քարտը'),
        fav ? h('div.fav-row', {}, cardView(fav), h('p', {}, `«${CARDS[fav].nameHy}» քարտը խաղացել ես ${s.cardUse[fav]} անգամ։`))
          : h('p.muted', {}, 'Դեռ ոչ մի մարտ չես խաղացել։ Սկսիր արշավից կամ ազատ մարտից։')),
      h('p.hint', {}, ui('info'), ' Վիճակագրությունը պահվում է քո համակարգչում՝ առաջընթացի հետ միասին։')));
}
