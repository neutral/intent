// The queue of pending reminders, kept in local storage.
export function createQueue(storage) {
  return {
    async add(entry) { await storage.commit(entry); },
    takeDue(now) { return storage.all().filter((e) => !e.fired && e.due <= now); },
    markFired(id) { storage.update(id, { fired: true }); },
  };
}
