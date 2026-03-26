import { VendorApplicationService } from '../services/VendorApplicationService.js';
import AppError from '../utils/AppError.js';

export class VendorApplicationController {
  constructor() {
    this.vendorAppService = new VendorApplicationService();
  }

  async submit(req, res, next) {
    try {
      const { businessName, serviceTypes, portfolioUrl, notes } = req.body;
      if (!businessName || String(businessName).trim().length < 2) {
        throw AppError.badRequest('businessName is required (min 2 chars).');
      }
      if (!Array.isArray(serviceTypes) || serviceTypes.length === 0) {
        throw AppError.badRequest('serviceTypes is required and must be a non-empty array.');
      }

      const result = await this.vendorAppService.submitApplication({
        actor: req.user,
        businessName,
        serviceTypes,
        portfolioUrl,
        notes,
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getMine(req, res, next) {
    try {
      const result = await this.vendorAppService.getMyApplications(req.user.userId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async listForAdmin(req, res, next) {
    try {
      const { status, page = 0, limit = 20 } = req.query;
      const result = await this.vendorAppService.listApplications({ status, page, limit });
      res.status(200).json({ success: true, data: result, ...result });
    } catch (err) {
      next(err);
    }
  }

  async review(req, res, next) {
    try {
      const { status, reviewReason } = req.body;
      if (!status) throw AppError.badRequest('status is required.');
      if (reviewReason && String(reviewReason).trim().length > 2000) {
        throw AppError.badRequest('reviewReason must not exceed 2000 characters.');
      }

      const result = await this.vendorAppService.reviewApplication({
        id: req.params.id,
        status,
        reviewReason,
        adminUserId: req.user.userId,
      });

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
