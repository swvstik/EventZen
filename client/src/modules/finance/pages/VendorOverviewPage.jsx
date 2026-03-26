import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { reportsApi } from '@/shared/api';
import { formatCurrency } from '@/shared/utils/formatters';
import { PageHeader, ErrorState } from '@/shared/ui';
import { buildRevenueMetricsForEvents, fetchAllEventsForReports } from '@/shared/utils/financeMetrics';
import useAuthStore from '@/shared/store/authStore';

export default function VendorOverviewPage() {
  const { user } = useAuthStore();
  const currentUserId = user?.userId || user?.id || user?._id || null;

  const { data: allEventsData = [] } = useQuery({
    queryKey: ['vendor-overview-all-events'],
    queryFn: fetchAllEventsForReports,
    refetchInterval: 60000,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vendor-overview'],
    queryFn: () => reportsApi.getVendorOverview().then(r => r.data),
    refetchInterval: 15000,
  });

  const events = Array.isArray(data) ? data : (data?.events || []);
  const normalizedEvents = events.map((e) => ({
    ...e,
    title: e.title || e.eventTitle || `Event ${e.eventId || ''}`.trim(),
    status: e.status || e.eventStatus || 'UNKNOWN',
    category: e.category || e.eventCategory || 'General',
  }));

  const normalizedAllEvents = (Array.isArray(allEventsData) ? allEventsData : [])
    .filter((event) => String(event?.vendorUserId || '') === String(currentUserId || ''))
    .map((event) => ({
      eventId: event.id,
      title: event.title || `Event ${event.id}`,
      status: event.status || 'UNKNOWN',
      category: event.category || 'General',
      totalAllocated: 0,
      totalSpent: 0,
      remaining: 0,
      percentUsed: 0,
      overspendWarning: false,
      currency: 'INR',
      expenseCount: 0,
    }));

  const budgetByEventId = new Map(
    normalizedEvents
      .filter((event) => event.eventId)
      .map((event) => [String(event.eventId), event])
  );

  const mergedEvents = normalizedAllEvents.map((event) => ({
    ...event,
    ...(budgetByEventId.get(String(event.eventId)) || {}),
  }));

  const orphanBudgetEvents = normalizedEvents.filter(
    (event) => !normalizedAllEvents.some((allEvent) => String(allEvent.eventId) === String(event.eventId))
  );

  const reportEvents = [...mergedEvents, ...orphanBudgetEvents];

  const eventIds = reportEvents
    .map((e) => e.eventId)
    .filter(Boolean)
    .map(String)
    .sort();

  const { data: revenueByEvent = {} } = useQuery({
    queryKey: ['vendor-overview-ticket-revenue', eventIds],
    queryFn: () => buildRevenueMetricsForEvents(reportEvents),
    enabled: reportEvents.length > 0,
    staleTime: 30000,
  });

  const enrichedEvents = reportEvents.map((e) => {
    const rev = revenueByEvent[String(e.eventId)] || { ticketRevenue: 0, ticketsSold: 0 };
    return {
      ...e,
      ticketRevenue: rev.ticketRevenue,
      ticketsSold: rev.ticketsSold,
      profitOrLoss: Number(rev.ticketRevenue || 0) - Number(e.totalSpent || 0),
    };
  });

  const totalTicketRevenue = enrichedEvents.reduce((sum, e) => sum + Number(e.ticketRevenue || 0), 0);
  const totalSpent = enrichedEvents.reduce((sum, e) => sum + Number(e.totalSpent || 0), 0);
  const overallProfitOrLoss = totalTicketRevenue - totalSpent;
  const totalEventsHosted = enrichedEvents.length;
  const totalTicketsSold = enrichedEvents.reduce((sum, e) => sum + Number(e.ticketsSold || 0), 0);
  const averageRevenuePerEvent = totalEventsHosted > 0 ? totalTicketRevenue / totalEventsHosted : 0;
  const averageSpendPerEvent = totalEventsHosted > 0 ? totalSpent / totalEventsHosted : 0;
  const avgMargin = totalTicketRevenue > 0
    ? ((overallProfitOrLoss / totalTicketRevenue) * 100)
    : 0;

  const topByRevenue = [...enrichedEvents]
    .sort((a, b) => Number(b.ticketRevenue || 0) - Number(a.ticketRevenue || 0))
    .slice(0, 5);

  return (
    <div>
      <PageHeader title="Vendor Reports" subtitle="Financial overview of your events" />

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="neo-card h-64" /><div className="neo-card h-48" />
        </div>
      ) : error ? (
        <ErrorState message="Could not load reports" onRetry={refetch} />
      ) : enrichedEvents.length === 0 ? (
        <div className="neo-card neo-card-no-hover p-8 text-center">
          <p className="font-heading text-lg uppercase">No Events Yet</p>
          <p className="font-body text-sm text-neo-black/65 mt-2">Create and manage events to see reports here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="neo-card neo-card-no-hover p-4 bg-neo-yellow/30">
              <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Events Hosted</p>
              <p className="font-heading text-lg mt-1">{totalEventsHosted}</p>
            </div>
            <div className="neo-card neo-card-no-hover p-4 bg-neo-cream">
              <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Tickets Sold</p>
              <p className="font-heading text-lg mt-1">{totalTicketsSold}</p>
            </div>
            <div className="neo-card neo-card-no-hover p-4 bg-neo-yellow/30">
              <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Ticket Revenue</p>
              <p className="font-heading text-lg mt-1">{formatCurrency(totalTicketRevenue)}</p>
            </div>

            <div className="neo-card neo-card-no-hover p-4 bg-neo-lavender/30">
              <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Operational Spend</p>
              <p className="font-heading text-lg mt-1">{formatCurrency(totalSpent)}</p>
            </div>
            <div className={`neo-card neo-card-no-hover p-4 ${overallProfitOrLoss >= 0 ? 'bg-neo-green/30' : 'bg-neo-red/20'}`}>
              <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Overall Evaluation</p>
              <p className="font-heading text-lg mt-1">
                {overallProfitOrLoss >= 0 ? 'Profit' : 'Loss'} - {formatCurrency(Math.abs(overallProfitOrLoss))}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="neo-card neo-card-no-hover p-4 bg-neo-white">
              <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Avg Revenue / Event</p>
              <p className="font-heading text-lg mt-1">{formatCurrency(averageRevenuePerEvent)}</p>
            </div>
            <div className="neo-card neo-card-no-hover p-4 bg-neo-white">
              <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Avg Spend / Event</p>
              <p className="font-heading text-lg mt-1">{formatCurrency(averageSpendPerEvent)}</p>
            </div>
            <div className="neo-card neo-card-no-hover p-4 bg-neo-white">
              <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Average Margin</p>
              <p className={`font-heading text-lg mt-1 ${avgMargin >= 0 ? 'text-neo-green' : 'text-neo-red'}`}>
                {avgMargin.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="neo-card neo-card-no-hover p-6">
            <h3 className="font-heading text-sm uppercase mb-4">Budget Usage by Event</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={enrichedEvents}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="title" tick={{ fontSize: 10, fontFamily: '"Anonymous Pro"' }} />
                <YAxis tick={{ fontSize: 10, fontFamily: '"Anonymous Pro"' }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="totalAllocated" fill="#4361EE" stroke="#1A1A2E" strokeWidth={2} name="Allocated" />
                <Bar dataKey="totalSpent" fill="#E63946" stroke="#1A1A2E" strokeWidth={2} name="Spent" />
                <Bar dataKey="ticketRevenue" fill="#06D6A0" stroke="#1A1A2E" strokeWidth={2} name="Ticket Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="neo-card neo-card-no-hover p-6">
            <h3 className="font-heading text-sm uppercase mb-4">Top Revenue Events</h3>
            {topByRevenue.length === 0 ? (
              <p className="font-body text-xs text-neo-black/65">No revenue events yet.</p>
            ) : (
              <div className="space-y-2">
                {topByRevenue.map((event) => (
                  <div key={`top-${event.eventId}`} className="neo-card neo-card-no-hover p-3 flex items-center justify-between">
                    <div>
                      <p className="font-heading text-xs uppercase tracking-wider">{event.title}</p>
                      <p className="font-body text-[10px] text-neo-black/65">{event.category} - {event.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-heading text-xs">{formatCurrency(event.ticketRevenue || 0)}</p>
                      <p className="font-body text-[10px] text-neo-black/65">{Number(event.ticketsSold || 0)} sold</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {enrichedEvents.map((e, i) => (
              <div key={i} className="neo-card neo-card-no-hover p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-heading text-xs uppercase tracking-wider">{e.title}</p>
                    <p className="font-body text-[10px] text-neo-black/65">{e.category} - {e.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-sm">{formatCurrency(e.totalSpent || 0)} / {formatCurrency(e.totalAllocated || 0)}</p>
                    <p className="font-body text-[10px] text-neo-black/65">Revenue {formatCurrency(e.ticketRevenue || 0)} - Sold {e.ticketsSold || 0}</p>
                    <p className={`font-body text-[10px] ${(e.profitOrLoss || 0) >= 0 ? 'text-neo-green' : 'text-neo-red'}`}>
                      {(e.profitOrLoss || 0) >= 0 ? 'Profit' : 'Loss'} {formatCurrency(Math.abs(e.profitOrLoss || 0))}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {e.eventId && (
                    <>
                      <Link to={`/admin/events/${e.eventId}/attendees`} className="neo-btn neo-btn-sm bg-neo-blue text-white">
                        Open Attendees
                      </Link>
                      <Link to={`/admin/events/${e.eventId}/budget`} className="neo-btn neo-btn-sm bg-neo-white">
                        Open Budget
                      </Link>
                      <Link to={`/admin/events/${e.eventId}/edit`} className="neo-btn neo-btn-sm bg-neo-white">
                        View Event Report
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
