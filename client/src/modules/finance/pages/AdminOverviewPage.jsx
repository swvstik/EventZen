import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { reportsApi } from '@/shared/api';
import { formatCurrency } from '@/shared/utils/formatters';
import { PageHeader, ErrorState } from '@/shared/ui';
import { buildRevenueMetricsForEvents, fetchAllEventsForReports } from '@/shared/utils/financeMetrics';

const COLORS = ['#FFD600', '#E63946', '#4361EE', '#06D6A0', '#F97316', '#8B5CF6', '#22D3EE', '#A3E635'];

export default function AdminOverviewPage() {
  const { data: allEventsData = [] } = useQuery({
    queryKey: ['admin-overview-all-events'],
    queryFn: fetchAllEventsForReports,
    refetchInterval: 60000,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => reportsApi.getAdminOverview().then(r => r.data),
    refetchInterval: 60000,
  });

  const events = Array.isArray(data) ? data : (data?.events || []);
  const normalizedEvents = events.map((e) => ({
    ...e,
    title: e.title || e.eventTitle || `Event ${e.eventId || ''}`.trim(),
    status: e.status || e.eventStatus || 'UNKNOWN',
    category: e.category || e.eventCategory || 'General',
  }));

  const normalizedAllEvents = (Array.isArray(allEventsData) ? allEventsData : []).map((event) => ({
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
    queryKey: ['admin-overview-ticket-revenue', eventIds],
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

  const totalAllocated = enrichedEvents.reduce((s, e) => s + (e.totalAllocated || 0), 0);
  const totalSpent = enrichedEvents.reduce((s, e) => s + (e.totalSpent || 0), 0);
  const totalTicketRevenue = enrichedEvents.reduce((s, e) => s + (e.ticketRevenue || 0), 0);
  const platformGain = enrichedEvents.reduce((s, e) => s + Number(e.platformFeeCollected || 0), 0);
  const totalTicketsSold = enrichedEvents.reduce((s, e) => s + Number(e.ticketsSold || 0), 0);
  const overallProfitOrLoss = totalTicketRevenue - totalSpent;
  const totalRemaining = totalAllocated - totalSpent;
  const overspendCount = enrichedEvents.filter((e) => Number(e.totalSpent || 0) > Number(e.totalAllocated || 0)).length;
  const highBurnCount = enrichedEvents.filter((e) => Number(e.percentUsed || 0) >= 75 && Number(e.totalAllocated || 0) > 0).length;
  const profitableCount = enrichedEvents.filter((e) => Number(e.profitOrLoss || 0) >= 0).length;
  const profitRate = enrichedEvents.length > 0 ? Math.round((profitableCount / enrichedEvents.length) * 100) : 0;

  const statusDistribution = reportEvents.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusDistribution).map(([name, value]) => ({ name, value }));

  const profitabilityRows = [...enrichedEvents]
    .sort((a, b) => Number(b.profitOrLoss || 0) - Number(a.profitOrLoss || 0))
    .slice(0, 8);

  const riskRows = [...enrichedEvents]
    .sort((a, b) => Number(b.percentUsed || 0) - Number(a.percentUsed || 0))
    .slice(0, 8);

  return (
    <div>
      <PageHeader title="Admin Reports" subtitle="System-wide financial overview" />

      {isLoading ? (
        <div className="animate-pulse space-y-4"><div className="neo-card h-48" /><div className="neo-card h-64" /></div>
      ) : error ? (
        <ErrorState message="Could not load reports" onRetry={refetch} />
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Events', value: reportEvents.length, color: 'bg-neo-yellow' },
              { label: 'Total Allocated', value: formatCurrency(totalAllocated), color: 'bg-neo-blue' },
              { label: 'Total Spent', value: formatCurrency(totalSpent), color: 'bg-neo-pink' },
              { label: 'Remaining', value: formatCurrency(totalRemaining), color: 'bg-neo-green' },
              { label: 'Tickets Sold', value: totalTicketsSold, color: 'bg-neo-cream' },
            ].map(s => (
              <div key={s.label} className={`${s.color} border-3 border-neo-black shadow-neo p-4 text-center`}>
                <p className="font-heading text-xl">{s.value}</p>
                <p className="font-heading text-[10px] uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="neo-card neo-card-no-hover p-4 bg-neo-yellow/30">
              <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Ticket Revenue</p>
              <p className="font-heading text-lg mt-1">{formatCurrency(totalTicketRevenue)}</p>
            </div>
            <div className="neo-card neo-card-no-hover p-4 bg-neo-orange/20">
              <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">EventZen Platform Gain (10%)</p>
              <p className="font-heading text-lg mt-1">{formatCurrency(platformGain)}</p>
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
              <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Over Budget Events</p>
              <p className="font-heading text-xl mt-1 text-neo-red">{overspendCount}</p>
            </div>
            <div className="neo-card neo-card-no-hover p-4 bg-neo-white">
              <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">High Burn (75%+)</p>
              <p className="font-heading text-xl mt-1">{highBurnCount}</p>
            </div>
            <div className="neo-card neo-card-no-hover p-4 bg-neo-white">
              <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Profitable Events</p>
              <p className="font-heading text-xl mt-1">{profitRate}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Budget chart */}
            <div className="neo-card neo-card-no-hover p-6">
              <h3 className="font-heading text-sm uppercase mb-4">Budget by Event</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={enrichedEvents.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="title" tick={{ fontSize: 9, fontFamily: '"Anonymous Pro"' }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10, fontFamily: '"Anonymous Pro"' }} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="totalAllocated" fill="#4361EE" stroke="#1A1A2E" strokeWidth={2} name="Allocated" />
                  <Bar dataKey="totalSpent" fill="#E63946" stroke="#1A1A2E" strokeWidth={2} name="Spent" />
                  <Bar dataKey="ticketRevenue" fill="#06D6A0" stroke="#1A1A2E" strokeWidth={2} name="Ticket Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Status distribution */}
            {statusData.length > 0 && (
              <div className="neo-card neo-card-no-hover p-6">
                <h3 className="font-heading text-sm uppercase mb-4">Event Status Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                      stroke="#1A1A2E" strokeWidth={2}>
                      {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="neo-card neo-card-no-hover p-6">
              <h3 className="font-heading text-sm uppercase mb-4">Top Profitability Events</h3>
              {profitabilityRows.length === 0 ? (
                <p className="font-body text-xs text-neo-black/65">No profitability data yet.</p>
              ) : (
                <div className="space-y-2">
                  {profitabilityRows.map((row) => (
                    <div key={`profit-${row.eventId}`} className="neo-card neo-card-no-hover p-3 flex items-center justify-between">
                      <div>
                        <p className="font-heading text-xs uppercase tracking-wider">{row.title}</p>
                        <p className="font-body text-[10px] text-neo-black/65">{row.category} - {row.status}</p>
                      </div>
                      <p className={`font-heading text-xs ${Number(row.profitOrLoss || 0) >= 0 ? 'text-neo-green' : 'text-neo-red'}`}>
                        {Number(row.profitOrLoss || 0) >= 0 ? '+' : '-'}{formatCurrency(Math.abs(Number(row.profitOrLoss || 0)))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="neo-card neo-card-no-hover p-6">
              <h3 className="font-heading text-sm uppercase mb-4">Budget Risk Watchlist</h3>
              {riskRows.length === 0 ? (
                <p className="font-body text-xs text-neo-black/65">No risk entries yet.</p>
              ) : (
                <div className="space-y-2">
                  {riskRows.map((row) => (
                    <div key={`risk-${row.eventId}`} className="neo-card neo-card-no-hover p-3 flex items-center justify-between">
                      <div>
                        <p className="font-heading text-xs uppercase tracking-wider">{row.title}</p>
                        <p className="font-body text-[10px] text-neo-black/65">{formatCurrency(row.totalSpent || 0)} / {formatCurrency(row.totalAllocated || 0)}</p>
                      </div>
                      <span className={`neo-badge ${Number(row.percentUsed || 0) >= 90 ? 'bg-neo-red text-white' : Number(row.percentUsed || 0) >= 75 ? 'bg-neo-yellow' : 'bg-neo-cream'}`}>
                        {Math.round(Number(row.percentUsed || 0))}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
