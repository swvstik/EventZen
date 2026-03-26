import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  if (!isValid(date)) return '-';
  return format(date, 'MMM d, yyyy');
};

export const formatTime = (timeStr) => {
  if (!timeStr) return '-';
  // Handle HH:mm:ss or HH:mm format
  const [h, m] = timeStr.split(':');
  const date = new Date();
  date.setHours(parseInt(h, 10), parseInt(m, 10));
  return format(date, 'h:mm a');
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  if (!isValid(date)) return '-';
  return format(date, 'MMM d, yyyy - h:mm a');
};

export const formatRelative = (dateStr) => {
  if (!dateStr) return '-';
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  if (!isValid(date)) return '-';
  return formatDistanceToNow(date, { addSuffix: true });
};

export const formatCurrency = (amount, currency = 'INR') => {
  if (amount == null) return '-';
  const normalizedCurrency = typeof currency === 'string' ? currency.toUpperCase() : 'INR';

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }
};

export const formatPercent = (value) => {
  if (value == null) return '-';
  return `${Math.round(value)}%`;
};

export const formatNumber = (num) => {
  if (num == null) return '0';
  return new Intl.NumberFormat('en-IN').format(num);
};
