import httpClient from '@/shared/api/httpClient';

export const authApi = {
  register: (data) => httpClient.post('/auth/register', data),
  verifyEmail: (data) => httpClient.post('/auth/verify-email', data),
  resendOtp: (data) => httpClient.post('/auth/resend-otp', data),
  login: (data) => httpClient.post('/auth/login', data),
  refresh: () => httpClient.post('/auth/refresh'),
  logout: () => httpClient.delete('/auth/logout'),
  forgotPassword: (data) => httpClient.post('/auth/forgot-password', data),
  resetPassword: (data) => httpClient.post('/auth/reset-password', data),
  getMe: () => httpClient.get('/auth/me'),
  updateMe: (data) => httpClient.put('/auth/me', data),
  requestEmailChange: (data) => httpClient.post('/auth/me/email-change/request', data),
  confirmEmailChange: (data) => httpClient.post('/auth/me/email-change/confirm', data),
};

export const usersApi = {
  getAll: (params) => httpClient.get('/users', { params }),
  deleteUser: (id) => httpClient.delete(`/users/${id}`),
  changeRole: (id, role) => httpClient.patch(`/users/${id}/role`, { role }),
};

export const eventsApi = {
  getAll: (params) => httpClient.get('/events', { params }),
  getById: (id) => httpClient.get(`/events/${id}`),
  create: (data) => httpClient.post('/events', data),
  update: (id, data) => httpClient.put(`/events/${id}`, data),
  delete: (id) => httpClient.delete(`/events/${id}`),
  submit: (id) => httpClient.post(`/events/${id}/submit`),
  changeStatus: (id, status) => httpClient.patch(`/events/${id}/status`, { status }),
};

export const scheduleApi = {
  getByEvent: (eventId) => httpClient.get(`/schedule/${eventId}`),
  create: (eventId, data) => httpClient.post(`/schedule/${eventId}`, data),
  updateSlot: (slotId, data) => httpClient.put(`/schedule/slot/${slotId}`, data),
  deleteSlot: (slotId) => httpClient.delete(`/schedule/slot/${slotId}`),
};

export const venuesApi = {
  getAll: (params) => httpClient.get('/venues', { params }),
  getById: (id) => httpClient.get(`/venues/${id}`),
  getAvailability: (id) => httpClient.get(`/venues/${id}/availability`),
  create: (data) => httpClient.post('/venues', data),
  update: (id, data) => httpClient.put(`/venues/${id}`, data),
  delete: (id) => httpClient.delete(`/venues/${id}`),
  createBooking: (id, data) => httpClient.post(`/venues/${id}/bookings`, data),
  getBookings: (id) => httpClient.get(`/venues/${id}/bookings`),
  cancelBooking: (id) => httpClient.delete(`/venues/bookings/${id}`),
};

export const attendeesApi = {
  register: (data) => httpClient.post('/attendees/register', data),
  getMy: () => httpClient.get('/attendees/my'),
  cancel: (id) => httpClient.delete(`/attendees/${id}`),
  getByEvent: (eventId, params) => httpClient.get(`/attendees/event/${eventId}`, { params }),
  getCount: (eventId) => httpClient.get(`/attendees/event/${eventId}/count`),
  getWaitlistCount: (eventId) => httpClient.get(`/attendees/event/${eventId}/waitlist-count`),
  getCountBulk: (eventIds) => httpClient.post('/attendees/events/counts', { eventIds }),
  export: (eventId) => httpClient.get(`/attendees/event/${eventId}/export`, { responseType: 'blob' }),
  checkin: (data) => httpClient.post('/attendees/checkin', data),
};

export const paymentsApi = {
  getStatus: (orderId) => httpClient.get(`/payments/status/${orderId}`),
  generateInvoice: (orderId) => httpClient.post(`/payments/status/${orderId}/invoice`),
  getInvoice: (orderId) => httpClient.get(`/payments/status/${orderId}/invoice`),
};

export const budgetApi = {
  create: (eventId, data) => httpClient.post(`/budget/events/${eventId}`, data),
  get: (eventId) => httpClient.get(`/budget/events/${eventId}`),
  update: (eventId, data) => httpClient.put(`/budget/events/${eventId}`, data),
  addExpense: (eventId, data) => httpClient.post(`/budget/events/${eventId}/expenses`, data),
  getExpenses: (eventId) => httpClient.get(`/budget/events/${eventId}/expenses`),
  updateExpense: (id, data) => httpClient.put(`/budget/expenses/${id}`, data),
  deleteExpense: (id) => httpClient.delete(`/budget/expenses/${id}`),
};

export const reportsApi = {
  getEventReport: (eventId) => httpClient.get(`/reports/events/${eventId}`),
  getVendorOverview: () => httpClient.get('/reports/vendor/events'),
  getAdminOverview: () => httpClient.get('/reports/admin/events'),
};

export const notificationsApi = {
  getAll: (params) => httpClient.get('/notifications', { params }),
  getUnreadCount: () => httpClient.get('/notifications/unread-count'),
  markRead: (id) => httpClient.patch(`/notifications/${id}/read`),
  markAllRead: () => httpClient.patch('/notifications/read-all'),
};

export const uploadsApi = {
  getConfig: () => httpClient.get('/uploads/config'),
  uploadImage: (formData) => httpClient.post('/uploads/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteByUrl: (payload) => httpClient.delete('/uploads/delete', { data: payload }),
};

export const vendorApplicationsApi = {
  submit: (data) => httpClient.post('/vendor-applications', data),
  getMine: () => httpClient.get('/vendor-applications/me'),
  getAll: (params) => httpClient.get('/admin/vendor-applications', { params }),
  updateStatus: (id, data) => httpClient.patch(`/admin/vendor-applications/${id}/status`, data),
};

export const reviewsApi = {
  getByEvent: (eventId, params) => httpClient.get(`/reviews/event/${eventId}`, { params }),
  getMine: (eventId) => httpClient.get(`/reviews/event/${eventId}/mine`),
  create: (data) => httpClient.post('/reviews', data),
  update: (id, data) => httpClient.put(`/reviews/${id}`, data),
  delete: (id) => httpClient.delete(`/reviews/${id}`),
};
