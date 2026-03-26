import crypto from 'crypto';
import QRCode from 'qrcode';
import axios from 'axios';
import { RegistrationRepository } from '../repositories/RegistrationRepository.js';
import { NotificationService }    from './NotificationService.js';
import AppError from '../utils/AppError.js';
import { publishEvent } from '../messaging/kafkaBus.js';
import { EVENT_TYPES, TOPICS } from '../messaging/topics.js';

/**
 * RegistrationService
 * All attendee + waitlist + QR business logic.
 *
 * Cross-service: calls Spring Boot GET /api/events/:id to validate
 * eventId and read per-tier capacity before registering, and
 * GET /api/internal/events/:id/ownership for vendor ownership checks.
 *
 * Methods:
 *   register(userId, userEmail, eventId, tierId, quantity)
 *   cancelRegistration(userId, registrationId)
 *   getMyRegistrations(userId)
 *   getEventAttendees(eventId, options, actor)
 *   getAttendeeCounts(eventId)
 *   checkIn(qrToken, actor)
 *   exportCsv(eventId, res, actor)
 */
export class RegistrationService {
  constructor() {
    this.regRepo  = new RegistrationRepository();
    this.notifSvc = new NotificationService();
    this.springBaseUrl = process.env.SPRING_BASE_URL || 'http://localhost:8082';
    this.internalSecret = process.env.INTERNAL_SERVICE_SECRET || '';
    this.springClient = axios.create({
      baseURL: this.springBaseUrl,
      timeout: 5000,
    });
  }

  // -- Register --------------------------------------------------------------

  async register(userId, userEmail, eventId, tierId, quantity = 1) {
    const normalizedQuantity = Number(quantity);
    if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 1) {
      throw AppError.badRequest('quantity must be an integer greater than or equal to 1.');
    }

    // 1. Fetch event from Spring Boot - validates eventId + gets tier capacity
    const event = await this._fetchEvent(eventId);

    // 2. Find the requested tier
    const tier = event.ticketTiers?.find(t => String(t.id) === String(tierId));
    if (!tier) throw AppError.notFound(`Ticket tier ${tierId} not found on event ${eventId}.`);

    const tierSnapshot = {
      tierName: String(tier.name || '').trim() || null,
      ticketUnitPrice: Number.isFinite(Number(tier.price)) ? Number(tier.price) : null,
      ticketCurrency: String(tier.currency || 'INR').trim() || 'INR',
    };

    const capacity = Number(tier.capacity ?? 0);
    if (!Number.isFinite(capacity) || capacity < 1) {
      throw AppError.badRequest(`Ticket tier ${tierId} has invalid capacity.`);
    }

    const maxPerOrder = Number(tier.maxPerOrder ?? 10);
    if (!Number.isInteger(maxPerOrder) || maxPerOrder < 1) {
      throw AppError.badRequest(`Ticket tier ${tierId} has invalid maxPerOrder.`);
    }
    if (normalizedQuantity > maxPerOrder) {
      throw AppError.badRequest(`You can buy up to ${maxPerOrder} tickets per person for this tier.`);
    }

    const ownedActiveTickets = await this.regRepo.countActiveTicketsForUserTier(
      String(userId),
      String(eventId),
      String(tierId)
    );
    if (ownedActiveTickets + normalizedQuantity > maxPerOrder) {
      throw AppError.badRequest(
        `Ticket limit reached for this tier. Max allowed per person is ${maxPerOrder}, and you already have ${ownedActiveTickets}.`
      );
    }

    const venueCapacity = Number(event?.venue?.capacity ?? 0);

    const registrations = [];
    for (let i = 0; i < normalizedQuantity; i += 1) {
      const nextRegistration = await this._registerSingleSeat(
        userId,
        userEmail,
        String(eventId),
        String(tierId),
        tierSnapshot,
        event,
        capacity,
        venueCapacity
      );
      registrations.push(nextRegistration);
    }

    const confirmedTickets = registrations.filter((item) => item?.status === 'REGISTERED');
    if (confirmedTickets.length > 0) {
      await this._notifyRegisteredBatch(userId, userEmail, event, confirmedTickets);

      await publishEvent(TOPICS.REGISTRATION_LIFECYCLE, `${eventId}:${tierId}:${userId}`, {
        eventType: EVENT_TYPES.REGISTRATION_COMPLETED,
        eventId: String(eventId),
        tierId: String(tierId),
        userId: String(userId),
        quantity: Number(confirmedTickets.length),
        occurredAt: new Date().toISOString(),
      }).catch(() => undefined);
    }

    return registrations;
  }

  // -- Cancel ----------------------------------------------------------------

  async cancelRegistration(userId, registrationId) {
    const reg = await this.regRepo.findByIdAndUserId(registrationId, userId);
    if (!reg) throw AppError.notFound('Registration not found.');
    if (reg.status === 'CANCELLED') throw AppError.badRequest('Registration is already cancelled.');
    if (reg.status === 'CHECKED_IN') throw AppError.badRequest('Checked-in registrations cannot be cancelled.');

    const wasRegistered = reg.status === 'REGISTERED';
    const wasWaitlisted = reg.status === 'WAITLISTED';

    // Mark cancelled
    await this.regRepo.updateById(registrationId, {
      status: 'CANCELLED',
      $unset: { qrToken: 1, qrDataUri: 1 },
    });

    if (wasRegistered) {
      // -- Auto-promote the first waitlisted person for this tier ------------
      const nextUp = await this.regRepo.findFirstWaitlisted(reg.eventId, reg.tierId);
      if (nextUp) {
        const qrToken   = crypto.randomUUID();
        const qrDataUri = await QRCode.toDataURL(qrToken);

        await this.regRepo.updateById(nextUp._id, {
          status:           'REGISTERED',
          waitlistPosition: null,
          qrToken,
          qrDataUri,
        });

        // Notify + email the promoted attendee (need their email - pass userId)
        this._notifyPromoted(nextUp.userId, reg.eventId).catch(console.error);
      }
    }

    if (wasWaitlisted) {
      // -- Renumber everyone behind this person ------------------------------
      await this.regRepo.decrementPositionsBehind(
        reg.eventId, reg.tierId, reg.waitlistPosition
      );
    }

    // Notify the cancelling user
    await this.notifSvc.createNotification(
      userId, reg.eventId,
      'REGISTRATION_CANCELLED',
      `Your registration for event #${reg.eventId} has been cancelled.`
    );

    return { message: 'Registration cancelled.', wasRegistered, wasWaitlisted };
  }

  // -- My registrations ------------------------------------------------------

  async getMyRegistrations(userId) {
    const registrations = await this.regRepo.findByUserId(userId);
    if (!registrations.length) return registrations;

    const uniqueEventIds = [...new Set(registrations.map((r) => String(r.eventId)))];
    const eventPairs = await Promise.all(
      uniqueEventIds.map(async (eventId) => {
        try {
          const event = await this._fetchEvent(eventId);
          return [eventId, event];
        } catch {
          return [eventId, null];
        }
      })
    );

    const eventById = new Map(eventPairs);

    return registrations.map((reg) => {
      const event = eventById.get(String(reg.eventId));
      const tier = event?.ticketTiers?.find((t) => String(t.id) === String(reg.tierId));

      const json = reg.toObject ? reg.toObject() : reg;
      return {
        ...json,
        eventTitle: event?.title || null,
        eventDescription: event?.description || null,
        eventDate: event?.eventDate || null,
        venueName: event?.venue?.name || null,
        venueAddress: event?.venue?.address || null,
        tierName: json.tierName || tier?.name || null,
        ticketUnitPrice: Number.isFinite(Number(json.ticketUnitPrice)) ? Number(json.ticketUnitPrice) : (Number.isFinite(Number(tier?.price)) ? Number(tier?.price) : null),
        ticketCurrency: json.ticketCurrency || tier?.currency || 'INR',
      };
    });
  }

  // -- Admin/Vendor: all attendees for an event ------------------------------

  async getEventAttendees(eventId, options, actor) {
    await this._assertCanManageEvent(eventId, actor);
    return this.regRepo.findByEventId(eventId, options);
  }

  // -- Public seat counter - registered count per tier -----------------------

  async getAttendeeCounts(eventId) {
    return this.regRepo.countRegisteredPerTier(eventId);
  }

  async getWaitlistCounts(eventId) {
    return this.regRepo.countWaitlistedPerTier(eventId);
  }

  async getAttendeeCountsForEvents(eventIds, actor) {
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return [];
    }

    const normalized = [...new Set(
      eventIds
        .map((eventId) => String(eventId || '').trim())
        .filter(Boolean)
    )];

    if (normalized.length === 0) return [];

    if (!actor) {
      throw AppError.unauthorized('Authentication required.');
    }

    if (actor.role === 'ADMIN') {
      return this.regRepo.countRegisteredForEvents(normalized);
    }

    if (actor.role !== 'VENDOR') {
      throw AppError.forbidden('Access denied. Requires VENDOR or ADMIN role.');
    }

    const ownershipChecks = await Promise.all(
      normalized.map((eventId) => this._fetchEventOwnership(eventId))
    );

    const allowedEventIds = ownershipChecks
      .filter((ownership) => String(ownership.vendorUserId) === String(actor.userId))
      .map((ownership) => String(ownership.eventId));

    if (allowedEventIds.length === 0) return [];
    return this.regRepo.countRegisteredForEvents(allowedEventIds);
  }

  // -- QR Check-in -----------------------------------------------------------

  async checkIn(qrToken, actor) {
    const reg = await this.regRepo.findByQrToken(qrToken);
    if (!reg)                       throw AppError.notFound('QR code not found. No matching registration.');
    await this._assertCanManageEvent(reg.eventId, actor);
    if (reg.status === 'CHECKED_IN') throw AppError.conflict('Attendee is already checked in.');
    if (reg.status !== 'REGISTERED') throw AppError.badRequest(`Cannot check in a registration with status: ${reg.status}`);

    return this.regRepo.updateById(reg._id, { status: 'CHECKED_IN' });
  }

  // -- CSV Export ------------------------------------------------------------

  async exportCsv(eventId, res, actor) {
    await this._assertCanManageEvent(eventId, actor);
    const registrations = await this.regRepo.findAllForExport(eventId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="event-${eventId}-attendees.csv"`);

    // Header row
    res.write('registrationId,userId,eventId,tierId,status,waitlistPosition,registeredAt\n');

    // Data rows - stream one at a time to handle large events without memory issues
    for (const r of registrations) {
      const row = [
        r._id,
        r.userId,
        r.eventId,
        r.tierId,
        r.status,
        r.waitlistPosition ?? '',
        r.registeredAt ? new Date(r.registeredAt).toISOString() : '',
      ].join(',');
      res.write(row + '\n');
    }

    res.end();
  }

  // -- Internal: cancel all active registrations for an event ---------------

  async cancelEventRegistrations(eventId) {
    const activeRegistrations = await this.regRepo.findActiveByEventId(String(eventId));
    if (!activeRegistrations.length) {
      return { eventId: String(eventId), cancelled: 0, notified: 0 };
    }

    await this.regRepo.cancelActiveByEventId(String(eventId));

    const notifyResults = await Promise.allSettled(
      activeRegistrations.map((reg) =>
        this.notifSvc.createNotification(
          reg.userId,
          String(eventId),
          'REGISTRATION_CANCELLED',
          'This event was cancelled. Your registration has been automatically cancelled.'
        )
      )
    );

    const notified = notifyResults.filter((r) => r.status === 'fulfilled').length;

    return {
      eventId: String(eventId),
      cancelled: activeRegistrations.length,
      notified,
    };
  }

  async _assertCanManageEvent(eventId, actor) {
    if (!actor) {
      throw AppError.unauthorized('Authentication required.');
    }

    if (actor.role === 'ADMIN') {
      return;
    }

    if (actor.role !== 'VENDOR') {
      throw AppError.forbidden('Access denied. Requires VENDOR or ADMIN role.');
    }

    // VENDOR: must own the event.
    const ownership = await this._fetchEventOwnership(eventId);
    if (String(ownership.vendorUserId) !== String(actor.userId)) {
      throw AppError.forbidden('Vendors can only manage attendees for their own events.');
    }
  }

  // -- Private helpers -------------------------------------------------------

  async _fetchEvent(eventId) {
    let lastError;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await this.springClient.get(`/api/events/${eventId}`);
        // Spring Boot wraps responses in { success, data }
        return response.data.data ?? response.data;
      } catch (err) {
        if (err.response?.status === 404) {
          throw AppError.notFound(`Event ${eventId} not found.`);
        }

        lastError = err;
        if (!this._isRetryableSpringError(err) || attempt === 2) break;
        await this._sleep(250 * attempt);
      }
    }

    throw AppError.internal(
      `Could not reach event service. Is Spring Boot running on ${this.springBaseUrl}? ` +
      `Last error: ${lastError?.message ?? 'unknown'}`
    );
  }

  async _fetchEventOwnership(eventId) {
    if (!this.internalSecret) {
      throw AppError.internal('INTERNAL_SERVICE_SECRET is not configured for internal ownership checks.');
    }

    let lastError;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await this.springClient.get(`/api/internal/events/${eventId}/ownership`, {
          headers: {
            'X-Internal-Secret': this.internalSecret,
          },
        });
        return response.data.data ?? response.data;
      } catch (err) {
        if (err.response?.status === 404) {
          throw AppError.notFound(`Event ${eventId} not found.`);
        }

        if (err.response?.status === 401 || err.response?.status === 403) {
          throw AppError.internal('Event service rejected internal ownership verification.');
        }

        lastError = err;
        if (!this._isRetryableSpringError(err) || attempt === 2) break;
        await this._sleep(250 * attempt);
      }
    }

    throw AppError.internal(
      `Could not verify event ownership from event service at ${this.springBaseUrl}. ` +
      `Last error: ${lastError?.message ?? 'unknown'}`
    );
  }

  async _registerSingleSeat(userId, userEmail, eventId, tierId, tierSnapshot, event, capacity, venueCapacity = 0) {
    if (venueCapacity > 0) {
      const totalRegistered = await this.regRepo.countRegisteredForEvent(eventId);
      if (totalRegistered >= venueCapacity) {
        throw AppError.conflict('Venue capacity reached for this event.');
      }
    }

    const registeredCount = await this.regRepo.countRegistered(eventId, tierId);

    if (registeredCount < capacity) {
      const registration = await this._createRegistered(userId, eventId, tierId, tierSnapshot);

      // Safety net for concurrent requests: ensure no more than capacity remain REGISTERED.
      const demotedIds = await this._rebalanceRegisteredTier(eventId, tierId, capacity, event?.title);
      if (demotedIds.includes(String(registration._id))) {
        const demoted = await this.regRepo.findById(registration._id);
        return demoted ?? registration;
      }
      return registration;
    }

    const allowWaitlist = event?.allowWaitlist !== false;
    if (!allowWaitlist) {
      throw AppError.conflict('Tickets are sold out for this tier and waitlist is disabled.');
    }

    // -- WAITLISTED path -----------------------------------------------------
    return this._createWaitlistedWithRetry(userId, eventId, tierId, tierSnapshot, event?.title);
  }

  _isRetryableSpringError(err) {
    if (!err.response) return true;
    return err.response.status >= 500 || err.response.status === 429;
  }

  _isDuplicateKeyError(err, indexName) {
    if (err?.code !== 11000) return false;
    if (!indexName) return true;
    return String(err?.message || '').includes(indexName);
  }

  async _createRegistered(userId, eventId, tierId, tierSnapshot) {
    const qrToken = crypto.randomUUID();
    const qrDataUri = await QRCode.toDataURL(qrToken);

    return this.regRepo.create({
      userId,
      eventId: String(eventId),
      tierId: String(tierId),
      tierName: tierSnapshot?.tierName || null,
      ticketUnitPrice: Number.isFinite(Number(tierSnapshot?.ticketUnitPrice)) ? Number(tierSnapshot.ticketUnitPrice) : null,
      ticketCurrency: tierSnapshot?.ticketCurrency || 'INR',
      quantity: 1,
      status: 'REGISTERED',
      waitlistPosition: null,
      qrToken,
      qrDataUri,
    });
  }

  async _createWaitlistedWithRetry(userId, eventId, tierId, tierSnapshot, eventTitle) {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const highestPosition = await this.regRepo.findHighestWaitlistPosition(eventId, tierId);
      const nextPosition = highestPosition + 1;

      try {
        const registration = await this.regRepo.create({
          userId,
          eventId: String(eventId),
          tierId: String(tierId),
          tierName: tierSnapshot?.tierName || null,
          ticketUnitPrice: Number.isFinite(Number(tierSnapshot?.ticketUnitPrice)) ? Number(tierSnapshot.ticketUnitPrice) : null,
          ticketCurrency: tierSnapshot?.ticketCurrency || 'INR',
          quantity: 1,
          status: 'WAITLISTED',
          waitlistPosition: nextPosition,
          qrToken: null,
          qrDataUri: null,
        });

        this._notifyWaitlisted(userId, eventId, eventTitle, nextPosition).catch(console.error);
        return registration;
      } catch (err) {
        if (this._isDuplicateKeyError(err, 'unique_waitlist_position') && attempt < maxAttempts) {
          continue;
        }

        throw err;
      }
    }

    throw AppError.conflict('Could not place your waitlist position due to concurrent registrations. Please retry.');
  }

  async _rebalanceRegisteredTier(eventId, tierId, capacity, eventTitle) {
    const registered = await this.regRepo.findRegisteredByTier(eventId, tierId);
    if (registered.length <= capacity) return [];

    const overflow = registered.slice(capacity);
    let nextPosition = (await this.regRepo.findHighestWaitlistPosition(eventId, tierId)) + 1;
    const demotedIds = [];

    for (const reg of overflow) {
      const updated = await this.regRepo.updateById(reg._id, {
        status: 'WAITLISTED',
        waitlistPosition: nextPosition,
        $unset: { qrToken: 1, qrDataUri: 1 },
      });

      if (!updated) continue;

      demotedIds.push(String(updated._id));
      this._notifyWaitlisted(updated.userId, eventId, eventTitle, nextPosition).catch(console.error);
      nextPosition += 1;
    }

    return demotedIds;
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async _notifyRegisteredBatch(userId, userEmail, event, registrations) {
    const ticketCount = Array.isArray(registrations) ? registrations.length : 0;
    await this.notifSvc.createNotification(
      userId, String(event?.id || event?.eventId || ''),
      'REGISTRATION_CONFIRMED',
      `Your registration for "${event?.title || 'this event'}" is confirmed (${ticketCount} ticket${ticketCount === 1 ? '' : 's'}). Check your dashboard for your QR ticket.`
    );

    if (userEmail) {
      await this.notifSvc.sendConfirmationEmail(userEmail, event, registrations);
    }
  }

  async _notifyWaitlisted(userId, eventId, eventTitle, position) {
    await this.notifSvc.createNotification(
      userId, String(eventId),
      'WAITLIST_JOINED',
      `You've been added to the waitlist for "${eventTitle}". Your position is #${position}.`
    );
  }

  async _notifyPromoted(userId, eventId) {
    // We only have userId here - fetch their email from DB for the email send
    // Import lazily to avoid circular deps
    const { UserRepository } = await import('../repositories/UserRepository.js');
    const userRepo = new UserRepository();
    const user = await userRepo.findById(userId);

    await this.notifSvc.createNotification(
      userId, String(eventId),
      'WAITLIST_PROMOTED',
      `Great news! A spot opened up and your waitlist registration has been confirmed. Check your dashboard for your QR ticket.`
    );
    if (user?.email) {
      await this.notifSvc.sendWaitlistPromotedEmail(user.email, eventId);
    }
  }
}
