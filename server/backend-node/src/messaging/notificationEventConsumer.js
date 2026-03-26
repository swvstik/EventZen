import { NotificationService } from '../services/NotificationService.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { publishEvent, startKafkaConsumer, isKafkaEnabled } from './kafkaBus.js';
import { EVENT_TYPES, TOPICS } from './topics.js';

const notifSvc = new NotificationService();
const userRepo = new UserRepository();

export async function handleNotificationLifecycleEvent(payload, deps = {}) {
  const activeNotifSvc = deps.notifSvc || notifSvc;
  const activeUserRepo = deps.userRepo || userRepo;

  const eventType = String(payload?.eventType || '').toUpperCase();
  const eventId = String(payload?.eventId || '').trim();
  const eventTitle = String(payload?.eventTitle || '').trim();
  const vendorUserId = String(payload?.vendorUserId || '').trim();
  const status = String(payload?.status || '').trim();

  if (!eventType || !eventId) return;

  if (eventType === EVENT_TYPES.EVENT_PENDING_APPROVAL) {
    const admins = await activeUserRepo.findByRole('ADMIN');
    await Promise.allSettled(
      (admins || []).map((admin) => activeNotifSvc.createNotification(
        String(admin?._id || admin?.id || ''),
        eventId,
        'EVENT_PENDING_APPROVAL',
        `Event pending approval: ${eventTitle || `#${eventId}`} (vendor: ${vendorUserId || 'unknown'}).`
      ))
    );
    return;
  }

  if (eventType === EVENT_TYPES.EVENT_STATUS_DECISION && vendorUserId) {
    const normalizedStatus = status.toUpperCase();
    const approved = normalizedStatus === 'PUBLISHED';
    const type = approved ? 'EVENT_APPROVED' : 'EVENT_REJECTED';
    const message = approved
      ? `Your event ${eventTitle || `#${eventId}`} was approved and is now published.`
      : `Your event ${eventTitle || `#${eventId}`} was sent back for edits.`;

    await activeNotifSvc.createNotification(vendorUserId, eventId, type, message);
  }
}

let consumer = null;

export async function processNotificationLifecycleMessage(message, deps = {}) {
  const payload = message?.payload || {};
  const key = String(message?.key || 'notification-lifecycle').trim() || 'notification-lifecycle';
  const activePublishEvent = deps.publishEvent || publishEvent;
  const activeHandler = deps.handleNotificationLifecycleEvent || handleNotificationLifecycleEvent;

  try {
    await activeHandler(payload);
  } catch (err) {
    console.error('Notification lifecycle consumer failed:', err?.message || err);
    await activePublishEvent(TOPICS.DLQ, key, {
      sourceTopic: TOPICS.EVENT_LIFECYCLE,
      error: String(err?.message || err),
      payload,
      occurredAt: new Date().toISOString(),
    }).catch(() => undefined);
  }
}

export async function startNotificationEventConsumer() {
  if (!isKafkaEnabled()) {
    return null;
  }

  try {
    consumer = await startKafkaConsumer({
      groupId: 'eventzen-node-notification-lifecycle-v1',
      topics: [TOPICS.EVENT_LIFECYCLE],
      onMessage: processNotificationLifecycleMessage,
    });
  } catch (err) {
    console.warn(`Notification lifecycle consumer unavailable: ${err?.message || err}`);
    consumer = null;
  }

  return consumer;
}

export async function stopNotificationEventConsumer() {
  if (!consumer) return;
  try {
    await consumer.disconnect();
  } catch {
    // no-op
  }
  consumer = null;
}
