// Save data: campaign progress, stars, unlocked cards, decks, settings, statistics.
// Stored as JSON in Electron's userData folder (via preload) or in localStorage in a browser.
import { STARTER_DECK, STARTER_UNLOCKED, NORMAL_UNLOCK_ORDER, PLAYER_CARD_IDS } from '../data/cards.js';
import { BATTLES, getChapter } from '../data/campaign.js';

const KEY = 'arqaneri-mart-save-v1';
export const PROFILE_VERSION = 3;

function emptyStats() {
  const lv = () => ({ wins: 0, losses: 0, draws: 0 });
  return { byLevel: { easy: lv(), medium: lv(), hard: lv() }, battles: 0, playMs: 0, cardUse: {}, castles: 0 };
}

export function defaultProfile() {
  return {
    version: PROFILE_VERSION,
    stars: {},                       // battleId -> best stars (1..3)
    unlocked: [...STARTER_UNLOCKED], // card ids available to the player
    deck: [...STARTER_DECK],         // campaign / default deck
    freeDeck: null,                  // deck built in "all cards" demo mode
    introSeen: false,                // the first-launch intro was shown
    tutorialDone: false,             // the interactive tutorial of battle 1-1 was completed
    settings: {
      timer: 8, animSpeed: 'normal', hardMs: 3000, allCards: false,
      reduceMotion: false, volMaster: 0.8, volMusic: 0.5, volSfx: 0.8, muted: false, showAiPanel: true, fullscreen: false,
    },
    stats: emptyStats(),
  };
}

/** Upgrade a parsed save file of any older version to the current profile shape (pure function). */
export function migrateProfile(p) {
  const base = defaultProfile();
  if (!p || typeof p !== 'object') return base;
  const prof = { ...base, ...p, settings: { ...base.settings, ...(p.settings || {}) } };
  // v1 -> v2: rounds became simultaneous planning + battle; old turn timers (10/15/30 s) are too long
  if (!p.version || p.version < 2) { prof.settings.timer = base.settings.timer; prof.settings.hardMs = Math.min(prof.settings.hardMs, 3000); }
  // v2 -> v3: sound / motion / panel settings and statistics were added; an existing player has seen the game already
  if (!p.version || p.version < 3) {
    prof.introSeen = Object.keys(prof.stars || {}).length > 0;
    prof.tutorialDone = (prof.stars?.['1-1'] || 0) > 0;
  }
  const st = emptyStats(), ps = p.stats || {};
  prof.stats = { ...st, ...ps, byLevel: { ...st.byLevel, ...(ps.byLevel || {}) }, cardUse: { ...(ps.cardUse || {}) } };
  if (![0, 5, 8, 12].includes(prof.settings.timer)) prof.settings.timer = base.settings.timer;
  prof.version = PROFILE_VERSION;
  return prof;
}

export async function loadProfile() {
  let raw = null;
  try {
    raw = window.saveAPI ? await window.saveAPI.load() : localStorage.getItem(KEY);
  } catch { raw = null; }
  if (!raw) return defaultProfile();
  try { return migrateProfile(JSON.parse(raw)); } catch { return defaultProfile(); }
}

export async function saveProfile(profile) {
  const json = JSON.stringify(profile, null, 2);
  try {
    if (window.saveAPI) await window.saveAPI.save(json); else localStorage.setItem(KEY, json);
  } catch (e) { console.warn('save failed', e); }
}

export function isBattleUnlocked(profile, battleId) {
  const i = BATTLES.findIndex(b => b.id === battleId);
  return i === 0 || (i > 0 && (profile.stars[BATTLES[i - 1].id] || 0) > 0);
}
export function deckEditorUnlocked(profile) { return (profile.stars['1-3'] || 0) > 0; }
export function totalStars(profile) { return Object.values(profile.stars).reduce((a, b) => a + b, 0); }

/**
 * Record a campaign victory. Returns the list of newly unlocked card ids.
 * Boss win -> the chapter's hero; first win of a normal battle -> next card of NORMAL_UNLOCK_ORDER.
 */
export function recordWin(profile, battle, stars) {
  const first = !(profile.stars[battle.id] > 0);
  profile.stars[battle.id] = Math.max(profile.stars[battle.id] || 0, stars);
  const unlocked = [];
  if (first) {
    if (battle.bossId) {
      const hero = getChapter(battle.chapter).heroUnlock;
      if (hero && !profile.unlocked.includes(hero)) unlocked.push(hero);
    } else {
      const next = NORMAL_UNLOCK_ORDER.find(id => !profile.unlocked.includes(id));
      if (next) unlocked.push(next);
    }
    profile.unlocked.push(...unlocked);
  }
  return unlocked;
}

/** Statistics of one finished battle: { level, winner (0 | 1 | 'draw'), ms, cards: [ids played], castle } */
export function recordBattle(profile, { level, winner, ms = 0, cards = [], castle = false }) {
  const s = profile.stats;
  const lv = s.byLevel[level] || (s.byLevel[level] = { wins: 0, losses: 0, draws: 0 });
  if (winner === 0) lv.wins++; else if (winner === 'draw') lv.draws++; else lv.losses++;
  s.battles++;
  s.playMs += Math.max(0, Math.round(ms));
  if (castle) s.castles++;
  for (const id of cards) s.cardUse[id] = (s.cardUse[id] || 0) + 1;
  return s;
}
/** Most played card id (or null). */
export function favouriteCard(profile) {
  let best = null, n = 0;
  for (const [id, k] of Object.entries(profile.stats.cardUse)) if (k > n) { best = id; n = k; }
  return best;
}

/** Cards the player may use: unlocked ones, or everything in demo mode. */
export function availableCards(profile, allCards = false) {
  return allCards ? PLAYER_CARD_IDS : PLAYER_CARD_IDS.filter(id => profile.unlocked.includes(id));
}
