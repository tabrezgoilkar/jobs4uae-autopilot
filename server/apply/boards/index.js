import { indeed } from './indeed.js';

// Board registry. Add a board by dropping a config file here — the apply engine
// is unchanged. Indeed first; Bayt / Naukrigulf / LinkedIn follow the same shape.
const BOARDS = { indeed };

export function getBoard(id) {
  return BOARDS[id];
}

/** Public, UI-safe metadata only — never leaks selectors/field maps to the client. */
export function listBoards() {
  return Object.values(BOARDS).map((b) => ({ id: b.id, name: b.name }));
}
