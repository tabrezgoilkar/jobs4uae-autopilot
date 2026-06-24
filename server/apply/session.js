// The current in-flight application per board: the live page adapter + the
// outstanding pending questions, so /apply/answer can fill the real form the
// user is looking at. In-memory (tied to the live browser window, not persisted).

const sessions = new Map();

export function setSession(boardId, session) {
  sessions.set(boardId, session);
}
export function getSession(boardId) {
  return sessions.get(boardId);
}
export function clearSession(boardId) {
  sessions.delete(boardId);
}
