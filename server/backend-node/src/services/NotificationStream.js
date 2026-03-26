const subscribersByUser = new Map();

function getSubscriberSet(userId) {
  const key = String(userId || '');
  if (!subscribersByUser.has(key)) {
    subscribersByUser.set(key, new Set());
  }
  return subscribersByUser.get(key);
}

export function addNotificationSubscriber(userId, res) {
  const key = String(userId || '');
  const bucket = getSubscriberSet(key);
  bucket.add(res);

  return () => {
    const current = subscribersByUser.get(key);
    if (!current) return;
    current.delete(res);
    if (current.size === 0) {
      subscribersByUser.delete(key);
    }
  };
}

export function publishNotificationEvent(userId, eventName, payload = {}) {
  const key = String(userId || '');
  const subscribers = subscribersByUser.get(key);
  if (!subscribers || subscribers.size === 0) return;

  const eventType = String(eventName || 'notification');
  const body = JSON.stringify({
    type: eventType,
    timestamp: new Date().toISOString(),
    ...payload,
  });

  for (const res of subscribers) {
    try {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${body}\n\n`);
    } catch {
      // Ignore write failures; connection cleanup runs on close/error hooks.
    }
  }
}