import { attendeesApi, eventsApi } from '@/shared/api';

const EVENTS_FETCH_PAGE_SIZE = 200;
const EVENTS_FETCH_MAX_PAGES = 6;

export async function fetchAllEventsForReports() {
  const rows = [];
  for (let page = 0; page < EVENTS_FETCH_MAX_PAGES; page += 1) {
    const response = await eventsApi.getAll({ page, limit: EVENTS_FETCH_PAGE_SIZE });
    const payload = response?.data || {};
    const pageRows = Array.isArray(payload?.events) ? payload.events : [];
    rows.push(...pageRows);

    const totalPages = Number(payload?.totalPages || 0);
    if (pageRows.length === 0 || (totalPages > 0 && page >= totalPages - 1)) {
      break;
    }
  }
  return rows;
}

export async function buildRevenueMetricsForEvents(events) {
  const eventIds = [...new Set(
    events.map((e) => e.eventId).filter(Boolean).map(String)
  )];

  if (eventIds.length === 0) return {};

  const [countsRes, eventPairs] = await Promise.all([
    attendeesApi.getCountBulk(eventIds).catch(() => ({ data: [] })),
    Promise.all(eventIds.map(async (eventId) => {
      try {
        const eventRes = await eventsApi.getById(eventId);
        const eventPayload = eventRes?.data || eventRes || null;
        return [String(eventId), eventPayload];
      } catch {
        return [String(eventId), null];
      }
    })),
  ]);

  const countsPayload = countsRes?.data || countsRes || [];
  const counts = Array.isArray(countsPayload)
    ? countsPayload
    : (Array.isArray(countsPayload?.data) ? countsPayload.data : []);
  const countsByEvent = counts.reduce((acc, row) => {
    const key = String(row.eventId || '');
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const eventById = Object.fromEntries(eventPairs);

  const metrics = eventIds.map((eventId) => {
    const event = eventById[eventId];
    const eventCounts = countsByEvent[eventId] || [];
    const tierCountById = new Map(eventCounts.map((c) => [String(c.tierId), Number(c.count || 0)]));
    const tiers = Array.isArray(event?.ticketTiers) ? event.ticketTiers : [];

    const ticketRevenue = tiers.reduce((sum, tier) => {
      const sold = tierCountById.get(String(tier.id)) || 0;
      return sum + sold * Number(tier.price || 0);
    }, 0);
    const ticketsSold = eventCounts.reduce((sum, c) => sum + Number(c.count || 0), 0);

    return { eventId, ticketRevenue, ticketsSold };
  });

  return metrics.reduce((acc, item) => {
    if (item.eventId) acc[item.eventId] = item;
    return acc;
  }, {});
}
