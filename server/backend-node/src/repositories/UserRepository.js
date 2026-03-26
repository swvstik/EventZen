import User from '../models/User.js';

/**
 * UserRepository
 * All Mongoose queries for the users collection live here.
 * Services call these methods - no Mongoose code outside this class.
 */
export class UserRepository {

  async findByEmail(email) {
    return User.findOne({ email: email.toLowerCase().trim() });
  }

  // Includes passwordHash - used only in login and password reset
  async findByEmailWithPassword(email) {
    return User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
  }

  async findById(id) {
    return User.findById(id);
  }

  async findByRole(role) {
    return User.find({ role: String(role || '').toUpperCase().trim() });
  }

  async create(data) {
    return User.create(data);
  }

  async updateById(id, data) {
    return User.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async updateRole(id, role) {
    return User.findByIdAndUpdate(id, { role }, { new: true });
  }

  async setEmailVerified(id) {
    return User.findByIdAndUpdate(id, { isEmailVerified: true }, { new: true });
  }

  async deleteById(id) {
    return User.findByIdAndDelete(id);
  }

  async findAll({ page = 0, limit = 20, q = '' } = {}) {
    const skip = page * limit;
    const normalizedQuery = String(q || '').trim();
    const filter = normalizedQuery
      ? {
          $or: [
            { name: { $regex: normalizedQuery, $options: 'i' } },
            { email: { $regex: normalizedQuery, $options: 'i' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    return { users, total, totalPages: Math.ceil(total / limit), page: Number(page) };
  }
}
