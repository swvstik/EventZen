import VendorApplication from '../models/VendorApplication.js';

export class VendorApplicationRepository {
  async create(data) {
    return VendorApplication.create(data);
  }

  async findById(id) {
    return VendorApplication.findById(id);
  }

  async findPendingByUserId(userId) {
    return VendorApplication.findOne({ userId, status: 'PENDING' });
  }

  async findByUserId(userId) {
    return VendorApplication.find({ userId }).sort({ createdAt: -1 });
  }

  async findLatestApprovedByUserId(userId) {
    return VendorApplication.findOne({ userId, status: 'APPROVED' }).sort({ reviewedAt: -1, createdAt: -1 });
  }

  async findAll({ status, page = 0, limit = 20 } = {}) {
    const filter = {};
    if (status) filter.status = status;

    const skip = Number(page) * Number(limit);
    const [applications, total] = await Promise.all([
      VendorApplication.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      VendorApplication.countDocuments(filter),
    ]);

    return {
      applications,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      page: Number(page),
    };
  }

  async updateById(id, updates) {
    return VendorApplication.findByIdAndUpdate(id, updates, { new: true });
  }
}
