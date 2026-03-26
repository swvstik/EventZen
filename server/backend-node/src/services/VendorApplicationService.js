import { VendorApplicationRepository } from '../repositories/VendorApplicationRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { NotificationService } from './NotificationService.js';
import AppError from '../utils/AppError.js';

const REVIEWABLE = new Set(['APPROVED', 'REJECTED']);

export class VendorApplicationService {
  constructor() {
    this.appRepo = new VendorApplicationRepository();
    this.userRepo = new UserRepository();
    this.notifSvc = new NotificationService();
  }

  async submitApplication({ actor, businessName, serviceTypes, portfolioUrl, notes }) {
    if (!actor?.userId) throw AppError.unauthorized('Authentication required.');

    const user = await this.userRepo.findById(actor.userId);
    if (!user) throw AppError.notFound('User not found.');

    if (user.role === 'VENDOR' || user.role === 'ADMIN') {
      throw AppError.badRequest('Only customers can apply to become a vendor.');
    }

    const pending = await this.appRepo.findPendingByUserId(actor.userId);
    if (pending) {
      throw AppError.conflict('You already have a pending vendor application.');
    }

    try {
      const created = await this.appRepo.create({
        userId: actor.userId,
        businessName: businessName.trim(),
        serviceTypes: Array.isArray(serviceTypes)
          ? serviceTypes.map((item) => String(item).trim()).filter(Boolean)
          : [],
        portfolioUrl: portfolioUrl ? String(portfolioUrl).trim() : null,
        notes: notes ? String(notes).trim() : null,
        status: 'PENDING',
      });

      const admins = await this.userRepo.findByRole('ADMIN');
      await Promise.allSettled(
        (admins || []).map((admin) => this.notifSvc.createNotification(
          admin._id.toString(),
          '0',
          'VENDOR_APPLICATION_SUBMITTED',
          `New vendor application submitted by ${user.name || user.email}.`
        ))
      );

      return created;
    } catch (err) {
      if (err?.code === 11000 && String(err?.message || '').includes('unique_pending_vendor_application')) {
        throw AppError.conflict('You already have a pending vendor application.');
      }
      throw err;
    }
  }

  async getMyApplications(userId) {
    return this.appRepo.findByUserId(userId);
  }

  async listApplications({ status, page = 0, limit = 20 }) {
    return this.appRepo.findAll({ status, page, limit });
  }

  async reviewApplication({ id, status, reviewReason, adminUserId }) {
    if (!REVIEWABLE.has(status)) {
      throw AppError.badRequest('status must be APPROVED or REJECTED.');
    }

    const app = await this.appRepo.findById(id);
    if (!app) throw AppError.notFound('Vendor application not found.');

    if (app.status !== 'PENDING') {
      throw AppError.conflict(`Application already ${app.status.toLowerCase()}.`);
    }

    const updates = {
      status,
      reviewReason: reviewReason ? String(reviewReason).trim() : null,
      reviewedByUserId: adminUserId,
      reviewedAt: new Date(),
    };

    const updated = await this.appRepo.updateById(id, updates);

    if (status === 'APPROVED') {
      await this.userRepo.updateRole(app.userId, 'VENDOR');
      await this.notifSvc.createNotification(
        app.userId,
        '0',
        'VENDOR_APPLICATION_APPROVED',
        'Your vendor application was approved. Your account is now a vendor account.'
      );
    } else {
      await this.notifSvc.createNotification(
        app.userId,
        '0',
        'VENDOR_APPLICATION_REJECTED',
        updates.reviewReason
          ? `Your vendor application was rejected. Reason: ${updates.reviewReason}`
          : 'Your vendor application was rejected. You can apply again after making updates.'
      );
    }

    return updated;
  }
}
