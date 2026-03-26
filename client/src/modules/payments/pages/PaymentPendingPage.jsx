import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import { eventsApi, paymentsApi } from '@/shared/api';
import { PageHeader, ErrorState } from '@/shared/ui';

const TERMINAL = new Set(['COMPLETED', 'CANCELLED', 'FAILED', 'ALLOCATION_FAILED']);

function asInr(minor) {
  const amount = Number(minor || 0) / 100;
  return `INR ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function downloadInvoicePdf({ orderId, status, eventTitle, eventDate, quantity, subtotalMinor, platformFeeMinor, chargedMinor, generatedAt }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(255, 244, 235);
  doc.rect(0, 0, pageWidth, 112, 'F');

  doc.setTextColor(124, 45, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('EVENTZEN INVOICE', 42, 54);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Invoice generated: ${generatedAt}`, 42, 78);
  doc.text(`Order ID: ${orderId}`, 42, 94);

  doc.setDrawColor(146, 64, 14);
  doc.setLineWidth(2);
  doc.line(42, 130, pageWidth - 42, 130);

  const rows = [
    ['Event', eventTitle || 'Event booking'],
    ['Event Date', eventDate || 'N/A'],
    ['Quantity', String(quantity || 1)],
    ['Payment Status', String(status || 'PENDING').replaceAll('_', ' ')],
    ['Ticket Subtotal', asInr(subtotalMinor)],
    ['Platform Fee (10%)', asInr(platformFeeMinor)],
    ['Total Charged', asInr(chargedMinor)],
  ];

  let y = 168;
  rows.forEach(([label, value], idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(255, 250, 245);
      doc.rect(42, y - 18, pageWidth - 84, 30, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(120, 53, 15);
    doc.text(label, 52, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);
    doc.text(String(value || 'N/A'), 220, y, { maxWidth: pageWidth - 272 });
    y += 30;
  });

  doc.setFillColor(255, 237, 213);
  doc.rect(42, y + 12, pageWidth - 84, 60, 'F');
  doc.setDrawColor(146, 64, 14);
  doc.setLineWidth(1.5);
  doc.rect(42, y + 12, pageWidth - 84, 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(124, 45, 18);
  doc.text(`Amount Paid: ${asInr(chargedMinor)}`, 52, y + 47);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(82, 82, 91);
  doc.text('This is an auto-generated invoice issued by EventZen.', 42, 770);

  doc.save(`eventzen-invoice-${orderId}.pdf`);
}

export default function PaymentPendingPage() {
  const [searchParams] = useSearchParams();
  const orderId = String(searchParams.get('orderId') || '').trim();
  const cancelledFlag = searchParams.get('cancelled') === '1';
  const autoInvoiceRequestedRef = useRef(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['payment-status', orderId],
    queryFn: () => paymentsApi.getStatus(orderId).then((res) => res?.data || {}),
    enabled: Boolean(orderId),
    refetchInterval: (query) => {
      const payload = query?.state?.data?.data || query?.state?.data || {};
      const status = String(payload?.status || '').toUpperCase();
      return TERMINAL.has(status) ? false : 2500;
    },
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: () => paymentsApi.generateInvoice(orderId).then((res) => res?.data || {}),
    onSuccess: () => {
      refetch();
    },
  });

  const refreshInvoiceMutation = useMutation({
    mutationFn: () => paymentsApi.getInvoice(orderId).then((res) => res?.data || {}),
    onSuccess: () => {
      refetch();
    },
  });

  const payload = data?.data || data || {};
  const status = String(payload?.status || 'PENDING').toUpperCase();
  const checkoutUrl = payload?.checkoutUrl;
  const invoiceUrl = payload?.invoiceUrl;
  const invoiceGenerated = Boolean(payload?.invoiceGenerated);
  const terminal = TERMINAL.has(status);
  const success = status === 'COMPLETED';
  const eventId = payload?.eventId;

  const { data: eventData } = useQuery({
    queryKey: ['payment-event-summary', eventId],
    queryFn: () => eventsApi.getById(eventId).then((res) => res?.data || null),
    enabled: Boolean(success && eventId),
  });

  useEffect(() => {
    if (!success || !orderId || invoiceGenerated || autoInvoiceRequestedRef.current || generateInvoiceMutation.isPending) {
      return;
    }

    autoInvoiceRequestedRef.current = true;
    generateInvoiceMutation.mutate();
  }, [success, orderId, invoiceGenerated, generateInvoiceMutation]);

  const summary = {
    title: eventData?.title || `Event #${eventId || '-'}`,
    date: eventData?.eventDate || eventData?.date || null,
    quantity: Number(payload?.quantity || 1),
    subtotalMinor: Number(payload?.subtotalMinor || 0),
    feeMinor: Number(payload?.platformFeeMinor || 0),
    chargedMinor: Number(payload?.chargedMinor || 0),
    generatedAt: new Date().toLocaleString(),
  };

  if (!orderId) {
    return (
      <div className="neo-container py-8">
        <ErrorState message="Missing orderId in return URL." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="neo-container py-8">
        <PageHeader title="Payment Confirmation" subtitle="Verifying your checkout and preparing your ticket summary..." />
        <div className="neo-card p-8 animate-pulse">
          <p className="font-heading text-sm uppercase tracking-wider">Please wait...</p>
          <p className="font-body text-sm mt-2 text-neo-black/70">We are checking payment status and invoice readiness.</p>
        </div>
      </div>
    );
  }

  if (error) {
    const statusCode = Number(error?.response?.status || 0);
    const apiMessage = error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || 'Could not fetch payment status.';

    const message = statusCode === 401
      ? 'Your session expired while returning from checkout. Please log in and open this page again.'
      : (statusCode === 404
        ? 'Payment order not found for this account. Make sure you are logged in with the same account used for checkout.'
        : apiMessage);

    return (
      <div className="neo-container py-8">
        <ErrorState message={message} onRetry={refetch} />
        <div className="mt-3 flex flex-wrap gap-2">
          {statusCode === 401 ? (
            <Link to="/login" className="neo-btn neo-btn-sm bg-neo-white">Go to Login</Link>
          ) : null}
          <Link to="/events" className="neo-btn neo-btn-sm bg-neo-white">Browse Events</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="neo-container py-8 md:py-10">
      <PageHeader
        title="Payment Confirmation"
        subtitle={success ? 'Payment confirmed. Your booking is complete and invoice generation has started automatically.' : 'We are syncing your checkout status.'}
      />

      <div className="neo-card p-5 md:p-8 space-y-6">
        <div className={`border-4 border-neo-black p-4 md:p-6 ${success ? 'bg-[#fde68a]' : 'bg-neo-white'}`}>
          <p className="font-heading-shade text-2xl md:text-4xl uppercase tracking-wide">
            {success ? 'Payment Successful' : 'Payment Update'}
          </p>
          <p className="font-body text-sm md:text-base mt-2 text-neo-black/80">
            {success
              ? 'Your order was confirmed. Tickets are ready in your dashboard, and an invoice is being prepared.'
              : 'Your checkout status is still being finalized. Keep this page open or refresh manually.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="neo-card p-3 bg-neo-white">
            <p className="font-heading text-[10px] uppercase tracking-wider">Order ID</p>
            <p className="font-body text-xs mt-1 break-all">{orderId}</p>
          </div>
          <div className="neo-card p-3 bg-neo-white">
            <p className="font-heading text-[10px] uppercase tracking-wider">Status</p>
            <p className="font-body text-xs mt-1">{status.replaceAll('_', ' ')}</p>
          </div>
          <div className="neo-card p-3 bg-neo-white">
            <p className="font-heading text-[10px] uppercase tracking-wider">Total Charged</p>
            <p className="font-body text-xs mt-1">{asInr(summary.chargedMinor)}</p>
          </div>
          <div className="neo-card p-3 bg-neo-white">
            <p className="font-heading text-[10px] uppercase tracking-wider">Platform Fee (10%)</p>
            <p className="font-body text-xs mt-1">{asInr(summary.feeMinor)}</p>
          </div>
        </div>

        <div className="neo-card p-4 bg-[#fff7ed] border-l-8 border-[#ea580c]">
          <p className="font-heading text-xs uppercase tracking-wider">Booking Details</p>
          <div className="mt-2 space-y-1 text-sm">
            <p className="font-body"><strong>Event:</strong> {summary.title}</p>
            <p className="font-body"><strong>Event Date:</strong> {summary.date ? new Date(summary.date).toLocaleDateString() : 'N/A'}</p>
            <p className="font-body"><strong>Tickets:</strong> {summary.quantity}</p>
            <p className="font-body"><strong>Ticket Subtotal:</strong> {asInr(summary.subtotalMinor)}</p>
          </div>
        </div>

        {status === 'PENDING' || status === 'PROCESSING' ? (
          <p className="font-body text-sm text-neo-black/70">
            Payment is still being confirmed. This page auto-refreshes every few seconds.
          </p>
        ) : null}

        {cancelledFlag && !success ? (
          <p className="font-body text-sm text-neo-red">
            Checkout appears cancelled. You can retry payment from the event page.
          </p>
        ) : null}

        {payload?.errorMessage ? (
          <p className="font-body text-sm text-neo-red">{payload.errorMessage}</p>
        ) : null}

        {success ? (
          <div className="neo-card p-4 bg-neo-cream border-l-8 border-neo-blue">
            <p className="font-heading text-xs uppercase tracking-wider">Invoice</p>
            <p className="font-body text-xs text-neo-black/70 mt-1">
              We auto-triggered invoice generation for this completed payment.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => generateInvoiceMutation.mutate()}
                disabled={generateInvoiceMutation.isPending}
                className="neo-btn neo-btn-sm bg-neo-white"
              >
                {generateInvoiceMutation.isPending ? 'Generating...' : (invoiceGenerated ? 'Regenerate Invoice' : 'Generate Invoice')}
              </button>
              <button
                type="button"
                onClick={() => refreshInvoiceMutation.mutate()}
                disabled={refreshInvoiceMutation.isPending}
                className="neo-btn neo-btn-sm bg-neo-white"
              >
                {refreshInvoiceMutation.isPending ? 'Checking...' : 'Check Invoice Status'}
              </button>
              <button
                type="button"
                onClick={() => downloadInvoicePdf({
                  orderId,
                  status,
                  eventTitle: summary.title,
                  eventDate: summary.date ? new Date(summary.date).toLocaleDateString() : 'N/A',
                  quantity: summary.quantity,
                  subtotalMinor: summary.subtotalMinor,
                  platformFeeMinor: summary.feeMinor,
                  chargedMinor: summary.chargedMinor,
                  generatedAt: summary.generatedAt,
                })}
                className="neo-btn neo-btn-sm bg-neo-white"
              >
                Download EventZen Invoice (PDF)
              </button>
              {invoiceUrl ? (
                <a href={invoiceUrl} target="_blank" rel="noreferrer" className="neo-btn neo-btn-sm bg-neo-yellow">
                  Download Invoice
                </a>
              ) : null}
            </div>
            {!invoiceUrl ? (
              <p className="font-body text-[11px] text-neo-black/65 mt-2">
                External invoice URL may take a moment. You can download the auto-generated EventZen invoice immediately.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-2">
          <Link to="/dashboard" className="neo-btn neo-btn-sm bg-neo-white">Go to Dashboard</Link>
          <Link to="/events" className="neo-btn neo-btn-sm bg-neo-white">Browse Events</Link>
          {!terminal ? (
            <button type="button" className="neo-btn neo-btn-sm bg-neo-yellow" onClick={() => refetch()}>
              Refresh Status
            </button>
          ) : null}
          {!success && checkoutUrl ? (
            <a href={checkoutUrl} className="neo-btn neo-btn-sm bg-neo-yellow">Retry Checkout</a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
