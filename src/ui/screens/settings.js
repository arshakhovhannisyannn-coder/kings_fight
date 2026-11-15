import { h, btn, confirmDialog } from '../dom.js';
import { topBar } from './campaign.js';
import { audio } from '../audio.js';

export function settingsScreen(app) {
  const s = app.profile.settings;
  const root = h('div.screen.settings');
  const commit = async () => { app.applySettings(); await app.save(); };
  const group = (title, key, options, note = null) => h('section.panel', {},
    h('h3', {}, title),
    h('div.choices', {}, options.map(([v, label]) =>
      h(`button.choice${s[key] === v ? '.on' : ''}`, { dataset: { key, value: String(v) }, onclick: async () => { audio.sfx('click'); s[key] = v; await commit(); render(); } }, h('b', {}, label)))),
    note ? h('p.hint', {}, note) : null);
  const toggle = (key, label, note = null) => h('label.toggle-row', {},
    h('input', { type: 'checkbox', checked: !!s[key], dataset: { key }, onchange: async (e) => { s[key] = e.target.checked; audio.sfx('click'); await commit(); render(); } }),
    h('span', {}, h('b', {}, label), note ? h('small', {}, note) : null));
  const slider = (key, label) => h('label.slider-row', {},
    h('span', {}, label),
    h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round((s[key] ?? 0.8) * 100), dataset: { key },
      oninput: (e) => { s[key] = Number(e.target.value) / 100; audio.configure(s); e.target.nextSibling.textContent = `${e.target.value}%`; },
      onchange: () => { audio.sfx('coin'); app.save(); } }),
    h('b.slider-val', {}, `${Math.round((s[key] ?? 0.8) * 100)}%`));
  const onExternal = () => render();
  document.addEventListener('arq-mute', onExternal);
  document.addEventListener('arq-fullscreen', onExternal);
  app.cleanup = () => { document.removeEventListener('arq-mute', onExternal); document.removeEventListener('arq-fullscreen', onExternal); };

  function render() {
    root.replaceChildren(
      topBar(app, 'Կարգավորումներ'),
      h('div.settings-body', {},
        h('section.panel', {},
          h('h3', {}, 'Ձայն'),
          slider('volMaster', 'Ընդհանուր ձայն'),
          slider('volMusic', 'Երաժշտություն'),
          slider('volSfx', 'Էֆեկտներ'),
          toggle('muted', 'Անջատել ձայնը', 'Ստեղն՝ M')),
        group('Պլանավորման ժամաչափ', 'timer', [[5, '5 վրկ'], [8, '8 վրկ'], [12, '12 վրկ'], [0, 'Անջատված']],
          'Ամեն ռաունդ դու և AI-ը միաժամանակ եք քարտեր դնում։ Ժամանակի ավարտին (կամ «Պատրաստ է» սեղմելիս) սկսվում է մարտը. չծախսած ոսկին պահպանվում է։'),
        group('Անիմացիայի արագություն', 'animSpeed', [['slow', 'Դանդաղ'], ['normal', 'Սովորական'], ['fast', 'Արագ']]),
        h('section.panel', {},
          h('h3', {}, 'Պատկեր'),
          toggle('reduceMotion', 'Նվազեցնել շարժումը', 'Անջատում է ցնցումը, մասնիկները և դանդաղեցումը'),
          toggle('showAiPanel', 'Ցույց տալ AI-ի վահանակը', 'Մարտի ժամանակ աջ կողմում երևում է AI-ի վերլուծությունը'),
          window.appAPI ? toggle('fullscreen', 'Ամբողջ էկրան', 'Ստեղն՝ F11') : null),
        group('«Դժվար» AI-ի մտածելու ժամանակը', 'hardMs', [[1000, '1 վրկ'], [2000, '2 վրկ'], [3000, '3 վրկ'], [5000, '5 վրկ']],
          'Որքան երկար է մտածում MCTS-ը, այնքան ուժեղ է խաղում։ AI-ը մտածում է քո պլանավորման ընթացքում և միշտ պատրաստ է լինում ժամաչափի ավարտից առաջ։'),
        h('section.panel', {},
          h('h3', {}, 'Առաջընթաց'),
          h('p.hint', {}, 'Ջնջում է արշավի առաջընթացը, աստղերը, բացված քարտերը, կապուկները և վիճակագրությունը։'),
          btn('.danger', 'Զրոյացնել առաջընթացը', () => confirmDialog('Իսկապե՞ս ջնջել ամբողջ առաջընթացը։', 'Ջնջել', async () => { await app.reset(); app.go('menu'); })))));
  }
  render();
  return root;
}
