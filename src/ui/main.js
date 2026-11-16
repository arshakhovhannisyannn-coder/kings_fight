// App shell: loads the save file, switches between screens, owns global hotkeys and sound settings.
import { loadProfile, saveProfile, defaultProfile } from './store.js';
import { closeModal, isModalOpen, dismissModal, showHoveredInfo, hideTooltip } from './dom.js';
import { audio } from './audio.js';
import { menuScreen, splashScreen } from './screens/menu.js';
import { campaignScreen, introScreen } from './screens/campaign.js';
import { freeBattleScreen } from './screens/freebattle.js';
import { deckScreen } from './screens/deck.js';
import { settingsScreen } from './screens/settings.js';
import { historyScreen } from './screens/history.js';
import { battleScreen } from './screens/battle.js';
import { resultScreen } from './screens/result.js';
import { howtoScreen } from './screens/howto.js';
import { statsScreen } from './screens/stats.js';

export const VERSION = '1.4.1';

const SCREENS = {
  menu: menuScreen, splash: splashScreen, campaign: campaignScreen, intro: introScreen, free: freeBattleScreen, deck: deckScreen,
  settings: settingsScreen, history: historyScreen, battle: battleScreen, result: resultScreen, howto: howtoScreen, stats: statsScreen,
};

const app = {
  version: VERSION,
  profile: defaultProfile(),
  root: document.getElementById('app'),
  cleanup: null,
  screen: null,
  /** Switch to a screen. A screen function returns a DOM node and may set app.cleanup. */
  go(name, params = {}) {
    if (this.cleanup) { try { this.cleanup(); } catch (e) { console.error(e); } this.cleanup = null; }
    closeModal();
    hideTooltip();
    this.screen = name;
    if (name !== 'battle' && name !== 'result') audio.music('menu');
    this.root.replaceChildren(SCREENS[name](this, params));
    this.root.dataset.screen = name;
    window.scrollTo(0, 0);
  },
  save() { return saveProfile(this.profile); },
  async reset() { this.profile = defaultProfile(); this.profile.introSeen = true; await this.save(); this.applySettings(); },
  /** Push the profile settings to the sound engine, the motion preference and the window. */
  applySettings() {
    const s = this.profile.settings;
    audio.configure(s);
    document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
    if (window.appAPI) window.appAPI.setFullscreen(!!s.fullscreen);
  },
  toggleMute() {
    this.profile.settings.muted = !this.profile.settings.muted;
    audio.configure(this.profile.settings);
    this.save();
    return this.profile.settings.muted;
  },
};

window.addEventListener('error', (e) => console.error('UI error:', e.message));
// sound may only start after a user gesture
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
window.addEventListener('keydown', (ev) => {
  if (ev.ctrlKey || ev.altKey || ev.metaKey) return;
  if (ev.target instanceof HTMLInputElement && ev.target.type !== 'range' && ev.target.type !== 'checkbox') return;
  const k = ev.key.toLowerCase();
  if (ev.key === 'Escape' && isModalOpen()) { dismissModal(); ev.stopPropagation(); }
  else if (k === 'm' || k === 'մ') { app.toggleMute(); document.dispatchEvent(new CustomEvent('arq-mute')); }
  else if (k === 'i' || k === 'ի') { if (!isModalOpen()) showHoveredInfo(); }
}, true);
if (window.appAPI && window.appAPI.onFullscreen) {
  window.appAPI.onFullscreen((on) => { app.profile.settings.fullscreen = !!on; app.save(); document.dispatchEvent(new CustomEvent('arq-fullscreen')); });
}

app.profile = await loadProfile();
app.applySettings();
window.__app = app; // handy for debugging and automated UI tests
app.go(app.profile.introSeen ? 'menu' : 'splash');
