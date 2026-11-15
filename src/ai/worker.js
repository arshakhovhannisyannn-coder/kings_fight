// Web Worker wrapper so the UI never freezes while the AI is thinking.
// Message in:  { id, state (serializeState output), side, level, opts }
// Message out: { id, result } or { id, error }
import { hydrateState } from '../engine/state.js';
import { chooseMove } from './index.js';

self.onmessage = (e) => {
  const { id, state, side, level, opts } = e.data;
  try {
    const result = chooseMove(hydrateState(state), side, level, opts || {});
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack || err) });
  }
};
