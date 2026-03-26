import crypto from 'node:crypto';
import axios from 'axios';
import { Polar } from '@polar-sh/sdk';
import Payment from '../models/Payment.js';
import AppError from '../utils/AppError.js';
import { RegistrationService } from './RegistrationService.js';
import { RegistrationRepository } from '../repositories/RegistrationRepository.js';
import { publishEvent } from '../messaging/kafkaBus.js';
import { EVENT_TYPES, TOPICS } from '../messaging/topics.js';

const TERMINAL_SUCCESS = new Set(['succeeded', 'successful', 'paid', 'completed', 'confirmed']);
const TERMINAL_CANCEL = new Set(['cancelled', 'canceled', 'expired', 'failed']);
const PLATFORM_FEE_RATE = 0.1;

export class PaymentService {
  constructor() {
    this.registrationService = new RegistrationService();
    this.registrationRepo = new RegistrationRepository();
    this.springBaseUrl = process.env.SPRING_BASE_URL || 'http://localhost:8082';
    this.springClient = axios.create({ baseURL: this.springBaseUrl, timeout: 6000 });

    this.polarToken = String(process.env.POLAR_ACCESS_TOKEN || '').trim();
    this.polarServer = String(process.env.POLAR_SERVER || 'sandbox').toLowerCase() === 'production'
      ? 'production'
      : 'sandbox';
    this.polarProductId = String(process.env.POLAR_PRODUCT_ID || '').trim();
    this.clientUrl = String(process.env.CLIENT_URL || 'http://localhost:8080').replace(/\/$/, '');
    this.polarApiBase = this.polarServer === 'production'
      ? 'https://api.polar.sh/v1'
      : 'https://sandbox-api.polar.sh/v1';

    this.polar = this.polarToken
      ? new Polar({ accessToken: this.polarToken, server: this.polarServer })
      : null;
  }

  async maybeCreateCheckout({ user, eventId, tierId, quantity = 1, origin }) {
    const normalizedQuantity = Number(quantity || 1);
    if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 1) {
      throw AppError.badRequest('quantity must be an integer greater than or equal to 1.');
    }

    const event = await this._fetchEvent(eventId);
    const tier = event.ticketTiers?.find((item) => String(item.id) === String(tierId));
    if (!tier) throw AppError.notFound(`Ticket tier ${tierId} not found on event ${eventId}.`);

    const price = Number(tier.price || 0);
    if (!Number.isFinite(price) || price < 0) {
      throw AppError.badRequest('Invalid tier price configuration.');
    }

    const maxPerOrder = Number(tier.maxPerOrder ?? 10);
    if (!Number.isInteger(maxPerOrder) || maxPerOrder < 1) {
      throw AppError.badRequest(`Ticket tier ${tierId} has invalid maxPerOrder.`);
    }
    if (normalizedQuantity > maxPerOrder) {
      throw AppError.badRequest(`You can buy up to ${maxPerOrder} tickets per person for this tier.`);
    }

    const ownedActiveTickets = await this.registrationRepo.countActiveTicketsForUserTier(
      String(user.userId),
      String(eventId),
      String(tierId)
    );
    if (ownedActiveTickets + normalizedQuantity > maxPerOrder) {
      throw AppError.badRequest(
        `Ticket limit reached for this tier. Max allowed per person is ${maxPerOrder}, and you already have ${ownedActiveTickets}.`
      );
    }

    if (price === 0) {
      return { requiresPayment: false, event };
    }

    if (!this.polar || !this.polarProductId) {
      throw AppError.serviceUnavailable('Paid checkout is not configured. Missing Polar token or product id.');
    }

    const subtotalMinor = Math.round(price * 100) * normalizedQuantity;
    const platformFeeMinor = Math.round(subtotalMinor * PLATFORM_FEE_RATE);
    const amountMinor = subtotalMinor + platformFeeMinor;
    const currency = String(tier.currency || 'INR').toUpperCase();
    const idempotencyKey = crypto.randomUUID();

    const pendingOrder = await Payment.create({
      userId: String(user.userId),
      userEmail: String(user.email || '').trim() || null,
      eventId: String(eventId),
      tierId: String(tierId),
      quantity: normalizedQuantity,
      currency,
      subtotalMinor,
      platformFeeMinor,
      amountMinor,
      idempotencyKey,
      status: 'PENDING',
      polarStatus: 'pending',
    });

    const returnBase = String(origin || this.clientUrl).replace(/\/$/, '');
    const successUrl = `${returnBase}/payments/pending?orderId=${pendingOrder._id}`;
    const cancelUrl = `${returnBase}/payments/pending?orderId=${pendingOrder._id}&cancelled=1`;

    try {
      const metadata = {
        orderId: String(pendingOrder._id),
        userId: String(user.userId),
        eventId: String(eventId),
        tierId: String(tierId),
        quantity: String(normalizedQuantity),
      };

      // One generic Polar product + ad-hoc checkout price per order.
      const checkout = await this.polar.checkouts.create({
        products: [this.polarProductId],
        prices: {
          [this.polarProductId]: [
            {
              amountType: 'fixed',
              priceAmount: amountMinor,
              priceCurrency: currency.toLowerCase(),
            },
          ],
        },
        successUrl,
        cancelUrl,
        metadata,
      });

      const selectedPrice = checkout?.productPrice || checkout?.product_price || {};
      const selectedSource = String(selectedPrice?.source || '').toLowerCase();
      const selectedAmount = Number(selectedPrice?.priceAmount ?? selectedPrice?.price_amount ?? NaN);
      const selectedCurrency = String(selectedPrice?.priceCurrency || selectedPrice?.price_currency || '').toLowerCase();

      // Protect against silent fallback to catalog/custom/free pricing.
      if (selectedSource !== 'ad_hoc' || selectedAmount !== amountMinor || selectedCurrency !== currency.toLowerCase()) {
        throw new Error(
          `Polar ad-hoc pricing mismatch. expected=${amountMinor} ${currency.toLowerCase()} source=ad_hoc, got=${selectedAmount} ${selectedCurrency} source=${selectedSource || 'unknown'}`
        );
      }

      const checkoutId = String(checkout?.id || checkout?.checkoutId || '').trim();
      const checkoutUrl = String(checkout?.url || checkout?.checkoutUrl || '').trim();
      if (!checkoutId || !checkoutUrl) {
        throw new Error('Polar checkout response was missing id or url.');
      }

      await Payment.findByIdAndUpdate(pendingOrder._id, {
        polarCheckoutId: checkoutId,
        polarCheckoutUrl: checkoutUrl,
        polarStatus: String(checkout?.status || 'pending').toLowerCase(),
      });

      return {
        requiresPayment: true,
        orderId: String(pendingOrder._id),
        checkoutId,
        checkoutUrl,
        subtotalMinor,
        platformFeeMinor,
        amountMinor,
        currency,
      };
    } catch (err) {
      await Payment.findByIdAndUpdate(pendingOrder._id, {
        status: 'FAILED',
        errorMessage: String(err?.message || 'Polar checkout creation failed.'),
      });
      throw AppError.serviceUnavailable('Unable to create checkout session. Please retry.');
    }
  }

  async getOrderStatusForUser(orderId, userId) {
    const order = await Payment.findOne({ _id: orderId, userId: String(userId) });
    if (!order) throw AppError.notFound('Payment order not found.');

    if (order.polarCheckoutId && (order.status === 'PENDING' || order.status === 'PROCESSING')) {
      await this.syncOrderFromPolar(order);
      return Payment.findById(order._id);
    }

    const withInvoice = await this.attachInvoiceState(order);
    return withInvoice || order;
  }

  async generateInvoiceForUserOrder(orderId, userId) {
    const order = await Payment.findOne({ _id: orderId, userId: String(userId) });
    if (!order) throw AppError.notFound('Payment order not found.');
    if (!this.polar) throw AppError.serviceUnavailable('Polar integration is not configured.');

    const normalizedStatus = String(order.status || '').toUpperCase();
    if (normalizedStatus !== 'COMPLETED') {
      throw AppError.badRequest('Invoice is available only after payment is completed.');
    }

    const polarOrderId = await this.resolvePolarOrderId(order);
    if (!polarOrderId) {
      throw AppError.notFound('Polar order not found for this payment yet. Please retry shortly.');
    }

    // Step 1: trigger generation (idempotent if already generated).
    await this.polar.orders.generateInvoice({ id: polarOrderId });

    // Step 2: fetch invoice URL if ready.
    const invoice = await this.tryFetchInvoice(polarOrderId);
    if (invoice?.url) {
      await Payment.findByIdAndUpdate(order._id, {
        polarOrderId,
        polarInvoiceGenerated: true,
        polarInvoiceUrl: invoice.url,
      });
      return { ready: true, url: invoice.url, polarOrderId };
    }

    await Payment.findByIdAndUpdate(order._id, {
      polarOrderId,
      polarInvoiceGenerated: false,
    });
    return { ready: false, polarOrderId };
  }

  async getInvoiceForUserOrder(orderId, userId) {
    const order = await Payment.findOne({ _id: orderId, userId: String(userId) });
    if (!order) throw AppError.notFound('Payment order not found.');
    if (!this.polar) throw AppError.serviceUnavailable('Polar integration is not configured.');

    const polarOrderId = await this.resolvePolarOrderId(order);
    if (!polarOrderId) {
      throw AppError.notFound('Polar order not found for this payment.');
    }

    const invoice = await this.tryFetchInvoice(polarOrderId);
    if (!invoice?.url) {
      throw AppError.notFound('Invoice not generated yet. Generate invoice first and retry.');
    }

    await Payment.findByIdAndUpdate(order._id, {
      polarOrderId,
      polarInvoiceGenerated: true,
      polarInvoiceUrl: invoice.url,
    });

    return { ready: true, url: invoice.url, polarOrderId };
  }

  async syncOrderFromPolar(order) {
    if (!order?.polarCheckoutId || !this.polarToken) return order;

    try {
      const response = await axios.get(`${this.polarApiBase}/checkouts/${order.polarCheckoutId}`, {
        headers: { Authorization: `Bearer ${this.polarToken}` },
        timeout: 6000,
      });
      const payload = response?.data || {};
      const rawStatus = String(payload?.status || payload?.checkout_status || '').toLowerCase();

      await Payment.findByIdAndUpdate(order._id, {
        polarStatus: rawStatus || order.polarStatus,
        rawLastPayload: payload,
      });

      if (TERMINAL_SUCCESS.has(rawStatus)) {
        return this.finalizePaidOrder(order._id, payload, 'poll');
      }

      if (TERMINAL_CANCEL.has(rawStatus)) {
        await Payment.findByIdAndUpdate(order._id, {
          status: 'CANCELLED',
          polarStatus: rawStatus,
          completedAt: new Date(),
        });
      }
    } catch {
      // Poll path is best-effort; keep order pending until webhook or next poll.
    }

    return Payment.findById(order._id);
  }

  async processWebhook(payload) {
    const data = payload?.data || payload || {};
    const metadata = data?.metadata || payload?.metadata || {};

    const checkoutId = String(data?.id || data?.checkout_id || data?.checkoutId || '').trim();
    const rawStatus = String(data?.status || payload?.status || '').toLowerCase();
    const orderIdFromMeta = String(metadata?.orderId || '').trim();

    let order = null;
    if (orderIdFromMeta) {
      order = await Payment.findById(orderIdFromMeta);
    }
    if (!order && checkoutId) {
      order = await Payment.findOne({ polarCheckoutId: checkoutId });
    }
    if (!order) return { accepted: true, ignored: true };

    await Payment.findByIdAndUpdate(order._id, {
      polarStatus: rawStatus || order.polarStatus,
      rawLastPayload: payload,
    });

    if (TERMINAL_SUCCESS.has(rawStatus)) {
      await this.finalizePaidOrder(order._id, payload, 'webhook');
    } else if (TERMINAL_CANCEL.has(rawStatus)) {
      await Payment.findByIdAndUpdate(order._id, {
        status: 'CANCELLED',
        completedAt: new Date(),
      });
    }

    return { accepted: true };
  }

  async finalizePaidOrder(orderId, payload = {}, source = 'system') {
    const locked = await Payment.findOneAndUpdate(
      { _id: orderId, status: { $in: ['PENDING', 'PROCESSING'] } },
      { status: 'PROCESSING' },
      { new: true }
    );

    if (!locked) {
      return Payment.findById(orderId);
    }

    try {
      const registrations = await this.registrationService.register(
        locked.userId,
        locked.userEmail,
        locked.eventId,
        locked.tierId,
        locked.quantity
      );

      await Payment.findByIdAndUpdate(locked._id, {
        status: 'COMPLETED',
        completedAt: new Date(),
        registrations: registrations.map((item) => ({
          registrationId: String(item?._id || item?.id || ''),
          status: String(item?.status || ''),
        })),
        rawLastPayload: payload,
        errorMessage: null,
        source,
      });

      await publishEvent(TOPICS.PAYMENT_LIFECYCLE, String(locked._id), {
        eventType: EVENT_TYPES.PAYMENT_COMPLETED,
        paymentId: String(locked._id),
        eventId: String(locked.eventId),
        tierId: String(locked.tierId),
        userId: String(locked.userId),
        quantity: Number(locked.quantity || 1),
        amountMinor: Number(locked.amountMinor || 0),
        currency: String(locked.currency || 'INR'),
        occurredAt: new Date().toISOString(),
      }).catch(() => undefined);
    } catch (err) {
      await Payment.findByIdAndUpdate(locked._id, {
        status: 'ALLOCATION_FAILED',
        errorMessage: String(err?.message || 'Could not finalize paid registration.'),
        rawLastPayload: payload,
      });

      await publishEvent(TOPICS.PAYMENT_LIFECYCLE, String(locked._id), {
        eventType: EVENT_TYPES.PAYMENT_ALLOCATION_FAILED,
        paymentId: String(locked._id),
        eventId: String(locked.eventId),
        tierId: String(locked.tierId),
        userId: String(locked.userId),
        quantity: Number(locked.quantity || 1),
        amountMinor: Number(locked.amountMinor || 0),
        currency: String(locked.currency || 'INR'),
        errorMessage: String(err?.message || 'Could not finalize paid registration.'),
        occurredAt: new Date().toISOString(),
      }).catch(() => undefined);
    }

    return Payment.findById(orderId);
  }

  async _fetchEvent(eventId) {
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await this.springClient.get(`/api/events/${eventId}`);
        return response?.data?.data ?? response?.data;
      } catch (err) {
        if (err?.response?.status === 404) {
          throw AppError.notFound(`Event ${eventId} not found.`);
        }
        lastError = err;
      }
    }

    throw AppError.internal(
      `Could not reach event service for checkout validation. Last error: ${lastError?.message || 'unknown'}`
    );
  }

  async resolvePolarOrderId(order) {
    if (!this.polar) return null;

    const existing = String(order?.polarOrderId || '').trim();
    if (existing) return existing;

    const localOrderId = String(order?._id || '').trim();
    if (!localOrderId) return null;

    const pages = await this.polar.orders.list({ limit: 50 });
    let cursor = pages;

    while (cursor) {
      const items = cursor?.result?.items || [];
      const matched = items.find((item) => String(item?.metadata?.orderId || '') === localOrderId);
      if (matched?.id) {
        const polarOrderId = String(matched.id);
        const invoiceGenerated = Boolean(matched?.isInvoiceGenerated ?? matched?.is_invoice_generated);
        await Payment.findByIdAndUpdate(order._id, {
          polarOrderId,
          polarInvoiceGenerated: invoiceGenerated,
        });
        return polarOrderId;
      }

      if (typeof cursor.next !== 'function') break;
      cursor = await cursor.next();
    }

    return null;
  }

  async tryFetchInvoice(polarOrderId) {
    try {
      return await this.polar.orders.invoice({ id: String(polarOrderId) });
    } catch (err) {
      const statusCode = Number(err?.statusCode || 0);
      if (statusCode === 404) return null;
      throw err;
    }
  }

  async attachInvoiceState(order) {
    if (!order || !this.polar) return order;

    const normalizedStatus = String(order.status || '').toUpperCase();
    if (normalizedStatus !== 'COMPLETED') return order;

    const polarOrderId = await this.resolvePolarOrderId(order);
    if (!polarOrderId) return order;

    const invoice = await this.tryFetchInvoice(polarOrderId);
    if (!invoice?.url) {
      if (order.polarInvoiceGenerated || order.polarInvoiceUrl) {
        await Payment.findByIdAndUpdate(order._id, {
          polarInvoiceGenerated: false,
          polarInvoiceUrl: null,
        });
      }
      return Payment.findById(order._id);
    }

    await Payment.findByIdAndUpdate(order._id, {
      polarOrderId,
      polarInvoiceGenerated: true,
      polarInvoiceUrl: invoice.url,
    });

    return Payment.findById(order._id);
  }

  async getPlatformFeeAggregatesForEvents(eventIds = []) {
    const normalizedEventIds = [...new Set(
      (Array.isArray(eventIds) ? eventIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )];

    if (normalizedEventIds.length === 0) {
      return [];
    }

    const rows = await Payment.aggregate([
      {
        $match: {
          eventId: { $in: normalizedEventIds },
          status: 'COMPLETED',
        },
      },
      {
        $addFields: {
          effectiveSubtotalMinor: {
            $ifNull: ['$subtotalMinor', '$amountMinor'],
          },
          effectivePlatformFeeMinor: {
            $ifNull: [
              '$platformFeeMinor',
              {
                $round: [
                  {
                    $multiply: [
                      { $ifNull: ['$subtotalMinor', '$amountMinor'] },
                      PLATFORM_FEE_RATE,
                    ],
                  },
                  0,
                ],
              },
            ],
          },
          effectiveAmountMinor: {
            $ifNull: [
              '$amountMinor',
              {
                $add: [
                  { $ifNull: ['$subtotalMinor', 0] },
                  { $ifNull: ['$platformFeeMinor', 0] },
                ],
              },
            ],
          },
          effectiveQuantity: {
            $ifNull: ['$quantity', 1],
          },
        },
      },
      {
        $group: {
          _id: '$eventId',
          subtotalMinor: { $sum: '$effectiveSubtotalMinor' },
          platformFeeMinor: { $sum: '$effectivePlatformFeeMinor' },
          chargedMinor: { $sum: '$effectiveAmountMinor' },
          paidOrderCount: { $sum: 1 },
          paidTicketCount: { $sum: '$effectiveQuantity' },
        },
      },
      {
        $project: {
          _id: 0,
          eventId: '$_id',
          subtotalMinor: 1,
          platformFeeMinor: 1,
          chargedMinor: 1,
          paidOrderCount: 1,
          paidTicketCount: 1,
        },
      },
    ]);

    return rows.map((row) => ({
      eventId: String(row?.eventId || ''),
      subtotalMinor: Number(row?.subtotalMinor || 0),
      platformFeeMinor: Number(row?.platformFeeMinor || 0),
      chargedMinor: Number(row?.chargedMinor || 0),
      paidOrderCount: Number(row?.paidOrderCount || 0),
      paidTicketCount: Number(row?.paidTicketCount || 0),
    }));
  }
}
