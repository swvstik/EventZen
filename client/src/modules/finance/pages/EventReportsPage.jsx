import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { reportsApi } from '@/shared/api';
import useAuthStore from '@/shared/store/authStore';
import { PageHeader, ErrorState, StatusBadge } from '@/shared/ui';
import { formatCurrency } from '@/shared/utils/formatters';

function normalizeItems(data) {
  const events = Array.isArray(data) ? data : (data?.events || []);
  return events.map((event) => ({
    ...event,
    title: event.title || event.eventTitle || `Event ${event.eventId || ''}`.trim(),
    status: event.status || event.eventStatus || 'UNKNOWN',
    eventId: event.eventId,
    totalAllocated: Number(event.totalAllocated || 0),
    totalSpent: Number(event.totalSpent || 0),
    remaining: Number(event.remaining || 0),
    percentUsed: Number(event.percentUsed || 0),
    expenseCount: Number(event.expenseCount || 0),
  }));
}

export default function EventReportsPage() {
  const { user } = useAuthStore();
  const role = String(user?.role || '').toUpperCase();
  const isAdmin = role === 'ADMIN';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['event-reports', role],
    queryFn: () => (isAdmin ? reportsApi.getAdminOverview() : reportsApi.getVendorOverview()).then((r) => r.data),
    refetchInterval: 30000,
  });

  const events = useMemo(() => normalizeItems(data), [data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Event Reports"
        subtitle="Per-event report access with budget and attendee drilldowns"
        action={(
          <Link
            to={isAdmin ? '/admin/reports/admin-overview' : '/admin/reports/vendor-overview'}
            className="neo-btn neo-btn-sm bg-neo-yellow"
          >
            Open Financial Overview
          </Link>
        )}
      />

      {isLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="neo-card h-24" />
          <div className="neo-card h-24" />
          <div className="neo-card h-24" />
        </div>
      ) : error ? (
        <ErrorState message="Could not load event reports" onRetry={refetch} />
      ) : events.length === 0 ? (
        <div className="neo-card neo-card-no-hover p-8 text-center">
          <p className="font-heading text-lg uppercase">No Event Reports Yet</p>
          <p className="font-body text-sm text-neo-black/65 mt-2">
            Create an event budget or expenses to populate report cards.
          </p>
          <Link to="/admin/events" className="neo-btn neo-btn-sm bg-neo-yellow mt-4 inline-flex">
            Go To Events
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={String(event.eventId)} className="neo-card neo-card-no-hover p-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <p className="font-heading text-sm uppercase tracking-wider">{event.title}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <StatusBadge status={event.status} />
                    <span className="neo-badge bg-neo-cream">Expenses: {event.expenseCount}</span>
                    <span className={`neo-badge ${event.overspendWarning ? 'bg-neo-red text-white' : 'bg-neo-green text-neo-black'}`}>
                      {event.overspendWarning ? 'Overspend Risk' : 'Within Budget'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-[260px]">
                  <div className="neo-card neo-card-no-hover p-2 bg-neo-yellow/20">
                    <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Allocated</p>
                    <p className="font-heading text-xs mt-1">{formatCurrency(event.totalAllocated)}</p>
                  </div>
                  <div className="neo-card neo-card-no-hover p-2 bg-neo-red/10">
                    <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Spent</p>
                    <p className="font-heading text-xs mt-1">{formatCurrency(event.totalSpent)}</p>
                  </div>
                  <div className="neo-card neo-card-no-hover p-2 bg-neo-green/10">
                    <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Remaining</p>
                    <p className="font-heading text-xs mt-1">{formatCurrency(event.remaining)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 items-center justify-between">
                <p className="font-body text-xs text-neo-black/65">
                  Budget usage: {Math.round(event.percentUsed || 0)}%
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/admin/events/${event.eventId}/attendees`} className="neo-btn neo-btn-sm bg-neo-blue text-white">
                    Open Attendees
                  </Link>
                  <Link to={`/admin/events/${event.eventId}/budget`} className="neo-btn neo-btn-sm bg-neo-white">
                    Open Budget
                  </Link>
                  <Link to={`/admin/events/${event.eventId}/edit`} className="neo-btn neo-btn-sm bg-neo-white">
                    Open Event
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
