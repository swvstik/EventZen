import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { vendorApplicationsApi } from '@/shared/api';
import { StatusBadge, PageHeader, EmptyState } from '@/shared/ui';
import { formatRelative } from '@/shared/utils/formatters';

export default function AdminReviewPage() {
  const [expandedId, setExpandedId] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-applications'],
    queryFn: () => vendorApplicationsApi.getAll().then(r => r.data?.applications || r.data || []),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, rejectionReason }) =>
      vendorApplicationsApi.updateStatus(id, { status, rejectionReason }),
    onSuccess: () => { toast.success('Status updated'); queryClient.invalidateQueries({ queryKey: ['vendor-applications'] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const applications = Array.isArray(data) ? data : [];

  const normalizeServiceTypes = (app) => {
    if (Array.isArray(app?.serviceTypes) && app.serviceTypes.length > 0) {
      return app.serviceTypes.join(', ');
    }
    if (app?.serviceType) return app.serviceType;
    return 'Not specified';
  };

  const normalizeDescription = (app) => app?.notes || app?.description || 'No description provided.';

  const handleAction = (id, status) => {
    if (status === 'REJECTED') {
      const reason = prompt('Rejection reason (optional):');
      statusMutation.mutate({ id, status, rejectionReason: reason || undefined });
    } else {
      statusMutation.mutate({ id, status });
    }
  };

  return (
    <div>
      <PageHeader
        title="Vendor Applications"
        subtitle={`${applications.length} applications`}
      />

      <p className="font-body text-xs text-neo-black/70 mb-4">
        Review organizer access requests. Approved applicants can be promoted to vendor workflows and submit events for approval.
      </p>

      {isLoading ? (
        <div className="animate-pulse space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="neo-card h-24" />)}</div>
      ) : applications.length === 0 ? (
        <EmptyState title="No Applications" description="No vendor applications to review" />
      ) : (
        <div className="space-y-3">
          {applications.map((app, i) => (
            <motion.div key={app._id || app.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="neo-card p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-heading text-sm uppercase tracking-wider">{app.businessName}</h3>
                  <StatusBadge status={app.status} />
                </div>
                  <p className="font-body text-xs text-neo-black/65">{normalizeServiceTypes(app)} - {formatRelative(app.createdAt)}</p>
                  <p className="font-body text-sm mt-2 line-clamp-2">{normalizeDescription(app)}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setExpandedId((current) => (current === (app._id || app.id) ? null : (app._id || app.id)))}
                    className="neo-btn neo-btn-sm bg-neo-white"
                  >
                    {expandedId === (app._id || app.id) ? 'Hide Details' : 'View Details'}
                  </button>
                  {app.status === 'PENDING' && (
                    <>
                      <button onClick={() => handleAction(app._id || app.id, 'APPROVED')}
                        className="neo-btn neo-btn-sm bg-neo-green">Approve</button>
                      <button onClick={() => handleAction(app._id || app.id, 'REJECTED')}
                        className="neo-btn neo-btn-sm bg-neo-red text-white">Reject</button>
                    </>
                  )}
                </div>
              </div>

              {expandedId === (app._id || app.id) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-neo-cream border-3 border-neo-black p-4">
                  <div>
                    <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/70">Business Name</p>
                    <p className="font-body text-sm">{app.businessName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/70">Service Types</p>
                    <p className="font-body text-sm">{normalizeServiceTypes(app)}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/70">Description</p>
                    <p className="font-body text-sm">{normalizeDescription(app)}</p>
                  </div>
                  <div>
                    <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/70">Portfolio</p>
                    {app.portfolioUrl ? (
                      <a href={app.portfolioUrl} target="_blank" rel="noreferrer" className="neo-link font-body text-sm">
                        {app.portfolioUrl}
                      </a>
                    ) : (
                      <p className="font-body text-sm">Not provided</p>
                    )}
                  </div>
                  <div>
                    <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/70">Submitted</p>
                    <p className="font-body text-sm">{formatRelative(app.createdAt)}</p>
                  </div>
                  {app.reviewReason && (
                    <div className="md:col-span-2">
                      <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/70">Review Reason</p>
                      <p className="font-body text-sm">{app.reviewReason}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
