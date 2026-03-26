import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { HiCalendar, HiCurrencyDollar, HiQrcode, HiUsers, HiOfficeBuilding, HiClipboardList } from 'react-icons/hi';
import { eventsApi, notificationsApi } from '@/shared/api';
import { PageHeader } from '@/shared/ui';
import useAuthStore from '@/shared/store/authStore';
import { formatRelative } from '@/shared/utils/formatters';

export default function OverviewPage() {
  const { user } = useAuthStore();
  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN';

  const { data } = useQuery({
    queryKey: ['admin-overview-quick-events'],
    queryFn: () => eventsApi.getAll({ limit: 50 }).then((r) => r.data),
  });

  const { data: notificationsData } = useQuery({
    queryKey: ['overview-notifications'],
    queryFn: () => notificationsApi.getAll({ page: 0, limit: 8 }).then((r) => r.data),
    refetchInterval: 30000,
  });

  const events = Array.isArray(data?.events) ? data.events : [];
  const notifications = Array.isArray(notificationsData?.notifications) ? notificationsData.notifications : [];
  const unreadNotifications = notifications.filter((n) => !n.isRead).slice(0, 3);
  const recentNotifications = notifications.slice(0, 5);
  const publishedCount = events.filter((e) => e.status === 'PUBLISHED').length;
  const pendingCount = events.filter((e) => e.status === 'PENDING_APPROVAL').length;

  const actionCards = isAdmin
    ? [
      { label: 'Manage Events', hint: 'Create, edit, publish, and monitor events', to: '/admin/events', icon: HiCalendar, tone: 'bg-neo-yellow' },
      { label: 'Manage Venues', hint: 'Review venue availability and conflicts', to: '/admin/venues', icon: HiOfficeBuilding, tone: 'bg-neo-orange' },
      { label: 'Review Applications', hint: 'Approve or reject vendor applications', to: '/admin/vendor-applications', icon: HiClipboardList, tone: 'bg-neo-lavender' },
      { label: 'View Admin Reports', hint: 'Track platform-level budget and revenue', to: '/admin/reports/admin-overview', icon: HiCurrencyDollar, tone: 'bg-neo-blue text-white' },
    ]
    : [
      { label: 'Manage Events', hint: 'Update event details and tickets', to: '/admin/events', icon: HiCalendar, tone: 'bg-neo-yellow' },
      { label: 'Check-In Console', hint: 'Scan QR and process attendee entry', to: '/admin/check-in', icon: HiQrcode, tone: 'bg-neo-orange' },
      { label: 'View Venues', hint: 'Browse venue availability and constraints', to: '/admin/venues/view', icon: HiOfficeBuilding, tone: 'bg-neo-lavender' },
      { label: 'Vendor Reports', hint: 'See revenue, spend, and margins', to: '/admin/reports/vendor-overview', icon: HiCurrencyDollar, tone: 'bg-neo-blue text-white' },
    ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAdmin ? 'Admin Overview' : 'Vendor Overview'}
        subtitle="Your operations launchpad with quick actions and live status"
      />

      <section className="neo-card neo-card-no-hover neo-hero-atmosphere p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="neo-badge bg-neo-yellow text-neo-black mb-3">Dashboard Hub</p>
            <h2 className="font-heading text-xl md:text-3xl uppercase tracking-wider text-neo-black">
              Welcome back, {user?.name || 'Team'}
            </h2>
            <p className="font-body text-sm text-neo-black/75 mt-2 max-w-2xl">
              Use this page as your central navigation point for daily operations, approvals, attendee flow, and financial tracking.
            </p>
          </div>
          <div className="neo-card neo-card-no-hover bg-neo-white/90 p-4">
            <p className="font-heading text-[10px] uppercase tracking-wider">Active role</p>
            <p className="font-heading text-base mt-1">{user?.role || 'VENDOR'}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: events.length, icon: HiCalendar, tone: 'bg-neo-yellow' },
          { label: 'Published', value: publishedCount, icon: HiUsers, tone: 'bg-neo-green' },
          { label: 'Pending', value: pendingCount, icon: HiClipboardList, tone: 'bg-neo-orange' },
          { label: 'Reports', value: isAdmin ? 'Admin' : 'Vendor', icon: HiCurrencyDollar, tone: 'bg-neo-blue text-white' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.tone} border-3 border-neo-black shadow-neo p-4`}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-heading text-[10px] uppercase tracking-wider">{stat.label}</p>
              <stat.icon size={18} />
            </div>
            <p className="font-heading text-2xl mt-2">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actionCards.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className={`neo-card neo-card-interactive p-5 ${card.tone}`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="font-heading text-sm uppercase tracking-wider">{card.label}</h3>
              <card.icon size={20} />
            </div>
            <p className="font-body text-sm text-neo-black/75">{card.hint}</p>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="neo-card neo-card-no-hover p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-heading text-sm uppercase tracking-wider">Latest Unread</h3>
            <span className="neo-badge bg-neo-yellow text-neo-black">{unreadNotifications.length}</span>
          </div>
          {unreadNotifications.length === 0 ? (
            <p className="font-body text-xs text-neo-black/65">No unread notifications right now.</p>
          ) : (
            <div className="space-y-2">
              {unreadNotifications.map((notif) => (
                <div key={notif._id || notif.id} className="neo-card neo-card-no-hover p-3 bg-neo-yellow/10">
                  <p className="font-body text-xs text-neo-black/85">{notif.message}</p>
                  <p className="font-body text-[10px] text-neo-black/60 mt-1">
                    {formatRelative(notif.sentAt || notif.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="neo-card neo-card-no-hover p-5">
          <h3 className="font-heading text-sm uppercase tracking-wider mb-3">Recent Notifications</h3>
          {recentNotifications.length === 0 ? (
            <p className="font-body text-xs text-neo-black/65">No recent notifications found.</p>
          ) : (
            <div className="space-y-2">
              {recentNotifications.map((notif) => (
                <div key={`recent-${notif._id || notif.id}`} className="neo-card neo-card-no-hover p-3 bg-neo-white">
                  <p className="font-body text-xs text-neo-black/85">{notif.message}</p>
                  <p className="font-body text-[10px] text-neo-black/60 mt-1">
                    {formatRelative(notif.sentAt || notif.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}