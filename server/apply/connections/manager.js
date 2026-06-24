import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../../config/paths.js';
import { getBoard, listBoards } from '../boards/index.js';
import * as browser from '../browser.js';

// Tracks which boards the user has connected (session present), persisted to
// data/connections.json. Only a connected/updatedAt flag is stored — never any
// credentials. The live browser window itself is owned by ../browser.js.

function connPath() {
  return path.join(dataDir(), 'connections.json');
}
function load() {
  try {
    return JSON.parse(fs.readFileSync(connPath(), 'utf8'));
  } catch {
    return {};
  }
}
function save(conn) {
  fs.mkdirSync(path.dirname(connPath()), { recursive: true });
  fs.writeFileSync(connPath(), JSON.stringify(conn, null, 2));
  return conn;
}

export function getStatus() {
  const conn = load();
  return listBoards().map((b) => ({
    ...b,
    connected: !!conn[b.id]?.connected,
    updatedAt: conn[b.id]?.updatedAt ?? null,
  }));
}

export function isConnected(boardId) {
  return !!load()[boardId]?.connected;
}

function requireBoard(boardId) {
  const board = getBoard(boardId);
  if (!board) throw new Error('Unknown board.');
  return board;
}

/** Open the board's login window (user logs in there). Does not mark connected yet. */
export async function connect(boardId) {
  return browser.connect(requireBoard(boardId));
}

/** User asserts they've logged in; best-effort probe, then persist connected status. */
export async function confirm(boardId) {
  const board = requireBoard(boardId);
  const { connected } = await browser.confirm(board);
  const conn = load();
  conn[boardId] = { connected, updatedAt: new Date().toISOString() };
  save(conn);
  return getStatus();
}

/** Close the window and forget the saved session. */
export async function disconnect(boardId) {
  const board = requireBoard(boardId);
  await browser.disconnect(board);
  const conn = load();
  conn[boardId] = { connected: false, updatedAt: new Date().toISOString() };
  save(conn);
  return getStatus();
}
