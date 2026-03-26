import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { vendorApplicationsApi } from '@/shared/api';
import { StatusBadge, PageHeader, EmptyState } from '@/shared/ui';
import { formatRelative } from '@/shared/utils/formatters';

const STATUS_MESSAGES = {
  PENDING: 'Your application is being reviewed. Please check back soon!',
  SUBMITTED: 'Your application has been submitted and is pending review.',
  APPROVED: 'Congratulations! Your vendor application has been approved.',
  REJECTED: 'Unfortunately your application was not approved. You may reapply.',
  WITHDRAWN: 'You have withdrawn this application.',
};

function normalizeApplicationPayload(data) {
  const primary = Array.isArray(data) ? data[0] : data;
  const unwrapped = primary?.application || primary?.data || primary;
  return unwrapped && typeof unwrapped === 'object' ? unwrapped : null;
}

function normalizeStatus(app) {
  const raw = String(app?.status || app?.applicationStatus || '').toUpperCase();
  if (raw === 'SUBMITTED') return 'PENDING';
  return raw || 'PENDING';
}

export default function MyApplicationPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-application'],
    queryFn: () => vendorApplicationsApi.getMine().then(r => r.data),
  });

  const app = normalizeApplicationPayload(data);
  const status = normalizeStatus(app);
  const serviceLabel = Array.isArray(app?.serviceTypes) && app.serviceTypes.length > 0
    ? app.serviceTypes.join(', ')
    : (app?.serviceType || app?.category || 'Not specified');
  const descriptionLabel = app?.notes || app?.description || app?.about || 'Not provided';
  const businessName = app?.businessName || app?.companyName || app?.vendorName || 'Vendor Application';
  const portfolioUrl = app?.portfolioUrl || app?.websiteUrl;
  const reviewReason = app?.reviewReason || app?.rejectionReason;
  const createdAtText = app?.createdAt || app?.submittedAt ? formatRelative(app?.createdAt || app?.submittedAt) : 'recently';

  if (isLoading) return <div className="neo-container py-8"><div className="neo-card h-48 animate-pulse" /></div>;

  if (!app) {
    return (
      <div className="neo-container py-8">
        <EmptyState title="No Application" description="You haven't applied yet"
          action={<Link to="/vendor/apply" className="neo-btn-primary neo-btn-sm">Apply Now</Link>} />
      </div>
    );
  }

  return (
    <div className="neo-container py-8">
      <PageHeader title="My Application" subtitle="Track your vendor application status" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="neo-card p-8 max-w-xl border-l-8 border-neo-purple">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-lg uppercase tracking-wider">{businessName}</h2>
          <StatusBadge status={status} />
        </div>
        <div className="space-y-3 mb-6">
          <p className="font-body text-sm"><strong className="font-heading text-xs uppercase">Service:</strong> {serviceLabel}</p>
          <p className="font-body text-sm"><strong className="font-heading text-xs uppercase">Description:</strong> {descriptionLabel}</p>
          {portfolioUrl && <p className="font-body text-sm"><strong className="font-heading text-xs uppercase">Portfolio:</strong> <a href={portfolioUrl} target="_blank" rel="noreferrer" className="neo-link">{portfolioUrl}</a></p>}
          <p className="font-body text-xs text-neo-black/65">Submitted {createdAtText}</p>
        </div>
        <div className={`p-4 border-3 ${
          status === 'APPROVED' ? 'border-neo-green bg-neo-green/10' :
          status === 'REJECTED' ? 'border-neo-red bg-neo-red/10' :
          'border-neo-yellow bg-neo-yellow/10'
        }`}>
          <p className="font-body text-sm">{STATUS_MESSAGES[status] || STATUS_MESSAGES.PENDING}</p>
          {reviewReason && <p className="font-body text-xs text-neo-black/65 mt-2">Reason: {reviewReason}</p>}
        </div>
      </motion.div>
    </div>
  );
}
