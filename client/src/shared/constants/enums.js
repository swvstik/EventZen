// Event status
export const EVENT_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  PUBLISHED: 'PUBLISHED',
  ONGOING: 'ONGOING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const EVENT_STATUS_COLORS = {
  DRAFT: { bg: 'bg-neo-lavender', text: 'text-neo-black', border: 'border-neo-orange' },
  PENDING_APPROVAL: { bg: 'bg-neo-orange', text: 'text-white', border: 'border-neo-orange' },
  PUBLISHED: { bg: 'bg-neo-blue', text: 'text-white', border: 'border-neo-blue' },
  ONGOING: { bg: 'bg-neo-green', text: 'text-neo-black', border: 'border-neo-green' },
  COMPLETED: { bg: 'bg-neo-purple', text: 'text-white', border: 'border-neo-purple' },
  CANCELLED: { bg: 'bg-neo-red', text: 'text-white', border: 'border-neo-red' },
};

// Registration status
export const REGISTRATION_STATUS = {
  REGISTERED: 'REGISTERED',
  CANCELLED: 'CANCELLED',
  CHECKED_IN: 'CHECKED_IN',
  WAITLISTED: 'WAITLISTED',
};

export const REGISTRATION_STATUS_COLORS = {
  REGISTERED: { bg: 'bg-neo-green', text: 'text-neo-black' },
  CANCELLED: { bg: 'bg-neo-red', text: 'text-white' },
  CHECKED_IN: { bg: 'bg-neo-blue', text: 'text-white' },
  WAITLISTED: { bg: 'bg-neo-yellow', text: 'text-neo-black' },
};

// Assignment status
export const ASSIGNMENT_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

// Vendor application status
export const APPLICATION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
};

// Event categories
export const EVENT_CATEGORIES = [
  'TECH', 'MUSIC', 'FOOD', 'SPORTS', 'BUSINESS', 'ARTS', 'OTHER',
];

export const CATEGORY_COLORS = {
  TECH: 'bg-neo-blue',
  MUSIC: 'bg-neo-pink',
  FOOD: 'bg-neo-orange',
  SPORTS: 'bg-neo-green',
  BUSINESS: 'bg-neo-purple',
  ARTS: 'bg-neo-orange',
  OTHER: 'bg-neo-lavender',
};

// Expense categories
export const EXPENSE_CATEGORIES = [
  'VENUE', 'CATERING', 'MARKETING', 'STAFF',
  'AV_EQUIPMENT', 'DECORATION', 'TRANSPORT', 'MISCELLANEOUS',
];

// Vendor service types
export const VENDOR_SERVICE_TYPES = [
  'GENERAL',
  'CATERING', 'AV', 'DECORATION', 'PHOTOGRAPHY',
  'SECURITY', 'TRANSPORT', 'OTHER',
];

// Roles
export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  VENDOR: 'VENDOR',
  ADMIN: 'ADMIN',
};
