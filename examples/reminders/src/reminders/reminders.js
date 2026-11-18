// Setting a reminder on a todo, and dropping it when the todo is completed.

/** Set a reminder. It is in the store before the caller is told that it is set. */
export function setReminder(queue, reminderId, time) {
  queue.add(reminderId, time);
  return { shownAsSet: true, reminderId };
}

/** The todo was completed: its reminder does not fire again, snoozed or not. */
export function completeTodo(queue, reminderId) {
  queue.remove(reminderId);
}
