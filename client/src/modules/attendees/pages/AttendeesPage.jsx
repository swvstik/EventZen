import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HiDownload, HiSearch } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { attendeesApi, eventsApi } from '@/shared/api';
import { StatusBadge, PageHeader, EmptyState, ErrorState } from '@/shared/ui';
import { formatCurrency, formatRelative } from '@/shared/utils/formatters';

export default function AttendeesPage() {
  const { id: eventId } = useParams();
  const [filter, setFilter] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['attendees', eventId],
    queryFn: () => attendeesApi.getByEvent(eventId, { limit: 500 }).then(r => r.data),
  });

  const { data: eventDetails } = useQuery({
    queryKey: ['event-details-attendees', eventId],
    queryFn: () => eventsApi.getById(eventId).then((r) => r.data),
    enabled: Boolean(eventId),
  });

  const handleExport = async () => {
    try {
      const res = await attendeesApi.export(eventId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `attendees-${eventId}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported!');
    } catch { toast.error('Export failed'); }
  };

  const attendees = Array.isArray(data) ? data : (data?.attendees || data?.registrations || []);
  const event = eventDetails?.data || eventDetails;
  const eventTitle = event?.title || `Event #${eventId}`;
  const tierById = new Map((event?.ticketTiers || []).map((tier) => [String(tier.id), tier]));
  const withTicketContext = attendees.map((attendee) => {
    const tier = tierById.get(String(attendee.tierId));
    const quantity = Number(attendee.quantity || 1);
    const fallbackPrice = Number(attendee.ticketUnitPrice);
    const resolvedPrice = Number.isFinite(Number(tier?.price))
      ? Number(tier.price)
      : (Number.isFinite(fallbackPrice) ? fallbackPrice : null);

    return {
      ...attendee,
      tierNameResolved: attendee.tierName || tier?.name || `Tier #${attendee.tierId} (Archived)`,
      ticketPrice: resolvedPrice,
      ticketCurrency: attendee.ticketCurrency || tier?.currency || 'INR',
      quantity,
      totalAmount: Number.isFinite(resolvedPrice) ? (resolvedPrice * quantity) : null,
    };
  });

  const totalRevenueEstimate = withTicketContext.reduce((sum, attendee) => {
    if (attendee.status !== 'REGISTERED' && attendee.status !== 'CHECKED_IN') {
      return sum;
    }
    return sum + Number(attendee.totalAmount || 0);
  }, 0);

  const checkedInCount = withTicketContext.filter((attendee) => attendee.status === 'CHECKED_IN').length;
  const registeredCount = withTicketContext.filter((attendee) => attendee.status === 'REGISTERED').length;
  const displayedAttendees = filter
    ? withTicketContext.filter((attendee) => attendee.status === filter)
    : withTicketContext;

  return (
    <div>
      <PageHeader title="Attendees" subtitle={`${eventTitle} - ${attendees.length} total`}
        action={
          <div className="flex gap-2">
            <Link to="/admin/check-in" className="neo-btn bg-neo-white neo-btn-sm">Open Check-In</Link>
            <button onClick={handleExport} className="neo-btn bg-neo-green neo-btn-sm"><HiDownload /> CSV</button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="neo-card p-3">
          <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Registered</p>
          <p className="font-heading text-lg">{registeredCount}</p>
        </div>
        <div className="neo-card p-3">
          <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Checked In</p>
          <p className="font-heading text-lg">{checkedInCount}</p>
        </div>
        <div className="neo-card p-3">
          <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/70">Revenue Estimate</p>
          <p className="font-heading text-lg">{formatCurrency(totalRevenueEstimate)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['', 'REGISTERED', 'WAITLISTED', 'CHECKED_IN', 'CANCELLED'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`neo-btn neo-btn-sm ${filter === s ? 'bg-neo-yellow' : 'bg-neo-white'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="neo-card h-16" />)}</div>
      ) : error ? (
        <ErrorState message="Could not load attendees" onRetry={refetch} />
      ) : displayedAttendees.length === 0 ? (
        <EmptyState icon={HiSearch} title="No attendees" description="No registrations found" />
      ) : (
        <div className="space-y-2">
          {displayedAttendees.map((a, i) => (
            <motion.div key={a._id || a.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
              className="neo-card p-4 flex items-center justify-between">
              <div>
                <p className="font-heading text-xs uppercase tracking-wider">{a.userName || a.userId}</p>
                <p className="font-body text-[10px] text-neo-black/65">
                  Ticket ID: {a._id || a.id} - Tier: {a.tierNameResolved} - Price: {Number.isFinite(Number(a.ticketPrice)) ? formatCurrency(a.ticketPrice, a.ticketCurrency) : 'N/A'} - Qty: {a.quantity}
                </p>
                <p className="font-body text-[10px] text-neo-black/65">
                  Amount: {Number.isFinite(Number(a.totalAmount)) ? formatCurrency(a.totalAmount, a.ticketCurrency) : 'N/A'} - Registered {formatRelative(a.registeredAt)}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
