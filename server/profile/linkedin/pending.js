// A one-slot, in-memory hand-off for a bookmarklet import. The bookmarklet POSTs
// from the LinkedIn tab; the app polls and consumes it once. Single-user local
// app, so in-memory is sufficient (and resets cleanly with the process).

let pending = null;

export function setPending(data) {
  pending = data;
}

/** Returns the stashed import and clears it (take-once), or null if empty. */
export function takePending() {
  const out = pending;
  pending = null;
  return out;
}
