// The notifier: what puts a notification on the phone. This one keeps what it was asked to send.

export function openNotifier() {
  const sent = [];
  return {
    send(notification) { sent.push(notification); },
    /** Every notification sent, in order: { reminderId, at, late }. */
    sent,
  };
}
