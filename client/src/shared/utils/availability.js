function normalizeTimePart(time, fallback = '00:00') {
  const source = String((time && String(time).trim()) || fallback || '00:00').trim();
  const [rawHour = '00', rawMinute = '00', rawSecond = '00'] = source.split(':');

  const hour = Math.min(23, Math.max(0, Number.parseInt(rawHour, 10) || 0));
  const minute = Math.min(59, Math.max(0, Number.parseInt(rawMinute, 10) || 0));
  const second = Math.min(59, Math.max(0, Number.parseInt(rawSecond, 10) || 0));

  return {
    hour: String(hour).padStart(2, '0'),
    minute: String(minute).padStart(2, '0'),
    second: String(second).padStart(2, '0'),
  };
}

export function toIsoFromEventWindow(eventDate, time, fallback = '00:00') {
  if (!eventDate) return null;
  const parts = normalizeTimePart(time, fallback);
  return `${eventDate}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function toTimestamp(value) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

export function toTimestampFromEventWindow(eventDate, time, fallback = '00:00') {
  const iso = toIsoFromEventWindow(eventDate, time, fallback);
  return toTimestamp(iso);
}

export function isWindowOverlapping(aStart, aEnd, bStart, bEnd) {
  if (![aStart, aEnd, bStart, bEnd].every(Number.isFinite)) return false;
  return aStart < bEnd && bStart < aEnd;
}

export function normalizeEventAvailabilityByVenue(events, excludedEventId = null) {
  if (!Array.isArray(events)) return {};

  const byVenue = {};
  events.forEach((event) => {
    if (excludedEventId && String(event?.id) === String(excludedEventId)) return;
    const venueId = event?.venueId || event?.venue?.id;
    if (!venueId) return;
    if (String(event?.status || '').toUpperCase() === 'CANCELLED') return;

    const startTime = toIsoFromEventWindow(event.eventDate, event.startTime, '00:00');
    const endTime = toIsoFromEventWindow(event.eventDate, event.endTime, '23:59');
    if (!startTime || !endTime) return;

    const startTs = toTimestamp(startTime);
    const endTs = toTimestamp(endTime);
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || startTs >= endTs) return;

    const key = String(venueId);
    if (!byVenue[key]) byVenue[key] = [];
    byVenue[key].push({
      id: `event-${event.id}`,
      startTime,
      endTime,
      eventId: event.id,
      eventTitle: event.title || `Event #${event.id}`,
      source: 'EVENT',
      status: event.status,
    });
  });

  return byVenue;
}

export function normalizeEventAvailabilityForVenue(events, activeVenueId) {
  if (!Array.isArray(events) || !activeVenueId) return [];

  return events
    .filter((event) => String(event?.venueId || event?.venue?.id) === String(activeVenueId))
    .filter((event) => String(event?.status || '').toUpperCase() !== 'CANCELLED')
    .map((event) => ({
      id: `event-${event.id}`,
      startTime: toIsoFromEventWindow(event.eventDate, event.startTime, '00:00'),
      endTime: toIsoFromEventWindow(event.eventDate, event.endTime, '23:59'),
      eventId: event.id,
      eventTitle: event.title || `Event #${event.id}`,
      status: event.status,
      source: 'EVENT',
    }))
    .filter((row) => {
      const startTs = toTimestamp(row.startTime);
      const endTs = toTimestamp(row.endTime);
      return Number.isFinite(startTs) && Number.isFinite(endTs) && startTs < endTs;
    });
}

export function formatWindowDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatWindowTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
