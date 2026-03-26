import AppError from '../utils/AppError.js';
import { PaymentService } from '../services/PaymentService.js';

const paymentSvc = new PaymentService();

export class PaymentController {
  async getStatus(req, res, next) {
    try {
      const order = await paymentSvc.getOrderStatusForUser(req.params.orderId, req.user.userId);
      res.json({
        success: true,
        data: {
          orderId: String(order._id),
          status: order.status,
          polarStatus: order.polarStatus,
          polarOrderId: order.polarOrderId,
          checkoutUrl: order.polarCheckoutUrl,
          invoiceGenerated: Boolean(order.polarInvoiceGenerated),
          invoiceUrl: order.polarInvoiceUrl,
          eventId: order.eventId,
          tierId: order.tierId,
          quantity: order.quantity,
          subtotalMinor: order.subtotalMinor,
          platformFeeMinor: order.platformFeeMinor,
          chargedMinor: order.amountMinor,
          completedAt: order.completedAt,
          errorMessage: order.errorMessage,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async webhook(req, res, next) {
    try {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        throw AppError.badRequest('Invalid webhook payload.');
      }

      const result = await paymentSvc.processWebhook(body);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async generateInvoice(req, res, next) {
    try {
      const result = await paymentSvc.generateInvoiceForUserOrder(req.params.orderId, req.user.userId);
      res.status(result.ready ? 200 : 202).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getInvoice(req, res, next) {
    try {
      const result = await paymentSvc.getInvoiceForUserOrder(req.params.orderId, req.user.userId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getPlatformFeeAggregatesInternal(req, res, next) {
    try {
      const { eventIds } = req.body || {};
      if (!Array.isArray(eventIds) || eventIds.length === 0) {
        throw AppError.badRequest('eventIds (non-empty array) is required.');
      }

      const normalizedEventIds = eventIds
        .map((id) => String(id || '').trim())
        .filter(Boolean);

      if (normalizedEventIds.length === 0) {
        throw AppError.badRequest('eventIds must contain at least one valid event id.');
      }

      const aggregates = await paymentSvc.getPlatformFeeAggregatesForEvents(normalizedEventIds);
      res.status(200).json({ success: true, data: aggregates });
    } catch (err) {
      next(err);
    }
  }
}
