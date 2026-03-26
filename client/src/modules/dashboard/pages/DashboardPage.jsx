import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { HiTicket, HiQrcode } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import { attendeesApi } from '@/shared/api';
import { formatDate } from '@/shared/utils/formatters';
import { StatusBadge, PageHeader, EmptyState, ErrorState, SkeletonCard } from '@/shared/ui';
import useAuthStore from '@/shared/store/authStore';

function downloadDataUri(dataUri, filename) {
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = filename;
  link.click();
}

function downloadTicketPdf(reg) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const ticketId = reg._id || reg.id || 'N/A';
  const title = reg.eventTitle || `Event ${reg.eventId}`;
  const venueLine = reg.venueName
    ? `${reg.venueName}${reg.venueAddress ? `, ${reg.venueAddress}` : ''}`
    : (reg.venueAddress || 'Venue not specified');

  const pageWidth = doc.internal.pageSize.getWidth();
  const panelX = 24;
  const panelY = 24;
  const panelWidth = pageWidth - 48;
  const contentX = panelX + 24;
  const qrSize = 256;
  const qrX = panelX + Math.round((panelWidth - qrSize) / 2);
  const qrY = panelY + 230;
  const detailsY = qrY + qrSize + 40;
  const eventDate = reg.eventDate ? formatDate(reg.eventDate) : 'N/A';
  const registeredAt = reg.registeredAt ? formatDate(reg.registeredAt) : 'N/A';
  const statusText = (reg.status || 'N/A').toUpperCase();
  const tierText = reg.tierName || reg.tierId || 'N/A';
  const quantityText = String(reg.quantity || 1);

  doc.setFillColor(16, 36, 58);
  doc.rect(panelX + 8, panelY + 8, panelWidth, 760, 'F');
  doc.setFillColor(248, 255, 254);
  doc.rect(panelX, panelY, panelWidth, 760, 'F');
  doc.setDrawColor(16, 36, 58);
  doc.setLineWidth(3);
  doc.rect(panelX, panelY, panelWidth, 760);

  doc.setFillColor(135, 245, 213);
  doc.rect(panelX, panelY, panelWidth, 86, 'F');
  doc.setLineWidth(2.5);
  doc.line(panelX, panelY + 86, panelX + panelWidth, panelY + 86);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 36, 58);
  doc.setFontSize(28);
  doc.text('EVENTZEN', contentX, panelY + 34);
  doc.setFontSize(12);
  doc.text('EVENT TICKET PASS', contentX, panelY + 56);

  doc.setFontSize(10);
  doc.text(`Ticket ID: ${ticketId}`, panelX + panelWidth - 210, panelY + 32);
  doc.text(`Qty: ${quantityText}`, panelX + panelWidth - 210, panelY + 48);
  doc.text(`Tier: ${String(tierText).toUpperCase()}`, panelX + panelWidth - 210, panelY + 64);

  doc.setFillColor(46, 125, 226);
  doc.rect(contentX, panelY + 108, 172, 28, 'F');
  doc.setDrawColor(16, 36, 58);
  doc.setLineWidth(2);
  doc.rect(contentX, panelY + 108, 172, 28);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(statusText, contentX + 16, panelY + 126);

  doc.setTextColor(16, 36, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, contentX, panelY + 174, { maxWidth: panelWidth - 48 });

  doc.setFillColor(255, 255, 255);
  doc.rect(qrX, qrY, qrSize, qrSize, 'F');
  doc.setDrawColor(16, 36, 58);
  doc.setLineWidth(3);
  doc.rect(qrX, qrY, qrSize, qrSize);

  if (reg.qrDataUri) {
    doc.addImage(reg.qrDataUri, 'PNG', qrX + 18, qrY + 18, qrSize - 36, qrSize - 36);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('QR UNAVAILABLE', qrX + 56, qrY + qrSize / 2);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Scan this QR at the venue gate for check-in.', panelX + Math.round(panelWidth / 2) - 120, qrY + qrSize + 22);

  const drawInfoBox = (x, y, w, label, value) => {
    doc.setFillColor(231, 251, 255);
    doc.rect(x, y, w, 54, 'F');
    doc.setDrawColor(16, 36, 58);
    doc.setLineWidth(2);
    doc.rect(x, y, w, 54);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, x + 10, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(String(value || 'N/A'), x + 10, y + 35, { maxWidth: w - 20 });
  };

  drawInfoBox(contentX, detailsY, 160, 'EVENT DATE', eventDate);
  drawInfoBox(contentX + 176, detailsY, 160, 'REGISTERED AT', registeredAt);
  drawInfoBox(contentX + 352, detailsY, 160, 'TIER', tierText);

  doc.setFillColor(255, 255, 255);
  doc.rect(contentX, detailsY + 70, panelWidth - 48, 72, 'F');
  doc.setDrawColor(16, 36, 58);
  doc.setLineWidth(2);
  doc.rect(contentX, detailsY + 70, panelWidth - 48, 72);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('VENUE', contentX + 10, detailsY + 86);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(venueLine, contentX + 10, detailsY + 105, { maxWidth: panelWidth - 68 });

  const footerY = panelY + 716;
  doc.setFillColor(196, 232, 255);
  doc.rect(contentX, footerY, panelWidth - 48, 34, 'F');
  doc.setDrawColor(16, 36, 58);
  doc.setLineWidth(2);
  doc.rect(contentX, footerY, panelWidth - 48, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('VALID ONLY FOR LISTED EVENT. KEEP TICKET ID VISIBLE FOR MANUAL CHECK.', contentX + 10, footerY + 21);

  doc.save(`eventzen-ticket-${ticketId}.pdf`);
}

function RegistrationCard({ reg, index }) {
  const queryClient = useQueryClient();
  const cancelMutation = useMutation({
    mutationFn: () => attendeesApi.cancel(reg._id || reg.id),
    onSuccess: () => {
      toast.success('Registration cancelled');
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
    },
    onError: (err) => {
      const message = err?.response?.data?.message || '';
      if (/already\s+cancelled|already\s+canceled|not\s+found/i.test(message)) {
        toast('No active tickets left to cancel for this ticket ID.');
        queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
        return;
      }
      toast.error(message || 'Cancel failed');
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="neo-card neo-card-interactive overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row">
        {/* QR code area */}
        <div className="sm:w-40 bg-neo-cream border-b-3 sm:border-b-0 sm:border-r-3 border-neo-black
                       p-4 flex items-center justify-center">
          {reg.qrDataUri ? (
            <img src={reg.qrDataUri} alt="QR ticket" className="w-28 h-28" />
          ) : (
            <div className="w-28 h-28 bg-neo-yellow/20 border-3 border-dashed border-neo-yellow
                          flex items-center justify-center">
              <HiQrcode size={32} className="text-neo-yellow/60" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-heading text-sm uppercase tracking-wider">
                {reg.eventTitle || `Event ${reg.eventId}`}
              </h3>
              <p className="font-body text-xs text-neo-black/65 mt-1">
                {reg.eventDate ? formatDate(reg.eventDate) : `ID: ${reg.eventId}`}
              </p>
              {(reg.venueName || reg.venueAddress) ? (
                <p className="font-body text-[10px] text-neo-black/65 mt-1">
                  Venue: {reg.venueName || 'Venue'}{reg.venueAddress ? `, ${reg.venueAddress}` : ''}
                </p>
              ) : null}
              {reg.eventDescription ? (
                <p className="font-body text-[11px] text-neo-black/75 mt-2">{reg.eventDescription}</p>
              ) : null}
              <p className="font-body text-[10px] text-neo-black/55 mt-1">
                Ticket ID: {reg._id || reg.id}
              </p>
              <p className="font-body text-[10px] text-neo-black/55 mt-1">
                Quantity Owned: {reg.quantity || 1}
              </p>
            </div>
            <StatusBadge status={reg.status} />
          </div>

          {reg.tierName && (
            <span className="neo-badge bg-neo-lavender text-neo-black text-[9px] mb-3 inline-block">
              {reg.tierName || `Tier #${reg.tierId}`}
            </span>
          )}

          {reg.status === 'WAITLISTED' && reg.waitlistPosition && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-2
                          bg-neo-yellow border-3 border-neo-black shadow-neo-sm rounded-md">
              <span className="font-heading text-sm uppercase tracking-wider leading-none">
                Waitlist #{reg.waitlistPosition}
              </span>
            </div>
          )}

          {reg.status === 'REGISTERED' && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadTicketPdf(reg)}
                className="neo-btn neo-btn-sm bg-neo-cream"
              >
                Download Ticket PDF
              </button>
              <button
                type="button"
                disabled={!reg.qrDataUri}
                onClick={() => downloadDataUri(reg.qrDataUri, `eventzen-qr-${reg._id || reg.id}.png`)}
                className="neo-btn neo-btn-sm bg-neo-white disabled:opacity-50"
              >
                Download QR
              </button>
            </div>
          )}

          {['REGISTERED', 'WAITLISTED'].includes(reg.status) && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="mt-4 neo-btn neo-btn-sm bg-neo-white text-neo-red hover:bg-neo-red hover:text-white"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-registrations'],
    queryFn: () => attendeesApi.getMy().then(r => r.data),
  });

  const registrations = Array.isArray(data) ? data : (data?.registrations || []);
  const filteredRegistrations = selectedStatus === 'ALL'
    ? registrations
    : registrations.filter((r) => r.status === selectedStatus);
  const activeRegistrations = registrations.filter((r) => ['REGISTERED', 'CHECKED_IN', 'WAITLISTED'].includes(r.status));
  const historyRegistrations = registrations.filter((r) => !['REGISTERED', 'CHECKED_IN', 'WAITLISTED'].includes(r.status));
  const filteredStatusLabel = selectedStatus === 'ALL' ? 'All' : selectedStatus.replaceAll('_', ' ');
  const statusSummary = [
    { key: 'ALL', label: 'All', count: registrations.length, color: 'bg-neo-white' },
    { key: 'REGISTERED', label: 'Registered', count: registrations.filter((r) => r.status === 'REGISTERED').length, color: 'bg-neo-green' },
    { key: 'WAITLISTED', label: 'Waitlisted', count: registrations.filter((r) => r.status === 'WAITLISTED').length, color: 'bg-neo-yellow' },
    { key: 'CHECKED_IN', label: 'Attended', count: registrations.filter((r) => r.status === 'CHECKED_IN').length, color: 'bg-neo-blue' },
    { key: 'CANCELLED', label: 'Cancelled', count: registrations.filter((r) => r.status === 'CANCELLED').length, color: 'bg-neo-red' },
  ];

  const headerAction = (
    <div className="flex flex-wrap gap-2">
      {['VENDOR', 'ADMIN'].includes(user?.role) && (
        <Link
          to={user?.role === 'ADMIN' ? '/admin/venues' : '/admin/venues/view'}
          className="neo-btn bg-neo-white neo-btn-sm"
        >
          {user?.role === 'ADMIN' ? 'Manage Venues' : 'View Venues'}
        </Link>
      )}
      <Link to="/events" className="neo-btn bg-neo-yellow neo-btn-sm">
        Browse Events
      </Link>
    </div>
  );

  if (isLoading) {
    return (
      <div className="neo-container py-8">
        <PageHeader
          title="My Dashboard"
          subtitle="My Events first. Browse and discover comes after your active tickets."
          action={headerAction}
        />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="neo-card p-5 mb-6 flex items-center gap-3"
        >
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, ease: 'linear', repeat: Infinity }}
            className="inline-flex w-9 h-9 items-center justify-center border-3 border-neo-black bg-neo-yellow"
          >
            <HiTicket size={18} />
          </motion.span>
          <div>
            <p className="font-heading text-xs uppercase tracking-wider">Loading your dashboard</p>
            <p className="font-body text-xs text-neo-black/70">Fetching registrations and ticket status.</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={`summary-skeleton-${i}`} className="h-24" />
          ))}
        </div>

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={`registration-skeleton-${i}`} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="neo-container py-8">
      <PageHeader
        title="My Dashboard"
        subtitle="My Events first. Browse and discover comes after your active tickets."
        action={headerAction}
      />

      <div className="neo-card p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-heading text-xs uppercase tracking-wider">My Events</p>
          <p className="font-body text-xs text-neo-black/70">
            Active tickets are listed first so upcoming attendance is always visible.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-heading uppercase tracking-wider">
          <span className="neo-badge bg-neo-green">Active: {activeRegistrations.length}</span>
          <span className="neo-badge bg-neo-white">History: {historyRegistrations.length}</span>
        </div>
      </div>

      {/* Stats + Primary Filters */}
      <div className="mb-8 flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0">
        {statusSummary.map((stat) => (
          <motion.div
            key={stat.key}
            whileHover={{ scale: 1.05 }}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedStatus(stat.key)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedStatus(stat.key);
              }
            }}
            className={`${stat.color} flex-none w-[92px] min-[360px]:w-[100px] min-[420px]:w-[112px] md:w-auto md:min-w-0 border-3 border-neo-black shadow-neo p-2 min-[360px]:p-2.5 md:p-4 text-center cursor-pointer transition-transform ${selectedStatus === stat.key ? 'ring-4 ring-neo-black/20 -translate-y-0.5' : ''}`}
          >
            <p className="font-heading-shade text-2xl min-[360px]:text-[1.7rem] md:text-3xl leading-none">{stat.count}</p>
            <p className="font-heading text-[9px] min-[360px]:text-[10px] uppercase tracking-wider mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Registrations */}
      {error ? (
        <ErrorState message="Could not load registrations" onRetry={refetch} />
      ) : registrations.length === 0 ? (
        <EmptyState
          icon={HiTicket}
          title="No Registrations Yet"
          description="Browse events and register to see your tickets here"
          action={<Link to="/events" className="neo-btn-primary neo-btn-sm">Browse Events</Link>}
        />
      ) : selectedStatus !== 'ALL' ? (
        <div className="space-y-3">
          <h2 className="font-heading text-xs uppercase tracking-wider">{filteredStatusLabel}</h2>
          {filteredRegistrations.length === 0 ? (
            <div className="neo-card p-4">
              <p className="font-body text-xs text-neo-black/70">
                No registrations found with status {filteredStatusLabel.toLowerCase()}.
              </p>
            </div>
          ) : (
            filteredRegistrations.map((reg, i) => (
              <RegistrationCard key={reg._id || reg.id || `${selectedStatus}-${i}`} reg={reg} index={i} />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-heading text-xs uppercase tracking-wider">My Active Events</h2>
            {activeRegistrations.length === 0 ? (
              <div className="neo-card p-4">
                <p className="font-body text-xs text-neo-black/70">
                  You have no active registrations right now. Browse events to book your next ticket.
                </p>
                <Link to="/events" className="neo-btn neo-btn-sm bg-neo-yellow mt-3 inline-flex">
                  Browse Events
                </Link>
              </div>
            ) : (
              activeRegistrations.map((reg, i) => (
                <RegistrationCard key={reg._id || reg.id || i} reg={reg} index={i} />
              ))
            )}
          </section>

          {historyRegistrations.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-heading text-xs uppercase tracking-wider">History</h2>
              {historyRegistrations.map((reg, i) => (
                <RegistrationCard key={reg._id || reg.id || `history-${i}`} reg={reg} index={i} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
