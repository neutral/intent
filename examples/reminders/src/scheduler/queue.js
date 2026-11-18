// The scheduler's queue: one entry for each reminder that is set, kept in the store.
// An entry is { reminderId, due, fired }: `due` in milliseconds, `fired` once its notification was sent.

export function openQueue(store) {
  const change = (edit) => {
    const document = store.read();
    const result = edit(document.entries);
    store.write(document);
    return result;
  };
  const indexOf = (entries, reminderId) => entries.findIndex((entry) => entry.reminderId === reminderId);
  return {
    /** Add the entry of a reminder that has none. It is in the store when this returns. */
    add(reminderId, due) {
      change((entries) => { entries.push({ reminderId, due, fired: false }); });
    },
    /** Replace a reminder's entry with one due at `due`, in one write. False when it has no entry. */
    replace(reminderId, due) {
      const at = indexOf(store.read().entries, reminderId);
      if (at < 0) return false;
      change((entries) => { entries[indexOf(entries, reminderId)] = { reminderId, due, fired: false }; });
      return true;
    },
    /** Mark a reminder's entry as fired, so no later tick or start sends it again. */
    markFired(reminderId) {
      change((entries) => { entries[indexOf(entries, reminderId)].fired = true; });
    },
    /** Remove a reminder's entry: the reminder was dismissed or its todo completed. */
    remove(reminderId) {
      change((entries) => { const at = indexOf(entries, reminderId); if (at >= 0) entries.splice(at, 1); });
    },
    /** The entries due at `now` whose notification has not been sent. */
    pending(now) {
      return store.read().entries.filter((entry) => !entry.fired && entry.due <= now);
    },
    /** A reminder's entry, or undefined. */
    entry(reminderId) {
      return store.read().entries.find((entry) => entry.reminderId === reminderId);
    },
  };
}
